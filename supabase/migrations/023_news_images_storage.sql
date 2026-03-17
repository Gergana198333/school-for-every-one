begin;

create table if not exists public.news_posts (
  id bigint generated always as identity primary key,
  title text not null,
  content text not null,
  image_url text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_news_posts_published_at
  on public.news_posts(published_at desc);

alter table public.news_posts
  add column if not exists image_url text;

alter table public.news_posts enable row level security;

drop policy if exists "news_posts_public_read" on public.news_posts;
drop policy if exists "news_posts_admin_insert" on public.news_posts;
drop policy if exists "news_posts_admin_update" on public.news_posts;
drop policy if exists "news_posts_admin_delete" on public.news_posts;

create policy "news_posts_public_read"
on public.news_posts
for select
to anon, authenticated
using (true);

create policy "news_posts_admin_insert"
on public.news_posts
for insert
to authenticated
with check (public.is_admin_email());

create policy "news_posts_admin_update"
on public.news_posts
for update
to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy "news_posts_admin_delete"
on public.news_posts
for delete
to authenticated
using (public.is_admin_email());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'news-images',
  'news-images',
  true,
  5242880,
  array['image/png']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin can upload news images" on storage.objects;
drop policy if exists "admin can update news images" on storage.objects;
drop policy if exists "admin can delete news images" on storage.objects;
drop policy if exists "public can read news images" on storage.objects;

create policy "admin can upload news images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'news-images'
  and public.is_admin_email()
);

create policy "admin can update news images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'news-images'
  and public.is_admin_email()
)
with check (
  bucket_id = 'news-images'
  and public.is_admin_email()
);

create policy "admin can delete news images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'news-images'
  and public.is_admin_email()
);

create policy "public can read news images"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'news-images'
);

commit;
