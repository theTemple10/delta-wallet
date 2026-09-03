# Delta — Build Prompt & Reference

**Repo:** https://github.com/theTemple10/delta-wallet
**Hosting:** Backend → Render, Frontend → Vercel, DB → Supabase (Postgres)
**Event:** BMONI x Learn2Earn "Hack the Future" hackathon, exhibition [date TBD by user]

---

## 1. What this product is

Delta is a decision-support layer for a single moment: **getting paid in a foreign currency for the first time (or the fiftieth time) as a Nigerian tech worker/fellow**, and not knowing exactly where each part of it should go. It sits on top of BMONI's Embedded Wallet API. It does not replace a wallet — it makes the existing wallet, swap, and card primitives feel deliberate.

Core loop: an inflow lands in a BMONI smart wallet → Delta proposes a split across channels (spend / save / obligations) → the user reviews and edits (Guided AI mode or Manual mode) → each channel becomes a real BMONI proposal → the user approves and signs each one → a digest summarizes what happened.

**Every money-moving action is a real BMONI `proposal → approve → sign` call. Nothing auto-executes. This is a design principle, not a limitation — build the UI around visibly showing this state machine, don't hide it behind one "confirm" button.**

---

## 2. Tech stack (fixed, do not deviate)

- **Backend:** Python, FastAPI. All calls to BMONI and Groq happen server-side only — the frontend never holds either API key.
- **Frontend:** React (Vite), no Flutter, no Next.js unless the agent has a strong reason — keep it simple. **Must be a PWA** — see section 7a.
- **DB:** Postgres via Supabase.
- **AI:** Groq API (Llama or Kimi model — pick a fast, capable one for JSON-structured output).
- **Design system:** glassmorphism (frosted, translucent, blurred layers) + Material 3 / Material You dynamic color — accent color per channel type, elevation via blur not flat shadows. See section 7.

---

## 3. Environment variables

```
# BMONI
BMONI_MODE=mock              # "mock" or "live" — THE toggle. Start on mock.
BMONI_API_KEY=                # fill in once issued
BMONI_BASE_URL=                # fill in once issued (sandbox proxy base, no trailing /v1)

# Groq
GROQ_API_KEY=                 # user already has this

# DB
DATABASE_URL=                 # from Supabase project settings

# Signing (sandbox only — see section 6.4)
DEMO_WALLET_OWNER_PRIVATE_KEY= # generated locally, sandbox-only, never a real key
```

**Build the BMONI client behind an interface from day one.** In `mock` mode, it returns realistic fixture JSON matching the exact response shapes documented in section 6. In `live` mode, it makes the real HTTP calls. Every other part of the app is identical in both modes — this is what lets the build proceed tonight without the real key.

---

## 4. Data model (Postgres)

- `users` — id, bmoni_user_id (nullable until real key exists), first_name, last_name, phone, bvn, role (`self` | `recipient`), demo_persona (`bunch_dillon` | `samson_jabo`)
- `channels` — id, user_id, label (e.g. "NGN spend", "USD savings", "Family — Samson"), type (`spend`|`save`|`transfer`), target_currency, recipient_user_id (nullable)
- `inflow_events` — id, user_id, amount, currency, created_at, status
- `proposals` — id, inflow_event_id, channel_id, bmoni_proposal_id (nullable in mock), type (`SWAP`|`TRANSFER`), amount, status (`DRAFT`|`PENDING_APPROVALS`|`PENDING_SIGNATURES`|`COMPLETED`|`REJECTED`), created_at, updated_at
- `cards` — id, user_id, bmoni_card_id (nullable in mock), currency, daily_limit, single_txn_limit, status
- `digests` — id, user_id, inflow_event_id, content (text), mode (`ai`|`stats`), created_at

---

## 5. Backend endpoints (what you build)

```
POST   /users/seed                        → creates Bunch Dillon + Samson Jabo demo users
POST   /inflow                            → simulates an inflow landing, returns event id
POST   /inflow/{id}/propose-split         → calls Groq (Guided) or accepts manual input, returns channel breakdown
POST   /channels/{id}/proposal            → creates a BMONI proposal (SWAP or TRANSFER) for that channel
POST   /proposals/{id}/approve            → BMONI approve call
GET    /proposals/{id}/sign-payload       → BMONI sign-payload call
POST   /proposals/{id}/sign               → signs hashToSign locally with the demo owner key, submits
GET    /proposals/{id}                    → poll status
POST   /cards                             → issue a card against a wallet
PUT    /cards/{id}/limit                  → set spend limits
GET    /digest/{inflow_event_id}          → Groq-written summary (AI mode) or raw stats (Manual mode)
```

---

