# HeRoShield Accounts & Licenses — setup

1. Run `supabase-license-system.sql` in the existing Supabase project. It creates new tables/functions; does not remove existing ones.
2. Enable Supabase Auth email/password and email confirmation. Configure `SUPABASE_ANON_KEY` in the website environment, keeping `SUPABASE_SERVICE_KEY` secret server-side. Existing Discord OAuth remains.
3. Generate a random long secret and set the SAME `HS_BOT_LICENSE_SECRET` in website and bot. Set `HS_SITE_URL` in bot to the deployed HTTPS website URL.
4. Restart/redeploy both projects. Bot `/createlicense user plan duration seats` issues a one-time activation code; buyer activates after logging in. Do not post codes publicly.
5. For Enterprise, owner uses account IDs shown in dashboard, adds members up to seats. The owner counts as one seat. Revocation/expiration is checked server-side.

## Important integration limitations
- Existing legacy staff access remains intentionally available; it is NOT replaced by license gating. Existing API endpoints protected by `requireAccess` use license-based `herocheck` permission. Some custom endpoints may use other checks and should be audited before production.
- Discord login and email login are separate identities. A code can be claimed by either; no automatic account merging. This prevents unsafe identity linking.
- The bot stores the buyer Discord ID as issuance metadata, but does not silently attach the license to their account: buyer claims it once with the code.
- Use a separate staging database first. No Windows EXE scanner files were modified.
- A real production rollout still needs end-to-end tests, abuse/rate limiting, email deliverability and operational monitoring. No production deployment or Windows testing has been performed.
