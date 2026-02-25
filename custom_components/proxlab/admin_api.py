"""Anthropic Admin API client for usage and cost reports."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import aiohttp

_LOGGER = logging.getLogger(__name__)

_ADMIN_BASE = "https://api.anthropic.com/v1/organizations"


async def fetch_usage_report(
    admin_key: str, days: int = 30
) -> dict[str, Any]:
    """Fetch usage report from Anthropic Admin API.

    Returns daily token usage grouped by model.
    """
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    url = f"{_ADMIN_BASE}/usage"
    params = {
        "starting_at": start.strftime("%Y-%m-%dT00:00:00Z"),
        "ending_at": now.strftime("%Y-%m-%dT23:59:59Z"),
        "bucket_width": "1d",
        "group_by": "model",
    }
    headers = {
        "x-api-key": admin_key,
        "anthropic-version": "2023-06-01",
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url, params=params, headers=headers,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    _LOGGER.warning(
                        "Admin API usage report failed (%d): %s",
                        resp.status, body[:200],
                    )
                    return {"error": f"HTTP {resp.status}", "detail": body[:200]}
                return await resp.json()
    except Exception as err:
        _LOGGER.error("Admin API usage report error: %s", err)
        return {"error": str(err)}


async def fetch_cost_report(
    admin_key: str, days: int = 30
) -> dict[str, Any]:
    """Fetch cost report from Anthropic Admin API."""
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    url = f"{_ADMIN_BASE}/cost"
    params = {
        "starting_at": start.strftime("%Y-%m-%dT00:00:00Z"),
        "ending_at": now.strftime("%Y-%m-%dT23:59:59Z"),
        "bucket_width": "1d",
    }
    headers = {
        "x-api-key": admin_key,
        "anthropic-version": "2023-06-01",
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url, params=params, headers=headers,
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    _LOGGER.warning(
                        "Admin API cost report failed (%d): %s",
                        resp.status, body[:200],
                    )
                    return {"error": f"HTTP {resp.status}", "detail": body[:200]}
                return await resp.json()
    except Exception as err:
        _LOGGER.error("Admin API cost report error: %s", err)
        return {"error": str(err)}
