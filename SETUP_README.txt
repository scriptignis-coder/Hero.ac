HeRoShield compact package + Supabase SQL

Contains fewer than 100 files (including database/heroshield_full_setup.sql).
1) Back up your existing Supabase database.
2) Inspect SQL and compare existing tables/columns.
3) Run SQL in Supabase SQL Editor only after review.
4) Deploy the website separately, keeping server-side environment secrets private.

This is a non-destructive compatibility bootstrap, not an exact full database export.
Existing tables are not overwritten, existing data is not populated.
Ranking timeout and PIN functionality require real integration tests.

The tests directory was excluded to keep the package under 100 files.
