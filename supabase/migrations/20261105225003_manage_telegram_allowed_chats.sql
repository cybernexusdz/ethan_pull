create table public.telegram_allowed_chats (
  chat_id text primary key check (
    chat_id ~ '^-?[1-9][0-9]{0,19}$'
  ),
  created_at timestamptz not null default now()
);

alter table public.telegram_allowed_chats enable row level security;

revoke all on public.telegram_allowed_chats from anon, authenticated;
grant select, insert, delete on public.telegram_allowed_chats to authenticated;
grant select on public.telegram_allowed_chats to service_role;

create policy "Authenticated users view Telegram allowed chats"
  on public.telegram_allowed_chats
  for select
  to authenticated
  using (true);

create policy "Authenticated users add Telegram allowed chats"
  on public.telegram_allowed_chats
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users remove Telegram allowed chats"
  on public.telegram_allowed_chats
  for delete
  to authenticated
  using (true);