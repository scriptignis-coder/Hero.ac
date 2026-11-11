-- HeRo Shield v29 — PC history across every server (run once in Supabase → SQL editor)
-- One row per finished scan: the PC's hardware identifiers + the verdict. No names, no files, no report.
create table if not exists pc_history (
  id          uuid primary key default gen_random_uuid(),
  ids         text[] not null,                 -- 'hwid:…', 'guid:…', 'uuid:…', 'bios:…', 'disk:…'
  pin_id      uuid,
  license_id  uuid,
  verdict     text,                            -- cheating | suspicious | clean
  detections  int not null default 0,
  scanned_at  timestamptz not null default now()
);
create index if not exists pc_history_ids_idx on pc_history using gin (ids);
create index if not exists pc_history_time_idx on pc_history (scanned_at desc);
alter table pc_history enable row level security;   -- only the server (service key) reads / writes it
