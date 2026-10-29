-- Real-estate listings managed from Admin → Properties.
--   properties            one row per listing (symbol is what holdings / the money function use)
--   property-images       public storage bucket for listing photos (admins upload / delete)
-- site_settings.property_prices (what the money function charges per unit) is kept in sync
-- from this table by a trigger, so an admin price edit is exactly what the server uses.
-- Hidden listings (active = false) stay priced so existing owners can still withdraw.
-- Anyone may read listings; only admins (public.is_admin()) may write. Safe to re-run.

begin;

create table if not exists public.properties (
  sym         text primary key check (sym ~ '^[A-Z0-9]{2,12}$'),
  name        text not null,
  location    text not null default '',
  type        text not null default '',
  description text not null default '',
  price       numeric not null check (price > 0),
  images      text[] not null default '{}',
  active      boolean not null default true,
  sort        int not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.properties enable row level security;
drop policy if exists properties_read on public.properties;
create policy properties_read on public.properties for select to anon, authenticated using (true);
drop policy if exists properties_admin_write on public.properties;
create policy properties_admin_write on public.properties
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Keep the money function's price list in step with the listings
create or replace function public.properties_sync_prices() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.site_settings (key, value)
  values ('property_prices', coalesce((select jsonb_object_agg(sym, price) from public.properties), '{}'::jsonb))
  on conflict (key) do update set value = excluded.value;
  return null;
end $$;
drop trigger if exists properties_sync_prices on public.properties;
create trigger properties_sync_prices after insert or update or delete on public.properties
  for each statement execute function public.properties_sync_prices();

create or replace function public.properties_stamp() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists properties_stamp on public.properties;
create trigger properties_stamp before update on public.properties
  for each row execute function public.properties_stamp();

-- Existing listings (same symbols and unit prices the platform already uses)
insert into public.properties (sym, name, location, type, description, price, images, sort) values
  ('LOND', 'The Shard Tower Suite', 'Southwark, London SE1', 'Commercial', 'Premium commercial suite in London''s iconic Shard skyscraper. Earn stable income from blue-chip tenants.', 500, array['https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1600&q=85'], 1),
  ('DXB', 'Burj Khalifa Residences', 'Downtown Dubai, UAE', 'Hospitality', 'Iconic residences in the world''s tallest building. Benefit from Dubai''s luxury hospitality sector.', 1000, array['https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1600&q=85'], 2),
  ('NYC', 'One Manhattan West', 'Hudson Yards, NY 10001', 'Residential', 'Prime Manhattan real estate in the Hudson Yards development.', 500, array['https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=1600&q=85'], 3),
  ('DXB2', 'Palm Jumeirah Villa', 'Palm Jumeirah, Dubai', 'Luxury Villa', 'Exclusive beachfront villa on the world-famous Palm Jumeirah.', 2000, array['image/palm.jpg'], 4),
  ('SGP', 'Marina Bay Tower', 'Marina Bay, Singapore', 'Commercial', 'Strategic office tower in Singapore''s premier financial district.', 500, array['https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1600&q=85'], 5),
  ('PAR', 'Champs-Élysées Office', '8th Arrondissement, Paris', 'Office', 'Prestigious address on Paris''s most famous boulevard, with corporate office tenants.', 1000, array['https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1600&q=85'], 6)
on conflict (sym) do nothing;

-- Photo storage: public read, admin upload / replace / delete
insert into storage.buckets (id, name, public) values ('property-images', 'property-images', true)
on conflict (id) do update set public = true;
drop policy if exists property_images_read on storage.objects;
create policy property_images_read on storage.objects for select to anon, authenticated using (bucket_id = 'property-images');
drop policy if exists property_images_admin_insert on storage.objects;
create policy property_images_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'property-images' and public.is_admin());
drop policy if exists property_images_admin_update on storage.objects;
create policy property_images_admin_update on storage.objects for update to authenticated using (bucket_id = 'property-images' and public.is_admin());
drop policy if exists property_images_admin_delete on storage.objects;
create policy property_images_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'property-images' and public.is_admin());

commit;
