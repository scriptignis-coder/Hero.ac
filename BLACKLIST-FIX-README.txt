HeRoShield admin blacklist patch
- Blacklist Management is now an admin-only sidebar link (permission display uses existing dashboard data-perm logic).
- Backend API enforces admin authorization for GET and POST.
- Find Discord ID searches server-side, beyond the first 200 records.
- Backend database errors are no longer silently converted to an empty blacklist.
- Do not reinitialize or delete your live database.
- If user still does not appear, verify the exact Discord ID and whether the block is from another subsystem; this list is hs_blacklist only.
- Deployment has not been tested against live Supabase.
