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
