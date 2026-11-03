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
