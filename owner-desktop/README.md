# Zyven Owner Manager — Unified UI

Windows owner console for the Zyven license server.

This desktop app is intentionally separate from customer programs. It connects to the existing Cloudflare Worker admin API and never embeds the admin key in the source or packaged application.

## Products

- `ZYVEN-SOUND-TOOL`
- `ZYVEN-GP-TOOL`

## Included owner functions

- Connect to the Zyven Cloudflare license server
- Dashboard with real server-derived totals
- Create new server-generated license keys
- Search and filter active licenses
- View permanently deleted license records
- Activate, pause and revoke
- Reset HWID / device binding
- Force logout one license
- Force logout all sessions for one product or all products
- Set expiry to `LIFETIME` or `yyyy-MM-dd`
- Permanently delete a license
- Locally encrypted full-key vault for keys created on this Owner PC
- Real local owner action log
- Automatic refresh
- Compact license table mode
- Destructive-action confirmations

## Security

- The admin key is held in Electron main-process memory only.
- The admin key is never written to disk.
- Customer full keys created by this app are stored with Electron `safeStorage` encryption so the Owner app can show/copy them later on the same Windows account.
- The server remains the source of truth for license status, product, HWID, expiry and session state.
- No private signing key is included in this application.

## Development

Requirements:

- Node.js 20+
- npm
- Windows for final portable EXE packaging

Run:

```bat
npm install
npm run dev
```

Build the UI:

```bat
npm run build
```

Build a portable Windows EXE:

```bat
npm run dist
```

Output is written to:

```text
release\
```

## Default server

```text
https://zyven-license.zyven.workers.dev
```

The URL can be changed on the connect screen. HTTPS is required except for localhost development.
