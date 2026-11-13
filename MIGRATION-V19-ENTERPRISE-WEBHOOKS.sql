-- Run in Supabase SQL Editor before deploying V19. Requires existing account-license and audit tables.
ALTER TABLE public.hs_account_licenses ADD COLUMN IF NOT EXISTS enterprise_name text;
CREATE TABLE IF NOT EXISTS public.hs_client_webhooks (
 owner_discord text PRIMARY KEY CHECK(owner_discord ~ '^[0-9]{17,20}$'),
 url_encrypted text NOT NULL,
 enabled boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hs_client_webhooks ENABLE ROW LEVEL SECURITY;
-- No direct browser access: service_role backend only.
REVOKE ALL ON public.hs_client_webhooks FROM anon, authenticated;
NOTIFY pgrst, 'reload schema';