## 6. BMONI reference (self-contained — do not need internet access for this)

### 6.1 Sandbox test personas — use these exact values, nothing invented

**Bunch Dillon** (primary demo user — the one getting paid):
- firstName: `Bunch`, lastName: `Dillon`
- BVN: `95888168924`
- NIN: `63184876213`
- Phone: `+2348000000000`

**Samson Jabo** (recipient — the "family/rent" transfer channel):
- firstName: `Samson`, lastName: `Jabo`
- BVN: `22222222222`
- Phone: `+2348000000001`

Create both users with these exact fields. Mismatched names/numbers fail KYC verification in sandbox by design (not a bug).

### 6.2 User creation

```
POST /v1/users
{ "firstName": "Bunch", "lastName": "Dillon", "email": "bunch.dillon@example.com", "phoneNumber": "+2348000000000", "bvn": "95888168924" }
```

### 6.3 Transfers & swaps — proposal → approve → sign

Step 1 — create proposal:
```
POST /v1/users/{userId}/smart-wallets/{smartWalletId}/proposals
# TRANSFER
{ "proposal": { "type": "TRANSFER", "toUserId": "...", "amount": "25.00", "currency": "CNGN", "description": "Rent split" } }
# SWAP
{ "proposal": { "type": "SWAP", "fromStablecoin": "USDB", "toStablecoin": "CNGN", "fromAmount": "100.00", "slippageBps": 50 } }
```
Response: `{ "data": { "proposal": { "id": "...", "status": "PENDING_APPROVALS" } } }`

Step 2 — approve: `POST /v1/users/{userId}/smart-wallets/proposals/{proposalId}/approve` (no body)

Step 3 — fetch signing payload (poll until ready, a 404 means threshold not met yet):
`GET /v1/users/{userId}/smart-wallets/proposals/{proposalId}/sign-payload` → returns `hashToSign`

Step 4 — sign & submit:
```
POST /v1/users/{userId}/smart-wallets/proposals/{proposalId}/sign
{ "signature": "0x..." }
```

**Critical signing detail:** sign `hashToSign` using the method that signs a **raw hash**, not a message — `unsafe_sign_hash()` in Python's `eth-account` library, not `.sign()`. A message-signing method applies an EIP-191 prefix and produces a signature the backend rejects. Poll `GET .../proposals/{proposalId}` for terminal status.

Stablecoins: `USDB`, `CNGN`, `CADC`, `EURe`, `GBPe`, `MEXe`. Only USD/NGN are in scope for this build (see out-of-scope list).

### 6.4 Signing key (sandbox demo only)

Each smart wallet has an owner key that must sign proposals. For this demo, generate one deterministic test EVM keypair locally (e.g. via `eth_account.Account.create()`), store it as `DEMO_WALLET_OWNER_PRIVATE_KEY`, and use it consistently for the demo users. **This is explicitly a sandbox-only convenience — label it clearly in code comments as not a production pattern**, since real BMONI integrations sign on-device via their Flutter/React Native SDK. State this plainly if asked in the demo.

### 6.5 Card issuance

```
POST /v1/users/{userId}/cards
{ "cardName": "Delta Spend", "cardColor": "#4285F4", "currency": "NGN", "type": "virtual", "smartWalletId": "...", "nin": "63184876213" }
```
Response includes a `proposalId` (already approved on your behalf) and `signPayload` — sign it the same way as section 6.3 step 4, then `POST /v1/users/{userId}/smart-wallets/proposals/{proposalId}/sign`.

Set spend limits (this is the "enforced, not just visual" feature — protect time for this):
```
PUT /v1/users/{userId}/cards/{cardId}/set-limit
{ "totalDailyLimit": 100000, "maxSingleTransactionAmount": 50000 }
```

### 6.6 KYC activation (do this before requesting test tokens)

```
PATCH /v1/users/{userId}/kyc
{ "personalInfo": { "firstName": "Bunch", "lastName": "Dillon" } }

GET /v1/users/{userId}/kyc/bvn-lookup/95888168924   # fetch only, confirms plumbing works
GET /v1/users/{userId}/kyc/nin-lookup/63184876213   # matches against saved name — save name first

POST /v1/users/{userId}/kyc/activate                # full verification
```

### 6.7 Mock mode fixtures

Every mock response must match the real shapes above exactly — same field names, same nesting — so flipping `BMONI_MODE=live` requires zero code changes, only the env vars.

---

## 7. Design system

