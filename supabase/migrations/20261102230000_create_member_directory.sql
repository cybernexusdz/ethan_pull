create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);

create unique index if not exists departments_name_unique
  on public.departments (lower(name));

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  telegram_id text check (telegram_id is null or char_length(btrim(telegram_id)) > 0),
  telegram_username text check (telegram_username is null or char_length(btrim(telegram_username)) > 0),
  department_id uuid references public.departments (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint members_telegram_contact_required check (
    nullif(btrim(telegram_id), '') is not null
    or nullif(btrim(telegram_username), '') is not null
  )
);

create unique index if not exists members_telegram_id_unique
  on public.members (telegram_id)
  where telegram_id is not null;

create unique index if not exists members_telegram_username_unique
  on public.members (lower(telegram_username))
  where telegram_username is not null;

alter table public.departments enable row level security;
alter table public.members enable row level security;

revoke all on public.departments, public.members from anon;
grant select, insert, update, delete on public.departments, public.members to authenticated;

drop policy if exists "Authenticated users manage departments" on public.departments;
create policy "Authenticated users manage departments"
  on public.departments
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users manage members" on public.members;
create policy "Authenticated users manage members"
  on public.members
  for all
  to authenticated
  using (true)
  with check (true);
