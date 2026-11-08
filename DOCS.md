# HeRo Shield website — all notes in one file

SQL files are in `database/` (run `database/supabase-all.sql`, then `database/supabase-v19-permissions-logs.sql`).


---

<!-- V19_PERMISSIONS_LOGS.md -->
# HeRoShield V19 — timed permissions, activity logs, 1 PIN per day

## Setup (once)
1. Supabase → SQL Editor → run `supabase-v19-permissions-logs.sql` (adds `user_access.expires_at`, `granted_by`, `granted_at` and the `audit_logs` table). Safe to run again.
2. Redeploy the site.
3. Optional Render env: `PIN_DAILY_LIMIT` (default 1) and `PIN_LIMIT_TZ` (default Africa/Tunis).

## What changed
- **Permission time** (Access, Permission Manager, Staff team): **Duration** (number) + **Unit** (Hours, Days, Weeks, Months, Years, Lifetime)
  with a live "Permission preview" (e.g. "HeRoCheck — 2 days", end date). When it ends the access stops by itself and the list shows **Expired**.
  "Set time" on a row gives a new end time from now. Ticking a box gives it for the chosen duration. Render env IDs stay permanent.
- **Activity logs** (admin): every permission given / removed / account removed, every license created / revoked,
  every PIN created / deleted, every plan bought — who, for whom, when, for how long.
- **1 PIN per day** for every client (not Admin), counted per calendar day in Tunis time. Deleting a PIN does not give it back.
  The Scan PINs page shows how many are left and when the next one is possible.
- **Fixes**: a used PIN could be uploaded again (the used / revoked-license check read columns it never loaded);
  scanner-license PINs did not send your Signatures to the scanner; Discord ID lookup / history needed a FiveM server;
  the sidebar could not scroll (links at the bottom were unreachable on small screens).
