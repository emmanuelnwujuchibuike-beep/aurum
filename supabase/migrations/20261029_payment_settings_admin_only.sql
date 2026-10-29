-- AUDIT S6: the policy named "Admin write" allowed anyone (even signed out) to
-- change or delete the bank / e-wallet details customers deposit to.
-- Reading stays public (the deposit screens need it); writing is admin-only.
drop policy if exists "Admin write" on public.payment_settings;
drop policy if exists payment_settings_admin_write on public.payment_settings;
create policy payment_settings_admin_write on public.payment_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
