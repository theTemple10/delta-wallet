# Contributing to Delta

Thanks for joining the build. This guide covers everything you need to get productive fast.

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/theTemple10/delta-wallet.git
cd delta-wallet

# Backend
cd backend
python3 -m venv .venv          # if you have python3-venv
source .venv/bin/activate
pip install -r requirements.txt
# OR if no venv: pip3 install --break-system-packages -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Environment setup

Copy the env template and fill in your values:

```bash
cp backend/.env.example backend/.env
```

**Required variables:**

| Variable | Where to get it | Notes |
|---|---|---|
| `DATABASE_URL` | Supabase dashboard → Settings → Database → Connect (Session mode) | Use the **pooler** URL (`aws-0-*.pooler.supabase.com:5432`), not the direct host (IPv6-only) |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) | Free tier works fine |
| `BMONI_API_KEY` | Ask mentor | Not needed for mock mode |
| `BMONI_BASE_URL` | Ask mentor | Not needed for mock mode |
| `DEMO_WALLET_OWNER_PRIVATE_KEY` | Generate locally | See section below |

**Generate a demo signing key (mock mode only):**

```bash
python3 -c "from eth_account import Account; print(Account.create().key)"
```

Paste the output into `DEMO_WALLET_OWNER_PRIVATE_KEY` in `.env`.

### 3. Run

```bash
# Terminal 1 — Backend
cd backend
uvicorn main:app --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open `http://localhost:5173` — you should see the landing page.

---

## Project Structure

```
delta-wallet/
├── backend/
│   ├── main.py                    # FastAPI entry point, CORS, startup
│   ├── .env                       # Secrets (gitignored — never commit)
│   ├── .env.example               # Template
│   ├── requirements.txt           # Python deps
│   └── app/
│       ├── config.py              # Pydantic settings (reads .env)
│       ├── db/
│       │   └── database.py        # SQLAlchemy async engine + session
│       ├── models/
│       │   └── models.py          # All 6 SQLAlchemy models + enums
│       ├── routes/
│       │   ├── seed.py            # POST /users/seed
│       │   ├── inflow.py          # POST /inflow/inflow
│       │   ├── split.py           # POST /inflow/{id}/propose-split
│       │   ├── channels.py        # GET/POST /channels
│       │   ├── proposals.py       # CRUD for proposals (create, approve, sign)
│       │   ├── cards.py           # Issue cards, set limits
│       │   └── digest.py          # GET /digest/{id}
│       └── services/
│           ├── bmoni_client.py    # BMONI API wrapper (mock + live)
│           └── groq_service.py    # Groq AI (split proposals + digests)
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx               # React entry point
│   │   ├── App.jsx                # Router, nav, offline/install banners
│   │   ├── index.css              # All styles (glassmorphism + landing)
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx    # /  — Public landing page
│   │   │   ├── InflowPage.jsx     # /app — Seed users, simulate inflow
│   │   │   ├── SplitPage.jsx      # /app/split/:id — AI/manual split flow
│   │   │   ├── ProposalsPage.jsx  # /app/proposals — Channel list
│   │   │   ├── DigestPage.jsx     # /app/digest/:id — AI/stats summary
│   │   │   └── CardsPage.jsx      # /app/cards — Virtual card management
│   │   └── services/
│   │       └── api.js             # Axios client, all API functions
│   ├── vite.config.js             # Vite + PWA plugin
│   └── package.json
│
├── delta-build-prompt.md          # Full product spec (read this first)
├── CONTRIBUTING.md                # This file
├── DECISIONS.md                   # Why we did it this way (read before making changes)
└── to_run.md                      # Quick-run instructions
```

---

## Architecture Overview

### Data Flow

```
User lands on / → clicks "Get Started" → /app
  → Seeds demo users (Bunch Dillon + Samson Jabo)
  → Enters amount + currency + AI/Manual mode
  → Simulates inflow → navigates to /app/split/:id
  → AI (Groq) proposes split across channels
  → User reviews → clicks "Approve & Sign" on each
  → Backend: createProposal → approveProposal → signProposal
  → Each step is a real BMONI API call (or mock)
  → All done → view digest at /app/digest/:id
```

### BMONI Mock vs Live

The app runs in **mock mode** by default (`BMONI_MODE=mock`). The BMONI client (`bmoni_client.py`) returns realistic fixture JSON without hitting the real API. To switch to live:

1. Set `BMONI_MODE=live` in `.env`
2. Fill in `BMONI_API_KEY` and `BMONI_BASE_URL`
3. The client switches automatically — no code changes needed

### Database

Postgres via Supabase. SQLAlchemy async with `asyncpg`. Tables auto-create on startup (`Base.metadata.create_all`). Six tables: `users`, `channels`, `inflow_events`, `proposals`, `cards`, `digests`.

---

## Routes Reference

### Frontend Routes

| Path | Page | Access |
|---|---|---|
| `/` | LandingPage | Public |
| `/app` | InflowPage | App |
| `/app/split/:inflowEventId` | SplitPage | App |
| `/app/proposals` | ProposalsPage | App |
| `/app/digest/:inflowEventId` | DigestPage | App |
| `/app/cards` | CardsPage | App |

