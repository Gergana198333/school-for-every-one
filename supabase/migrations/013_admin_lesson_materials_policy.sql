begin;

alter table public.lesson_materials enable row level security;

drop policy if exists "admin_all_lesson_materials" on public.lesson_materials;

create policy "admin_all_lesson_materials"
on public.lesson_materials
for all
to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

commit;
