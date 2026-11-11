-- HeRo Shield v30 — scan PINs per game (run once in Supabase → SQL editor)
alter table public.scan_pins add column if not exists game text not null default 'fivem';
alter table public.scan_pins drop constraint if exists scan_pins_game_check;
alter table public.scan_pins add constraint scan_pins_game_check check (game in ('fivem','redm','minecraft','roblox'));

-- signatures can be limited to some games (empty = every game)
alter table public.signatures add column if not exists games text[] not null default '{}';
