-- Optional non-destructive migration. Run in Supabase SQL editor after backup.
-- Manual external verdicts are unverified; they must never overwrite HeRoShield scans.
CREATE TABLE IF NOT EXISTS public.hs_external_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id text NOT NULL CHECK (discord_id ~ '^[0-9]{15,22}$'),
  source text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('cheating','suspicious','clean','unknown')),
  notes text,
  evidence_url text,
  scanned_at timestamptz NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hs_external_reports_discord_date_idx ON public.hs_external_reports(discord_id,scanned_at DESC);
ALTER TABLE public.hs_external_reports ENABLE ROW LEVEL SECURITY;
-- No public policies: server API uses the service role with access checks.
