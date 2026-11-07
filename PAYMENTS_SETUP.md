# HeRoShield Premium billing

1. Run `supabase-billing.sql` in Supabase SQL Editor.
2. Create five **one-time** Stripe Prices in your Stripe dashboard, with the exact USD amounts displayed on the site: 1 month $4.99, 3 months $12.99, 6 months $22.99, 1 year $39.99, lifetime $79.99. These are one-time purchases, not auto-renewing subscriptions. Put each `price_...` ID into the corresponding environment variable. Do not use different Stripe amounts without updating the site prices; displayed prices are not dynamically fetched from Stripe.
3. Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `PUBLIC_SITE_URL` in Render/Vercel. Set Stripe webhook endpoint to `https://YOUR_DOMAIN/api/billing-webhook` and subscribe to `checkout.session.completed`.
4. Configure Discord OAuth and Supabase as in `SETUP.md`. Customers must log in with Discord before checkout.
5. A verified Stripe webhook grants or extends a paid entitlement. The site checks it server-side on protected staff routes. Existing `admin`, `heroshield`, `herocheck` permissions remain required; payment alone does NOT grant staff permissions. Owner admin bypasses billing for management.
6. Test with Stripe test-mode keys, test price IDs, and test webhooks before going live. Checkout success redirect does not grant access.

**Important:** The existing `requireLicense()` FiveM server license flow is separate and has NOT been converted to paid licensing; server runtime licenses may still work without a paid entitlement. Payment gating is applied to staff dashboard API routes using `requireAccess`. Some legacy API endpoints may use other guards and need an additional access audit before production. This package is not certified production-ready billing. For robust production billing, use a transactional database function for webhook idempotency and expiry updates, handle refunds/disputes and admin cancellations, and confirm your Stripe account supports your country.

The PNG logo is `assets/logo.png`.
