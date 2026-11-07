-- Run once in Supabase SQL Editor. Server service_role only; never expose keys.
create table if not exists public.paid_entitlements (
 discord_id text primary key, plan text not null, lifetime boolean not null default false,
 expires_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.billing_payments (
 stripe_payment_id text primary key, discord_id text not null, plan text not null,
 stripe_session_id text not null, created_at timestamptz not null default now()
);
alter table public.paid_entitlements enable row level security;
alter table public.billing_payments enable row level security;
revoke all on public.paid_entitlements from anon, authenticated;
revoke all on public.billing_payments from anon, authenticated;
