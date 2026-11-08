-- HeRoShield V13: scanner-only licenses. Run after the existing supabase-all.sql.
create extension if not exists pgcrypto;
create table if not exists public.scanner_licenses (
 id uuid primary key default gen_random_uuid(),
 owner_discord text not null,
 label text not null,
 license_key text not null unique,
 revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists scanner_licenses_owner_idx on public.scanner_licenses(owner_discord,created_at desc);
alter table public.scanner_licenses enable row level security;
-- Backend uses service_role; do not grant client-side public read/write access.
alter table public.scan_pins add column if not exists license_id uuid references public.scanner_licenses(id) on delete restrict;
alter table public.scan_pins alter column server_id drop not null;
create index if not exists scan_pins_license_idx on public.scan_pins(license_id,created_at desc);
create unique index if not exists scan_pins_pin_unique_idx on public.scan_pins(pin);
notify pgrst, 'reload schema';
