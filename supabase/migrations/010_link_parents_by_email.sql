begin;

create table if not exists public.parent_email_student_links (
  id bigint generated always as identity primary key,
  parent_email text not null,
  student_id bigint not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_parent_email_links_student_id on public.parent_email_student_links(student_id);
create unique index if not exists uq_parent_email_links_email_student
on public.parent_email_student_links (lower(parent_email), student_id);

create or replace function public.sync_parent_links_from_emails()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_profiles integer := 0;
  inserted_links integer := 0;
  class_updates integer := 0;
begin
  with matched as (
    select
      au.id as parent_user_id,
      trim(coalesce(au.raw_user_meta_data ->> 'full_name', '')) as parent_full_name,
      pel.student_id,
      s.class_id
    from public.parent_email_student_links pel
    join auth.users au
      on lower(au.email) = lower(pel.parent_email)
    join public.students s
      on s.id = pel.student_id
  ),
  upserted_profiles as (
    insert into public.user_profiles (user_id, full_name, role, class_id)
    select
      m.parent_user_id,
      nullif(m.parent_full_name, ''),
      'parent',
      m.class_id
    from matched m
    on conflict (user_id) do update
      set role = 'parent',
          class_id = coalesce(excluded.class_id, public.user_profiles.class_id),
          full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
          updated_at = now()
    returning user_id
  ),
  inserted_parent_students as (
    insert into public.parent_students (parent_user_id, student_id)
    select m.parent_user_id, m.student_id
    from matched m
    on conflict do nothing
    returning id
  ),
  updated_profiles as (
    update public.user_profiles up
    set class_id = s.class_id,
        updated_at = now()
    from public.parent_students ps
    join public.students s on s.id = ps.student_id
    where up.user_id = ps.parent_user_id
      and up.role = 'parent'
      and (up.class_id is distinct from s.class_id)
    returning up.user_id
  )
  select
    (select count(*) from upserted_profiles),
    (select count(*) from inserted_parent_students),
    (select count(*) from updated_profiles)
  into inserted_profiles, inserted_links, class_updates;

  return jsonb_build_object(
    'ok', true,
    'profiles_upserted', inserted_profiles,
    'parent_student_links_inserted', inserted_links,
    'profile_class_updates', class_updates
  );
end;
$$;

grant execute on function public.sync_parent_links_from_emails() to authenticated;

commit;
