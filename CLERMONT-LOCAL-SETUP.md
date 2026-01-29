# Clermont – Local Environment Setup

Use this guide to run Clermont locally (database + backend + frontend) and verify geo/APIs before switching to Clermont-specific API keys.

---

## 1. Open Clermont in your IDE

- **Cursor / VS Code:** File → Open Folder → choose `Clermont` (e.g. `~/Clermont` or `/Users/elienabushosi/Clermont`).
- All steps below assume your workspace is the **Clermont** repo root.

---

## 2. Environment files (dev + prod)

You need **development** and **production** env for both backend and frontend. Start with development.

### Backend

1. In `backend/`, copy the example file twice:
   ```bash
   cp env.example .env.development
   cp env.example .env.production
   ```
2. Edit **`backend/.env.development`** and set:
   - **SUPABASE_URL** – Clermont Supabase project URL (Dashboard → Settings → API).
   - **SUPABASE_ANON_KEY** – Clermont anon/public key.
   - **SUPABASE_SERVICE_ROLE_KEY** – Clermont service role key (for auth/admin).
   - **STRIPE_SECRET_KEY** – For now use Lindero’s Stripe test key so billing flows work.
   - **STRIPE_WEBHOOK_SECRET** – Lindero’s webhook secret for local testing (or leave empty if not testing webhooks).
   - **FRONTEND_URL** – `http://localhost:3000` for dev.
   - **GEOSERVICE_API_KEY** – For now use Lindero’s geo key so geo services work; replace with Clermont key later.
3. Later, fill **`backend/.env.production`** with Clermont production values (Supabase prod, Stripe prod, deployed FRONTEND_URL, etc.).

### Frontend

1. In `frontend/`, copy the example file twice:
   ```bash
   cp env.example .env.development
   cp env.example .env.production
   ```
2. Edit **`frontend/.env.development`** and set:
   - **NEXT_PUBLIC_API_URL** – `http://localhost:3002` (local backend).
   - **NEXT_PUBLIC_GOOGLE_MAPS_API_KEY** – For now use Lindero’s key so maps/autocomplete work; replace later.
   - **NEXT_PUBLIC_STRIPE_*** – For now use Lindero’s Stripe product/price IDs so checkout works; replace with Clermont Stripe later.
3. Later, fill **`frontend/.env.production`** with production API URL, Clermont Stripe IDs, etc.

---

## 3. Install dependencies

From the **Clermont** repo root:

```bash
npm run install:all
```

---

## 4. Run backend and frontend (development)

- **Backend (port 3002):**
  ```bash
  npm run dev:backend
  ```
- **Frontend (port 3000):** in a second terminal:
  ```bash
  npm run dev:frontend
  ```

Or run both from root:

```bash
npm run dev
```

---

## 5. Verify

1. **Database:** Open `http://localhost:3002/api/test-supabase` – should return success and Clermont Supabase URL.
2. **Frontend:** Open `http://localhost:3000` – landing page and login/signup should load.
3. **Geo / APIs:** Use search-address, create a report, etc. With Lindero keys in `.env.development`, geo and Lindero APIs should work. Once verified, you can add new API keys and switch to Clermont Stripe/Supabase prod.

---

## 6. Production env (later)

When you deploy (Vercel + Railway):

- **Backend (Railway):** Set the same variables as `backend/.env.production` in the Railway project (Clermont Supabase prod, Clermont Stripe, FRONTEND_URL = Clermont frontend URL).
- **Frontend (Vercel):** Set the same variables as `frontend/.env.production` (NEXT_PUBLIC_API_URL = Railway backend URL, Clermont Stripe IDs, Google Maps key).

---

## Summary

| Goal                         | Action |
|-----------------------------|--------|
| DB connection + backend     | `.env.development` in `backend/` with Clermont Supabase; run `npm run dev:backend`. |
| Frontend in dev             | `.env.development` in `frontend/` with `NEXT_PUBLIC_API_URL=http://localhost:3002`; run `npm run dev:frontend`. |
| Geo / APIs work like Lindero| Use Lindero keys in backend/frontend `.env.development` for now. |
| Switch to Clermont keys     | After verification, replace with new API keys and Clermont Stripe in both dev and prod env files. |
