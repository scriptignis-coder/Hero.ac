# HeRoShield Website V19 — Deployment

1. Back up Supabase and deploy files together. Run `MIGRATION-V19-ENTERPRISE-WEBHOOKS.sql` in Supabase SQL Editor.
2. In Render add `HS_WEBHOOK_ENCRYPTION_KEY` with a **persistent** 32-byte random hex key (`openssl rand -hex 32`). Keep it private and never change it casually or existing webhook URLs become unreadable.
3. Restart Render and verify Discord login, existing licenses, PINs, scanner reports, enterprise list, timer and webhook saving.
4. The Enterprise Management and Activity logs tabs are visible to Admin and Staff; both can rename enterprises, but not change owner/seats/expiry; account claims, member changes, enterprise renames and webhook changes are additionally logged. Existing audit log table required.
5. Webhook notifications send a short summary only. Scanner PIN uploads still use the existing public scanner-report API; ensure the scanned user's consent covers sharing scan summaries with the authorized account owner. Avoid uploading sensitive data to Discord.
6. PIN generation has a subtle two-tone sound FX with an on/off toggle. Staff-only rename (without admin) is **not** included. Enterprise custom PIN names are not included.
7. This is source code, not a deployed site. No live Supabase/Render integration test has been performed.
