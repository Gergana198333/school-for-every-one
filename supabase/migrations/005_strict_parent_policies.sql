begin;

alter table public.parent_students enable row level security;
alter table public.students enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "parent_students_select_own_links" on public.parent_students;
drop policy if exists "parent_students_insert_own_links" on public.parent_students;
drop policy if exists "parent_students_delete_own_links" on public.parent_students;
drop policy if exists "students_select_for_linked_parents" on public.students;
drop policy if exists "lesson_progress_select_for_linked_parents" on public.lesson_progress;
drop policy if exists "submissions_select_for_linked_parents" on public.submissions;

create policy "parent_students_select_own_links"
on public.parent_students
for select
to authenticated
using (
  parent_user_id = auth.uid()
  and exists (
    select 1
    from public.user_profiles me
    where me.user_id = auth.uid()
      and me.role = 'parent'
  )
);

create policy "parent_students_insert_own_links"
on public.parent_students
for insert
to authenticated
with check (
  parent_user_id = auth.uid()
  and exists (
    select 1
    from public.user_profiles me
    where me.user_id = auth.uid()
      and me.role = 'parent'
  )
);

create policy "parent_students_delete_own_links"
on public.parent_students
for delete
to authenticated
using (
  parent_user_id = auth.uid()
  and exists (
    select 1
    from public.user_profiles me
    where me.user_id = auth.uid()
      and me.role = 'parent'
  )
);

create policy "students_select_for_linked_parents"
on public.students
for select
to authenticated
using (
  exists (
    select 1
    from public.parent_students ps
    join public.user_profiles me
      on me.user_id = auth.uid()
    where ps.parent_user_id = auth.uid()
      and ps.student_id = public.students.id
      and me.role = 'parent'
  )
);

create policy "lesson_progress_select_for_linked_parents"
on public.lesson_progress
for select
to authenticated
using (
  exists (
    select 1
    from public.parent_students ps
    join public.user_profiles me
      on me.user_id = auth.uid()
    where ps.parent_user_id = auth.uid()
      and ps.student_id = public.lesson_progress.student_id
      and me.role = 'parent'
  )
);

create policy "submissions_select_for_linked_parents"
on public.submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.parent_students ps
    join public.user_profiles me
      on me.user_id = auth.uid()
    where ps.parent_user_id = auth.uid()
      and ps.student_id = public.submissions.student_id
      and me.role = 'parent'
  )
);

commit;
