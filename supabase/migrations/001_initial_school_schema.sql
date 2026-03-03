-- Уча България: initial schema (Postgres / Supabase)
-- Safe to run multiple times where possible.

begin;

create table if not exists public.classes (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id bigint generated always as identity primary key,
  full_name text not null,
  class_id bigint references public.classes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parent_students (
  id bigint generated always as identity primary key,
  parent_user_id uuid not null,
  student_id bigint not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (parent_user_id, student_id)
);

create table if not exists public.lessons (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  class_id bigint references public.classes(id) on delete set null,
  subject_id bigint references public.subjects(id) on delete set null,
  teacher_name text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_progress (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students(id) on delete cascade,
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  status text not null check (status in ('not_started', 'in_progress', 'completed')),
  updated_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

create table if not exists public.submissions (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.students(id) on delete cascade,
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  notes text,
  file_name text,
  file_path text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  student_name text not null,
  student_class text not null,
  message text not null,
  homework_file_name text,
  homework_file_url text,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_students_class_id on public.students(class_id);
create index if not exists idx_lessons_class_id on public.lessons(class_id);
create index if not exists idx_lessons_subject_id on public.lessons(subject_id);
create index if not exists idx_progress_student_id on public.lesson_progress(student_id);
create index if not exists idx_progress_lesson_id on public.lesson_progress(lesson_id);
create index if not exists idx_submissions_student_id on public.submissions(student_id);
create index if not exists idx_submissions_lesson_id on public.submissions(lesson_id);
create index if not exists idx_contact_messages_created_at on public.contact_messages(created_at desc);

commit;
