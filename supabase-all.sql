-- =====================================================================
-- HeRo Shield — COMPLETE database (all tables the website uses)
-- Supabase → SQL Editor → New query → paste ALL of this → Run.
-- Safe to run again on an existing database: it only adds what is missing,
-- it never deletes data.
-- =====================================================================


-- ===== supabase.sql =====
-- HeRo Shield - Supabase schema (SQL Editor -> Run)
create extension if not exists pgcrypto;

create table if not exists servers (
  id            uuid primary key default gen_random_uuid(),
  owner_discord text not null,
  name          text not null,
  license       text not null unique,
  last_seen     timestamptz,
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
-- if you already ran the old version:
alter table servers add column if not exists settings jsonb not null default '{}'::jsonb;

create index if not exists servers_owner_idx on servers(owner_discord);

create table if not exists detections (
  id          bigserial primary key,
  server_id   uuid not null references servers(id) on delete cascade,
  player      text,
  identifier  text,
  reason      text,
  info        text,
  action      text,
  identifiers jsonb default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists detections_server_idx on detections(server_id, created_at desc);

create table if not exists bans (
  id            bigserial primary key,
  server_id     uuid not null references servers(id) on delete cascade,
  ban_id        text not null,
  player        text,
  identifier    text,
  reason        text,
  info          text,
  identifiers   jsonb default '[]'::jsonb,
  active        boolean not null default true,
  unban_pending boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (server_id, ban_id)
);
create index if not exists bans_server_idx on bans(server_id, created_at desc);

create table if not exists players (
  id         bigserial primary key,
  server_id  uuid not null references servers(id) on delete cascade,
  identifier text not null,
  player     text,
  playtime   integer not null default 0,
  sessions   integer not null default 0,
  online     boolean not null default false,
  last_seen  timestamptz not null default now(),
  unique (server_id, identifier)
);
create index if not exists players_server_idx on players(server_id, last_seen desc);

create table if not exists logs (
  id          bigserial primary key,
  server_id   uuid not null references servers(id) on delete cascade,
  category    text,
  title       text,
  message     text,
  player      text,
  identifier  text,
  created_at  timestamptz not null default now()
);
create index if not exists logs_server_idx on logs(server_id, created_at desc);
alter table logs enable row level security;

create table if not exists commands (
  id          bigserial primary key,
  server_id   uuid not null references servers(id) on delete cascade,
  type        text not null,
  target      text not null,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists commands_server_idx on commands(server_id, created_at);
alter table commands enable row level security;

alter table players add column if not exists live_url text;
alter table players add column if not exists live_at timestamptz;
alter table players add column if not exists live_size integer;

alter table bans add column if not exists proof jsonb not null default '{}'::jsonb;

-- Storage for proof screenshots (public links)
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', true)
on conflict (id) do nothing;

-- Only the API (service_role) can access the data
alter table servers    enable row level security;
alter table detections enable row level security;
alter table bans       enable row level security;
alter table players    enable row level security;

-- refresh the API cache
notify pgrst, 'reload schema';


-- ===== supabase-scanner.sql =====
-- HeRo Shield — screenshare scanner add-on (run in Supabase SQL Editor after supabase.sql)

create table if not exists scan_pins (
  id         uuid primary key default gen_random_uuid(),
  server_id  uuid not null references servers(id) on delete cascade,
  pin        text not null,
  player     text,
  used       boolean not null default false,
  result     text,                                   -- cheating | suspicious | clean
  report     jsonb,
  created_at timestamptz not null default now()
);
create index if not exists scan_pins_server_idx on scan_pins(server_id, created_at desc);
alter table scan_pins enable row level security;

create table if not exists signatures (
  id            uuid primary key default gen_random_uuid(),
  owner_discord text not null,
  name          text not null,
  file_names    jsonb not null default '[]'::jsonb,
  features      jsonb not null default '[]'::jsonb,
  severity      text not null default 'high',
  created_at    timestamptz not null default now()
);
alter table signatures add column if not exists domains jsonb not null default '[]'::jsonb;
alter table signatures add column if not exists hashes  jsonb not null default '[]'::jsonb;
create index if not exists signatures_owner_idx on signatures(owner_discord);
alter table signatures enable row level security;

create table if not exists staff (
  id            uuid primary key default gen_random_uuid(),
  owner_discord text not null,
  name          text not null,
  discord_id    text,
  role          text not null default 'staff',       -- admin | staff
  created_at    timestamptz not null default now()
);
create index if not exists staff_owner_idx on staff(owner_discord);
alter table staff enable row level security;

notify pgrst, 'reload schema';


-- ===== supabase-access.sql =====
-- HeRo Shield — dashboard permissions (run ONCE in Supabase → SQL Editor)
-- heroshield = anticheat dashboard tabs, herocheck = screenshare / scan tabs
create table if not exists user_access (
  discord_id  text primary key,
  name        text,
  avatar      text,
  heroshield  boolean not null default false,
  herocheck   boolean not null default false,
  last_login  timestamptz,
  created_at  timestamptz not null default now()
);
alter table user_access enable row level security;  -- only the API (service_role) can read it

notify pgrst, 'reload schema';

-- Upgrade existing deployments safely:
alter table public.user_access add column if not exists admin boolean not null default false;


-- ===== supabase-discord.sql =====
-- HeRo Shield — Discord cheat-server check (run ONCE in Supabase → SQL Editor)
-- the player's Discord + server list (given with consent during the check)
alter table scan_pins add column if not exists discord_check jsonb;

-- your watch-list of cheat Discord servers (added from invite links)
create table if not exists cheat_servers (
  id            uuid primary key default gen_random_uuid(),
  owner_discord text not null,
  guild_id      text not null,
  name          text,
  icon          text,
  invite        text,
  created_at    timestamptz not null default now(),
  unique (owner_discord, guild_id)
);
create index if not exists cheat_servers_owner_idx on cheat_servers(owner_discord);
alter table cheat_servers enable row level security;

notify pgrst, 'reload schema';


-- ===== supabase-scanner-licenses-v13.sql =====
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


-- ===== supabase-scanner-gui-v14.sql =====
-- Run AFTER the V13 all-in-one SQL. Safe for existing scanner_licenses rows.
ALTER TABLE public.scanner_licenses
ADD COLUMN IF NOT EXISTS scanner_bg TEXT NOT NULL DEFAULT '';
NOTIFY pgrst, 'reload schema';


-- ===== supabase-billing.sql =====
-- Run once in Supabase SQL Editor. Server service_role only; never expose keys.
create table if not exists public.paid_entitlements (
 discord_id text primary key, plan text not null, lifetime boolean not null default false,
 expires_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.billing_payments (
 stripe_payment_id text primary key, discord_id text not null, plan text not null,
 stripe_session_id text not null, created_at timestamptz not null default now()
);
alter table public.paid_entitlements enable row level security;
alter table public.billing_payments enable row level security;
revoke all on public.paid_entitlements from anon, authenticated;
revoke all on public.billing_payments from anon, authenticated;


-- ===== supabase-leaderboard.sql =====
-- Run in Supabase SQL Editor. Private by default; server-side API uses service role.
create table if not exists leaderboard_optins (
  discord_id text primary key,
  opted_in boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table leaderboard_optins enable row level security;
create index if not exists leaderboard_optins_enabled_idx on leaderboard_optins(opted_in) where opted_in = true;
notify pgrst, 'reload schema';


-- ===== supabase-v19-permissions-logs.sql =====
-- HeRo Shield v19 — timed permissions + activity logs (run ONCE in Supabase → SQL Editor; safe to run again)

-- permissions can now end by themselves (1 hour, 2 days, 1 month… / NULL = lifetime)
alter table public.user_access add column if not exists expires_at timestamptz;
alter table public.user_access add column if not exists granted_by text;
alter table public.user_access add column if not exists granted_at timestamptz;

-- activity log: every permission given / removed, every license created / revoked, every PIN created
create table if not exists public.audit_logs (
  id              bigserial primary key,
  created_at      timestamptz not null default now(),
  actor_discord   text,
  actor_name      text,
  action          text not null,      -- permission.grant | permission.revoke | permission.remove | license.create | license.revoke | pin.create | pin.delete | plan.purchase | staff.remove
  target_discord  text,
  target_name     text,
  detail          jsonb
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx   on public.audit_logs (actor_discord, action, created_at desc);
alter table public.audit_logs enable row level security;   -- only the API (service_role) can read / write it

notify pgrst, 'reload schema';


-- refresh the API cache once more at the end
notify pgrst, 'reload schema';

-- v26: 👁️ Admin (test) — sees every tab, cannot change anything
alter table public.user_access add column if not exists viewer boolean not null default false;
notify pgrst, 'reload schema';
create table if not exists public.partners (
  id bigserial primary key,
  guild_id text unique not null,
  name text not null,
  icon text,
  members integer,
  description text not null,
  invite text not null,
  position integer not null default 0,
  added_by text,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;   -- only the server (service key) reads / writes it
notify pgrst, 'reload schema';
-- HeRo Shield v29 — PC history across every server (run once in Supabase → SQL editor)
-- One row per finished scan: the PC's hardware identifiers + the verdict. No names, no files, no report.
create table if not exists pc_history (
  id          uuid primary key default gen_random_uuid(),
  ids         text[] not null,                 -- 'hwid:…', 'guid:…', 'uuid:…', 'bios:…', 'disk:…'
  pin_id      uuid,
  license_id  uuid,
  verdict     text,                            -- cheating | suspicious | clean
  detections  int not null default 0,
  scanned_at  timestamptz not null default now()
);
create index if not exists pc_history_ids_idx on pc_history using gin (ids);
create index if not exists pc_history_time_idx on pc_history (scanned_at desc);
alter table pc_history enable row level security;   -- only the server (service key) reads / writes it
-- HeRo Shield v30 — scan PINs per game (run once in Supabase → SQL editor)
alter table public.scan_pins add column if not exists game text not null default 'fivem';
alter table public.scan_pins drop constraint if exists scan_pins_game_check;
alter table public.scan_pins add constraint scan_pins_game_check check (game in ('fivem','redm','minecraft','roblox'));

-- signatures can be limited to some games (empty = every game)
alter table public.signatures add column if not exists games text[] not null default '{}';

-- HeRo Shield v35 — Player history: server name, game and main detections of every scan (run once)
alter table if exists pc_history add column if not exists server_name text;
alter table if exists pc_history add column if not exists game text;
alter table if exists pc_history add column if not exists top text[] not null default '{}';
-- faster ban lookup by identifier (Discord / Steam) across all servers
create index if not exists bans_identifier_idx on bans (identifier);
create index if not exists bans_identifiers_gin on bans using gin (identifiers jsonb_path_ops);
