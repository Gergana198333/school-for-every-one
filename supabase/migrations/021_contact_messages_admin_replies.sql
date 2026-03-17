begin;

alter table public.contact_messages
  add column if not exists reply_text text,
  add column if not exists replied_at timestamptz,
  add column if not exists replied_by text;

create index if not exists idx_contact_messages_replied_at
  on public.contact_messages(replied_at desc);

commit;
