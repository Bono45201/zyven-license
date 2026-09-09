# Zyven License — Cloudflare Worker + D1

This package is for the `Bono45201/zyven-license` GitHub repository.

## IMPORTANT
The GitHub repository is public. NEVER upload:
- `Zyven-owner-private.pem`
- the admin key
- `ZYVEN_PRIVATE_KEY_PEM_B64`
- any license database export

Those must exist only as Cloudflare Secrets.

## Files to upload to GitHub
- `package.json`
- `wrangler.jsonc`
- `src/index.js`
- `schema.sql`
- `migrations/0001_init.sql`

## D1
The configured D1 binding is:
- binding: `DB`
- database: `zyven-license-db`
- database id: `07eeb7a5-86c3-4f23-ae5d-04ba7d4f5379`

Run `schema.sql` once in the D1 Console before testing licenses.

## Required Cloudflare secrets
- `ZYVEN_ADMIN_KEY`
- `ZYVEN_PRIVATE_KEY_PEM_B64`

Optional variable:
- `ZYVEN_PUBLIC_URL` — normally not needed while using the workers.dev URL.

The Worker implements the API expected by Zyven v4.3:
- GET `/health`
- POST `/api/license/login`
- POST `/api/license/check`
- POST `/api/license/logout`
- GET `/api/admin/licenses`
- GET `/api/admin/deleted`
- POST `/api/admin/import`
- POST `/api/admin/create`
- POST `/api/admin/licenses/{id}/status`
- DELETE `/api/admin/licenses/{id}`
- POST `/api/admin/licenses/{id}/logout`
- POST `/api/admin/logout-all`
- POST `/api/admin/licenses/{id}/reset-device`
- POST `/api/admin/licenses/{id}/expiry`
