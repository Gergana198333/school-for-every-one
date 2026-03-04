begin;

insert into public.student_quick_login_codes (code, login_email, quick_password, is_active)
values
  ('5U00235', 'office@bergovaai.com', 'maria123', true)
on conflict (code) do update
set login_email = excluded.login_email,
    quick_password = excluded.quick_password,
    is_active = true,
    updated_at = now();

insert into public.parent_quick_login_codes (code, login_email, quick_password, is_active)
values
  ('5RU00235', 'koki.moki1974@gmail.com', 'kkkkkk', true)
on conflict (code) do update
set login_email = excluded.login_email,
    quick_password = excluded.quick_password,
    is_active = true,
    updated_at = now();

commit;
