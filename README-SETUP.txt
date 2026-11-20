HeRoShield Site v72 + Blacklist Admin + Supabase SQL

1. Deploy site files (including api/, assets/, dashboard.html, blacklist-admin.html) to your existing hosting.
2. Supabase SQL Editor: run database/blacklist.sql after taking a backup. This creates missing tables, does not erase data. Existing tables must have compatible column types.
3. Configure environment variables from .env.example on your host; NEVER commit actual service keys.
4. Log in as an admin (ADMIN_DISCORD_IDS configured) and open /blacklist-admin.html or dashboard button.
5. Search for the Discord ID and click Unblacklist. History is retained.
6. To disable automatic self-scan blacklist, set Self-scans limit to 0. Existing bans are not lifted by this change.

NOTE: The site has a Supabase-backed database; no live database contents or credentials are included.
API already existed in v72. This package adds a usable UI and an additive SQL migration.
