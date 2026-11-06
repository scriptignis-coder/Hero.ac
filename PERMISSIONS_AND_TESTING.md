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
