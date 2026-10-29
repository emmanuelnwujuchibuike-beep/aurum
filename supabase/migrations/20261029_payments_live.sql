-- Demo / live switch. Admin → Settings → "Real payments".
--   payments_live = false (default): demo phase. Every page shows a DEMO label and
--                    the deposit screens hide real wallet addresses / PayPal details.
--   payments_live = true : label removed, real payment details shown.
-- Uses the existing site_settings table (anyone reads, only admins write).
insert into public.site_settings (key, value) values ('payments_live', 'false'::jsonb)
on conflict (key) do nothing;
