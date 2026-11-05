alter table public.telegram_allowed_chats
  add column name text;

update public.telegram_allowed_chats
set name = 'Chat ' || chat_id;

alter table public.telegram_allowed_chats
  alter column name set not null,
  add constraint telegram_allowed_chats_name_check
    check (length(trim(name)) between 1 and 80);

grant update on public.telegram_allowed_chats to authenticated;

create policy "Authenticated users update Telegram allowed chats"
  on public.telegram_allowed_chats
  for update
  to authenticated
  using (true)
  with check (true);