-- Run in Supabase SQL Editor. Private by default; server-side API uses service role.
create table if not exists leaderboard_optins (
  discord_id text primary key,
  opted_in boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table leaderboard_optins enable row level security;
create index if not exists leaderboard_optins_enabled_idx on leaderboard_optins(opted_in) where opted_in = true;
notify pgrst, 'reload schema';
