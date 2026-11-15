-- MIGRATION-MEMORY-STRINGS-V31
--
-- "Find THIS text inside THAT process."
--
-- A cheat has to keep things in memory while it runs: a licence key, a session id, the Discord
-- server it talks to, a timestamp it wrote. Windows services keep their own records, and the
-- scanner already reads them:
--   dps     Diagnostic Policy Service   "!!cheat.exe!2024/06/02:22:07:58!"  = a program and when it ran
--   pcasvc  Program Compatibility Assistant — full paths of programs that ran
--
-- So a string seen once inside a confirmed cheat can be looked for on every check afterwards,
-- long after the cheat's files are deleted.
--
-- The PROCESS is part of the rule, not a detail. A string for discord.exe is only looked for
-- inside discord.exe, so a short string cannot match stray bytes in an unrelated program.

create table if not exists public.memory_strings (
  id            uuid primary key default gen_random_uuid(),
  owner_discord text not null,
  process_name  text not null,            -- dps | pcasvc | sysmain | dnscache | discord.exe | …
  client_name   text not null default '', -- what staff call it, shown in the report ("Cheat Discord")
  string        text not null,            -- the text to find
  severity      text not null default 'detect' check (severity in ('detect','warning')),
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists memory_strings_owner_idx on public.memory_strings(owner_discord);
-- the same string twice for the same process is the same rule
create unique index if not exists memory_strings_unique_idx
  on public.memory_strings(owner_discord, lower(process_name), string);

alter table public.memory_strings enable row level security;
revoke all on public.memory_strings from anon, authenticated;

-- The processes staff may add to a scan. Reading another process's memory is a real thing to ask
-- for, so the list is explicit rather than "anything you type".
create table if not exists public.memory_processes (
  id            uuid primary key default gen_random_uuid(),
  owner_discord text not null,
  process_name  text not null,
  created_at    timestamptz not null default now()
);
create unique index if not exists memory_processes_unique_idx
  on public.memory_processes(owner_discord, lower(process_name));
alter table public.memory_processes enable row level security;
revoke all on public.memory_processes from anon, authenticated;

notify pgrst, 'reload schema';
