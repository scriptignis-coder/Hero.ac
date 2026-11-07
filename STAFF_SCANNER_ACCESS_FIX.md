# HeRoShield Scanner — staff permission fix

Set `ADMIN_DISCORD_IDS` (owner IDs) and/or `HEROCHECK_IDS` (scanner staff IDs) in the **server environment**; use comma-separated Discord user IDs. `HEROCHECK_IDS` is the existing variable name used by this project. Restart/redeploy after changing environment variables, then sign out and sign in through Discord OAuth.

A verified Admin or HeRoCheck role can use scanner/dashboard endpoints without a paid subscription or `paid_entitlements` record. The Profile/License pages show **Staff access** instead of incorrectly displaying a missing paid plan. Normal customers do not gain staff permissions by purchasing a plan. HeRoCheck users cannot open admin endpoints.

The original paid plans, checkout, webhook, database SQL migrations, scanner APIs and visual assets are included. Run the provided `supabase-all.sql`, `supabase-access.sql`, `supabase-scanner.sql`, `supabase-billing.sql` and `supabase-leaderboard.sql` as applicable in Supabase SQL Editor, checking your existing schema first. `paid_entitlements` is created by `supabase-billing.sql`; its `lifetime` column is required by the billing code. Do not use a simplified alternative schema that omits `lifetime`.

Security: Discord IDs must come from server-verified OAuth sessions. Never expose `SUPABASE_SERVICE_KEY`, `SESSION_SECRET`, `DISCORD_CLIENT_SECRET` or Stripe secrets in public JS. The project still requires real Discord/Supabase/Stripe configuration and production testing.

Validation: Node unit tests run locally; live Discord OAuth, Stripe, Supabase, and scanner executable integration have NOT been tested.
