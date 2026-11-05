create table public.member_departments (
  member_id uuid not null references public.members (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  primary key (member_id, department_id)
);

create index member_departments_department_id_idx
  on public.member_departments (department_id);

insert into public.member_departments (member_id, department_id)
select id, department_id
from public.members
where department_id is not null;

alter table public.members
  drop column department_id;

alter table public.member_departments enable row level security;

grant select, insert, update, delete
  on public.member_departments
  to authenticated;

create policy "Authenticated users manage member departments"
  on public.member_departments
  for all
  to authenticated
  using (true)
  with check (true);

create function public.save_member_with_departments(
  p_member_id uuid,
  p_name text,
  p_telegram_id text,
  p_telegram_username text,
  p_department_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_member_id uuid;
begin
  if p_member_id is null then
    insert into public.members (name, telegram_id, telegram_username)
    values (p_name, p_telegram_id, p_telegram_username)
    returning id into saved_member_id;
  else
    update public.members
    set
      name = p_name,
      telegram_id = p_telegram_id,
      telegram_username = p_telegram_username
    where id = p_member_id
    returning id into saved_member_id;

    if saved_member_id is null then
      raise exception 'Member % does not exist or is not accessible', p_member_id
        using errcode = 'P0002';
    end if;
  end if;

  delete from public.member_departments
  where member_id = saved_member_id;

  insert into public.member_departments (member_id, department_id)
  select saved_member_id, selected.department_id
  from unnest(coalesce(p_department_ids, '{}'::uuid[])) as selected(department_id)
  on conflict (member_id, department_id) do nothing;

  return saved_member_id;
end;
$$;

revoke execute on function public.save_member_with_departments(
  uuid, text, text, text, uuid[]
) from public, anon;

grant execute on function public.save_member_with_departments(
  uuid, text, text, text, uuid[]
) to authenticated;