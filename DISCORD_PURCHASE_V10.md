# Discord Purchase Flow V10

On the homepage Pricing section, clicking any of the five plan buttons opens a purchase dialog showing the selected plan and price. The CTA opens https://discord.gg/EEF2tNYhk in a new tab and asks the buyer to open a Purchase Ticket.

This replaces the homepage Stripe redirect only. Existing billing API endpoints are retained for compatibility but are not called by the plan buttons. Payment verification and account activation remain manual unless separately automated. The Discord invite cannot automatically open a Discord ticket channel.
