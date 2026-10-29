-- Client testimonials shown on testimonial.html, managed in Admin → Testimonials.
--   testimonials         one row per testimonial (video and/or short quote)
--   testimonial-media    public storage bucket for videos and cover images (admins write)
-- Anyone may read published rows; only admins (public.is_admin()) may read drafts or write.
-- Starts with the three existing client videos (no profit figures). Safe to re-run.

begin;

create table if not exists public.testimonials (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 80),
  role       text not null default '',
  quote      text not null default '',
  video_url  text,
  poster_url text,
  published  boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint testimonials_has_content check (coalesce(video_url, '') <> '' or length(quote) > 0)
);

alter table public.testimonials enable row level security;
drop policy if exists testimonials_read on public.testimonials;
create policy testimonials_read on public.testimonials for select to anon, authenticated
  using (published or public.is_admin());
drop policy if exists testimonials_admin_write on public.testimonials;
create policy testimonials_admin_write on public.testimonials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.testimonials_stamp() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists testimonials_stamp on public.testimonials;
create trigger testimonials_stamp before update on public.testimonials
  for each row execute function public.testimonials_stamp();

insert into public.testimonials (name, role, video_url, poster_url, sort)
select v.name, v.role, v.video_url, v.poster_url, v.sort
from (values
  ('Marcus T.', 'Private investor · Texas, USA', 'videos/testimony1.mp4', 'videos/testimony1.jpeg', 1),
  ('Nigel Lievers', 'Tech executive · Porto, Portugal', 'videos/testimony2.mp4', 'videos/testimony2.jpeg', 2),
  ('Legacy M.', 'Doctor · Sydney, Australia', 'videos/testimony3.mp4', 'videos/testimony3.jpeg', 3)
) as v(name, role, video_url, poster_url, sort)
where not exists (select 1 from public.testimonials t where t.video_url = v.video_url);

insert into storage.buckets (id, name, public) values ('testimonial-media', 'testimonial-media', true)
on conflict (id) do update set public = true;
drop policy if exists testimonial_media_read on storage.objects;
create policy testimonial_media_read on storage.objects for select to anon, authenticated using (bucket_id = 'testimonial-media');
drop policy if exists testimonial_media_admin_insert on storage.objects;
create policy testimonial_media_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'testimonial-media' and public.is_admin());
drop policy if exists testimonial_media_admin_update on storage.objects;
create policy testimonial_media_admin_update on storage.objects for update to authenticated using (bucket_id = 'testimonial-media' and public.is_admin());
drop policy if exists testimonial_media_admin_delete on storage.objects;
create policy testimonial_media_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'testimonial-media' and public.is_admin());

commit;
