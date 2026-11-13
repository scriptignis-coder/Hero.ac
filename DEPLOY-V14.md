# HeRoShield V14 — My License and Enterprise

- My License now reads account licenses from `/api/licenses` (Supabase `hs_account_licenses`), not just scanner PIN licenses.
- Staff label uses server-reported permission fields, not billing `staffAccess`.
- Enterprise tab is visible only to the Enterprise license owner; add/remove members by Discord ID.
- The API enforces Enterprise owner authorization and seat limits via Supabase RPC.
- On member add/remove, server permission cache for the member is invalidated. Member login uses existing `getAccess` account-license lookup.
- Scanner PIN licenses remain a separate section; original dashboard tabs and scanner source untouched.

Deploy website ZIP to Render. Database must already contain the account-license migration functions and member table. This code was syntax checked, but needs end-to-end testing on your own Supabase and Render environment. If a user still appears as Staff, check `user_access` and Render HEROSHIELD_IDS/ADMIN_DISCORD_IDS — those are independent permission sources.
