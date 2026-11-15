-- FIX-LICENSE-RENEWAL-V29  (run this AFTER V28 — or instead of it, it contains V28 too)
--
-- WHAT V28 MISSED
-- V28 let the claim function accept a renewing customer, but the UPDATE then hit this:
--
--     duplicate key value violates unique constraint "hs_account_licenses_claimed_unique"
--
-- That index is:
--     CREATE UNIQUE INDEX hs_account_licenses_claimed_unique
--       ON hs_account_licenses(claimed_discord) WHERE claimed_discord IS NOT NULL;
--
-- so a Discord account may appear as claimed_discord on ONE row in the whole table, for
-- ever — including rows whose licence is long expired or revoked. The old dead row kept
-- the seat and the new claim could not be written.
--
-- THE FIX
-- Before writing the new claim, the function releases that account's DEAD licences
-- (revoked, or past their expiry) by clearing claimed_discord on them. A dead licence has
-- no reason to hold a name. Nothing is deleted, and the history stays readable:
--   - discord_user_id still records who the licence was ISSUED to
--   - redeemed_at still records when it was redeemed
-- Only the live-seat marker is released.
--
-- Safe to run more than once. It does not delete any row.

CREATE OR REPLACE FUNCTION public.hs_claim_account_license(p_hash text, p_discord text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.hs_account_licenses%ROWTYPE;
BEGIN
  IF p_discord !~ '^[0-9]{17,20}$' THEN RAISE EXCEPTION 'Invalid Discord ID'; END IF;

  SELECT * INTO v FROM public.hs_account_licenses WHERE license_key = p_hash FOR UPDATE;
  IF NOT FOUND OR v.revoked OR v.claimed_discord IS NOT NULL
     OR (v.expires_at IS NOT NULL AND v.expires_at <= now()) THEN
    RAISE EXCEPTION 'License unavailable or already claimed';
  END IF;

  IF v.discord_user_id IS DISTINCT FROM p_discord THEN
    RAISE EXCEPTION 'License issued to a different recipient';
  END IF;

  -- a LIVE licence still blocks a second one (V28)
  IF EXISTS (SELECT 1 FROM public.hs_account_licenses
             WHERE claimed_discord = p_discord
               AND id <> v.id
               AND NOT revoked
               AND (expires_at IS NULL OR expires_at > now()))
     OR EXISTS (SELECT 1 FROM public.hs_account_license_members m
                JOIN public.hs_account_licenses l ON l.id = m.license_id
                WHERE m.discord_id = p_discord
                  AND NOT l.revoked
                  AND (l.expires_at IS NULL OR l.expires_at > now())) THEN
    RAISE EXCEPTION 'Discord account already licensed';
  END IF;

  -- release this account's DEAD licences, so the unique index has room for the new claim
  UPDATE public.hs_account_licenses
     SET claimed_discord = NULL
   WHERE claimed_discord = p_discord
     AND id <> v.id
     AND (revoked OR (expires_at IS NOT NULL AND expires_at <= now()));

  UPDATE public.hs_account_licenses
     SET claimed_discord = p_discord, redeemed_at = now()
   WHERE id = v.id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.hs_add_account_member(p_license uuid, p_owner text, p_member text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.hs_account_licenses%ROWTYPE; n integer;
BEGIN
  IF p_member !~ '^[0-9]{17,20}$' THEN RAISE EXCEPTION 'Invalid Discord ID'; END IF;

  SELECT * INTO v FROM public.hs_account_licenses WHERE id = p_license FOR UPDATE;
  IF NOT FOUND OR v.claimed_discord IS DISTINCT FROM p_owner OR NOT v.enterprise
     OR v.revoked OR (v.expires_at IS NOT NULL AND v.expires_at <= now()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_member = p_owner
     OR EXISTS (SELECT 1 FROM public.hs_account_licenses
                WHERE claimed_discord = p_member
                  AND NOT revoked
                  AND (expires_at IS NULL OR expires_at > now()))
     OR EXISTS (SELECT 1 FROM public.hs_account_license_members m
                JOIN public.hs_account_licenses l ON l.id = m.license_id
                WHERE m.discord_id = p_member
                  AND NOT l.revoked
                  AND (l.expires_at IS NULL OR l.expires_at > now())) THEN
    RAISE EXCEPTION 'Already licensed';
  END IF;

  -- a member joining a new team also releases their dead seats
  DELETE FROM public.hs_account_license_members m
   USING public.hs_account_licenses l
   WHERE m.license_id = l.id
     AND m.discord_id = p_member
     AND (l.revoked OR (l.expires_at IS NOT NULL AND l.expires_at <= now()));

  SELECT count(*) INTO n FROM public.hs_account_license_members WHERE license_id = p_license;
  IF n >= v.seats - 1 THEN RAISE EXCEPTION 'Seats exhausted'; END IF;

  INSERT INTO public.hs_account_license_members(license_id, discord_id) VALUES (p_license, p_member);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.hs_claim_account_license(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hs_add_account_member(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hs_claim_account_license(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.hs_add_account_member(uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

-- Optional: see which accounts are currently holding a seat with a DEAD licence.
-- They are released automatically the next time they claim, so you do not have to do anything.
--
--   select claimed_discord, discord_user_id, revoked, expires_at
--   from public.hs_account_licenses
--   where claimed_discord is not null
--     and (revoked or (expires_at is not null and expires_at <= now()))
--   order by expires_at;
