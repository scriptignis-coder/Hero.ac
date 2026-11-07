# V15 Leaderboard repair
- Credits completed scans to scanner_licenses.owner_discord using scan_pins.license_id.
- Displays profile name/avatar from user_access, only for opted-in Discord IDs.
- Supports old discord_check-based scan reports where no scanner license owner is found.
- Fixes scanner PIN verification query to select only existing scanner_licenses.id.
- Run supabase-leaderboard.sql and ensure supabase-access.sql + supabase-scanner-licenses-v13.sql have been applied.
- Redeploy the site. No schema change is required for this leaderboard fix if the V14 database was already installed.
- 15 local Node tests pass. Live Supabase/Discord not tested.
