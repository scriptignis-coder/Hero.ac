-- HeRo Shield v35 — Player history: server name, game and main detections of every scan (run once)
alter table if exists pc_history add column if not exists server_name text;
alter table if exists pc_history add column if not exists game text;
alter table if exists pc_history add column if not exists top text[] not null default '{}';
-- faster ban lookup by identifier (Discord / Steam) across all servers
create index if not exists bans_identifier_idx on bans (identifier);
create index if not exists bans_identifiers_gin on bans using gin (identifiers jsonb_path_ops);
