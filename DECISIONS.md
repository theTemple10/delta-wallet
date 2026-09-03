# Decisions

Why we did it this way. Read this before making changes so you understand the reasoning behind the current setup.

---

## Architecture

### Why FastAPI + React/Vite (not Next.js, not Flutter)

The build prompt says "no Flutter, no Next.js unless the agent has a strong reason." FastAPI is the simplest Python async framework for a BMONI API wrapper — it handles async/await natively, which matters because every BMONI call is I/O-bound. React + Vite is the lightest React setup with PWA support via `vite-plugin-pwa`. Next.js would add SSR complexity with no benefit for a mobile-first PWA.

### Why Supabase pooler over direct connection

Supabase's direct database host (`db.*.supabase.co`) resolves to an **IPv6-only** address. Most dev machines (including ours) only have IPv4. The Supavisor pooler (`aws-0-*.pooler.supabase.com:5432`) always has an IPv4 address and is available on every plan tier. The tradeoff is that the pooler username format changes (`postgres.PROJECT_REF` instead of just `postgres`) and transaction mode doesn't support prepared statements — but SQLAlchemy async works fine with session mode on port 5432.

### Why mock-first BMONI client

We don't have the real API key yet (hackathon timeline). The BMONI client (`bmoni_client.py`) has a `BMONI_MODE` toggle that returns realistic fixture JSON in mock mode. Every other part of the app is identical in both modes — the mock responses match the exact response shapes from the BMONI docs. This lets the full flow work end-to-end without the real key. When the key arrives, we flip one env var.

### Why SQLAlchemy async + asyncpg

BMONI's API is async (HTTP calls via httpx). If we used synchronous SQLAlchemy, every DB call would block the event loop. `asyncpg` is the fastest async Postgres driver for Python. The tradeoff is that all DB access must go through `async/await` and `Depends(get_db)` — but FastAPI makes this natural.

---

## Design

### Why BMONI palette (#AF01AF magenta, not the original blue-purple)

The original palette used `#667eea → #764ba2` (blue → purple gradient). We switched to BMONI's actual colors after analyzing bmoni.com:
- `#AF01AF` — BMONI's primary magenta (used for active states, CTAs)
- `#FDA9FF` — BMONI's pink accent (links, highlights, transfer channel)
- `#7B2FBE` — deeper purple for gradient depth

This makes Delta feel like it belongs in the BMONI ecosystem rather than being a separate product. The glassmorphism dark theme was already aligned (near-black backgrounds, frosted glass cards).

### Why Poppins + Raleway (not Inter)

BMONI's website uses **Poppins** for headlines and **Raleway** for body text (confirmed via Google Fonts imports in their source). We switched from Inter to match. Poppins is geometric and bold — good for fintech headlines. Raleway is elegant and readable — good for body copy.

### Why CSS-only animations (no Framer Motion, no GSAP)

We kept animations CSS-only (`@keyframes`) to avoid adding JS animation dependencies. The animations are:
- `fadeInUp` / `fadeInDown` — entrance effects for content
- `scaleIn` — feature cards appear with a subtle scale
- `float` — feature icons gently bob
- `pulseGlow` — hero background orb breathes
- `shimmer` — step numbers have a gradient sweep

These are lightweight, performant, and don't require JS runtime. Framer Motion would add ~30kb for animations that CSS handles fine.

### Why images from bmoni.com (not local assets)

For the hackathon, we reference BMONI's hosted images directly (hero, feature illustrations, step images, logo). This is fast to implement and keeps the repo small. For production, these should be downloaded to `frontend/public/` and served locally — but for a demo, hotlinking is fine.

---

## Routing

### Why `/` for landing, `/app/*` for the app

The landing page is a marketing/onboarding screen — it should be publicly accessible, have no app chrome (bottom nav, header), and feel like a website. The app screens are a different context — they need the nav bar, the header, and the container layout. Splitting them at `/` vs `/app/*` makes this clean:
- `/` → `LandingPage` (no wrapper)
- `/app` → `InflowPage` (inside `<div className="container">` with header + nav)
- `/app/*` → other pages (same wrapper)

The bottom nav only renders when `location.pathname.startsWith('/app')`.

### Why bottom nav has 3 items (not 5)

We kept the nav minimal: Inflow, Proposals, Cards. Digest is accessed from the split flow, not as a standalone destination. This matches mobile fintech patterns — fewer tabs = less cognitive load.

---

## Data Flow

### Why proposal → approve → sign (not one-click)

This is BMONI's design principle, not ours. Every money-moving action goes through three distinct steps:
1. **Create proposal** — defines what the transaction does
2. **Approve** — user confirms the intent
3. **Sign** — cryptographic signature authorizes execution

Hiding this behind one "confirm" button would defeat the purpose of the hackathon demo. The UI should visibly show each state transition — this is the "glassmorphism state machine" the build prompt describes (cards go from semi-transparent to solid as they progress through states).

### Why Groq for AI (not OpenAI, not local)

Groq's API is fast (sub-second responses), free for the hackathon, and supports JSON-structured output. We use `llama-3.1-8b-instant` for both split proposals and digests. The fallback on error is an equal split across channels — the app never breaks if Groq is down.

---

## Security

### Why .env is gitignored

The `.env` file contains the Supabase password and Groq API key. It was accidentally committed in an earlier commit (`ee1c870`). Before pushing to a public repo, these credentials must be rotated. The `.gitignore` now excludes `.env` files. The `.env.example` template has placeholder values.

### Why DEMO_WALLET_OWNER_PRIVATE_KEY is sandbox-only

In production, BMONI signs proposals on-device via their Flutter/React Native SDK. For this hackathon demo, we generate a test EVM keypair locally and use `unsafe_sign_hash()` to sign sandbox proposals. This key has no real value — it's explicitly labeled in code comments as not a production pattern. If asked during the demo, state this plainly.

### Why pooler username is `postgres.PROJECT_REF`

Supabase's connection pooler (Supavisor) is multi-tenant. The username format `postgres.<project-ref>` disambiguates which project the connection targets. The direct connection uses just `postgres` because it's already scoped to the project's database instance.

---

## Tradeoffs (what's deferred and why)

| Deferred | Why | When to do it |
|---|---|---|
| PWA icons (192x192, 512x512) | Need actual design assets, not generated placeholders | Before exhibition |
| Deploy config (Render/Vercel) | Can't deploy until mock flow works end-to-end locally | After API key arrives |
| Push notifications | Out of scope per build prompt — adds complexity with no demo payoff | Never |
| Offline transaction signing | Out of scope — if no network, show "you're offline" state | Never |
| Error toasts in frontend | Basic error state exists now, but no toast library | Nice-to-have |
| Loading skeletons | All pages have spinner, but no skeleton placeholders | Nice-to-have |
| Local asset hosting for BMONI images | Hotlinking works for demo, but should be本地化 for production | Before exhibition |

---

## Git history context

| Commit | What | Why |
|---|---|---|
| `b7a247f` | Initial frontend structure | Scaffold: pages, routing, API service |
| `ee1c870` | Seed + split functionality | Backend routes, BMONI mock client, Groq integration |
| `728c6c2` | Landing page + BMONI design | New LandingPage, route restructure (`/app/*`), BMONI palette |
| `560dff9` | .gitignore + CONTRIBUTING.md | Security (.env removal), collaboration guide |
| `8cb1560` | Seed bug fix + animations + assets | Fixed stuck-on-seed, added BMONI images, CSS animations |
