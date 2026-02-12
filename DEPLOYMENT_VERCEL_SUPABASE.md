# Vercel + Supabase Migration

## What is already changed in this repo

- Added Vercel API entrypoint: `api/[...path].ts`
- Updated backend routing bootstrap to support serverless mode (no WebSocket attach required): `server/routes.ts`
- Kept local Node server flow for development: `server/index.ts`
- Added Supabase-compatible DB env support (`SUPABASE_DB_URL` alias): `server/db.ts`
- Added DEV auth fallback when Replit OIDC is not configured: `server/replitAuth.ts`
- Switched Live View from WebSocket dependency to polling (works on Vercel serverless): `client/src/pages/LiveView.tsx`
- Added Vercel config and env template: `vercel.json`, `.env.example`

## Required services

1. Vercel
- Host frontend and API function.
- Import this repo and deploy from the `Outlet-Auctions` root.

2. Supabase
- Create a project.
- Use Supabase Postgres connection string as `DATABASE_URL` (or `SUPABASE_DB_URL`).
- Run schema push from your machine or CI: `npm run db:push`.

3. Stripe (if payments stay enabled)
- Required env vars: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`.
- Set `ADMIN_BATCH_SECRET` for protected batch charge endpoint.

4. UPC API provider (optional but used by scan flow)
- Set `UPCITEMDB_API_KEY` for higher limits.

## Strongly recommended replacements for production

1. Auth provider
- Current fallback is `AUTH_MODE=dev`, intended only to keep migration moving.
- For production, replace Replit auth with Supabase Auth and JWT verification in API middleware.

2. Object storage
- Current object storage integration is Replit-specific (`server/replit_integrations/object_storage`).
- Replace with Supabase Storage, Cloudflare R2, or S3-compatible storage.

3. Scheduled jobs
- Batch payment endpoint exists, but scheduling must be external.
- Use Vercel Cron, GitHub Actions cron, or Supabase scheduled jobs to call `/api/admin/process-batch-payments`.

## Vercel environment variables (minimum)

- `DATABASE_URL`
- `SESSION_SECRET`
- `AUTH_MODE` (`dev` for now)
- `DEV_USER_ID`
- `DEV_USER_EMAIL`
- `STRIPE_SECRET_KEY` (if payments enabled)
- `STRIPE_PUBLISHABLE_KEY` (if payments enabled)
- `ADMIN_BATCH_SECRET`
- `UPCITEMDB_API_KEY` (optional but recommended)

## Deployment steps

1. Install and verify locally
- `npm ci`
- `npm run check`

2. Push schema to Supabase
- `npm run db:push`

3. Deploy to Vercel
- Connect repo.
- Set root directory to `Outlet-Auctions`.
- Add env vars from `.env.example`.
- Deploy.

4. Post-deploy check
- Open `/` and confirm SPA routes work.
- Hit `/api/staff/auctions` and `/api/shelves`.
- Validate scan flow and live view polling updates.

## Cost controls to keep spend low

1. Keep Vercel Hobby/low tier until traffic justifies upgrade.
2. Use Supabase pooled connection string to reduce DB connection pressure.
3. Keep polling interval conservative (currently 5s in live view).
4. Move heavy exports/batch processing to scheduled jobs, not user requests.
