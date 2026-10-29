-- SECURITY (AUDIT S2): customers can no longer change balances from the browser.
-- Apply only after the pages that call the `money` function are deployed.
--   profiles.cash  — only server code (no auth.uid()) or an admin may change it
--   holdings       — customers: read own rows only; writes via mx_* functions / admins
--   open_trades    — customers: read own rows only; writes via mx_* functions / admins
--   transactions   — customers: read own rows; insert only PENDING deposit/withdraw requests
-- Admins keep full access via public.is_admin() (admin function uses the service role).
-- Safe to re-run.

begin;

-- profiles.cash: ignore changes from customers (rest of their update still applies)
create or replace function public.protect_profile_money() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'UPDATE' then
    new.cash := old.cash;
  else
    new.cash := 0;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_money on public.profiles;
create trigger protect_profile_money before insert or update on public.profiles
  for each row execute function public.protect_profile_money();

-- holdings
drop policy if exists holdings_insert_own on public.holdings;
drop policy if exists holdings_update_own on public.holdings;
drop policy if exists holdings_delete_own on public.holdings;
drop policy if exists holdings_admin_all on public.holdings;
create policy holdings_admin_all on public.holdings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- open_trades
drop policy if exists users_insert_own_trades on public.open_trades;
drop policy if exists open_trades_update_own on public.open_trades;
drop policy if exists open_trades_delete_own on public.open_trades;

-- transactions: only pending deposit / withdraw requests from customers
drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_request on public.transactions
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and ((type = 'deposit' and usd_amount > 0) or (type = 'withdraw' and usd_amount < 0))
  );

commit;
