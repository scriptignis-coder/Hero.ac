-- Run AFTER the V13 all-in-one SQL. Safe for existing scanner_licenses rows.
ALTER TABLE public.scanner_licenses
ADD COLUMN IF NOT EXISTS scanner_bg TEXT NOT NULL DEFAULT '';
NOTIFY pgrst, 'reload schema';