- Glassmorphism: frosted/blurred translucent cards, layered elevation via blur radius not drop-shadow alone.
- Material 3 dynamic color: derive an accent tint per channel type (e.g. blue-ish for USD savings, green for NGN spend, warm for family/transfer channels).
- **The proposal state machine is the hero visual.** A channel card starts semi-transparent/"unconfirmed." On approve it firms up slightly. On sign, it fully solidifies with a completion state. This should feel like the literal reason for the glass metaphor — money going from ambiguous to deliberate.
- Central "inflow" moment: an amount lands, then visually branches/splits into the channel cards (this is the core screen — spend real design effort here over anything else).
- Toggle for **Guided (AI, via Groq)** vs **Manual** mode should be visible and obvious, not buried in settings — it's a feature, not a preference.

---

## 7a. PWA requirements

Use `vite-plugin-pwa` — fastest path to a correct manifest + service worker with minimal hand-rolled config.

- **Manifest:** `name: "Delta"`, `short_name: "Delta"`, `display: "standalone"`, `theme_color` and `background_color` matching the glass/dark palette from section 7, icons at 192×192 and 512×512 plus one maskable icon.
- **Service worker strategy:** cache the app shell (static assets, JS/CSS bundle) so the app opens instantly on repeat launch. Use **network-first for all `/api/*` calls** — this app is about live money movement, never serve stale proposal/balance data from cache. No offline transaction signing; if there's no network, show a clear "you're offline" state rather than pretending to work.
- **Install prompt:** capture the `beforeinstallprompt` event and surface a custom "Install Delta" button styled to match the glass UI, rather than relying on the browser's default install banner — this is a real demo moment (installing it live on a judge's phone is a strong close).
- **No push notifications** — out of scope, adds complexity with no payoff here.
- Test installability with Chrome DevTools' Lighthouse PWA audit before the exhibition — fix anything it flags as blocking installability, ignore purely cosmetic warnings if time is short.

---

## 8. AI layer (Groq)

Two calls only:
1. **Split proposal** — given an inflow amount/currency + the user's saved channels, return a JSON array of `{channel_id, amount, one_line_reason}`. Keep the reasoning short and concrete ("rent is due in 6 days"), never a market/timing recommendation.
2. **Digest** — given the completed proposals for an inflow event, return 2–3 sentences of plain-language summary. No FX predictions, no "you should have..." — factual and warm.

Manual mode skips both calls entirely — this should be trivially demonstrable as "the AI is optional, the execution layer is not."

---

## 9. Explicitly out of scope — do not build these

- Webhooks (poll proposal/card status instead)
- Physical cards, OTP card activation
- Employer/school "no mobile app" invite flow (roadmap talking point only)
- FX "hold vs convert" predictive advice (rate *context* only — a static/cached rate display is fine, a recommendation is not)
- Any currency beyond USD and NGN
- Any Flutter code, any use of `bmoni_embedded_sdk` or `bkey_uikit` (Flutter packages) — this is a pure API/REST integration project

---

## 10. Build order

1. Backend skeleton + DB models + BMONI client interface (mock mode) + seed endpoint for the two personas
2. Groq integration (split proposal + digest), testable against mock data end-to-end
3. Frontend: inflow screen → split/channel screen (Guided + Manual) → approve/sign interaction → digest screen
4. Card issuance + limit screen
5. PWA setup (manifest, service worker, install prompt) — do this once the core screens exist, not before, so there's a real app shell to wrap
6. Deploy (Render + Vercel + Supabase), confirm mock-mode demo works end-to-end, run a Lighthouse PWA audit
7. Swap in real BMONI_API_KEY / BASE_URL, re-test each real call against the two personas
8. Rehearse: know exactly which parts are live vs seeded, and why

---

## 11. Your manual tasks (human, not the agent) — in order

1. **Get the real BMONI partner API key + sandbox base URL.** Ask your coding mentor directly — this is the one blocking dependency outside your control. Do this first thing.
2. **Once you have the key:** create the two sandbox users (Bunch Dillon, Samson Jabo) using the exact field values in section 6.1.
3. **Run KYC activation** for both (section 6.6) — confirm `bvn-lookup` returns a record, then `activate` succeeds.
4. **Submit the test-token request** (the form at the "Request test tokens" doc page) with Bunch Dillon's phone number, the moment KYC is active — don't wait, this can take up to a business day.
5. **Poll `GET /v1/users/{userId}/smart-wallets/account/balances`** until the NGN 1,000 / USD 10 credit lands.
6. **Flip `BMONI_MODE=live`** in Render's environment settings once tokens are confirmed, redeploy, and test one real SWAP and one real TRANSFER end to end.
7. **Issue one real card** and set a real limit — this is your strongest live demo moment, don't skip testing it ahead of time.
8. **Rehearse the disclosure line** for anything still seeded at showtime: what's real, what's pre-seeded, and why (the token-credit SLA is the honest, documented reason).