- Scan report: **File journal** tab for scanner v4.3.
- **Troubleshooting** is now a dashboard tab (scanner won't open / .NET Framework 4.8, antivirus, PIN, report not delivered, Discord, expired access); the public /troubleshooting page is updated for .NET Framework 4.8.


---

<!-- SETUP.md -->
# HeRo Shield — setup (do it once)

## 1. Database (Supabase)
Supabase → SQL Editor → New query → paste **supabase-all.sql** → Run.
It creates every table (servers, scans, signatures, staff, access, Discord check). Safe to run again.

## 2. Render → Environment
Copy the names from **.env.example** exactly:

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → **service_role** key |
| `SESSION_SECRET` | any long random text |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | discord.com/developers → your app → OAuth2 |
| `DISCORD_REDIRECT_URI` | `https://southside-ecjn.onrender.com/api/auth/callback` (also add it in Discord → OAuth2 → Redirects) |
| `ADMIN_DISCORD_IDS` | your Discord ID (full access + Access page) |
| `HEROCHECK_IDS` | IDs that see the screenshare tabs |
| `HEROSHIELD_IDS` | IDs that see the anticheat tabs |

Discord ID: Discord → Settings → Advanced → Developer Mode → right-click your name → Copy User ID.

## 3. Push to GitHub
Push this whole folder to the **SouthSide** repo.
- Render redeploys the site by itself.
- GitHub Actions builds **HeRoShield.exe** on Windows and puts it in release **v1.0** by itself
  (GitHub → Actions → "Build scanner" — green = done, ~4 min). No BUILD.bat needed.
  You can also start it by hand: Actions → Build scanner → Run workflow.

## 4. Use it
1. Dashboard → **Scan PINs** → player name → **Generate PIN** → **Copy link**.
2. Send the link to the player. He opens it, runs `HeRoShield-PIN.exe`, clicks **Accept** (no PIN to type).
3. The Discord page opens: he connects Discord → you see his servers.
4. Result appears in Scan PINs → **View**.

Cheat Discord servers: dashboard → **Discord check** → paste invite links → Add.
Scanner background: dashboard → **Scanner GUI**.
Give staff access: dashboard → **Access** (or the env IDs above).

## If something fails
- Scanner says "could not send the result (HTTP …)": the text after HTTP says why.
  The report is also saved next to the .exe as `hero-report-PIN.json`.
- "PIN NOT FOUND" in the scanner: the PIN was deleted or typed wrong — make a new link.
- Render log "Could not find the table …": run **supabase-all.sql** again.


---

<!-- PERMISSIONS_AND_TESTING.md -->
# HeRoShield Site — permissions and local validation

This is the existing HeRoShield dashboard project, not a clone of napse.ac. It retains the original dashboard, Discord login, scan report pages, and its permission names.

## Permission model

- `ADMIN_DISCORD_IDS`: full access to HeRoShield and HeRoCheck, including Access management.
- `HEROSHIELD_IDS`: anticheat features and owned-server / staff endpoints.
- `HEROCHECK_IDS`: screenshare / scanner report features and browser tabs inside Detection Results.
- Access page (`user_access` table) can grant `heroshield` or `herocheck` in addition to environment lists.
- **No configured IDs = no access** (fail closed). Set `ADMIN_DISCORD_IDS` before deploying.
- API checks are enforced on the server; hiding UI tabs is not considered authorization.
- Server ownership checks still apply to server-scoped endpoints.

## Setup

1. Install Node.js 18+ and run `npm install` in `hero-shield-site`.
2. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SESSION_SECRET`, Discord OAuth values, and `ADMIN_DISCORD_IDS` using `.env.example`. Keep secrets server-side only.
3. Run the project's Supabase SQL setup scripts per `SETUP.md`; confirm `user_access` table exists.
4. Set the Discord OAuth redirect URL to `https://YOUR_DOMAIN/api/auth/callback` in both Discord Developer Portal and server environment.
5. Run `npm start` on your host. Test OAuth, Access management, scan PIN, upload, and report pages on the actual deployed domain.
6. Use `npm test` for local permission and HTTP smoke tests; these do **not** validate Discord or Supabase integrations.

## Security note

This build preserves the original scanner API and site UI. Browser history/downloads are sensitive: only collect and share with explicit, informed consent and retain them only as necessary. Avoid exposing the Supabase service role key to client code. Do not treat a successful local smoke test as proof that the production integrations work.


---

<!-- GUIDE.md -->
# HeRo Shield — site + dashboard (branche sur TON resource v1.1.0)

Ce site correspond EXACTEMENT a ton resource :
- `GET  /api/license/validate?key=...`  (Config.LicenseUrl)
- `POST /api/ingest/ban`                (Config.ReportingUrl + /ban)
- `POST /api/ingest/log`                (+ /log)
- `POST /api/ingest/heartbeat` et `/api/ingest/player`  (ajout stats/playtime)
Auth des ingest : header `X-Ingest-Token` = `Config.ReportingToken` = env `INGEST_TOKEN`.

## 1) Supabase
- supabase.com -> New project -> SQL Editor -> colle `supabase_schema.sql` -> Run.
- Settings -> API : note `Project URL` + cle `service_role`.

## 2) Discord (login du dashboard)
- developers discord -> ton app -> OAuth2 : Client ID + Secret.
- OAuth2 -> Redirects -> `https://TON-SITE.vercel.app/api/auth-callback`

## 3) Vercel
- Mets ce dossier sur GitHub (garde les dossiers `api/`, `api/ingest/`, `api/license/`).
- Importe sur Vercel -> Deploy.
- Settings -> Environment Variables (voir `.env.example`) :
  CLIENT_ID, CLIENT_SECRET, SUPABASE_URL, SUPABASE_KEY, SESSION_SECRET,
  SITE_URL (URL fixe de prod, sans / final), INGEST_TOKEN (choisis une valeur secrete).
- Redeploy.

## 4) config.lua du resource (remplace "ton-site.com")
```
Config.LicenseUrl      = "https://TON-SITE.vercel.app/api/license/validate"
Config.ReportingUrl    = "https://TON-SITE.vercel.app/api/ingest"
Config.ReportingToken  = "LA-MEME-VALEUR-QUE-INGEST_TOKEN"
```
Redemarre le resource -> les bans (avec preuve), logs, joueurs et heartbeat
remontent dans le dashboard.

## Note
- Le dashboard liste TOUS les serveurs qui remontent (usage mono-proprietaire).
- Pour vendre a des clients : chaque client met SON propre INGEST_TOKEN / deploiement,
  ou on ajoute un owner par serveur plus tard.
- La validation de licence est "ouverte" tant que la table hs_licenses est vide
  (ajoute des cles dedans pour verrouiller).


---

<!-- DEPLOY-VERCEL.md -->
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


---

<!-- PAYMENTS_SETUP.md -->
# HeRoShield Premium billing

1. Run `supabase-billing.sql` in Supabase SQL Editor.
2. Create five **one-time** Stripe Prices in your Stripe dashboard, with the exact USD amounts displayed on the site: 1 month $4.99, 3 months $12.99, 6 months $22.99, 1 year $39.99, lifetime $79.99. These are one-time purchases, not auto-renewing subscriptions. Put each `price_...` ID into the corresponding environment variable. Do not use different Stripe amounts without updating the site prices; displayed prices are not dynamically fetched from Stripe.
3. Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `PUBLIC_SITE_URL` in Render/Vercel. Set Stripe webhook endpoint to `https://YOUR_DOMAIN/api/billing-webhook` and subscribe to `checkout.session.completed`.
4. Configure Discord OAuth and Supabase as in `SETUP.md`. Customers must log in with Discord before checkout.
5. A verified Stripe webhook grants or extends a paid entitlement. The site checks it server-side on protected staff routes. Existing `admin`, `heroshield`, `herocheck` permissions remain required; payment alone does NOT grant staff permissions. Owner admin bypasses billing for management.
6. Test with Stripe test-mode keys, test price IDs, and test webhooks before going live. Checkout success redirect does not grant access.

**Important:** The existing `requireLicense()` FiveM server license flow is separate and has NOT been converted to paid licensing; server runtime licenses may still work without a paid entitlement. Payment gating is applied to staff dashboard API routes using `requireAccess`. Some legacy API endpoints may use other guards and need an additional access audit before production. This package is not certified production-ready billing. For robust production billing, use a transactional database function for webhook idempotency and expiry updates, handle refunds/disputes and admin cancellations, and confirm your Stripe account supports your country.

The PNG logo is `assets/logo.png`.


---

<!-- PRICING_USD.md -->
# HeRoShield affordable USD pricing

| Access | One-time price |
|---|---:|
| 1 Month | $4.99 |
| 3 Months | $12.99 |
| 6 Months | $22.99 |
| 1 Year | $39.99 |
| Lifetime | $79.99 |

Prices are suggested introductory prices and should be reviewed against actual costs, taxes, and payment processing fees. Configure Stripe one-time USD prices with **exactly these amounts**, then set STRIPE_PRICE_* variables. The current backend uses Stripe Price IDs; editing HTML alone does not set the amount charged. Payment does not automatically grant staff permissions.


---

<!-- LEADERBOARD_SETUP.md -->
# HeRoShield Leaderboard

1. Run `supabase-leaderboard.sql` in the same Supabase project used by the site.
2. Deploy updated `api/leaderboard.js`, `api/leaderboard-optin.js` and `index.html`.
3. A Discord user must sign in to the site and explicitly click **Join public leaderboard**. They can opt out any time.
4. Scans only count when the PIN is used, a report exists, and a verified Discord identity was attached to the scan.
5. Top Checks = number of completed checks; Top Findings = total reported scanner detections, **not proof of cheating**.
6. Public API does not expose Discord IDs, PINs, reports, file paths or private data.
7. The list currently reads the newest 1,000 completed reports and 2,000 opt-ins. For production scale, use SQL-side aggregation/pagination.
8. No existing Admin / HeRoShield / HeRoCheck permissions were changed.
9. Run `npm test` to verify local logic. Live Supabase/Discord integration requires configured credentials and a deployment.


---

<!-- LEADERBOARD_FIX_V15.md -->
# V15 Leaderboard repair
- Credits completed scans to scanner_licenses.owner_discord using scan_pins.license_id.
- Displays profile name/avatar from user_access, only for opted-in Discord IDs.
- Supports old discord_check-based scan reports where no scanner license owner is found.
- Fixes scanner PIN verification query to select only existing scanner_licenses.id.
- Run supabase-leaderboard.sql and ensure supabase-access.sql + supabase-scanner-licenses-v13.sql have been applied.
- Redeploy the site. No schema change is required for this leaderboard fix if the V14 database was already installed.
- 15 local Node tests pass. Live Supabase/Discord not tested.


---

<!-- ROLE_MANAGER_V11.md -->
# HeRoShield V11 — Admin / HeRoCheck dashboard permissions

1. Run `supabase-access.sql` in Supabase SQL Editor (adds `user_access.admin`).
2. Set `ADMIN_DISCORD_IDS` in hosting environment to the Discord ID of the owner.
3. Redeploy. Owner logs in, opens **Permission Manager**, enters a Discord user ID and grants **Admin** or **HeRoCheck**.
4. HeRoCheck users see scanner tabs, never Admin tabs. Admin users see Permission Manager and scanner tabs.
5. Only an environment owner can grant/revoke Admin. API enforces authorization; hidden tabs alone are not a security boundary.
6. A grant in `HEROCHECK_IDS` environment cannot be revoked in dashboard; remove it from the environment.

The `user_access` table must be accessible by the backend service role; do not expose service keys to the browser.


---

<!-- STAFF_ACCESS_V6.md -->
# Staff Access V6

## Fixes
- Staff Team now requires an owner/admin session to add a member. A staff member cannot grant other users privileges.
- Add Staff requires a Discord user ID, and saves `heroshield`/`herocheck` permissions to `user_access` before adding the staff entry.
- Staff with a matching Discord ID in the `staff` table bypass the *customer payment* gate on operator endpoints; staff permissions are still mandatory.
- Staff role label does **not** confer owner/admin privileges. Only `ADMIN_DISCORD_IDS` controls owner rights.
- New Quick Tools and Team Directory tabs. Both use existing authenticated APIs; no dummy statistics.
- Team deletion removes the team record; separately revoke permissions on the Access page. This is intentional to avoid silently deleting independently granted permissions.

## Setup
1. Set `ADMIN_DISCORD_IDS` to the real owner Discord user ID in the deployment environment.
2. Run the project's `supabase-access.sql` and `supabase_schema.sql` as appropriate.
3. Configure Discord OAuth and Supabase credentials.
4. Owner signs in, opens Staff Team, enters name + valid Discord ID, selects HeRoShield / HeRoCheck and clicks Add & Grant Access.
5. Staff signs in with the **same Discord account**. If already signed in, reload.
6. To revoke, remove Staff entry AND revoke HeRoShield / HeRoCheck in Access.

## Verification limits
Node syntax checks and existing automated tests pass. Real Discord OAuth, Supabase, payment and browser end-to-end flows require configured services and have not been tested here.


---

<!-- STAFF_SCANNER_ACCESS_FIX.md -->
# HeRoShield Scanner — staff permission fix

Set `ADMIN_DISCORD_IDS` (owner IDs) and/or `HEROCHECK_IDS` (scanner staff IDs) in the **server environment**; use comma-separated Discord user IDs. `HEROCHECK_IDS` is the existing variable name used by this project. Restart/redeploy after changing environment variables, then sign out and sign in through Discord OAuth.

A verified Admin or HeRoCheck role can use scanner/dashboard endpoints without a paid subscription or `paid_entitlements` record. The Profile/License pages show **Staff access** instead of incorrectly displaying a missing paid plan. Normal customers do not gain staff permissions by purchasing a plan. HeRoCheck users cannot open admin endpoints.

The original paid plans, checkout, webhook, database SQL migrations, scanner APIs and visual assets are included. Run the provided `supabase-all.sql`, `supabase-access.sql`, `supabase-scanner.sql`, `supabase-billing.sql` and `supabase-leaderboard.sql` as applicable in Supabase SQL Editor, checking your existing schema first. `paid_entitlements` is created by `supabase-billing.sql`; its `lifetime` column is required by the billing code. Do not use a simplified alternative schema that omits `lifetime`.

Security: Discord IDs must come from server-verified OAuth sessions. Never expose `SUPABASE_SERVICE_KEY`, `SESSION_SECRET`, `DISCORD_CLIENT_SECRET` or Stripe secrets in public JS. The project still requires real Discord/Supabase/Stripe configuration and production testing.

Validation: Node unit tests run locally; live Discord OAuth, Stripe, Supabase, and scanner executable integration have NOT been tested.


---

<!-- V13_README.md -->
# HeRoShield V13 — Scanner licenses (no FiveM server)

1. Run existing `supabase-all.sql` (and `supabase-access.sql`/`supabase-billing.sql` as applicable) in Supabase SQL Editor if this is a new database.
2. Run `supabase-scanner-licenses-v13.sql` in Supabase SQL Editor. This is a non-destructive migration: existing server-linked PINs are retained, but the new scanner-only PIN page only lists license-linked PINs.
3. Configure Render/Vercel environment: SUPABASE_URL, SUPABASE_SERVICE_KEY, Discord OAuth variables and ADMIN_DISCORD_IDS (or HEROCHECK_IDS). Deploy and sign in again.
4. My License -> Create license -> Use for Scan PINs -> Generate PIN. Windows scanner continues to validate PIN with `/api/scan-report` and upload reports there.
5. Profile -> leaderboard opt-in settings. Quick Tools navigation removed.

Permissions: scanner licenses are managed only by their Discord owner, after server-side `herocheck` access check (Admin also qualifies). A revoked license cannot be used to validate new scans. Existing paid plan entitlement is a separate billing feature.

Limitations: No live Supabase/Discord or Windows build test was possible here. Legacy endpoints that still depend on FiveM server IDs are not migrated; scanner PIN creation, license management and scan activity are scanner-only. The Windows scanner source is unchanged.


---

<!-- V14_SCANNER_GUI_FIX.md -->
# HeRoShield V14 — Scanner GUI Invalid server fix

The Scanner GUI previously called `/api/scanner-bg?server=...` and triggered the legacy `requireOwnedServer` validation. V14 uses `/api/scanner-licenses` and a user-owned `license_id` instead. Scanner background reads by PIN also resolve the associated scanner license rather than a FiveM server.

## Deployment
1. In Supabase SQL Editor run `supabase-scanner-gui-v14.sql` after your V13 schema.
2. Deploy the `hero-shield-site` folder to your existing hosting setup.
3. Log in with Discord, create a license under My License, open Scanner GUI and select it.
4. Test saving/removing a background and retrieving it by a generated PIN.

The Windows scanner source is bundled unchanged; Windows build and live Supabase/Discord tests were not performed.


---

<!-- SCANNER_ONLY_V8.md -->
# HeRoShield Scanner-only website V8

The public site now markets only Windows PC scanning/screenshare workflows. The legacy FiveM anti-cheat features, HWID bans, resource installation, and server management have been removed from the public marketing and visible dashboard navigation.

Scanner tabs: Download scanner, Scan PINs, Discord check, Scanner GUI, Signatures, Scan Activity, My Profile, My License, Quick Tools, Leaderboard, Tutorial, Changelogs, plus staff management for administrators.

Scanner users need HeRoCheck access (or admin). Legacy HeRoShield permissions remain in the data model for compatibility, but alone no longer grant scanner dashboard entry.

IMPORTANT: Legacy anti-cheat API code and database tables remain in this source archive to avoid silently breaking existing integrations. This is a product UI/scope conversion, not a verified full backend removal. Audit and retire unused API routes before deployment if anti-cheat services must be completely disabled. Payment/Discord/Supabase still require production configuration.


---

<!-- SCANNER_ONLY_DASHBOARD_IMAGES.md -->
# HeRoShield Scanner-only dashboard

The supplied reference screenshot shows Anti-Cheat UI (Players, Bans, Server Detections, Live Stream, Server Configuration). These tabs are NOT part of this project dashboard.html: the original V8 already removed them. This revision verifies that both desktop and mobile navigation contain scanner-related tabs only and tidies the markup. The screenshot is a visual mockup, not the live dashboard.

## Images
- assets/logo.png — existing HeRoShield logo, used by dashboard and homepage.
- assets/hero-bg.webp — hero background copied from the site's existing hero-waves.webp.
- assets/scanner-preview.png — NOT INCLUDED; a genuine scanner screenshot should be captured from the running Windows app.
- assets/dashboard-preview.png — NOT INCLUDED; capture the real logged-in scanner dashboard instead of using fabricated metrics.

Existing visual assets: assets/hero-waves.webp, assets/cinematic-operator.webp, assets/fivem-city.webp.

No live Discord/Stripe/Supabase test was performed.


---

<!-- DISCORD_PURCHASE_V10.md -->
# Discord Purchase Flow V10

On the homepage Pricing section, clicking any of the five plan buttons opens a purchase dialog showing the selected plan and price. The CTA opens https://discord.gg/EEF2tNYhk in a new tab and asks the buyer to open a Purchase Ticket.

This replaces the homepage Stripe redirect only. Existing billing API endpoints are retained for compatibility but are not called by the plan buttons. Payment verification and account activation remain manual unless separately automated. The Discord invite cannot automatically open a Discord ticket channel.


---

<!-- DASHBOARD_WORKSPACE_V5.md -->
# HeRoShield Workspace Dashboard V5

Added working navigation: My Profile, My License, Analytics, Scan Activity, Leaderboard.

## Data wiring
- Profile: /api/me (authenticated Discord user), /api/servers, /api/billing-status
- My License: /api/billing-status (Stripe-backed paid_entitlements; existing payment setup required)
- Analytics: /api/data?server=...&type=overview (existing server authorization)
- Scan Activity: /api/servers then /api/pins?server=... (herocheck permissions and owned server enforced by API)
- Leaderboard: /api/leaderboard?metric=checks|findings (opt-in only)

## Security and limitations
Existing Admin / HeRoShield / HeRoCheck permissions preserved. UI permissions are not a substitute for server-side authorization. No invented numbers. Existing backend and billing configuration required. Scan activity lists up to 20 authorized servers and latest 100 PINs per server; not an all-time aggregate. Existing endpoints may return errors if Supabase/Stripe not configured. No production browser or payment tests were performed.


---

<!-- FORENSIC_EDITION_CHANGELOG.md -->
# HeRoShield Forensic Edition — Visual redesign

Inspired by user-provided Napse screenshots, but original HeRoShield design in black and electric blue.

- Rebuilt homepage hero into split editorial composition with illustrative scanner widget (explicitly DEMO; no fabricated scan stats).
- New protected-environments showcase, six-step workflow and brand mission sections.
- Floating pill navbar and refined dark card system.
- Dashboard dark forensic styling; existing markup, event handlers, APIs and permission logic preserved.
- Existing pricing, leaderboard, FAQ, billing and backend files retained.

## Limitations
- Visual scanner preview is illustrative and not connected to a real scan.
- No live Discord OAuth, Stripe, Supabase or deployed environment test was performed.
- No claims of real uptime, signed binaries or guaranteed detection accuracy.


---

<!-- TROUBLESHOOTING_V18.md -->
HeRoShield V18: public /troubleshooting page and dashboard Help sidebar link. .NET 8 Desktop Runtime Windows x64 official Microsoft link; optional Cloudflare WARP official link; Discord support ticket. No scanner engine or backend changes.


---

<!-- REDESIGN_V2.md -->
# HeRoShield Obsidian visual redesign

Changed: landing page typography, headline, color system (obsidian + lime), card surfaces, navbar, buttons, preview, responsive spacing, dashboard sidebar and panels.

Preserved: original site APIs, routes, Discord OAuth, permissions (`data-perm`), scanner report workflows, server code, Supabase schema, tests. No credentials included.

Landing-page counters are illustrative demo data, not live service metrics.

Local validation is not equivalent to Discord/Supabase integration or production tests.


---

<!-- VISUAL_UPGRADE_V3.md -->
# HeRoShield Visual Upgrade V3

- Added original procedural imagery: `assets/hero-waves.webp` and `assets/fivem-city.webp`. These are illustrative graphics, not screenshots of real games or product performance.
- Redesigned homepage hero background, interactive scanner preview, FiveM cinematic section, story panel, cards and mobile layouts.
- Refined dashboard colors, card borders and background without modifying its JavaScript, authentication or permissions.
- Kept existing five USD plans, leaderboard, logo PNG, Discord/Supabase/Stripe API logic.
- No real payment/Discord/Supabase integration tests were run.


---

<!-- DESIGN_V4_NOTES.md -->
# Cinematic Blue V4

Added a new editorial visual section with three immersive panels, and a detailed illustrative dashboard preview. Reworked hero, lighting, typography, responsive layouts and reduced-motion support. Existing API, billing, permission logic and dashboard scripts are unchanged. The dashboard preview is illustrative, not live data.


---

<!-- STYLE_V7_NOTES.md -->
# HeRoShield Website V7 — Actual website styling

- Updated actual `index.html` and `dashboard.html` (not a standalone mockup).
- Added a decorative, cropped cinematic operator image in `assets/cinematic-operator.webp`.
- Reworked navbar, hero, typography, CTA buttons, scanner preview, FiveM panel, feature-card hover states, and dashboard sidebar/panels.
- Added mobile refinements and reduced-motion support.
- Preserved existing routes, API code, pricing, leaderboard, Discord login, and permissions.
- The visual scanner preview is decorative and does not represent a live scan.
- No production browser or external-service integration tests performed.


---

<!-- BLUE_BRANDING_CHANGELOG.md -->
# HeRoShield Blue Branding

- Replaced green Obsidian accents with blue/cyan across homepage and dashboard.
- Replaced header and sidebar shield mark with user-provided blue magnifying glass image at `assets/logo.png`.
- Updated favicon to matching magnifying glass.
- Preserved backend, API routes, Discord OAuth, Supabase and permission logic unchanged.
- No production deployment or live OAuth integration tests were performed.
