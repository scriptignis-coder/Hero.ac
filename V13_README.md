# HeRoShield V13 — Scanner licenses (no FiveM server)

1. Run existing `supabase-all.sql` (and `supabase-access.sql`/`supabase-billing.sql` as applicable) in Supabase SQL Editor if this is a new database.
2. Run `supabase-scanner-licenses-v13.sql` in Supabase SQL Editor. This is a non-destructive migration: existing server-linked PINs are retained, but the new scanner-only PIN page only lists license-linked PINs.
3. Configure Render/Vercel environment: SUPABASE_URL, SUPABASE_SERVICE_KEY, Discord OAuth variables and ADMIN_DISCORD_IDS (or HEROCHECK_IDS). Deploy and sign in again.
4. My License -> Create license -> Use for Scan PINs -> Generate PIN. Windows scanner continues to validate PIN with `/api/scan-report` and upload reports there.
5. Profile -> leaderboard opt-in settings. Quick Tools navigation removed.

Permissions: scanner licenses are managed only by their Discord owner, after server-side `herocheck` access check (Admin also qualifies). A revoked license cannot be used to validate new scans. Existing paid plan entitlement is a separate billing feature.

Limitations: No live Supabase/Discord or Windows build test was possible here. Legacy endpoints that still depend on FiveM server IDs are not migrated; scanner PIN creation, license management and scan activity are scanner-only. The Windows scanner source is unchanged.
