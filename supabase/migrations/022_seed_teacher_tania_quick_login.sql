begin;

insert into public.student_quick_login_codes (code, login_email, quick_password, is_active)
values
  ('5TU00200', 'tania.teacher@ucha-bg.school', 'tania200', true)
on conflict (code) do update
set login_email = excluded.login_email,
    quick_password = excluded.quick_password,
    is_active = true,
    updated_at = now();

commit;
