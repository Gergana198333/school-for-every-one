begin;

create table if not exists public.user_profiles (
  user_id uuid primary key,
  full_name text,
  role text not null check (role in ('student', 'teacher', 'parent', 'visitor')),
  class_id bigint references public.classes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_room_messages (
  id bigint generated always as identity primary key,
  class_id bigint not null references public.classes(id) on delete cascade,
  user_id uuid not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_class_id on public.user_profiles(class_id);
create index if not exists idx_class_room_messages_class_id on public.class_room_messages(class_id);
create index if not exists idx_class_room_messages_created_at on public.class_room_messages(created_at desc);

commit;
