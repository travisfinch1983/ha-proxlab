"""Connection health coordinator for ProxLab.

Periodically checks all configured connections for reachability and API validity.
Results are consumed by sensor, binary_sensor, text, and button entity platforms.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

import aiohttp

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import (
    CONF_CONNECTIONS,
    CONNECTION_TYPE_CLAUDE,
    DOMAIN,
    HEALTH_CHECK_INTERVAL,
    HEALTH_CHECK_TIMEOUT,
)

_LOGGER = logging.getLogger(__name__)

# Capabilities that use specific API endpoints beyond /models
_TTS_CAPS = {"tts"}
_STT_CAPS = {"stt"}
_EMBEDDING_CAPS = {"embeddings"}


@dataclass
class ConnectionCheckResult:
    """Result of a single connection health check."""

    reachable: bool
    api_valid: bool
    detail: str
    error: str | None
    model_name: str | None


class ConnectionHealthCoordinator(DataUpdateCoordinator[dict[str, ConnectionCheckResult]]):
    """Coordinator that periodically checks all connection endpoints."""

    config_entry: ConfigEntry

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize the coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            name=f"{DOMAIN}_health_{entry.entry_id[:8]}",
            update_interval=timedelta(seconds=HEALTH_CHECK_INTERVAL),
            config_entry=entry,
        )
        self._session: aiohttp.ClientSession | None = None

    def _get_session(self) -> aiohttp.ClientSession:
        """Get or create an aiohttp session."""
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=HEALTH_CHECK_TIMEOUT)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    async def _async_update_data(self) -> dict[str, ConnectionCheckResult]:
        """Run health checks on all connections in parallel."""
        connections: dict[str, dict[str, Any]] = self.config_entry.data.get(
            CONF_CONNECTIONS, {}
        )
        if not connections:
            return {}

        tasks = {
            conn_id: self._check_connection(conn_id, conn)
            for conn_id, conn in connections.items()
        }
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)

        data: dict[str, ConnectionCheckResult] = {}
        for conn_id, result in zip(tasks.keys(), results):
            if isinstance(result, Exception):
                _LOGGER.debug("Health check exception for %s: %s", conn_id, result)
                data[conn_id] = ConnectionCheckResult(
                    reachable=False,
                    api_valid=False,
                    detail=str(result),
                    error="Exception",
                    model_name=None,
                )
            else:
                data[conn_id] = result

        return data

    async def _check_connection(
        self, conn_id: str, conn: dict[str, Any]
    ) -> ConnectionCheckResult:
        """Run two-phase check on a single connection."""
        base_url = conn.get("base_url", "").rstrip("/")
        capabilities = set(conn.get("capabilities", []))
        model_name = conn.get("model")
        is_claude = conn.get("connection_type") == CONNECTION_TYPE_CLAUDE

        if not base_url:
            return ConnectionCheckResult(
                reachable=False,
                api_valid=False,
                detail="No base URL configured",
                error="No URL",
                model_name=model_name,
            )

        session = self._get_session()

        if is_claude:
            return await self._check_claude_connection(
                session, conn, base_url, model_name
            )

        # Phase 1: Connectivity — hit /models
        reachable = False
        try:
            async with session.get(f"{base_url}/models") as resp:
                reachable = True
                # Try to extract the model name from response
                if resp.status == 200:
                    try:
                        body = await resp.json()
                        # OpenAI-compatible format
                        if isinstance(body, dict) and "data" in body:
                            models = body["data"]
                            if models and isinstance(models, list):
                                model_name = models[0].get("id", model_name)
                        elif isinstance(body, dict) and "object" in body:
                            model_name = body.get("id", model_name)
                    except Exception:
                        pass
        except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as err:
            return ConnectionCheckResult(
                reachable=False,
                api_valid=False,
                detail=f"Connection failed: {err}",
                error="Unreachable",
                model_name=model_name,
            )

        # Phase 2: API verification — probe capability-specific endpoints
        api_valid, detail, error = await self._probe_api(
            session, base_url, capabilities
        )

        return ConnectionCheckResult(
            reachable=reachable,
            api_valid=api_valid,
            detail=detail,
            error=error,
            model_name=model_name,
        )

    async def _check_claude_connection(
        self,
        session: aiohttp.ClientSession,
        conn: dict[str, Any],
        base_url: str,
        model_name: str | None,
    ) -> ConnectionCheckResult:
        """Check an Anthropic Claude API connection.

        Uses the Anthropic /v1/models endpoint with proper auth headers.
        """
        api_key = conn.get("api_key", "")
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        }
        models_url = f"{base_url}/v1/models"

        try:
            async with session.get(models_url, headers=headers) as resp:
                if resp.status == 401:
                    return ConnectionCheckResult(
                        reachable=True,
                        api_valid=False,
                        detail="Invalid API key",
                        error="Auth Failed",
                        model_name=model_name,
                    )
                if resp.status == 200:
                    return ConnectionCheckResult(
                        reachable=True,
                        api_valid=True,
                        detail="OK",
                        error=None,
                        model_name=model_name,
                    )
                return ConnectionCheckResult(
                    reachable=True,
                    api_valid=False,
                    detail=f"Unexpected status {resp.status}",
                    error="API Error",
                    model_name=model_name,
                )
        except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as err:
            return ConnectionCheckResult(
                reachable=False,
                api_valid=False,
                detail=f"Connection failed: {err}",
                error="Unreachable",
                model_name=model_name,
            )

    async def _probe_api(
        self,
        session: aiohttp.ClientSession,
        base_url: str,
        capabilities: set[str],
    ) -> tuple[bool, str, str | None]:
        """Probe capability-specific endpoints.

        Returns (api_valid, detail, error).
        """
        # If only generic LLM caps, /models success is sufficient
        if not (capabilities & (_TTS_CAPS | _STT_CAPS | _EMBEDDING_CAPS)):
            return True, "OK", None

        # Check capability-specific endpoints
        probes: list[tuple[str, str, str]] = []

        if capabilities & _TTS_CAPS:
            probes.append((
                "POST",
                f"{base_url}/audio/speech",
                "TTS /audio/speech",
            ))

        if capabilities & _STT_CAPS:
            probes.append((
                "POST",
                f"{base_url}/audio/transcriptions",
                "STT /audio/transcriptions",
            ))

        if capabilities & _EMBEDDING_CAPS:
            probes.append((
                "POST",
                f"{base_url}/embeddings",
                "Embeddings /embeddings",
            ))

        for method, url, label in probes:
            try:
                # Send minimal payload to check endpoint existence
                if method == "POST":
                    async with session.post(url, json={}) as resp:
                        if resp.status == 404:
                            return (
                                False,
                                f"Expected {label} but got 404",
                                "API Mismatch",
                            )
                else:
                    async with session.get(url) as resp:
                        if resp.status == 404:
                            return (
                                False,
                                f"Expected {label} but got 404",
                                "API Mismatch",
                            )
            except (aiohttp.ClientError, asyncio.TimeoutError, OSError):
                # Server is reachable (phase 1 passed) but endpoint timed out
                return False, f"{label} endpoint timed out", "API Mismatch"

        return True, "OK", None

    async def async_shutdown(self) -> None:
        """Close the aiohttp session."""
        if self._session and not self._session.closed:
            await self._session.close()
        await super().async_shutdown()
