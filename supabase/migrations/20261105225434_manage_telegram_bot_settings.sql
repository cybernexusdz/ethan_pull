create table public.telegram_bot_settings (
  id boolean primary key default true check (id),
  target_group_id text check (
    target_group_id is null or target_group_id ~ '^-[1-9][0-9]{0,19}$'
  ),
  updated_at timestamptz not null default now()
);

insert into public.telegram_bot_settings (id, target_group_id)
values (true, null);

alter table public.telegram_bot_settings enable row level security;

revoke all on public.telegram_bot_settings from anon, authenticated;
grant select, insert, update on public.telegram_bot_settings to authenticated;
grant select on public.telegram_bot_settings to service_role;

create policy "Authenticated users view Telegram bot settings"
  on public.telegram_bot_settings
  for select
  to authenticated
  using (true);

create policy "Authenticated users add Telegram bot settings"
  on public.telegram_bot_settings
  for insert
  to authenticated
  with check (id);

create policy "Authenticated users update Telegram bot settings"
  on public.telegram_bot_settings
  for update
  to authenticated
  using (id)
  with check (id);