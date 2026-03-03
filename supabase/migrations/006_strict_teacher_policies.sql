begin;

alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "lessons_select_for_teacher_class" on public.lessons;
drop policy if exists "lessons_insert_for_teacher_class" on public.lessons;
drop policy if exists "lessons_update_for_teacher_class" on public.lessons;
drop policy if exists "lessons_delete_for_teacher_class" on public.lessons;
drop policy if exists "lesson_progress_select_for_teacher_class" on public.lesson_progress;
drop policy if exists "lesson_progress_update_for_teacher_class" on public.lesson_progress;
drop policy if exists "submissions_select_for_teacher_class" on public.submissions;

create policy "lessons_select_for_teacher_class"
on public.lessons
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles me
    where me.user_id = auth.uid()
      and me.role = 'teacher'
      and me.class_id = public.lessons.class_id
  )
);

create policy "lessons_insert_for_teacher_class"
on public.lessons
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_profiles me
    where me.user_id = auth.uid()
      and me.role = 'teacher'
      and me.class_id = public.lessons.class_id
  )
);

create policy "lessons_update_for_teacher_class"
on public.lessons
for update
to authenticated
using (
  exists (
    select 1
    from public.user_profiles me
    where me.user_id = auth.uid()
      and me.role = 'teacher'
      and me.class_id = public.lessons.class_id
  )
)
with check (
  exists (
    select 1
    from public.user_profiles me
    where me.user_id = auth.uid()
      and me.role = 'teacher'
      and me.class_id = public.lessons.class_id
  )
);

create policy "lessons_delete_for_teacher_class"
on public.lessons
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_profiles me
    where me.user_id = auth.uid()
      and me.role = 'teacher'
      and me.class_id = public.lessons.class_id
  )
);

create policy "lesson_progress_select_for_teacher_class"
on public.lesson_progress
for select
to authenticated
using (
  exists (
    select 1
    from public.lessons l
    join public.user_profiles me
      on me.user_id = auth.uid()
    where l.id = public.lesson_progress.lesson_id
      and me.role = 'teacher'
      and me.class_id = l.class_id
  )
);

create policy "lesson_progress_update_for_teacher_class"
on public.lesson_progress
for update
to authenticated
using (
  exists (
    select 1
    from public.lessons l
    join public.user_profiles me
      on me.user_id = auth.uid()
    where l.id = public.lesson_progress.lesson_id
      and me.role = 'teacher'
      and me.class_id = l.class_id
  )
)
with check (
  exists (
    select 1
    from public.lessons l
    join public.user_profiles me
      on me.user_id = auth.uid()
    where l.id = public.lesson_progress.lesson_id
      and me.role = 'teacher'
      and me.class_id = l.class_id
  )
);

create policy "submissions_select_for_teacher_class"
on public.submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.lessons l
    join public.user_profiles me
      on me.user_id = auth.uid()
    where l.id = public.submissions.lesson_id
      and me.role = 'teacher'
      and me.class_id = l.class_id
  )
);

commit;
