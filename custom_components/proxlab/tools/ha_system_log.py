"""Home Assistant system log tool for the ProxLab integration.

Reads recent entries from the HA error log, optionally filtered by severity.
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.core import HomeAssistant

from .registry import BaseTool

_LOGGER = logging.getLogger(__name__)

TOOL_NAME = "ha_system_log"


class HomeAssistantSystemLogTool(BaseTool):
    """Tool for reading Home Assistant system/error logs.

    Gives the LLM the ability to inspect recent log entries so it can
    diagnose configuration errors, integration failures, and other issues
    without the user needing to manually copy-paste logs.
    """

    def __init__(self, hass: HomeAssistant) -> None:
        super().__init__(hass)

    @property
    def name(self) -> str:
        return TOOL_NAME

    @property
    def description(self) -> str:
        return (
            "Read recent Home Assistant system log entries (errors, warnings, info). "
            "Use this to diagnose configuration problems, integration errors, "
            "failed automations, or any system issues the user asks about. "
            "Returns log entries with timestamp, level, source, and message."
        )

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "severity": {
                    "type": "string",
                    "description": (
                        "Filter by minimum severity level. "
                        "'error' = errors only, 'warning' = warnings and errors, "
                        "'all' = everything including info/debug. Default: 'warning'."
                    ),
                    "enum": ["error", "warning", "all"],
                },
                "max_entries": {
                    "type": "integer",
                    "description": (
                        "Maximum number of log entries to return. Default: 50. Max: 200."
                    ),
                },
                "search": {
                    "type": "string",
                    "description": (
                        "Optional text to search for in log messages. "
                        "Case-insensitive. Use to find logs about a specific "
                        "integration, entity, or error type."
                    ),
                },
            },
            "required": [],
        }

    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        """Read system log entries."""
        severity = kwargs.get("severity", "warning")
        max_entries = min(kwargs.get("max_entries", 50), 200)
        search = kwargs.get("search", "").lower()

        entries: list[dict[str, Any]] = []

        # Method 1: Use the system_log component's in-memory records
        sys_log_handler = None
        for handler in logging.root.handlers:
            cls_name = type(handler).__name__
            if cls_name == "LogErrorHandler":
                sys_log_handler = handler
                break

        if sys_log_handler is not None and hasattr(sys_log_handler, "records"):
            records = list(sys_log_handler.records)

            # Map severity filter to logging levels
            level_map = {
                "error": logging.ERROR,
                "warning": logging.WARNING,
                "all": logging.DEBUG,
            }
            min_level = level_map.get(severity, logging.WARNING)

            for record in reversed(records):
                if len(entries) >= max_entries:
                    break

                # Filter by severity
                level = record.get("level")
                if isinstance(level, int) and level < min_level:
                    continue
                elif isinstance(level, str):
                    numeric = getattr(logging, level.upper(), 0)
                    if numeric < min_level:
                        continue

                message = record.get("message", "")
                source = record.get("source", ["unknown"])
                name = record.get("name", "")

                # Filter by search term
                combined = f"{message} {name} {' '.join(source) if isinstance(source, list) else source}"
                if search and search not in combined.lower():
                    continue

                entries.append({
                    "level": record.get("level", "UNKNOWN")
                        if isinstance(record.get("level"), str)
                        else logging.getLevelName(record.get("level", 0)),
                    "source": source,
                    "message": message[:1000],  # Cap very long messages
                    "name": name,
                    "timestamp": record.get("timestamp", 0),
                    "count": record.get("count", 1),
                    "first_occurred": record.get("first_occurred"),
                })
        else:
            # Method 2: Fallback — read the log file directly
            try:
                log_path = self.hass.config.path("home-assistant.log")
                entries = await self._read_log_file(
                    log_path, severity, max_entries, search
                )
            except Exception as err:
                _LOGGER.warning("Failed to read log file: %s", err)
                return {
                    "error": f"Could not read system log: {err}",
                    "entries": [],
                    "total": 0,
                }

        return {
            "entries": entries,
            "total": len(entries),
            "severity_filter": severity,
            "search_filter": search or None,
        }

    async def _read_log_file(
        self,
        log_path: str,
        severity: str,
        max_entries: int,
        search: str,
    ) -> list[dict[str, Any]]:
        """Fallback: read and parse the log file."""
        level_order = {"DEBUG": 0, "INFO": 1, "WARNING": 2, "ERROR": 3, "CRITICAL": 4}
        min_level = {
            "error": level_order["ERROR"],
            "warning": level_order["WARNING"],
            "all": level_order["DEBUG"],
        }.get(severity, level_order["WARNING"])

        entries: list[dict[str, Any]] = []

        def _read():
            with open(log_path, "r", errors="replace") as f:
                return f.readlines()

        try:
            lines = await self.hass.async_add_executor_job(_read)
        except FileNotFoundError:
            return [{"level": "ERROR", "message": f"Log file not found: {log_path}", "source": ["system"]}]

        # Parse from the end (most recent first)
        current_entry: dict[str, Any] | None = None
        for line in reversed(lines):
            if len(entries) >= max_entries:
                break

            # HA log lines start with: YYYY-MM-DD HH:MM:SS.mmm LEVEL (source) [name] message
            # Try to detect a new log entry start
            stripped = line.rstrip()
            if not stripped:
                continue

            # Check if this is a continuation of a multi-line entry
            is_new_entry = False
            for lvl in ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"):
                if f" {lvl} " in stripped[:40]:
                    is_new_entry = True
                    break

            if is_new_entry:
                # Flush previous
                if current_entry:
                    msg = current_entry.get("message", "")
                    if search and search not in msg.lower():
                        current_entry = None
                    else:
                        entries.append(current_entry)
                        current_entry = None

                # Parse this line
                parts = stripped.split(" ", 3)
                if len(parts) >= 4:
                    level_str = parts[2] if len(parts) > 2 else "INFO"
                    entry_level = level_order.get(level_str, 1)
                    if entry_level >= min_level:
                        current_entry = {
                            "level": level_str,
                            "message": parts[3] if len(parts) > 3 else stripped,
                            "source": [parts[0] + " " + parts[1]],
                        }
            elif current_entry:
                # Multi-line continuation — prepend
                current_entry["message"] = stripped + "\n" + current_entry.get("message", "")

        # Flush last
        if current_entry and len(entries) < max_entries:
            msg = current_entry.get("message", "")
            if not search or search in msg.lower():
                entries.append(current_entry)

        return entries
