# HeRoShield License Setup (V4)

1. Website: set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (server-only), and a strong random `HS_BOT_LICENSE_SECRET` in deployment environment.
2. Bot: set `HS_SITE_URL` to the deployed HTTPS website origin (no trailing /api), and `HS_BOT_LICENSE_SECRET` to the **exact same** secret. Never put either service-role key or secret in frontend code.
3. In Supabase SQL editor, execute `supabase-license-system.sql` if not already installed. If installed from an older release, **also execute** `ALTER TABLE public.hs_licenses ALTER COLUMN expires_at DROP NOT NULL;` for lifetime support.
4. Deploy website and restart bot, and re-register slash commands if your bot does not auto-sync them.
5. `/createlicense user unit duration`: unit = hours/days/weeks/months/lifetime; duration omitted for lifetime. Each code is cryptographically random and hashed at rest. A database transaction locks a code during redemption; it can only be claimed once.
6. The recipient Discord ID is metadata, not an automatic proof of ownership for email accounts. Anyone possessing an unused code can claim it first. Deliver privately; to strictly bind redemption to the intended Discord user, add verified Discord account linking and check issued_to_discord server-side.
7. Existing Enterprise seat support remains in the database, but this simplified command issues **personal one-seat** licenses only.
8. Test in staging: duplicate redemption, expiration, lifetime, revoke, login persistence, role bypass, and all protected APIs. Existing scanner and forensic files were not modified.

IMPORTANT: This package does not configure your live hosting or Supabase automatically. If the bot reports missing configuration, set the environment variables and redeploy.
