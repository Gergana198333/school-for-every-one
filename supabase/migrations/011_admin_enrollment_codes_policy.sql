begin;

alter table public.enrollment_codes enable row level security;

drop policy if exists "admin_all_enrollment_codes" on public.enrollment_codes;

create policy "admin_all_enrollment_codes"
on public.enrollment_codes
for all
to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

commit;
