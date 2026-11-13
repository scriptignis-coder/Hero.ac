# V12 activation fix
- Static license input and Activate License button in dashboard.html (visible after Discord login even if /api/licenses fails).
- No more replacing the entire activation UI with an API error.
- JS initializes once, displays API errors without hiding form.
- Clears server-side access cache immediately after successful claim.
- Cache-busting asset URLs for fresh deployment.

Deploy the whole website to Render. This does not repair an unavailable /api/licenses endpoint or a missing Supabase schema; inspect Render logs and database migration if activation still returns an error.
