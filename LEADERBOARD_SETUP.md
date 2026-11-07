# HeRoShield Leaderboard

1. Run `supabase-leaderboard.sql` in the same Supabase project used by the site.
2. Deploy updated `api/leaderboard.js`, `api/leaderboard-optin.js` and `index.html`.
3. A Discord user must sign in to the site and explicitly click **Join public leaderboard**. They can opt out any time.
4. Scans only count when the PIN is used, a report exists, and a verified Discord identity was attached to the scan.
5. Top Checks = number of completed checks; Top Findings = total reported scanner detections, **not proof of cheating**.
6. Public API does not expose Discord IDs, PINs, reports, file paths or private data.
7. The list currently reads the newest 1,000 completed reports and 2,000 opt-ins. For production scale, use SQL-side aggregation/pagination.
8. No existing Admin / HeRoShield / HeRoCheck permissions were changed.
9. Run `npm test` to verify local logic. Live Supabase/Discord integration requires configured credentials and a deployment.
