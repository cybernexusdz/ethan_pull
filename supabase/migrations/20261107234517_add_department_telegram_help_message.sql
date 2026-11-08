alter table public.departments
  add column telegram_help_message text,
  add constraint departments_telegram_help_message_check
    check (
      telegram_help_message is null
      or char_length(trim(telegram_help_message)) between 1 and 160
    );