### Backend API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/users/seed` | Create demo users + channels |
| POST | `/inflow/inflow` | Simulate incoming payment |
| POST | `/inflow/{id}/propose-split` | AI or manual split |
| GET | `/channels/{user_id}` | List user channels |
| POST | `/channels/{channel_id}/proposal` | Create BMONI proposal |
| POST | `/proposals/{id}/approve` | Approve proposal |
| GET | `/proposals/{id}/sign-payload` | Get hash to sign |
| POST | `/proposals/{id}/sign` | Sign and complete |
| GET | `/proposals/{id}` | Get proposal status |
| POST | `/cards` | Issue virtual card |
| PUT | `/cards/{id}/limit` | Set spend limits |
| GET | `/digest/{inflow_event_id}?mode=ai\|stats` | Get digest |
| GET | `/health` | Health check |

---

## Working on a Feature

### Branch naming

```
feature/short-description    # new features
fix/short-description        # bug fixes
```

Example: `feature/card Issuance UI`, `fix/proposal-status-polling`

### What to work on

Check `delta-build-prompt.md` section 10 (Build order) for priorities. Current status:

- [x] Backend skeleton + DB models + BMONI mock client
- [x] Groq integration (split + digest)
- [x] Frontend: inflow → split → approve/sign → digest
- [x] Landing page (BMONI assets, animations, palette)
- [x] Card issuance + limits
- [x] Seed wallet bug fix (re-seed recovery, error feedback)
- [x] BMONI design alignment (Poppins/Raleway, #AF01AF palette)
- [ ] PWA icons (need 192x192 and 512x512 PNGs in `frontend/public/`)
- [ ] Deploy config (Render backend + Vercel frontend)
- [ ] Real BMONI key integration (waiting on API key)
- [ ] Error toasts (replace console.error with user-visible feedback)

**Good first issues for new contributors:**
- Create PWA icons (`pwa-192x192.png` and `pwa-512x512.png` in `frontend/public/`)
- Write the Vercel/Render deploy config
- Add error toasts (show user-visible errors instead of console.error)
- Add loading skeletons to pages
- Read `DECISIONS.md` before making architectural or design changes

### Code conventions

**Before making changes**, read `DECISIONS.md` to understand why things are set up the way they are.

**Backend (Python/FastAPI):**
- All routes go in `app/routes/`
- Use `Depends(get_db)` for database sessions
- BMONI calls go through `bmoni_client` (never call BMONI directly from routes)
- Keep mock responses matching real BMONI response shapes exactly

**Frontend (React/Vite):**
- Pages go in `src/pages/`
- API functions go in `src/services/api.js`
- Use existing CSS classes (`.glass-card`, `.btn-primary`, `.input`, etc.)
- Keep inline styles minimal — prefer CSS classes
- Use `localStorage` for client state (`delta_user_id`)
- All app routes are under `/app/*`

### Before opening a PR

1. Test your feature end-to-end
2. Make sure the frontend builds: `cd frontend && npm run build`
3. Make sure the backend starts without errors: `cd backend && uvicorn main:app --reload`
4. Run the linter: `cd frontend && npm run lint`
5. Write a clear PR description explaining what changed and why

---

## Environment Variables Reference

```bash
# BMONI — start with mock, switch to live for demo
BMONI_MODE=mock              # "mock" or "live"
BMONI_API_KEY=               # from mentor (not needed in mock)
BMONI_BASE_URL=               # from mentor (not needed in mock)

# Groq — AI splits and digests
GROQ_API_KEY=                # from console.groq.com

# Database — use Supabase pooler URL (NOT direct host)
DATABASE_URL=postgresql+asyncpg://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres

# Signing — sandbox only, never a real key
DEMO_WALLET_OWNER_PRIVATE_KEY=  # generate with eth_account.Account.create()
```

---

## Common Issues

### "Network is unreachable" connecting to Supabase

Your Supabase direct host is IPv6-only. Use the **pooler** connection string instead:
- Go to Supabase Dashboard → Settings → Database → **Connect**
- Use the **Session mode** URL (`aws-0-*.pooler.supabase.com:5432`)
- Username format: `postgres.PROJECT_REF` (not just `postgres`)

### Frontend won't start — "Cannot find package 'vite-plugin-pwa'"

```bash
cd frontend && npm install vite-plugin-pwa --save-dev
```

### Backend crashes on startup — "No module named 'fastapi'"

```bash
# Option A: with venv
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Option B: without venv
pip3 install --break-system-packages -r requirements.txt
```

### "asyncio" error in mock mode

Make sure `import asyncio` is at the **top** of `bmoni_client.py`, not at the bottom.

---

## Deployment (when ready)

| Service | What | Notes |
|---|---|---|
| **Supabase** | Postgres database | Already set up. Pooler URL for runtime. |
| **Render** | Backend (FastAPI) | Set env vars in Render dashboard. Use `uvicorn main:app` as start command. |
| **Vercel** | Frontend (React/Vite) | Framework preset: Vite. Root dir: `frontend`. |

Set `BMONI_MODE=live` and real API keys on Render **after** testing mock mode end-to-end.

---

## Questions?

Ask in the team chat or open a GitHub issue. For BMONI-specific questions, check the API docs in `delta-build-prompt.md` section 6.
