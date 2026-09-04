# Delta — Deployment Guide

## Prerequisites
- GitHub repo pushed: `https://github.com/theTemple10/delta-wallet`
- Supabase database already set up
- BMONI API key ready

---

## Step 1: Deploy Backend (Render)

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect your GitHub repo `theTemple10/delta-wallet`
3. Render will detect `render.yaml` and auto-configure
4. Set these **environment variables** in Render dashboard:

| Variable | Value |
|----------|-------|
| `BMONI_MODE` | `live` |
| `BMONI_API_KEY` | `pk_a025cacbf33a_76fb864113f3540909de5b1da39cc146906e35b1c6d4d1e4` |
| `BMONI_BASE_URL` | `https://embedded.bmoni.com` |
| `GROQ_API_KEY` | `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` |
| `DATABASE_URL` | `postgresql+asyncpg://qitemtwxsbsmqgmizcah:FLKD7WGck5Dlgrfh@aws-0-eu-central-1.pooler.supabase.com:5432/postgres` |
| `DEMO_WALLET_OWNER_PRIVATE_KEY` | `f279f375026d493fc7d745794007daf3f6ac771144d4890b49d5ef229751239e` |

5. Click **Deploy**
6. Once deployed, note your backend URL (e.g., `https://delta-wallet-api.onrender.com`)
7. Test: visit `https://delta-wallet-api.onrender.com/health` — should return `{"status":"ok"}`

---

## Step 2: Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import GitHub repo `theTemple10/delta-wallet`
3. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add **Environment Variable:**

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://delta-wallet-api.onrender.com` (your Render URL from Step 1) |

5. Click **Deploy**
6. Once deployed, visit your Vercel URL

---

## Step 3: Test End-to-End

1. Open your Vercel URL
2. Click **Get Started** → **Seed Demo Users**
3. Enter an amount → **Simulate Inflow**
4. Watch the waterfall split across priority-ranked channels
5. **Approve & Sign** each channel
6. View the digest

---

## Troubleshooting

### "Failed to connect to server"
- Backend isn't deployed yet or wrong URL. Check `VITE_API_URL`.

### "User not found" after seed
- Tables were recreated on backend restart. Just seed again.

### PWA not installable
- Must be served over HTTPS (Vercel handles this automatically).

### Database connection errors
- Make sure `DATABASE_URL` uses the **pooler** URL, not the direct host.
