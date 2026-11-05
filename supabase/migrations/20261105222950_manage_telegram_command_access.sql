create table public.telegram_command_users (
  id uuid primary key default gen_random_uuid(),
  telegram_id text,
  telegram_username text,
  created_at timestamptz not null default now(),
  constraint telegram_command_users_single_identifier check (
    num_nonnulls(telegram_id, telegram_username) = 1
  ),
  constraint telegram_command_users_id_format check (
    telegram_id is null or telegram_id ~ '^[0-9]{1,20}$'
  ),
  constraint telegram_command_users_username_format check (
    telegram_username is null
    or (
      telegram_username = lower(btrim(telegram_username))
      and telegram_username ~ '^[a-z0-9_]{5,32}$'
    )
  )
);

create unique index telegram_command_users_telegram_id_unique
  on public.telegram_command_users (telegram_id)
  where telegram_id is not null;

create unique index telegram_command_users_telegram_username_unique
  on public.telegram_command_users (telegram_username)
  where telegram_username is not null;

alter table public.telegram_command_users enable row level security;

revoke all on public.telegram_command_users from anon, authenticated;
grant select, insert, delete on public.telegram_command_users to authenticated;
grant select on public.telegram_command_users to service_role;

create policy "Authenticated users view Telegram command users"
  on public.telegram_command_users
  for select
  to authenticated
  using (true);

create policy "Authenticated users add Telegram command users"
  on public.telegram_command_users
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users remove Telegram command users"
  on public.telegram_command_users
  for delete
  to authenticated
  using (true);