-- Admin email sends (Admin > Email): one row per send, with Resend's answer, so
-- delivery problems can be seen and diagnosed. Admins read; the edge function writes.
create table if not exists public.email_log (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  admin_id   uuid,
  sender     text,
  subject    text,
  recipients int,
  sent       int,
  failed     int,
  detail     jsonb
);
alter table public.email_log enable row level security;
drop policy if exists email_log_admin_read on public.email_log;
create policy email_log_admin_read on public.email_log for select to authenticated using (public.is_admin());
