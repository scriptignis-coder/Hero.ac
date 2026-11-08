-- HeRo Shield v19 — timed permissions + activity logs (run ONCE in Supabase → SQL Editor; safe to run again)

-- permissions can now end by themselves (1 hour, 2 days, 1 month… / NULL = lifetime)
alter table public.user_access add column if not exists expires_at timestamptz;
alter table public.user_access add column if not exists granted_by text;
alter table public.user_access add column if not exists granted_at timestamptz;

-- activity log: every permission given / removed, every license created / revoked, every PIN created
create table if not exists public.audit_logs (
  id              bigserial primary key,
  created_at      timestamptz not null default now(),
  actor_discord   text,
  actor_name      text,
  action          text not null,      -- permission.grant | permission.revoke | permission.remove | license.create | license.revoke | pin.create | pin.delete | plan.purchase | staff.remove
  target_discord  text,
  target_name     text,
  detail          jsonb
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx   on public.audit_logs (actor_discord, action, created_at desc);
alter table public.audit_logs enable row level security;   -- only the API (service_role) can read / write it

notify pgrst, 'reload schema';
