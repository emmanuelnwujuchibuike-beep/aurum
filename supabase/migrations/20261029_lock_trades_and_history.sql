-- SECURITY (found 2026-10-29), safe for the current live pages:
-- 1. open_trades had UPDATE and DELETE policies named "service_role_*" but granted
--    to PUBLIC with USING (true): anyone, even signed out, could change or delete
--    every customer's open trades. Service role bypasses RLS anyway, so these
--    policies only ever opened the table. Narrow them to the owner's own rows
--    (the current trade page closes a CFD by updating its own row).
-- 2. transactions: "own rows" was FOR ALL, so customers could edit or delete their
--    own history (e.g. change a pending deposit amount or mark it approved). No page
--    updates or deletes transactions from the browser (admin uses the server
--    function), so keep only SELECT and INSERT for customers.
-- Admins keep full access through public.is_admin(). Safe to re-run.

begin;

drop policy if exists service_role_update_trades on public.open_trades;
drop policy if exists service_role_delete_trades on public.open_trades;
drop policy if exists open_trades_update_own on public.open_trades;
drop policy if exists open_trades_delete_own on public.open_trades;
create policy open_trades_update_own on public.open_trades
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy open_trades_delete_own on public.open_trades
  for delete to authenticated using (auth.uid() = user_id);
drop policy if exists open_trades_admin_all on public.open_trades;
create policy open_trades_admin_all on public.open_trades
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "transactions: own rows" on public.transactions;
drop policy if exists transactions_admin_all on public.transactions;
create policy transactions_admin_all on public.transactions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

commit;
