-- Site-wide settings editable from the admin dashboard.
--   test_mode       boolean  — when true, pages use admin pnl_override values and
--                              mark every affected figure "TEST"; false = real figures only
--   regulator_name  text     — shown in the risk disclosure
--   licence_number  text     — shown in the risk disclosure
-- Anyone may read (pages need them before sign-in); only admins may write.
-- Requires public.is_admin() (created in 20261029_lock_down_chat.sql). Safe to re-run.

begin;

create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.site_settings enable row level security;

drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings
  for select to anon, authenticated using (true);

drop policy if exists site_settings_admin_write on public.site_settings;
create policy site_settings_admin_write on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Stamp who changed what
create or replace function public.site_settings_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists site_settings_stamp on public.site_settings;
create trigger site_settings_stamp before insert or update on public.site_settings
  for each row execute function public.site_settings_stamp();

insert into public.site_settings (key, value) values
  ('test_mode', 'false'::jsonb),
  ('regulator_name', 'null'::jsonb),
  ('licence_number', 'null'::jsonb)
on conflict (key) do nothing;

-- Admin dashboard listens for changes in real time
do $$ begin
  alter publication supabase_realtime add table public.site_settings;
exception when duplicate_object then null; end $$;

commit;
