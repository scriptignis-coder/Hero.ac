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
