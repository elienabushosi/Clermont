# Clermont – Platform Context & Next Steps

Use this document to give the Clermont IDE (or a new chat) context about the platform, the transition from Lindero, current dev status, and production next steps.

---

## What is Clermont?

**Clermont** is a separate product/project built from the same codebase as **Lindero**. It is a feasibility and research platform that provides:

- **Address search** and report generation
- **Geo services** (zoning, FEMA flood, transit, tax lot, etc.) via external APIs
- **Organizations, users, teams** (Supabase auth + custom app users)
- **Billing** via Stripe (subscriptions, seats, webhooks)
- **Reports** stored in Supabase with sources (Zola, zoning resolution, etc.)

The app is a **monorepo**: `frontend` (Next.js) and `backend` (Node/Express). Backend talks to Supabase, Stripe, and geo APIs; frontend talks to the backend API and uses Google Maps for address autocomplete and maps.

---

## Transition from Lindero to Clermont

- **Lindero** = original project (repo: `elienabushosi/Lindero`, Supabase/Stripe/APIs for Lindero).
- **Clermont** = new project created from the same codebase:
  - New GitHub repo: **`elienabushosi/Clermont`**
  - New Supabase project: **Clermont** (schema applied via `backend/schema.sql`)
  - Same codebase; separate env and config for Clermont (Supabase, Stripe, APIs).

Development setup for Clermont was done in a separate IDE:

- **Backend:** `.env.development` (and optionally `.env.local`) – Clermont Supabase, Lindero Stripe dev/sandbox, Lindero geo keys for now.
- **Frontend:** `.env.development` and `.env.local` – `NEXT_PUBLIC_API_URL=http://localhost:3002`, Google Maps API key, GEO Service API key, Stripe dev.
- **Local dev:** Backend on port 3002, frontend on port 3000; Stripe dev/sandbox and dev webhooks work; Supabase is connected to the **Clermont** database.

So in this repo, **dev is fully set up and working**. The next phase is **production**: deploy backend and frontend, then switch to production Stripe and production webhooks.

---

## What’s Done (Dev)

- [x] Clermont repo created and filled from Lindero codebase
- [x] Clermont Supabase project created; `schema.sql` run (app tables)
- [x] Backend and frontend dev env files (`.env.development`, `.env.local` where used)
- [x] Database connection to Clermont DB
- [x] Backend and frontend running locally (backend 3002, frontend 3000)
- [x] Google Maps API and GEO Service API keys working (e.g. via `.env.local`)
- [x] Stripe dev/sandbox and dev webhooks working
- [x] Supabase (Clermont) auth and data working

---

## Next Steps (Production)

Use this as a checklist. Order can be adjusted (e.g. commit first, then Railway/Vercel).

### 1. Commit recent dev setup

- Commit any uncommitted changes (env examples, setup docs, etc.).  
- **Do not commit** `.env.development`, `.env.production`, or `.env.local` (they are gitignored).  
- Example: commit `backend/env.example`, `frontend/env.example`, `CLERMONT-LOCAL-SETUP.md`, `README-CLERMONT-CONTEXT.md`, and any other setup docs or non-secret config.

### 2. Railway (backend)

- Create a **Railway** project for Clermont (or use an existing one).
- Connect the project to GitHub repo **`elienabushosi/Clermont`**.
- Set **root directory** to `backend` (or the directory that contains `server.js`).
- Set **start command** (e.g. `node server.js` or `npm start`) and **build** if needed.
- Add **production environment variables** (same names as backend `.env.production`):
  - `NODE_ENV=production`
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Clermont Supabase)
  - `STRIPE_SECRET_KEY` (Clermont Stripe **live** key when ready)
  - `STRIPE_WEBHOOK_SECRET` (Clermont Stripe **production** webhook secret; add after creating prod webhook)
  - `FRONTEND_URL` = production frontend URL (from Vercel, e.g. `https://clermont.vercel.app` or your custom domain)
  - `PORT` (Railway often sets this; keep default if so)
  - `GEOSERVICE_API_KEY` (production geo key when you switch)
- Deploy and note the **backend URL** (e.g. `https://clermont-api.up.railway.app`).  
- This URL becomes **`NEXT_PUBLIC_API_URL`** for the frontend in production.

### 3. Get `NEXT_PUBLIC_API_URL` (frontend production)

- After Railway deploy: **NEXT_PUBLIC_API_URL** = your Railway backend URL (e.g. `https://clermont-api.up.railway.app`).
- No trailing slash. Set this in **Vercel** (and in `frontend/.env.production` if you build locally for prod).

### 4. Vercel (frontend)

- Create a **Vercel** project for Clermont.
- Connect the project to GitHub repo **`elienabushosi/Clermont`**.
- Set **root directory** to `frontend` (Next.js app).
- Add **production environment variables**:
  - `NEXT_PUBLIC_API_URL` = Railway backend URL (from step 3)
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (production Google Maps key if different from dev)
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = Clermont Stripe **live** publishable key (e.g. `pk_live_...`)
  - Stripe product/price IDs for production if you use them in frontend env:  
    `NEXT_PUBLIC_STRIPE_PRODUCT_ID`, `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID`, `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID` (Clermont Stripe live product/prices when ready)
