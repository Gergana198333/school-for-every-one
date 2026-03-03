begin;

create table if not exists public.lesson_materials (
  id bigint generated always as identity primary key,
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_url text,
  file_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_materials_lesson_id on public.lesson_materials(lesson_id);
create index if not exists idx_lesson_materials_created_at on public.lesson_materials(created_at desc);

commit;
