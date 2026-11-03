-- HeRo Shield — schema Supabase (pour le dashboard web)
-- Supabase -> SQL Editor -> Run.

create table if not exists hs_licenses (
  key text primary key,
  server_name text,
  owner_id text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists hs_servers (
  name text primary key,
  online int default 0,
  max int default 0,
  last_seen timestamptz default now()
);

create table if not exists hs_bans (
  id bigint generated always as identity primary key,
  server_name text,
  type text,
  player_name text,
  identifier text,
  reason text,
  detail text,
  ban_id text,
  expires bigint default 0,
  screenshot text,
  created_at timestamptz default now()
);
create index if not exists hs_bans_srv_idx on hs_bans(server_name, created_at desc);

create table if not exists hs_logs (
  id bigint generated always as identity primary key,
  server_name text,
  type text,
  detail text,
  created_at timestamptz default now()
);
create index if not exists hs_logs_srv_idx on hs_logs(server_name, created_at desc);

create table if not exists hs_players (
  server_name text not null,
  identifier text not null,
  name text,
  playtime_sec bigint default 0,
  online boolean default false,
  last_seen timestamptz default now(),
  primary key (server_name, identifier)
);
create index if not exists hs_players_srv_idx on hs_players(server_name, playtime_sec desc);

alter table hs_licenses enable row level security;
alter table hs_servers  enable row level security;
alter table hs_bans     enable row level security;
alter table hs_logs     enable row level security;
alter table hs_players  enable row level security;
