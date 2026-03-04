begin;

drop policy if exists "admin can upload lesson materials" on storage.objects;
drop policy if exists "admin can read lesson materials" on storage.objects;
drop policy if exists "admin can update lesson materials" on storage.objects;
drop policy if exists "admin can delete lesson materials" on storage.objects;

create policy "admin can upload lesson materials"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'lesson-matirials'
  and public.is_admin_email()
);

create policy "admin can read lesson materials"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'lesson-matirials'
  and public.is_admin_email()
);

create policy "admin can update lesson materials"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'lesson-matirials'
  and public.is_admin_email()
)
with check (
  bucket_id = 'lesson-matirials'
  and public.is_admin_email()
);

create policy "admin can delete lesson materials"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'lesson-matirials'
  and public.is_admin_email()
);

commit;
