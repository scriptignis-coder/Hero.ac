# HeRoShield Workspace Dashboard V5

Added working navigation: My Profile, My License, Analytics, Scan Activity, Leaderboard.

## Data wiring
- Profile: /api/me (authenticated Discord user), /api/servers, /api/billing-status
- My License: /api/billing-status (Stripe-backed paid_entitlements; existing payment setup required)
- Analytics: /api/data?server=...&type=overview (existing server authorization)
- Scan Activity: /api/servers then /api/pins?server=... (herocheck permissions and owned server enforced by API)
- Leaderboard: /api/leaderboard?metric=checks|findings (opt-in only)

## Security and limitations
Existing Admin / HeRoShield / HeRoCheck permissions preserved. UI permissions are not a substitute for server-side authorization. No invented numbers. Existing backend and billing configuration required. Scan activity lists up to 20 authorized servers and latest 100 PINs per server; not an all-time aggregate. Existing endpoints may return errors if Supabase/Stripe not configured. No production browser or payment tests were performed.
