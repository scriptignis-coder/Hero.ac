-- MIGRATION-COMMUNITY-SIGNATURES-V30
--
-- A shared signature list every licensed user can see and contribute to.
--
-- THE IMPORTANT DESIGN RULE
-- A community signature NEVER reaches anybody's scanner on its own. It sits in this table
-- until an owner presses "Add to mine", which COPIES it into their own `signatures` row.
-- The scanner feed (api/scanner-sigs.js) still reads only the owner's own signatures, and
-- is not changed by this migration at all.
--
-- The reason is the CitizenFX.FiveM.Native.dll incident: one wrong "+ Add to my signatures"
-- turned the game's own file into a cheat, and every scan flagged it. If a shared list applied
-- to everyone automatically, one bad row would do that across every server at once. Shared to
-- read, opt-in to use.

create table if not exists public.community_signatures (
  id              uuid primary key default gen_random_uuid(),
  author_discord  text not null,
  author_name     text,
  name            text not null,
  file_names      jsonb not null default '[]'::jsonb,
  features        jsonb not null default '[]'::jsonb,
  domains         jsonb not null default '[]'::jsonb,
  hashes          jsonb not null default '[]'::jsonb,
  severity        text not null default 'high',
  games           jsonb not null default '[]'::jsonb,
  note            text,
  imports         integer not null default 0,   -- how many owners added it
  reports         integer not null default 0,   -- how many flagged it as a false positive
  hidden          boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists community_signatures_created_idx on public.community_signatures(created_at desc);
create index if not exists community_signatures_author_idx  on public.community_signatures(author_discord);

-- one report per person per signature
create table if not exists public.community_signature_reports (
  signature_id  uuid not null references public.community_signatures(id) on delete cascade,
  discord_id    text not null,
  reason        text,
  created_at    timestamptz not null default now(),
  primary key (signature_id, discord_id)
);

alter table public.community_signatures        enable row level security;
alter table public.community_signature_reports enable row level security;
revoke all on public.community_signatures        from anon, authenticated;
revoke all on public.community_signature_reports from anon, authenticated;

-- Counting a report, and hiding a row once enough people flag it. Three independent
-- reports is enough to take it out of the list: a signature that several operators call
-- a false positive is not one people should keep importing.
create or replace function public.hs_report_community_signature(p_sig uuid, p_discord text, p_reason text)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.community_signature_reports(signature_id, discord_id, reason)
  values (p_sig, p_discord, left(coalesce(p_reason, ''), 300))
  on conflict (signature_id, discord_id) do update set reason = excluded.reason;

  select count(*) into n from public.community_signature_reports where signature_id = p_sig;
  update public.community_signatures
     set reports = n, hidden = (n >= 3)
   where id = p_sig;
  return n;
end $$;

create or replace function public.hs_count_signature_import(p_sig uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.community_signatures set imports = imports + 1 where id = p_sig;
end $$;

revoke all on function public.hs_report_community_signature(uuid, text, text) from public, anon, authenticated;
revoke all on function public.hs_count_signature_import(uuid) from public, anon, authenticated;
grant execute on function public.hs_report_community_signature(uuid, text, text) to service_role;
grant execute on function public.hs_count_signature_import(uuid) to service_role;

notify pgrst, 'reload schema';
