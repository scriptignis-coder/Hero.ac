-- HeRoShield account license migration V7. Does NOT alter original hs_licenses.
-- Backup your Supabase project before applying. Run once in SQL Editor.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.hs_account_licenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 license_key text NOT NULL UNIQUE,
 discord_user_id text,
 duration_unit text NOT NULL DEFAULT 'days',
 duration_value integer,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz,
 redeemed_by uuid REFERENCES auth.users(id),
 redeemed_at timestamptz,
 revoked boolean NOT NULL DEFAULT false
);
ALTER TABLE public.hs_account_licenses ADD COLUMN IF NOT EXISTS claimed_discord text;
ALTER TABLE public.hs_account_licenses ADD COLUMN IF NOT EXISTS enterprise boolean NOT NULL DEFAULT false;
ALTER TABLE public.hs_account_licenses ADD COLUMN IF NOT EXISTS seats integer NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS hs_account_licenses_claimed_unique ON public.hs_account_licenses(claimed_discord) WHERE claimed_discord IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.hs_account_license_members (
 license_id uuid NOT NULL REFERENCES public.hs_account_licenses(id) ON DELETE CASCADE,
 discord_id text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(license_id,discord_id)
);
ALTER TABLE public.hs_account_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_account_license_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hs_account_licenses FROM anon,authenticated;
REVOKE ALL ON public.hs_account_license_members FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.hs_claim_account_license(p_hash text,p_discord text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.hs_account_licenses%ROWTYPE;
BEGIN
 IF p_discord !~ '^[0-9]{17,20}$' THEN RAISE EXCEPTION 'Invalid Discord ID'; END IF;
 SELECT * INTO v FROM public.hs_account_licenses WHERE license_key=p_hash FOR UPDATE;
 IF NOT FOUND OR v.revoked OR v.claimed_discord IS NOT NULL OR (v.expires_at IS NOT NULL AND v.expires_at<=now()) THEN RAISE EXCEPTION 'License unavailable or already claimed'; END IF;
 IF v.discord_user_id IS DISTINCT FROM p_discord THEN RAISE EXCEPTION 'License issued to a different recipient'; END IF;
 IF EXISTS(SELECT 1 FROM public.hs_account_licenses WHERE claimed_discord=p_discord)
    OR EXISTS(SELECT 1 FROM public.hs_account_license_members WHERE discord_id=p_discord) THEN RAISE EXCEPTION 'Discord account already licensed'; END IF;
 UPDATE public.hs_account_licenses SET claimed_discord=p_discord,redeemed_at=now() WHERE id=v.id;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.hs_add_account_member(p_license uuid,p_owner text,p_member text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.hs_account_licenses%ROWTYPE; n integer;
BEGIN
 IF p_member !~ '^[0-9]{17,20}$' THEN RAISE EXCEPTION 'Invalid Discord ID'; END IF;
 SELECT * INTO v FROM public.hs_account_licenses WHERE id=p_license FOR UPDATE;
 IF NOT FOUND OR v.claimed_discord IS DISTINCT FROM p_owner OR NOT v.enterprise OR v.revoked OR (v.expires_at IS NOT NULL AND v.expires_at<=now()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_member=p_owner OR EXISTS(SELECT 1 FROM public.hs_account_licenses WHERE claimed_discord=p_member) OR EXISTS(SELECT 1 FROM public.hs_account_license_members WHERE discord_id=p_member) THEN RAISE EXCEPTION 'Already licensed'; END IF;
 SELECT count(*) INTO n FROM public.hs_account_license_members WHERE license_id=p_license;
 IF n>=v.seats-1 THEN RAISE EXCEPTION 'Seats exhausted'; END IF;
 INSERT INTO public.hs_account_license_members(license_id,discord_id) VALUES(p_license,p_member);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.hs_claim_account_license(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.hs_add_account_member(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.hs_claim_account_license(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hs_add_account_member(uuid,text,text) TO service_role;

NOTIFY pgrst, 'reload schema';
