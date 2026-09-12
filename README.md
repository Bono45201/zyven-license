# Zyven License — Cloudflare Worker + D1

Multi-product license server for Zyven applications.

## Products
Currently supported product IDs:
- `ZYVEN-SOUND-TOOL`
- `ZYVEN-GP-TOOL`

Sound Tool is the current default product. GP Tool is reserved for the new GP Tool.

## IMPORTANT
The GitHub repository is public. NEVER upload:
- `Zyven-owner-private.pem`
- the admin key
- `ZYVEN_PRIVATE_KEY_PEM_B64`
- any license database export

Those must exist only as Cloudflare Secrets.

## Required Cloudflare secrets
- `ZYVEN_ADMIN_KEY`
- `ZYVEN_PRIVATE_KEY_PEM_B64`

Optional variable:
- `ZYVEN_PUBLIC_URL`

## D1
Configured binding:
- binding: `DB`
- database: `zyven-license-db`
- database id: `07eeb7a5-86c3-4f23-ae5d-04ba7d4f5379`

### Existing database upgrade
Run `migrations/0002_products.sql` once in the Cloudflare D1 Console before deploying the v5 Worker.

The migration adds a `product` column to active and deleted licenses and marks existing old rows as `ZYVEN-LEGACY`.

### Fresh database
Use `schema.sql` for a brand-new database.

## API
Public client endpoints:
- GET `/health`
- POST `/api/license/login`
- POST `/api/license/check`
- POST `/api/license/logout`

Client login/check requests now include:
- `licenseKey`
- `deviceId`
- `product`

For Zyven Sound Tool use:
- `product: "ZYVEN-SOUND-TOOL"`

Admin endpoints:
- GET `/api/admin/licenses?product=ZYVEN-SOUND-TOOL`
- GET `/api/admin/deleted?product=ZYVEN-SOUND-TOOL`
- POST `/api/admin/import`
- POST `/api/admin/create`
- POST `/api/admin/licenses/{id}/status`
- DELETE `/api/admin/licenses/{id}`
- POST `/api/admin/licenses/{id}/logout`
- POST `/api/admin/logout-all`
- POST `/api/admin/licenses/{id}/reset-device`
- POST `/api/admin/licenses/{id}/expiry`

`POST /api/admin/create` accepts a `product` field. If omitted, it defaults to `ZYVEN-SOUND-TOOL`.

Supported statuses:
- `ACTIVE`
- `PAUSED`
- `REVOKED`

Pause and revoke invalidate the active session immediately.
