begin;

-- Ensure helper function is executable in policy context
revoke all on function public.is_admin_email() from public;
grant execute on function public.is_admin_email() to anon, authenticated;

-- Remove known problematic policies for dashboard tables
-- lesson_progress

drop policy if exists "lesson_progress_select_for_linked_parents" on public.lesson_progress;
drop policy if exists "lesson_progress_select_for_teacher_class" on public.lesson_progress;
drop policy if exists "lesson_progress_update_for_teacher_class" on public.lesson_progress;
drop policy if exists "admin_all_lesson_progress" on public.lesson_progress;

-- submissions

drop policy if exists "submissions_select_for_linked_parents" on public.submissions;
drop policy if exists "submissions_select_for_teacher_class" on public.submissions;
drop policy if exists "admin_all_submissions" on public.submissions;

alter table public.lesson_progress enable row level security;
alter table public.submissions enable row level security;

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

commit;
