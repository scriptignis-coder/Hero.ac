# HeRoShield website patch

1. Deploy the contents of this site folder to the existing website host (the folder containing index.html, api/, dashboard.html, and vercel.json). Do not deploy bot/ or change the scanner.
2. In the Supabase project configured by SUPABASE_URL on the website, run MIGRATION-ACCOUNT-LICENSES-V7.sql in SQL Editor. This creates the license tables, required columns, and claim/member functions. If V7 migration was already applied successfully and only enterprise is missing, run FIX-ENTERPRISE-COLUMN.sql instead.
3. Confirm HS_BOT_LICENSE_SECRET is identical on website and Discord bot, and that SUPABASE_SERVICE_KEY is configured server-side. Never expose service keys in browser code.
4. Redeploy website to refresh its API functions. Verify that /api/me returns a user when logged in, and 401 when logged out. Login shows Logout, Discord username and avatar after authentication; logout returns to homepage.
5. Create a NEW test license through the bot, claim it in the dashboard, then refresh and confirm access. The real Discord/Supabase end-to-end flow was not tested in this environment.

Existing dashboard.html, permissions, scanner files and other tabs are left unchanged by this patch.
