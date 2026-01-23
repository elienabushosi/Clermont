# Development vs Production Environment Setup

This document explains how the project switches between development and production environments.

## Overview

The project uses environment-specific configuration files (`.env.development` and `.env.production`) that are automatically loaded based on the `NODE_ENV` environment variable. This allows you to easily switch between development and production configurations using npm scripts.

## File Structure

```
ProjectLindero-fresh/
├── backend/
│   ├── .env.development      # Development environment variables
│   ├── .env.production        # Production environment variables
│   ├── .env                   # (Optional) Local overrides (gitignored)
│   └── lib/
│       └── supabase.js        # Loads env files based on NODE_ENV
├── frontend/
│   ├── .env.development       # Development environment variables
│   ├── .env.production        # Production environment variables
│   ├── .env.local             # (Optional) Local overrides (gitignored)
│   └── lib/
│       └── config.ts          # Centralized config using env variables
└── package.json               # Root scripts for dev/prod
```

## How It Works

### Backend

The backend uses `dotenv` to load environment-specific files:

1. **Environment Detection**: Checks `NODE_ENV` (defaults to `development`)
2. **File Loading**: Loads `.env.${NODE_ENV}` (e.g., `.env.development` or `.env.production`)
3. **Override Support**: Also loads base `.env` if it exists (for local overrides, doesn't override existing vars)

**Location**: `backend/lib/supabase.js`

```javascript
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
dotenv.config({ path: join(__dirname, '..', envFile) });
```

### Frontend

Next.js automatically loads environment files based on `NODE_ENV`:

- `NODE_ENV=development` → Loads `.env.development`
- `NODE_ENV=production` → Loads `.env.production`

**Location**: `frontend/lib/config.ts` - Centralized configuration that reads from environment variables.

All API calls use `config.apiUrl` instead of hardcoded URLs.

## Environment Variables

### Backend Environment Variables

**File**: `backend/.env.development` and `backend/.env.production`

| Variable | Development | Production | Description |
|----------|-------------|------------|-------------|
| `NODE_ENV` | `development` | `production` | Environment identifier |
| `SUPABASE_URL` | Same for both | Same for both | Supabase project URL |
| `SUPABASE_ANON_KEY` | Same for both | Same for both | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Same for both | Same for both | Supabase service role key (admin) |
| `FRONTEND_URL` | `http://localhost:3000` | `https://yourdomain.com` | Frontend application URL |
| `PORT` | `3002` | `3002` | Backend server port |
| `GEOSERVICE_API_KEY` | Same for both | Same for both | Geoservice API key |

### Frontend Environment Variables

**File**: `frontend/.env.development` and `frontend/.env.production`

| Variable | Development | Production | Description |
|----------|-------------|------------|-------------|
| `NODE_ENV` | `development` | `production` | Environment identifier |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3002` | `https://api.yourdomain.com` | Backend API URL |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Your key | Your key | Google Maps API key |

**Note**: Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. All other variables are server-side only.

## NPM Scripts

### Root Level (Monorepo)

```bash
# Development
npm run dev              # Run both frontend & backend in dev mode
npm run dev:frontend     # Run frontend only (dev)
npm run dev:backend      # Run backend only (dev)
npm run dev:all          # Run both (same as npm run dev)

# Production
npm run prod             # Run both frontend & backend in prod mode
npm run prod:frontend    # Run frontend only (prod)
npm run prod:backend     # Run backend only (prod)
npm run prod:all         # Run both (same as npm run prod)
```

### Backend Scripts

**File**: `backend/package.json`

```bash
npm run dev      # NODE_ENV=development node --watch server.js
npm run prod     # NODE_ENV=production node server.js
npm start        # NODE_ENV=production node server.js (same as prod)
```

### Frontend Scripts

**File**: `frontend/package.json`

```bash
npm run dev      # NODE_ENV=development next dev
npm run prod     # NODE_ENV=production next start
npm run build    # NODE_ENV=production next build
npm start        # NODE_ENV=production next start (same as prod)
```

## Usage Examples

### Running in Development Mode

```bash
# From root directory
npm run dev

# This will:
# 1. Set NODE_ENV=development
# 2. Backend loads backend/.env.development
# 3. Frontend loads frontend/.env.development
# 4. API calls go to http://localhost:3002
# 5. Frontend runs on http://localhost:3000
```

### Running in Production Mode

```bash
# From root directory
npm run prod

# This will:
# 1. Set NODE_ENV=production
# 2. Backend loads backend/.env.production
# 3. Frontend loads frontend/.env.production
# 4. API calls go to https://api.yourdomain.com
# 5. Frontend runs on production port
```

## Setting Up Your Environments

### Initial Setup

1. **Create environment files** (if not already created):
   - `backend/.env.development`
   - `backend/.env.production`
   - `frontend/.env.development`
   - `frontend/.env.production`

2. **Fill in the values**:
   - Copy the same Supabase credentials to both dev and prod (for now)
   - Set `FRONTEND_URL` in production to your actual domain
   - Set `NEXT_PUBLIC_API_URL` in production to your production API URL
   - Add your `SUPABASE_SERVICE_ROLE_KEY` if you have it
   - Add your `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` if you have it

### Updating Production URLs

When deploying to production:

1. **Update `backend/.env.production`**:
   ```
   FRONTEND_URL=https://your-actual-domain.com
   ```

2. **Update `frontend/.env.production`**:
   ```
   NEXT_PUBLIC_API_URL=https://api.your-actual-domain.com
   ```

## How Code Uses Environment Variables

### Backend

All backend code reads from `process.env` after `dotenv.config()` loads the appropriate file:

```javascript
// backend/lib/supabase.js
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
```

### Frontend

All frontend code uses the centralized `config` object:

```typescript
// frontend/lib/config.ts
import { config } from "@/lib/config";

// In any component or utility
fetch(`${config.apiUrl}/api/reports`)
```

**All hardcoded `http://localhost:3002` URLs have been replaced with `config.apiUrl`.**

## Local Overrides

You can create local override files that won't be committed:

- `backend/.env` - Overrides for backend (gitignored)
- `frontend/.env.local` - Overrides for frontend (gitignored)

These files are loaded after the environment-specific files, so they can override values for local testing without affecting the committed environment files.

## Security Notes

1. **Never commit `.env` files** - They're in `.gitignore`
2. **Never commit `.env.local` files** - They're in `.gitignore`
3. **Do commit `.env.development` and `.env.production`** - These contain non-sensitive defaults
4. **For production deployments**: Set environment variables in your hosting platform (Vercel, Railway, etc.) rather than committing sensitive keys

## Troubleshooting

### Backend not loading correct environment

- Check that `NODE_ENV` is set correctly in your npm script
- Verify the `.env.development` or `.env.production` file exists in `backend/` directory
- Check console logs for dotenv loading messages

### Frontend using wrong API URL

- Verify `NEXT_PUBLIC_API_URL` is set in the correct `.env` file
- Make sure `NODE_ENV` is set when running `npm run dev` or `npm run prod`
- Check browser console for the actual API URL being used
- Restart the Next.js dev server after changing `.env` files

### Environment variables not updating

- **Backend**: Restart the server after changing `.env` files
- **Frontend**: Restart the Next.js dev server (`.env` files are loaded at startup)
- Clear browser cache if using production build

## Testing the Setup

1. **Test Development**:
   ```bash
   npm run dev
   # Check that API calls go to http://localhost:3002
   ```

2. **Test Production**:
   ```bash
   npm run prod
   # Check that API calls go to your production URL
   ```

3. **Verify Environment Loading**:
   - Backend: Check server startup logs
   - Frontend: Check browser console for `config.apiUrl` value

## Summary

- **Development**: `npm run dev` → Uses `.env.development` files → `localhost:3002`
- **Production**: `npm run prod` → Uses `.env.production` files → Production URLs
- All hardcoded URLs have been replaced with environment-based configuration
- Environment switching is automatic based on `NODE_ENV` set by npm scripts
