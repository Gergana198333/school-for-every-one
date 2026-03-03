begin;

alter table public.user_profiles enable row level security;
alter table public.class_room_messages enable row level security;

drop policy if exists "profiles_select_own_or_same_class" on public.user_profiles;
drop policy if exists "profiles_insert_own" on public.user_profiles;
drop policy if exists "profiles_update_own" on public.user_profiles;
drop policy if exists "class_room_messages_select_by_class" on public.class_room_messages;
drop policy if exists "class_room_messages_insert_by_class" on public.class_room_messages;

create policy "profiles_select_own_or_same_class"
on public.user_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    class_id is not null
    and exists (
      select 1
      from public.user_profiles me
      where me.user_id = auth.uid()
        and me.class_id = public.user_profiles.class_id
        and me.role in ('student', 'teacher', 'parent')
    )
  )
);

create policy "profiles_insert_own"
on public.user_profiles
for insert
to authenticated
with check (user_id = auth.uid());

create policy "profiles_update_own"
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "class_room_messages_select_by_class"
on public.class_room_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profiles me
    where me.user_id = auth.uid()
      and me.class_id = public.class_room_messages.class_id
      and me.role in ('student', 'teacher', 'parent')
  )
);

create policy "class_room_messages_insert_by_class"
on public.class_room_messages
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.user_profiles me
    where me.user_id = auth.uid()
      and me.class_id = public.class_room_messages.class_id
      and me.role in ('student', 'teacher', 'parent')
  )
);

commit;
