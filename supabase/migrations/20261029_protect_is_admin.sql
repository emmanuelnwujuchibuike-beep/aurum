-- SECURITY: stop customers making themselves admin (found 2026-10-29).
-- RLS let a signed-in user update every column of their own profile, including
-- is_admin, which grants the whole admin panel (approve withdrawals, change any
-- balance, read all chats). Nothing in the app sets is_admin from the browser,
-- so only these may change it from now on:
--   * server-side code (service role / SQL editor / triggers: no auth.uid())
--   * an existing admin
-- Anyone else's change to is_admin is silently ignored (the rest of the update
-- still applies, so normal profile edits keep working). Safe to re-run.

begin;

create or replace function public.protect_is_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then          -- server context: service role, SQL, signup trigger
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not public.is_admin() then new.is_admin := false; end if;
  elsif new.is_admin is distinct from old.is_admin and not public.is_admin() then
    new.is_admin := old.is_admin;
  end if;
  return new;
end $$;

drop trigger if exists protect_is_admin on public.profiles;
create trigger protect_is_admin before insert or update on public.profiles
  for each row execute function public.protect_is_admin();

commit;
