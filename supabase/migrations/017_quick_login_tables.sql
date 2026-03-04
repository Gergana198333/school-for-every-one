begin;

create table if not exists public.student_quick_login_codes (
  id bigint generated always as identity primary key,
  code text not null unique,
  student_id bigint references public.students(id) on delete set null,
  login_email text,
  quick_password text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_quick_login_codes_code_upper check (code = upper(code))
);

create table if not exists public.parent_quick_login_codes (
  id bigint generated always as identity primary key,
  code text not null unique,
  student_id bigint references public.students(id) on delete set null,
  login_email text,
  quick_password text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_quick_login_codes_code_upper check (code = upper(code))
);

create index if not exists idx_student_quick_login_student_id
  on public.student_quick_login_codes(student_id);

create index if not exists idx_parent_quick_login_student_id
  on public.parent_quick_login_codes(student_id);

alter table public.student_quick_login_codes enable row level security;
alter table public.parent_quick_login_codes enable row level security;

drop policy if exists "student_quick_login_codes_admin_manage" on public.student_quick_login_codes;
create policy "student_quick_login_codes_admin_manage"
on public.student_quick_login_codes
for all
to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

drop policy if exists "parent_quick_login_codes_admin_manage" on public.parent_quick_login_codes;
create policy "parent_quick_login_codes_admin_manage"
on public.parent_quick_login_codes
for all
to authenticated
using (public.is_admin_email())
with check (public.is_admin_email());

create or replace function public.resolve_quick_login(
  p_code text,
  p_password text
)
returns table(login_email text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(trim(coalesce(p_code, '')));
  normalized_password text := coalesce(p_password, '');
begin
  if normalized_code = '' or normalized_password = '' then
    return;
  end if;

  return query
  select sq.login_email, 'student'::text
  from public.student_quick_login_codes sq
  where sq.is_active = true
    and sq.code = normalized_code
    and sq.quick_password = normalized_password
    and coalesce(trim(sq.login_email), '') <> ''
  limit 1;

  if found then
    return;
  end if;

  return query
  select pq.login_email, 'parent'::text
  from public.parent_quick_login_codes pq
  where pq.is_active = true
    and pq.code = normalized_code
    and pq.quick_password = normalized_password
    and coalesce(trim(pq.login_email), '') <> ''
  limit 1;
end;
$$;

grant execute on function public.resolve_quick_login(text, text) to anon, authenticated;

commit;
