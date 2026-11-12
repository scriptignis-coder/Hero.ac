# Email authentication and persistent sign-in

1. Open the SAME Supabase project used by this website. Under Authentication > Providers, enable Email (Email + Password). Decide whether to require email confirmation.
2. In your website deployment environment (Render/Vercel), set `SUPABASE_URL` to the project URL and `SUPABASE_ANON_KEY` to its public anon/publishable key. Keep `SUPABASE_SERVICE_KEY` secret and server-only. Set a stable, strong `SESSION_SECRET` (do not regenerate on each deploy). Redeploy/restart the website.
3. In Authentication > URL Configuration, set your production Site URL and allowed redirect URLs. If confirmation is enabled, configure SMTP for reliable delivery and verify confirmation links.
4. Supabase Auth enforces unique email identities per project. Do not create a second auth project for the same site. Existing-email signup responses may be intentionally generic to prevent account enumeration; use login or password recovery.
5. The site issues an HttpOnly, Secure, SameSite=Lax signed cookie for up to 30 days after successful login. Returning to the site in the same browser stays signed in until expiry, logout, browser cookie removal or SESSION_SECRET rotation. This is NOT permanent login. Cookies require HTTPS on the deployed site.
6. Email and Discord identities are intentionally separate unless a verified account-linking flow is implemented. Do not merge by typed email alone.
7. Test: register with a fresh email, confirm email if required, login, close/reopen browser, refresh dashboard, logout, and confirm access is revoked. Test duplicate-email signup and Discord login separately.

Security note: the current signed cookie is stateless, so server-side instant revocation across devices is not implemented. For production, consider revocable server-side sessions and rate limiting for login/register.
