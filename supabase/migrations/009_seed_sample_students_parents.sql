begin;

-- 1) Примерен клас (ако го няма)
insert into public.classes (name)
select '5 клас'
where not exists (
  select 1 from public.classes where name = '5 клас'
);

-- 2) Примерни ученици в 5 клас
insert into public.students (full_name, class_id)
select 'Иван Петров', c.id
from public.classes c
where c.name = '5 клас'
  and not exists (
    select 1 from public.students s where s.full_name = 'Иван Петров' and s.class_id = c.id
  );

insert into public.students (full_name, class_id)
select 'Мария Георгиева', c.id
from public.classes c
where c.name = '5 клас'
  and not exists (
    select 1 from public.students s where s.full_name = 'Мария Георгиева' and s.class_id = c.id
  );

insert into public.students (full_name, class_id)
select 'Николай Димитров', c.id
from public.classes c
where c.name = '5 клас'
  and not exists (
    select 1 from public.students s where s.full_name = 'Николай Димитров' and s.class_id = c.id
  );

-- 3) Примерни parent профили (UUID са примерни; може да ги замениш с реални auth user id)
insert into public.user_profiles (user_id, full_name, role, class_id)
select '11111111-1111-1111-1111-111111111111'::uuid, 'Родител Иван Петров', 'parent', c.id
from public.classes c
where c.name = '5 клас'
on conflict (user_id) do update
set full_name = excluded.full_name,
    role = excluded.role,
    class_id = excluded.class_id,
    updated_at = now();

insert into public.user_profiles (user_id, full_name, role, class_id)
select '22222222-2222-2222-2222-222222222222'::uuid, 'Родител Мария Георгиева', 'parent', c.id
from public.classes c
where c.name = '5 клас'
on conflict (user_id) do update
set full_name = excluded.full_name,
    role = excluded.role,
    class_id = excluded.class_id,
    updated_at = now();

insert into public.user_profiles (user_id, full_name, role, class_id)
select '33333333-3333-3333-3333-333333333333'::uuid, 'Родител Николай Димитров', 'parent', c.id
from public.classes c
where c.name = '5 клас'
on conflict (user_id) do update
set full_name = excluded.full_name,
    role = excluded.role,
    class_id = excluded.class_id,
    updated_at = now();

-- 4) Връзка родител -> ученик (parent_students)
insert into public.parent_students (parent_user_id, student_id)
select '11111111-1111-1111-1111-111111111111'::uuid, s.id
from public.students s
join public.classes c on c.id = s.class_id
where c.name = '5 клас' and s.full_name = 'Иван Петров'
on conflict do nothing;

insert into public.parent_students (parent_user_id, student_id)
select '22222222-2222-2222-2222-222222222222'::uuid, s.id
from public.students s
join public.classes c on c.id = s.class_id
where c.name = '5 клас' and s.full_name = 'Мария Георгиева'
on conflict do nothing;

insert into public.parent_students (parent_user_id, student_id)
select '33333333-3333-3333-3333-333333333333'::uuid, s.id
from public.students s
join public.classes c on c.id = s.class_id
where c.name = '5 клас' and s.full_name = 'Николай Димитров'
on conflict do nothing;

-- 5) Примерни кодове за регистрация (ученик + родител)
insert into public.enrollment_codes (code, role, class_id, student_id)
select '5U00234', 'student', c.id, s.id
from public.students s
join public.classes c on c.id = s.class_id
where c.name = '5 клас' and s.full_name = 'Иван Петров'
on conflict (code) do nothing;

insert into public.enrollment_codes (code, role, class_id, student_id)
select '5RU00234', 'parent', c.id, s.id
from public.students s
join public.classes c on c.id = s.class_id
where c.name = '5 клас' and s.full_name = 'Иван Петров'
on conflict (code) do nothing;

insert into public.enrollment_codes (code, role, class_id, student_id)
select '5U00235', 'student', c.id, s.id
from public.students s
join public.classes c on c.id = s.class_id
where c.name = '5 клас' and s.full_name = 'Мария Георгиева'
on conflict (code) do nothing;

insert into public.enrollment_codes (code, role, class_id, student_id)
select '5RU00235', 'parent', c.id, s.id
from public.students s
join public.classes c on c.id = s.class_id
where c.name = '5 клас' and s.full_name = 'Мария Георгиева'
on conflict (code) do nothing;

insert into public.enrollment_codes (code, role, class_id, student_id)
select '5U00236', 'student', c.id, s.id
from public.students s
join public.classes c on c.id = s.class_id
where c.name = '5 клас' and s.full_name = 'Николай Димитров'
on conflict (code) do nothing;

insert into public.enrollment_codes (code, role, class_id, student_id)
select '5RU00236', 'parent', c.id, s.id
from public.students s
join public.classes c on c.id = s.class_id
where c.name = '5 клас' and s.full_name = 'Николай Димитров'
on conflict (code) do nothing;

commit;
