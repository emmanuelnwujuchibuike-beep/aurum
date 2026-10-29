-- Lock down live-chat tables (AUDIT.md S1).
-- Before: anyone with the public anon key could read every chat session
-- (names, emails) and message, and could insert "agent" replies into any chat.
-- After:
--   * visitors may only CREATE sessions and send messages as sender_role='user'
--   * only admins (profiles.is_admin) may read, reply to, resolve or delete chats
--   * a visitor fetches the support replies for their own chat through
--     chat_agent_replies(), keyed by the unguessable session id the widget holds
-- Live replies reach the visitor through a Realtime *broadcast* sent by the
-- admin console (chat-widget.js / contact.html), so no read access is needed.
-- Safe to run more than once.

begin;

-- 1. Admin check usable inside RLS (security definer avoids recursive RLS on profiles)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 2. Enable RLS and drop every existing policy on the two tables
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('chat_sessions', 'chat_messages')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 3. Visitors: insert only
create policy chat_sessions_visitor_insert on public.chat_sessions
  for insert to anon, authenticated
  with check (status = 'open');

create policy chat_messages_visitor_insert on public.chat_messages
  for insert to anon, authenticated
  with check (sender_role = 'user' or public.is_admin());

-- 4. Admins: full access
create policy chat_sessions_admin_all on public.chat_sessions
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy chat_messages_admin_select on public.chat_messages
  for select to authenticated using (public.is_admin());
create policy chat_messages_admin_update on public.chat_messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy chat_messages_admin_delete on public.chat_messages
  for delete to authenticated using (public.is_admin());

-- 5. Visitor reads the agent replies for their own session only
create or replace function public.chat_agent_replies(p_session_id text, p_after timestamptz default null)
returns setof public.chat_messages -- agent rows only, so no visitor PII is returned
language sql
stable
security definer
set search_path = public
as $$
  select m.*
  from public.chat_messages m
  where m.session_id = p_session_id
    and m.sender_role = 'agent'
    and length(p_session_id) >= 20
    and (p_after is null or m.created_at > p_after)
  order by m.created_at
  limit 200;
$$;
revoke all on function public.chat_agent_replies(text, timestamptz) from public;
grant execute on function public.chat_agent_replies(text, timestamptz) to anon, authenticated;

commit;

-- ── Run these after the migration to verify ────────────────────────────────
-- Must return true for the account you use in the contact.html admin console:
--   select email, p.is_admin from auth.users u join public.profiles p on p.id = u.id where p.is_admin;
-- Must list only the 6 policies created above:
--   select tablename, policyname, cmd, roles from pg_policies where tablename like 'chat%';
