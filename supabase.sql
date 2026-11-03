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
