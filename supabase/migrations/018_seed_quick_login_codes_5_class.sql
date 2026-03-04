begin;

insert into public.classes (name)
select '5 клас'
where not exists (
  select 1 from public.classes where name = '5 клас'
);

insert into public.students (full_name, class_id)
select seed.full_name, c.id
from public.classes c
join (
  values
    ('Гергана Пенкина'),
    ('Иван Петров'),
    ('Николай Димитров'),
    ('Мария Георгиева')
) as seed(full_name) on true
where c.name = '5 клас'
  and not exists (
    select 1
    from public.students s
    where s.full_name = seed.full_name
      and s.class_id = c.id
  );

insert into public.enrollment_codes (code, role, class_id, student_id)
select seed.student_code, 'student', c.id, s.id
from public.classes c
join (
  values
    ('Гергана Пенкина', '5U00237'),
    ('Иван Петров', '5U00234'),
    ('Николай Димитров', '5U00236'),
    ('Мария Георгиева', '5U00235')
) as seed(full_name, student_code) on true
join public.students s on s.full_name = seed.full_name and s.class_id = c.id
where c.name = '5 клас'
on conflict (code) do update
set class_id = excluded.class_id,
    student_id = excluded.student_id;

insert into public.enrollment_codes (code, role, class_id, student_id)
select seed.parent_code, 'parent', c.id, s.id
from public.classes c
join (
  values
    ('Гергана Пенкина', '5RU00237'),
    ('Иван Петров', '5RU00234'),
    ('Николай Димитров', '5RU00236'),
    ('Мария Георгиева', '5RU00235')
) as seed(full_name, parent_code) on true
join public.students s on s.full_name = seed.full_name and s.class_id = c.id
where c.name = '5 клас'
on conflict (code) do update
set class_id = excluded.class_id,
    student_id = excluded.student_id;

insert into public.student_quick_login_codes (code, student_id, login_email, quick_password, is_active)
select
  seed.student_code,
  s.id,
  seed.login_email,
  seed.quick_password,
  true
from public.classes c
join (
  values
    ('Гергана Пенкина', '5U00237', 'student.5u00237@example.com', 'u237123'),
    ('Иван Петров', '5U00234', 'student.5u00234@example.com', 'u234123'),
    ('Николай Димитров', '5U00236', 'student.5u00236@example.com', 'u236123'),
    ('Мария Георгиева', '5U00235', 'office@bergovaai.com', 'maria123')
) as seed(full_name, student_code, login_email, quick_password) on true
join public.students s on s.full_name = seed.full_name and s.class_id = c.id
where c.name = '5 клас'
on conflict (code) do update
set student_id = excluded.student_id,
    login_email = excluded.login_email,
    quick_password = excluded.quick_password,
    is_active = true,
    updated_at = now();

insert into public.parent_quick_login_codes (code, student_id, login_email, quick_password, is_active)
select
  seed.parent_code,
  s.id,
  seed.login_email,
  seed.quick_password,
  true
from public.classes c
join (
  values
    ('Гергана Пенкина', '5RU00237', 'parent.5ru00237@example.com', 'p237123'),
    ('Иван Петров', '5RU00234', 'parent.5ru00234@example.com', 'p234123'),
    ('Николай Димитров', '5RU00236', 'parent.5ru00236@example.com', 'p236123'),
    ('Мария Георгиева', '5RU00235', 'koki.moki1974@gmail.com', 'kkkkkk')
) as seed(full_name, parent_code, login_email, quick_password) on true
join public.students s on s.full_name = seed.full_name and s.class_id = c.id
where c.name = '5 клас'
on conflict (code) do update
set student_id = excluded.student_id,
    login_email = excluded.login_email,
    quick_password = excluded.quick_password,
    is_active = true,
    updated_at = now();

commit;
