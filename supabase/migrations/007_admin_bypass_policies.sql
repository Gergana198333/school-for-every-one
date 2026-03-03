begin;

create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.admin_emails (email)
values ('tifani1983@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_admin_email()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_emails a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function public.is_admin_email() to anon, authenticated;

drop policy if exists "admin_all_lessons" on public.lessons;
drop policy if exists "admin_all_lesson_progress" on public.lesson_progress;
drop policy if exists "admin_all_submissions" on public.submissions;
drop policy if exists "admin_all_students" on public.students;
drop policy if exists "admin_all_parent_students" on public.parent_students;
drop policy if exists "admin_all_user_profiles" on public.user_profiles;
drop policy if exists "admin_all_class_room_messages" on public.class_room_messages;

create policy "admin_all_lessons"
on public.lessons
for all
to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy "admin_all_lesson_progress"
on public.lesson_progress
for all
to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy "admin_all_submissions"
on public.submissions
for all
to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy "admin_all_students"
on public.students
for all
to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy "admin_all_parent_students"
on public.parent_students
for all
to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy "admin_all_user_profiles"
on public.user_profiles
for all
to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create policy "admin_all_class_room_messages"
on public.class_room_messages
for all
to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

commit;
