#!/usr/bin/env python3

from __future__ import annotations

import json
import logging
import os
import re
import sys
import time
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API_TIMEOUT = 40
POLL_TIMEOUT = 30
REFRESH_INTERVAL = 300
PAGE_SIZE = 1000
MAX_MESSAGE_UNITS = 3900
RESERVED_COMMANDS = {"all"}
ALL_MEMBERS_TITLE = "📢 نــداء الى عمــوم الوحــدات"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("ethan-pull-bot")


class ApiError(RuntimeError):
    """An API request failed with an actionable error."""


def load_local_env() -> None:
    """Load simple KEY=value entries from the workspace .env.local."""
    env_file = Path(__file__).resolve().parents[1] / ".env.local"
    if not env_file.is_file():
        return

    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)


def required_setting(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ApiError(
            f"Missing {name}. Set it in the workspace .env.local or environment."
        )
    return value


def parse_allowed_chat_ids() -> set[int]:
    raw_ids = required_setting("TELEGRAM_ALLOWED_CHAT_IDS")
    try:
        chat_ids = {int(value.strip()) for value in raw_ids.split(",") if value.strip()}
    except ValueError as error:
        raise ApiError(
            "TELEGRAM_ALLOWED_CHAT_IDS must be comma-separated Telegram chat IDs."
        ) from error
    if not chat_ids:
        raise ApiError("TELEGRAM_ALLOWED_CHAT_IDS must contain at least one chat ID.")
    return chat_ids


def api_json(url: str, *, payload: dict[str, Any] | None = None,
             headers: dict[str, str] | None = None, timeout: int = API_TIMEOUT) -> Any:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request_headers = {"Accept": "application/json"}
    if body is not None:
        request_headers["Content-Type"] = "application/json"
    if headers:
        request_headers.update(headers)
    request = Request(url, data=body, headers=request_headers)

    try:
        with urlopen(request, timeout=timeout) as response:
            content = response.read()
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(detail)
            detail = parsed.get("description", detail)
        except (json.JSONDecodeError, AttributeError):
            pass
        raise ApiError(f"HTTP {error.code}: {detail}") from error
    except (TimeoutError, URLError, OSError) as error:
        raise ApiError(f"Request failed: {error}") from error

    try:
        result = json.loads(content)
    except json.JSONDecodeError as error:
        raise ApiError("The API returned an invalid JSON response.") from error

    if isinstance(result, dict) and result.get("ok") is False:
        raise ApiError(str(result.get("description", "Telegram API request failed.")))
    return result


@dataclass(frozen=True)
class Settings:
    telegram_token: str
    supabase_url: str
    supabase_key: str
    target_group_id: int
    allowed_chat_ids: set[int]


def read_settings() -> Settings:
    load_local_env()
    try:
        target_group_id = int(required_setting("TELEGRAM_TARGET_GROUP_ID"))
    except ValueError as error:
        raise ApiError("TELEGRAM_TARGET_GROUP_ID must be a Telegram group chat ID.") from error

    return Settings(
        telegram_token=required_setting("TELEGRAM_BOT_TOKEN"),
        supabase_url=required_setting("NEXT_PUBLIC_SUPABASE_URL").rstrip("/"),
        supabase_key=required_setting("SUPABASE_SERVICE_ROLE_KEY"),
        target_group_id=target_group_id,
        allowed_chat_ids=parse_allowed_chat_ids(),
    )


class DirectoryBot:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.telegram_url = f"https://api.telegram.org/bot{settings.telegram_token}"
        self.supabase_url = f"{settings.supabase_url}/rest/v1"
        self.supabase_headers = {
            "apikey": settings.supabase_key,
            "Authorization": f"Bearer {settings.supabase_key}",
        }
        self.bot_username = ""
        self.next_update_id: int | None = None
        self.departments: dict[str, str] = {}
        self.department_rows: list[dict[str, Any]] = []
        self.members: list[dict[str, Any]] = []
        self.registered_menu: list[dict[str, str]] | None = None
        self.last_refresh = 0.0

    def telegram(self, method: str, payload: dict[str, Any] | None = None,
                 *, timeout: int = API_TIMEOUT) -> Any:
        return api_json(
            f"{self.telegram_url}/{method}",
            payload=payload,
            timeout=timeout,
        )

    def supabase_rows(self, table: str, columns: str) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        offset = 0
        while True:
            query = urlencode({"select": columns, "order": "id"})
            request = Request(
                f"{self.supabase_url}/{table}?{query}",
                headers={
                    **self.supabase_headers,
                    "Range-Unit": "items",
                    "Range": f"{offset}-{offset + PAGE_SIZE - 1}",
                },
            )
            try:
                with urlopen(request, timeout=API_TIMEOUT) as response:
                    page = json.loads(response.read())
            except HTTPError as error:
                detail = error.read().decode("utf-8", errors="replace")
                raise ApiError(f"Supabase {table} query failed (HTTP {error.code}): {detail}") from error
            except (TimeoutError, URLError, OSError) as error:
                raise ApiError(f"Supabase {table} query failed: {error}") from error
            except json.JSONDecodeError as error:
                raise ApiError(f"Supabase returned invalid JSON for {table}.") from error

            if not isinstance(page, list):
                raise ApiError(f"Supabase returned an unexpected response for {table}.")
            rows.extend(page)
            if len(page) < PAGE_SIZE:
                return rows
            offset += PAGE_SIZE

    @staticmethod
    def command_slug(name: str) -> str:
        normalized = unicodedata.normalize("NFKD", name)
        ascii_name = normalized.encode("ascii", errors="ignore").decode("ascii")
        slug = re.sub(r"[^a-z0-9_]+", "_", ascii_name.lower()).strip("_")
        return slug[:32].rstrip("_")

    def build_commands(self, departments: list[dict[str, Any]]) -> dict[str, str]:
        commands: dict[str, str] = {}
        for department in departments:
            name = str(department.get("name", "")).strip()
            slug = self.command_slug(name)
            if not slug:
                logger.warning("Skipping department with no valid Telegram command: %r", name)
                continue
            if slug in RESERVED_COMMANDS or slug in commands:
                logger.warning(
                    "Skipping department %r: command /%s is reserved or conflicts with another department.",
                    name,
                    slug,
                )
                continue
            commands[slug] = name

        available = 100 - len(RESERVED_COMMANDS)
        if len(commands) > available:
            skipped = list(commands)[available:]
            commands = dict(list(commands.items())[:available])
            logger.warning(
                "Telegram supports at most 100 menu commands; omitted %d department commands: %s",
                len(skipped),
                ", ".join(f"/{slug}" for slug in skipped),
            )
        return commands

    def refresh_directory(self) -> None:
        departments = self.supabase_rows("departments", "id,name,telegram_title_ar")
        members = self.supabase_rows(
            "members", "name,telegram_id,telegram_username,department_id"
        )
        commands = self.build_commands(departments)
        menu = [
            {"command": "start", "description": "Show bot instructions"},
            {"command": "help", "description": "List available commands"},
            {"command": "all", "description": "Ping all directory members"},
        ]
        menu.extend(
            {
                "command": slug,
                "description": f"Tag members in {name}"[:256],
            }
            for slug, name in commands.items()
        )

        if menu != self.registered_menu:
            self.telegram("setMyCommands", {"commands": menu})
            self.registered_menu = menu
        self.department_rows = departments
        self.departments = commands
        self.members = members
        self.last_refresh = time.monotonic()
        logger.info(
            "Loaded %d departments and %d members; registered %d department commands.",
            len(departments),
            len(members),
            len(commands),
        )

    def refresh_if_due(self) -> None:
        if time.monotonic() - self.last_refresh < REFRESH_INTERVAL:
            return
        try:
            self.refresh_directory()
        except ApiError as error:
            logger.error("Directory refresh failed; keeping the last loaded data: %s", error)
            self.last_refresh = time.monotonic()

    def check_webhook(self) -> None:
        result = self.telegram("getWebhookInfo")
        webhook_url = result.get("result", {}).get("url", "")
        if webhook_url:
            raise ApiError(
                "This bot has a webhook configured. Disable it in the existing bot setup "
                "before starting this long-polling bot."
            )

    @staticmethod
    def command_from_message(message: dict[str, Any], bot_username: str) -> str | None:
        text = message.get("text")
        if not isinstance(text, str) or not text.startswith("/"):
            return None
        command = text.split(maxsplit=1)[0][1:]
        command_name, separator, target = command.partition("@")
        if separator and target.casefold() != bot_username.casefold():
            return None
        return command_name.lower()

    @staticmethod
    def text_units(text: str) -> int:
        return len(text.encode("utf-16-le")) // 2

    def member_line(self, member: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
        name = str(member.get("name") or "Member").replace("\r", " ").replace("\n", " ").strip()
        username = str(member.get("telegram_username") or "").strip().lstrip("@")
        if username and re.fullmatch(r"[A-Za-z0-9_]{1,32}", username):
            mention = f"@{username}"
            entity = {
                "type": "mention",
                "offset": 0,
                "length": self.text_units(mention),
            }
            return mention, entity

        telegram_id = member.get("telegram_id")
        if telegram_id is not None and str(telegram_id).isdigit():
            mention = name or "Member"
            entity = {
                "type": "text_mention",
                "offset": 0,
                "length": self.text_units(mention),
                "user": {
                    "id": int(telegram_id),
                    "is_bot": False,
                    "first_name": mention[:64],
                },
            }
            return mention, entity
        return None

    def send_member_mentions(self, chat_id: int, command: str) -> None:
        department_name = self.departments.get(command)
        if department_name is None:
            self.send_text(chat_id, "That department command is no longer available. Try /help.")
            return

        department = next(
            (row for row in self.department_rows if row.get("name") == department_name),
            None,
        )
        if department is None:
            self.send_text(chat_id, "I couldn't find that department. Try again after the next refresh.")
            return

        department_id = department.get("id")
        members = [
            member
            for member in self.members
            if member.get("department_id") == department_id
        ]
        self.send_mentions(
            chat_id,
            str(department.get("telegram_title_ar") or f"نــداء الى أعضاء {department_name}"),
            members,
            "لا يوجد أعضاء لديهم بيانات تواصل عبر تيليجرام في هذا القسم.",
        )

    def send_all_mentions(self, chat_id: int) -> None:
        self.send_mentions(
            chat_id,
            ALL_MEMBERS_TITLE,
            self.members,
            "لا يوجد أعضاء لديهم بيانات تواصل عبر تيليجرام.",
        )

    def send_mentions(
        self,
        chat_id: int,
        title: str,
        members: list[dict[str, Any]],
        empty_message: str,
    ) -> None:
        lines = [
            line
            for member in members
            if (line := self.member_line(member)) is not None
        ]
        if not lines:
            self.send_text(chat_id, empty_message)
            return

        header = title
        current_text = header
        current_entities: list[dict[str, Any]] = []
        for line, entity in lines:
            candidate = f"{current_text}\n{line}"
            if self.text_units(candidate) > MAX_MESSAGE_UNITS and current_entities:
                self.send_text(chat_id, current_text, current_entities)
                current_text = f"{header}\n{line}"
                entity = {
                    **entity,
                    "offset": self.text_units(f"{header}\n") + entity["offset"],
                }
                current_entities = [entity]
            else:
                entity = {
                    **entity,
                    "offset": self.text_units(current_text + "\n") + entity["offset"],
                }
                current_text = candidate
                current_entities.append(entity)
        self.send_text(chat_id, current_text, current_entities)

    def send_text(self, chat_id: int, text: str,
                  entities: list[dict[str, Any]] | None = None) -> None:
        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": True,
        }
        if entities:
            payload["entities"] = entities
        self.telegram("sendMessage", payload)

    def handle_message(self, message: dict[str, Any]) -> None:
        chat = message.get("chat", {})
        chat_id = chat.get("id")
        if not isinstance(chat_id, int) or chat_id not in self.settings.allowed_chat_ids:
            if isinstance(chat_id, int):
                logger.warning("Ignored a command from a non-allowlisted chat.")
            return

        command = self.command_from_message(message, self.bot_username)
        if command is None:
            return
        if command == "start":
            self.send_text(
                chat_id,
                "Welcome to the member directory bot. Use /help to see commands for your departments.",
            )
        elif command == "help":
            if not self.refresh_for_command(chat_id):
                return
            self.send_text(chat_id, self.help_text())
        else:
            if not self.refresh_for_command(chat_id):
                return
            if command == "all":
                self.send_all_mentions(self.settings.target_group_id)
            elif command in self.departments:
                self.send_member_mentions(self.settings.target_group_id, command)
            else:
                self.send_text(chat_id, "Unknown command. Try /help.")

    def refresh_for_command(self, chat_id: int) -> bool:
        try:
            self.refresh_directory()
            return True
        except ApiError as error:
            logger.error("Could not refresh the directory before handling a command: %s", error)
            self.send_text(
                chat_id,
                "I couldn't refresh the directory, so no mentions were sent. Please try again.",
            )
            return False

    def help_text(self) -> str:
        command_list = "\n".join(
            f"/{slug} — {name}" for slug, name in self.departments.items()
        )
        if command_list:
            return f"/all — Ping all directory members\n{command_list}"
        return "/all — Ping all directory members\n\nThere are no departments yet."

    def run(self) -> None:
        self.check_webhook()
        me = self.telegram("getMe").get("result", {})
        self.bot_username = str(me.get("username", ""))
        if not self.bot_username:
            raise ApiError("Telegram did not return this bot's username.")

        self.refresh_directory()
        logger.info("Bot @%s is running. Allowed chat IDs are configured.", self.bot_username)

        while True:
            self.refresh_if_due()
            payload: dict[str, Any] = {
                "timeout": POLL_TIMEOUT,
                "allowed_updates": ["message"],
            }
            if self.next_update_id is not None:
                payload["offset"] = self.next_update_id
            try:
                result = self.telegram(
                    "getUpdates",
                    payload,
                    timeout=POLL_TIMEOUT + 10,
                )
            except ApiError as error:
                logger.error("Telegram polling failed; retrying in 5 seconds: %s", error)
                time.sleep(5)
                continue

            for update in result.get("result", []):
                self.next_update_id = int(update["update_id"]) + 1
                message = update.get("message")
                if isinstance(message, dict):
                    try:
                        self.handle_message(message)
                    except ApiError as error:
                        logger.error("Could not handle Telegram update: %s", error)


def main() -> int:
    try:
        DirectoryBot(read_settings()).run()
    except KeyboardInterrupt:
        logger.info("Bot stopped.")
    except ApiError as error:
        logger.error("%s", error)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