- Deploy and note the **frontend URL** (e.g. `https://clermont.vercel.app` or custom domain).  
- This URL is **FRONTEND_URL** for the backend (Railway) and for Stripe (checkout success/cancel, etc.).

### 5. Get frontend URL

- From Vercel: the deployed app URL (e.g. `https://clermont.vercel.app`).
- Use it as:
  - **FRONTEND_URL** in Railway (backend) so redirects and links point to production.
  - **Stripe** dashboard: set it in product/checkout success/cancel URLs if needed.

### 6. Stripe production keys and webhooks

- **Stripe Dashboard** → switch to **Live** mode for Clermont (or use a separate Stripe account for Clermont).
- **Keys:**
  - **Backend (Railway):** `STRIPE_SECRET_KEY` = live secret key (e.g. `sk_live_...`).
  - **Frontend (Vercel):** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = live publishable key (e.g. `pk_live_...`).
- **Product/Price IDs:** If frontend or backend use fixed product/price IDs, create Clermont live products/prices and set:
  - Frontend: `NEXT_PUBLIC_STRIPE_PRODUCT_ID`, `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID`, `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID`.
  - Backend: same IDs if read from env; otherwise ensure backend uses Stripe API with live keys.
- **Production webhooks:**
  - Stripe Dashboard → Developers → Webhooks → Add endpoint.
  - **Endpoint URL:** `https://<your-railway-backend-url>/api/billing/webhook` (your Railway backend URL + `/api/billing/webhook`).
  - Select **live** mode and the events you need (e.g. `customer.subscription.*`, `invoice.*`, etc. – match what Lindero uses).
  - Copy the **signing secret** (`whsec_...`) and set it in Railway as **`STRIPE_WEBHOOK_SECRET`** (production).

### 7. Other production env (recap)

- **Backend (Railway):** Clermont Supabase (prod), Clermont Stripe live key + prod webhook secret, FRONTEND_URL, GEOSERVICE_API_KEY (prod when you switch).
- **Frontend (Vercel):** NEXT_PUBLIC_API_URL (Railway), NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, and Stripe product/price IDs if used.
- **CORS:** If the backend restricts origins, add the Vercel frontend URL (and custom domain if any) to the allowed list.

### 8. Optional / later

- **Custom domains:** Point domain to Vercel (frontend) and optionally to Railway (backend); update FRONTEND_URL and Stripe/Vercel config.
- **Supabase production:** You’re already using Clermont Supabase; if you add separate “prod” Supabase project later, point Railway to that.
- **Geo/API keys:** Replace dev geo keys with production keys and set them in Railway when ready.
- **Monitoring / logging:** Use Railway and Vercel logs; add error tracking (e.g. Sentry) if needed.

---

## Quick reference – env vars

| Where        | Variable                             | Dev (local)              | Production                          |
|-------------|--------------------------------------|--------------------------|-------------------------------------|
| Backend     | SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY | Clermont Supabase        | Clermont Supabase                   |
| Backend     | STRIPE_SECRET_KEY                    | Lindero dev (sandbox)    | Clermont Stripe live                |
| Backend     | STRIPE_WEBHOOK_SECRET                | Lindero dev webhook      | Clermont prod webhook               |
| Backend     | FRONTEND_URL                         | http://localhost:3000    | Vercel frontend URL                 |
| Backend     | GEOSERVICE_API_KEY                   | Lindero key (for now)    | Clermont/prod key when ready        |
| Frontend    | NEXT_PUBLIC_API_URL                  | http://localhost:3002    | Railway backend URL                 |
| Frontend    | NEXT_PUBLIC_GOOGLE_MAPS_API_KEY      | Dev key                  | Prod key if different               |
| Frontend    | NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY   | Dev publishable (if used)| Clermont Stripe live publishable    |
| Frontend    | NEXT_PUBLIC_STRIPE_* (product/price) | Lindero dev IDs          | Clermont live product/price IDs     |

---

## Repo structure (reminder)

- **`backend/`** – Node/Express API, Supabase, Stripe, geo agents; env: `.env.development`, `.env.production` (and `.env` if used).
- **`frontend/`** – Next.js app; env: `.env.development`, `.env.production`, `.env.local` (Next.js also loads these by convention).
- **`backend/schema.sql`** – App-only schema for Clermont (already run on Clermont Supabase).
- **`CLERMONT-LOCAL-SETUP.md`** – Local dev setup and env copy instructions.
- **`backend/env.example`**, **`frontend/env.example`** – Templates; copy to `.env.development` / `.env.production` and fill (do not commit the filled files).

You can hand this README to the Clermont IDE or paste it into a new chat so it has full context on the platform, the Lindero → Clermont transition, and the next steps above.
