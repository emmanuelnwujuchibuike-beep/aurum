-- site_settings.email — everything the shared email template needs, admin-editable.
-- Sender addresses, admin recipients and footer text now come from here instead of
-- being written into each edge function (and instead of being supplied by the caller,
-- which is what made the email functions an open relay).
-- Safe to re-run: an existing row is left alone so admin edits are never overwritten.
insert into public.site_settings (key, value)
values ('email', jsonb_build_object(
  'brand',          'Aurum Capital',
  'site_url',       'https://aurumcapitalinvest.com',
  'domain',         'aurumcapitalinvest.com',
  'senders',        jsonb_build_array(
                      jsonb_build_object('local', 'noreply', 'name', 'Aurum Capital'),
                      jsonb_build_object('local', 'support', 'name', 'Aurum Capital Support'),
                      jsonb_build_object('local', 'hello',   'name', 'Aurum Capital')
                    ),
  'default_sender', 'noreply',
  'admin_to',       jsonb_build_array('aurumcapitalinvest@gmail.com'),
  'support_email',  'support@aurumcapitalinvest.com',
  'footer_note',    'Dubai · London · New York · Singapore',
  'legal',          'Investing involves risk, including the loss of capital. Past performance is not a guide to future returns.'
))
on conflict (key) do nothing;
