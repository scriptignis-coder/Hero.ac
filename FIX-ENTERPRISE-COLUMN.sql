-- Run in Supabase SQL Editor on the SAME project used by the deployed website.
-- Preserves the original public.hs_licenses table and existing data.
ALTER TABLE public.hs_account_licenses
  ADD COLUMN IF NOT EXISTS enterprise boolean NOT NULL DEFAULT false;
ALTER TABLE public.hs_account_licenses
  ADD COLUMN IF NOT EXISTS seats integer NOT NULL DEFAULT 1;
ALTER TABLE public.hs_account_licenses
  ADD COLUMN IF NOT EXISTS claimed_discord text;
NOTIFY pgrst, 'reload schema';