---

## 12. Changelog

Track significant changes here so any agent picking up the project knows what's been done.

### 2026-09-03 — Setup fixes, landing page, BMONI design alignment

**Infrastructure fixes:**
- Fixed `DATABASE_URL` typo in `.env` (had `ppostgresql://` double-p, wrong scheme) — corrected to `postgresql+asyncpg://`
- Switched from direct Supabase host (`db.*.supabase.co`) to **Supavisor pooler** (`aws-0-eu-central-1.pooler.supabase.com:5432`) because direct host is IPv6-only and the dev machine lacks IPv6
- Installed Python dependencies via `pip3 install --break-system-packages` (no venv available)
- Installed `vite-plugin-pwa` as devDependency (was missing from `package.json`)
- Ran `npm install` for frontend

**Backend bug fix:**
- `app/services/bmoni_client.py`: Moved `import asyncio` from line 127 (after class definition) to line 1 (top of file). Was using `asyncio.sleep()` in `_mock_request` before the import — worked only because methods aren't called at import time.

**Frontend — Landing page:**
- Created `src/pages/LandingPage.jsx` with BMONI-inspired design:
  - Hero section with gradient headline + CTA
  - Features grid (Multi-Currency, AI Splits, Virtual Cards)
  - "3 simple steps" onboarding flow
  - CTA section + footer with BMONI attribution
- Updated `App.jsx` routing:
  - `/` → LandingPage (public, no container/nav)
  - `/app` → InflowPage (app shell with bottom nav)
  - All app routes now under `/app/*`
- Updated `InflowPage.jsx`: navigate to `/app/split/...`
- Updated `SplitPage.jsx`: navigate to `/app/digest/...`
- Updated `DigestPage.jsx`: navigate back to `/app`
- Bottom navigation hidden on landing page, only shows on `/app/*` routes

**Frontend — Design:**
- Added landing page CSS to `index.css`: hero glow, features grid, steps grid, responsive breakpoints
- Added `.btn-lg` utility class
- Kept existing glassmorphism dark theme (already aligned with BMONI palette)

**Current route table:**
| Path | Component | Notes |
|---|---|---|
| `/` | LandingPage | Public landing, no nav |
| `/app` | InflowPage | App shell, bottom nav |
| `/app/split/:id` | SplitPage | |
| `/app/proposals` | ProposalsPage | |
| `/app/digest/:id` | DigestPage | |
| `/app/cards` | CardsPage | |

### 2026-09-03 (evening) — Seed bug fix, BMONI palette refresh, animations, assets

**Backend bug fix:**
- `app/routes/seed.py`: When users already exist in DB, the endpoint now returns the existing user IDs in the `users` array (previously returned `{"message": "..."}` with no users, causing frontend to get permanently stuck on the seed screen)

**Frontend — Seed screen fix:**
- `pages/InflowPage.jsx`: Added `error` and `seedMessage` state variables. Seed button now shows success/error feedback. Handles "already seeded" case gracefully (user IDs returned from backend). Shows "Failed to connect to server" when backend is down.

**Frontend — Design refresh (BMONI palette):**
- Fonts: Replaced `Inter` with `Poppins` (headlines) + `Raleway` (body) — matches BMONI's typography
- CSS variables updated:
  - `--accent-primary: #AF01AF` (BMONI magenta)
  - `--accent-secondary: #FDA9FF` (BMONI pink)
  - `--accent-tertiary: #7B2FBE` (deep purple)
  - `--accent-transfer` changed from `#f472b6` to `#FDA9FF` (BMONI pink)
  - `--font-heading: 'Poppins'` / `--font-body: 'Raleway'`
- Button gradient: `#667eea → #764ba2` replaced with `#AF01AF → #7B2FBE`
- Input focus ring: Changed from blue (`#667eea`) to magenta (`#AF01AF`)
- All headings and labels now use `var(--font-heading)` / `var(--font-body)`

**Frontend — Animations (CSS-only, no new deps):**
- `fadeInUp`: Hero headline, subtitle, CTA stagger in on load
- `fadeInDown`: Nav bar slides down on load
- `scaleIn`: Feature cards scale from 0.95 → 1 with stagger delays
- `float`: Feature icons gently bob up/down
- `pulseGlow`: Hero background orb breathes
- `shimmer`: Step number circles have a gradient sweep effect

**Frontend — BMONI assets:**
- Hero: Added BMONI dashboard image (`image-69.png`)
- Features: Added BMONI illustrations (wallets, globe, cards)
- Steps: Added BMONI step illustrations (`c1-1.png`, `c2-1.png`, `c3-1.png`)
- Footer: Added BMONI logo (`LOGO-White.png`)
