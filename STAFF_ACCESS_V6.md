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
