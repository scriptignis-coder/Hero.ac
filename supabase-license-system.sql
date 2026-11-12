-- Run in Supabase SQL editor. Server-only access: no public grants / RLS policies.
create table if not exists public.hs_licenses (
 id uuid primary key default gen_random_uuid(),
 code_hash text unique not null,
 issued_to_discord text not null,
 owner_identity text unique,
 plan text not null check(plan in ('personal','pro','enterprise')),
 seats integer not null default 1 check(seats between 1 and 500),
 status text not null default 'active' check(status in ('active','revoked')),
 expires_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.hs_license_members (
 license_id uuid not null references public.hs_licenses(id) on delete cascade,
 identity text not null unique,
 created_at timestamptz not null default now(),
 primary key(license_id,identity)
);
alter table public.hs_licenses enable row level security;
alter table public.hs_license_members enable row level security;
revoke all on public.hs_licenses from anon,authenticated;
revoke all on public.hs_license_members from anon,authenticated;
create or replace function public.hs_claim_license(p_hash text,p_identity text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
 if length(p_identity)<5 then raise exception 'Invalid identity'; end if;
 select id into v_id from hs_licenses where code_hash=p_hash and owner_identity is null and status='active' and (expires_at is null or expires_at>now()) for update;
 if v_id is null then raise exception 'Unavailable license'; end if;
 if exists(select 1 from hs_licenses where owner_identity=p_identity) or exists(select 1 from hs_license_members where identity=p_identity) then raise exception 'Identity already licensed'; end if;
 update hs_licenses set owner_identity=p_identity where id=v_id;
 return true;
end $$;
create or replace function public.hs_add_member(p_license uuid,p_owner text,p_identity text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v hs_licenses%rowtype; n integer;
begin
 select * into v from hs_licenses where id=p_license for update;
 if not found or v.owner_identity<>p_owner or v.plan<>'enterprise' or v.status<>'active' or (v.expires_at is not null and v.expires_at<=now()) then raise exception 'Not authorized'; end if;
 if p_identity=v.owner_identity or exists(select 1 from hs_licenses where owner_identity=p_identity) then raise exception 'Already licensed'; end if;
 select count(*) into n from hs_license_members where license_id=p_license;
 if n>=v.seats-1 then raise exception 'Seats exhausted'; end if;
 insert into hs_license_members(license_id,identity) values(p_license,p_identity);
 return true;
end $$;
revoke all on function public.hs_claim_license(text,text) from public,anon,authenticated;
revoke all on function public.hs_add_member(uuid,text,text) from public,anon,authenticated;
grant execute on function public.hs_claim_license(text,text) to service_role;
grant execute on function public.hs_add_member(uuid,text,text) to service_role;
