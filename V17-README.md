# HeRoShield Website V17 — Unlimited PINs

- Removed daily PIN generation quota in `api/pins.js`, not merely the counter in the UI.
- Non-staff PIN access requires an active account license, checked on every request. Staff/Admin original permission bypass retained.
- Existing PIN records and scanner_licenses foreign-key structure retained.
- PINs are not automatically deleted on expiration; access to PIN API is denied after license expiry for non-staff users.
- Keep Supabase database and Render secrets unchanged. Deploy the entire website to Render.
- GitHub browser upload limit is 100 files per batch; this archive is below that limit.
- No live production integration test performed.
