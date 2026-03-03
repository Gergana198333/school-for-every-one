begin;

alter table public.students
  add column if not exists auth_user_id uuid unique;

create table if not exists public.enrollment_codes (
  id bigint generated always as identity primary key,
  code text not null unique,
  role text not null check (role in ('student', 'parent')),
  class_id bigint references public.classes(id) on delete set null,
  student_id bigint references public.students(id) on delete set null,
  is_used boolean not null default false,
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_enrollment_codes_role on public.enrollment_codes(role);
create index if not exists idx_enrollment_codes_student_id on public.enrollment_codes(student_id);

alter table public.enrollment_codes enable row level security;

drop policy if exists "enrollment_codes_no_direct_read" on public.enrollment_codes;
create policy "enrollment_codes_no_direct_read"
on public.enrollment_codes
for select
to authenticated, anon
using (false);

create or replace function public.claim_enrollment_code(
  p_code text,
  p_full_name text default null,
  p_expected_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_code text := upper(trim(coalesce(p_code, '')));
  code_row public.enrollment_codes%rowtype;
  student_row public.students%rowtype;
  resolved_class_id bigint;
  resolved_role text;
begin
  if current_user_id is null then
    raise exception 'Нужно е влизане в профил.';
  end if;

  if normalized_code = '' then
    raise exception 'Въведете код от училището.';
  end if;

  select *
  into code_row
  from public.enrollment_codes
  where upper(code) = normalized_code
  for update;

  if not found then
    raise exception 'Невалиден код.';
  end if;

  if code_row.is_used then
    raise exception 'Кодът вече е използван.';
  end if;

  resolved_role := code_row.role;

  if p_expected_role is not null and p_expected_role <> resolved_role then
    raise exception 'Кодът е за роля %, а не за %.', resolved_role, p_expected_role;
  end if;

  if resolved_role = 'student' then
    resolved_class_id := code_row.class_id;

    if code_row.student_id is not null then
      select *
      into student_row
      from public.students
      where id = code_row.student_id
      for update;

      if student_row.auth_user_id is not null and student_row.auth_user_id <> current_user_id then
        raise exception 'Този ученически код вече е свързан с друг акаунт.';
      end if;

      update public.students
      set auth_user_id = current_user_id,
          full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
          class_id = coalesce(code_row.class_id, class_id),
          updated_at = now()
      where id = code_row.student_id;

      resolved_class_id := coalesce(code_row.class_id, student_row.class_id);
    else
      insert into public.students (full_name, class_id, auth_user_id)
      values (coalesce(nullif(trim(p_full_name), ''), 'Ученик'), resolved_class_id, current_user_id)
      returning id into code_row.student_id;

      update public.enrollment_codes
      set student_id = code_row.student_id
      where id = code_row.id;
    end if;

    insert into public.user_profiles (user_id, full_name, role, class_id)
    values (current_user_id, nullif(trim(p_full_name), ''), 'student', resolved_class_id)
    on conflict (user_id) do update
      set full_name = excluded.full_name,
          role = excluded.role,
          class_id = excluded.class_id,
          updated_at = now();
  else
    if code_row.student_id is null then
      raise exception 'Parent кодът няма свързан ученик.';
    end if;

    select s.*
    into student_row
    from public.students s
    where s.id = code_row.student_id;

    if not found then
      raise exception 'Липсва ученик за този parent код.';
    end if;

    resolved_class_id := coalesce(code_row.class_id, student_row.class_id);

    insert into public.user_profiles (user_id, full_name, role, class_id)
    values (current_user_id, nullif(trim(p_full_name), ''), 'parent', resolved_class_id)
    on conflict (user_id) do update
      set full_name = excluded.full_name,
          role = excluded.role,
          class_id = excluded.class_id,
          updated_at = now();

    insert into public.parent_students (parent_user_id, student_id)
    values (current_user_id, code_row.student_id)
    on conflict do nothing;
  end if;

  update public.enrollment_codes
  set is_used = true,
      used_by = current_user_id,
      used_at = now()
  where id = code_row.id;

  return jsonb_build_object(
    'ok', true,
    'role', resolved_role,
    'class_id', resolved_class_id
  );
end;
$$;

grant execute on function public.claim_enrollment_code(text, text, text) to authenticated;

commit;
