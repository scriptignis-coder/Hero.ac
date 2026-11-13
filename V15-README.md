# V15: My License, Enterprise, PIN quota display

- My License shows the account license from /api/licenses, not just the separate scanner PIN licenses.
- Staff label uses actual backend permission flags, not billing.staffAccess. If the user still has Staff, inspect user_access and HEROSHIELD_IDS; do not hide a real server-granted role.
- Enterprise tab shown only for active enterprise owner, with add/remove Discord members. API enforces ownership and seat limits.
- Enterprise member permissions use the existing server accountLicense() lookup.
- Removed the daily PIN count banner from UI; server rate limits are deliberately preserved.
- Requires Supabase migrations and configured service role on Render. No live production verification performed.
