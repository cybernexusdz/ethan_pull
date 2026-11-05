# Ethan Pull Telegram bot

## Configure

Add these values to the workspace root `.env.local` (the file is ignored by Git):

```env
TELEGRAM_BOT_TOKEN=your-token-from-botfather
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

`NEXT_PUBLIC_SUPABASE_URL` should already be present in `.env.local`. Set the destination group in the web app under **Command access**; neither the destination group nor allowed chat IDs are configured in `.env.local`.

Apply the hosted database migrations, then set the destination group and add allowed chat IDs and permitted users in **Command access** before using the bot. Use Telegram's actual numeric chat IDs (supergroups usually start with `-100`). Add a private chat ID to trigger commands privately or a group ID to allow commands there. If either allowlist is empty or cannot be loaded, commands are denied. Mention commands are also denied if the destination group is missing or cannot be loaded.

If upgrading from `TELEGRAM_ALLOWED_CHAT_IDS`, copy each existing comma-separated ID into **Allowed chats** before removing the environment variable.

If upgrading from `TELEGRAM_TARGET_GROUP_ID`, enter its value under **Destination group** before removing it from `.env.local`.

Command access is controlled separately by two lists in the signed-in web app: **Allowed chats** determines where commands can be sent, and **Allowed users** determines who can send them. The bot checks both lists for every command, so changes apply immediately without restarting it. Use Telegram user IDs for reliability because usernames can change.

The service-role key bypasses row-level security, so keep it secret and never use it in browser code.

Create the bot with [@BotFather](https://t.me/BotFather), add it to your Telegram group, and give it permission to send messages. For group commands, disable BotFather's privacy mode if the bot needs to receive commands in group chats.

## Start

From the workspace root:

```powershell
python bot\main.py
```

The bot registers `/start`, `/help`, `/all`, and each department command at startup. It reloads the full directory every five minutes. Commands fetch only the data they need: `/help` reloads departments, `/all` reloads all members, and a department command reloads departments plus that department's member assignments. A member can belong to multiple departments but is mentioned only once by `/all`. Updates are therefore used the next time a command runs, while avoiding unnecessary table reads. The destination group is loaded from Supabase for every mention command, so web changes apply without restarting the bot. Department commands are added to Telegram's menu when refreshed. `/all` and department commands send mentions to the destination group; `/start` and `/help` reply in the chat where they were issued. In Telegram forum topics, replies are sent in the topic where the command was used. Mention commands keep the topic only when issued in the destination group; commands triggered elsewhere send mentions to that group's General topic because topic IDs are local to each group. Apply pending migrations to the hosted database with `supabase db push --remote` before using the Arabic title field, multiple-department assignments, and web-managed bot settings.

Department names are normalized to Telegram command syntax (`a-z`, `0-9`, and `_`). Empty names, conflicting normalized names, and reserved commands (`/start`, `/help`, and `/all`) are skipped with a warning. Telegram allows at most 100 menu commands.

Member lists are sent as Telegram expandable blockquotes: the Arabic title stays visible while the mentions can be expanded or collapsed to save space. Members with a Telegram username are shown as `@username` on their own line. Members without a username are mentioned by Telegram ID, using their saved name as the visible text. A bot can only successfully notify people Telegram allows it to message.