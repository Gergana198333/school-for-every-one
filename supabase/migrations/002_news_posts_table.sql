begin;

create table if not exists public.news_posts (
  id bigint generated always as identity primary key,
  title text not null,
  content text not null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_news_posts_published_at on public.news_posts(published_at desc);

commit;
