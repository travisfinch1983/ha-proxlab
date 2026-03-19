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
    CONNECTION_TYPE_CLAUDE_ADDON,
    CONNECTION_TYPE_OLLAMA,
    CONNECTION_TYPE_OPENAI,
    DOMAIN,
    EMBEDDING_PROVIDER_OLLAMA,
    HEALTH_CHECK_INTERVAL,
    HEALTH_CHECK_TIMEOUT,
)
from .helpers import is_ollama_backend

_LOGGER = logging.getLogger(__name__)

# Capabilities that use specific API endpoints beyond /models
_LLM_CAPS = {"conversation", "tool_use"}
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
    available_models: list[str] | None = None


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

        # Close session after each cycle to prevent connection pool accumulation
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None

        old_data = self.data or {}

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

        # Fire HA events on model state transitions
        for conn_id, new_result in data.items():
            old_result = old_data.get(conn_id)
            if old_result is None:
                continue
            old_models = set(old_result.available_models or [])
            new_models = set(new_result.available_models or [])

            for model in old_models - new_models:
                self.hass.bus.async_fire("proxlab_model_unloaded", {
                    "connection_id": conn_id,
                    "model": model,
                })
                _LOGGER.info("Model '%s' unloaded from connection '%s'", model, conn_id)

            for model in new_models - old_models:
                self.hass.bus.async_fire("proxlab_model_loaded", {
                    "connection_id": conn_id,
                    "model": model,
                })
                _LOGGER.info("Model '%s' loaded on connection '%s'", model, conn_id)

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

        connection_type = conn.get("connection_type")

        # Explicit connection_type takes priority over heuristics
        if connection_type == CONNECTION_TYPE_OPENAI:
            pass  # Fall through to OpenAI-compatible check below
        elif connection_type == CONNECTION_TYPE_CLAUDE_ADDON:
            pass  # Claude Code add-on proxy speaks OpenAI format
        elif connection_type == CONNECTION_TYPE_OLLAMA:
            return await self._check_ollama_connection(
                session, conn, base_url, model_name, capabilities
            )
        elif is_ollama_backend(base_url):
            # No explicit type — use URL heuristic as fallback
            return await self._check_ollama_connection(
                session, conn, base_url, model_name, capabilities
            )

        # Phase 1: Connectivity — hit /models
        reachable = False
        try:
            async with session.get(f"{base_url}/models") as resp:
                # 5xx means the server (or proxy) is up but the backend is down
                if resp.status >= 500:
                    return ConnectionCheckResult(
                        reachable=True,
                        api_valid=False,
                        detail=f"Backend error (HTTP {resp.status})",
                        error="Backend Down",
                        model_name=model_name,
                    )
                reachable = True
                # Try to extract the model name from response
                available: list[str] = []
                if resp.status == 200:
                    try:
                        body = await resp.json()
                        # OpenAI-compatible format
                        if isinstance(body, dict) and "data" in body:
                            models = body["data"]
                            if models and isinstance(models, list):
                                available = [m.get("id") for m in models if m.get("id")]
                                model_name = available[0] if available else model_name
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
            available_models=available or None,
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
        # base_url may already include /v1 (e.g. https://api.anthropic.com/v1)
        if base_url.rstrip("/").endswith("/v1"):
            models_url = f"{base_url.rstrip('/')}/models"
        else:
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

    async def _check_ollama_connection(
        self,
        session: aiohttp.ClientSession,
        conn: dict[str, Any],
        base_url: str,
        model_name: str | None,
        capabilities: set[str],
    ) -> ConnectionCheckResult:
        """Check an Ollama connection using native API endpoints.

        Ollama uses /api/tags (list models) and /api/embeddings instead of
        the OpenAI-compatible /v1/models and /v1/embeddings.
        """
        # Strip any path to get native Ollama base URL (scheme://host:port)
        from urllib.parse import urlparse
        parsed = urlparse(base_url)
        native_base = f"{parsed.scheme}://{parsed.netloc}"

        # Phase 1: Connectivity — GET /api/tags
        try:
            async with session.get(f"{native_base}/api/tags") as resp:
                if resp.status != 200:
                    return ConnectionCheckResult(
                        reachable=True,
                        api_valid=False,
                        detail=f"Ollama /api/tags returned {resp.status}",
                        error="API Error",
                        model_name=model_name,
                    )
                # Try to extract model info from response
                available: list[str] = []
                try:
                    body = await resp.json()
                    if isinstance(body, dict) and "models" in body:
                        models = body["models"]
                        if models and isinstance(models, list):
                            available = [
                                m.get("name", m.get("model"))
                                for m in models
                                if m.get("name") or m.get("model")
                            ]
                            # Use configured model name, or fall back to first
                            if not model_name:
                                model_name = available[0] if available else model_name
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

        # Phase 2: Probe Ollama-native capability endpoints
        if capabilities & _EMBEDDING_CAPS:
            try:
                async with session.post(
                    f"{native_base}/api/embeddings", json={}
                ) as resp:
                    if resp.status == 404:
                        return ConnectionCheckResult(
                            reachable=True,
                            api_valid=False,
                            detail="Ollama /api/embeddings not found",
                            error="API Mismatch",
                            model_name=model_name,
                        )
                    # 400 is expected (empty payload) — endpoint exists
            except (aiohttp.ClientError, asyncio.TimeoutError, OSError):
                return ConnectionCheckResult(
                    reachable=True,
                    api_valid=False,
                    detail="Ollama /api/embeddings timed out",
                    error="API Mismatch",
                    model_name=model_name,
                )

        if capabilities & _LLM_CAPS:
            try:
                async with session.post(
                    f"{native_base}/api/chat", json={}
                ) as resp:
                    if resp.status == 404:
                        return ConnectionCheckResult(
                            reachable=True,
                            api_valid=False,
                            detail="Ollama /api/chat not found",
                            error="API Mismatch",
                            model_name=model_name,
                        )
                    # 400 is expected (empty payload) — endpoint exists
            except (aiohttp.ClientError, asyncio.TimeoutError, OSError):
                return ConnectionCheckResult(
                    reachable=True,
                    api_valid=False,
                    detail="Ollama /api/chat timed out",
                    error="API Mismatch",
                    model_name=model_name,
                )

        return ConnectionCheckResult(
            reachable=True,
            api_valid=True,
            detail="OK",
            error=None,
            model_name=model_name,
            available_models=available or None,
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
