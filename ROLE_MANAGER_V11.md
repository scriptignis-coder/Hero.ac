# HeRoShield V11 — Admin / HeRoCheck dashboard permissions

1. Run `supabase-access.sql` in Supabase SQL Editor (adds `user_access.admin`).
2. Set `ADMIN_DISCORD_IDS` in hosting environment to the Discord ID of the owner.
3. Redeploy. Owner logs in, opens **Permission Manager**, enters a Discord user ID and grants **Admin** or **HeRoCheck**.
4. HeRoCheck users see scanner tabs, never Admin tabs. Admin users see Permission Manager and scanner tabs.
5. Only an environment owner can grant/revoke Admin. API enforces authorization; hidden tabs alone are not a security boundary.
6. A grant in `HEROCHECK_IDS` environment cannot be revoked in dashboard; remove it from the environment.

The `user_access` table must be accessible by the backend service role; do not expose service keys to the browser.
