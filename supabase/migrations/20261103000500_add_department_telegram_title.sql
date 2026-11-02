alter table public.departments
  add column telegram_title_ar text;

update public.departments
set telegram_title_ar = 'نــداء الى أعضاء ' || name
where telegram_title_ar is null or char_length(btrim(telegram_title_ar)) = 0;

alter table public.departments
  alter column telegram_title_ar set not null,
  alter column telegram_title_ar set default 'نــداء الى أعضاء الوحدة',
  add constraint departments_telegram_title_ar_not_empty
    check (char_length(btrim(telegram_title_ar)) > 0);
