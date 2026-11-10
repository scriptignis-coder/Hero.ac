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

-- v26: 👁️ Admin (test) — sees every tab, cannot change anything
alter table public.user_access add column if not exists viewer boolean not null default false;
notify pgrst, 'reload schema';
