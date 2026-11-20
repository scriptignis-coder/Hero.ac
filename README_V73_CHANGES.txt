HeRoShield v73 — Player History + Discord account profile

1. Discord OAuth session now keeps username, display name and avatar URL.
   Users must log out/in after deployment to refresh an old session.
2. Account profile displays Discord PFP, display name, @username and Discord ID.
3. Player History shows staff-submitted external reports only when a scan report
   contains a matching Discord ID. External reports remain clearly unverified.
4. New authenticated API /api/external-reports:
   GET ?discord_id=... requires herocheck permission;
   POST requires admin permission and accepts discord_id, source, verdict,
   scanned_at, notes, evidence_url (HTTPS).
   Use POST via authenticated admin tooling / API; no import form is provided yet.
5. Run database/hs_v73_external_reports.sql once in Supabase SQL editor.
6. No Napse.ac integration is claimed: an official API/report export is required
   for automatic trustworthy import. No cross-scanner verdict is fabricated.
7. No changes to Blacklist, PIN handling, licenses or leaderboard.

Not tested against live Supabase, Discord, or a production deployment.
