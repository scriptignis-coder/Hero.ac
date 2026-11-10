-- HeRo Shield v26 — run ONCE in Supabase → SQL Editor
-- 👁️ Admin (test): sees every tab of the dashboard, cannot change anything
alter table public.user_access add column if not exists viewer boolean not null default false;
notify pgrst, 'reload schema';
