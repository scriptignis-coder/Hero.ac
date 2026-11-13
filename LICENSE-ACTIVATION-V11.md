# HeRoShield Site V11 — Activation UI fix

Changes:
- License key field remains visible even when `/api/licenses` fails.
- API failure now displays a specific error and retry option, without hiding the form.
- New dark blue activation panel, keyboard-friendly input, safe message rendering.
- Original dashboard tabs, API endpoints, role checks, and scanner assets are preserved.

IMPORTANT: This does NOT automatically fix a failing API or Supabase migration.
To resolve 'License service unavailable', inspect the `/api/licenses` HTTP response and Render logs.
Apply `MIGRATION-ACCOUNT-LICENSES-V7.sql` only after checking your existing schema and backing up the database.
Render must have SUPABASE_URL and SUPABASE_SERVICE_KEY configured securely.
The activation API expects a key of the form HS- followed by 32 hexadecimal characters.
After activation, the server must recognize the account's license before granting dashboard access.

Deployment: upload this site to the same Render web service; do not upload to the Discord bot host.
