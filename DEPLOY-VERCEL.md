# Deploy HeRo Shield on Vercel

This site is a **static site + serverless functions** (folder `api/`).
It must NOT run `server.js` on Vercel (that file is only for local/Render).
If you ever see a plain "Not found", Vercel is wrongly running `server.js` —
fix the project settings below and redeploy.

## 1. Import the project (clean)
- Vercel → Add New → Project → import the GitHub repo.
- **Framework Preset: `Other`**
- **Root Directory: `./`** (the repo root — where `index.html` is)
- **Build Command:** leave EMPTY (Override OFF)
- **Output Directory:** leave EMPTY (Override OFF)
- **Install Command:** `npm install` (default is fine)

(If a project already exists and shows "Not found", open it →
Settings → Build and Deployment → set the four values above → Redeploy.
If it still fails, delete the project and re-import with these settings.)

## 2. Environment Variables
Project → Settings → Environment Variables (add for Production):

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | the Secret key `sb_secret_...` |
| `DISCORD_CLIENT_ID` | Discord app → Application ID |
| `DISCORD_CLIENT_SECRET` | Discord → OAuth2 → Client Secret |
| `DISCORD_REDIRECT_URI` | `https://YOUR-APP.vercel.app/api/auth/callback` |
| `SESSION_SECRET` | any long random string |

Then redeploy (Deployments → ⋯ → Redeploy).

## 3. Discord redirect
Discord Developer Portal → your app → OAuth2 → Redirects, add:
`https://YOUR-APP.vercel.app/api/auth/callback`

## 4. Supabase schema
Supabase → SQL Editor → run `supabase-RESET.sql` once.

## 5. Scanner download
Build `HeRoShieldScanner.exe` (BUILD.bat), then upload it to the repo's
GitHub Releases so the "Download scanner (.exe)" button works.

## Endpoints
- Dashboard/login: `/api/auth/login`, `/api/me`, `/api/servers`, `/api/pins`,
  `/api/signatures`, `/api/staff`, `/api/settings`, `/api/live`, `/api/stream` …
- Scanner report: `/api/scan-report`
- FiveM anticheat (header `x-license` = a server's license key):
  `/api/detection`, `/api/ban`, `/api/player`, `/api/log`, `/api/sync`

All `api/*.js` are ESM (`export default`). The old CommonJS duplicates and the
`api/ingest/*` files were removed — they used a different, obsolete schema.
