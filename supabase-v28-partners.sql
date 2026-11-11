-- HeRo Shield v28 — run ONCE in Supabase → SQL Editor
-- 🤝 Partners shown on the website (added by the Owner / Admins in the dashboard)
create table if not exists public.partners (
  id bigserial primary key,
  guild_id text unique not null,
  name text not null,
  icon text,
  members integer,
  description text not null,
  invite text not null,
  position integer not null default 0,
  added_by text,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;   -- only the server (service key) reads / writes it
notify pgrst, 'reload schema';
