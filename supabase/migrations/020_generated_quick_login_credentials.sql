begin;

insert into public.student_quick_login_codes (code, login_email, quick_password, is_active)
values
  ('5U00234', 'student.5u00234@ucha-bg.school', 'Stu234!2026', true),
  ('5U00236', 'student.5u00236@ucha-bg.school', 'Stu236!2026', true),
  ('5U00237', 'student.5u00237@ucha-bg.school', 'Stu237!2026', true)
on conflict (code) do update
set login_email = excluded.login_email,
    quick_password = excluded.quick_password,
    is_active = true,
    updated_at = now();

insert into public.parent_quick_login_codes (code, login_email, quick_password, is_active)
values
  ('5RU00234', 'parent.5ru00234@ucha-bg.school', 'Par234!2026', true),
  ('5RU00236', 'parent.5ru00236@ucha-bg.school', 'Par236!2026', true),
  ('5RU00237', 'parent.5ru00237@ucha-bg.school', 'Par237!2026', true)
on conflict (code) do update
set login_email = excluded.login_email,
    quick_password = excluded.quick_password,
    is_active = true,
    updated_at = now();

commit;
