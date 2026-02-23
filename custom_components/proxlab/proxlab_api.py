"""ProxLab API client for service discovery.

Queries the ProxLab DV-Lab API to discover running LLM, TTS, and STT
services, providing auto-populated endpoint URLs in the config flow.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import aiohttp

_LOGGER = logging.getLogger(__name__)

# Timeout for ProxLab API requests
_API_TIMEOUT = aiohttp.ClientTimeout(total=10)

# Provider IDs classified as STT (speech-to-text)
_STT_PROVIDERS = {"faster-whisper"}


@dataclass
class ProxLabService:
    """Represents a discovered ProxLab inference service."""

    id: str
    provider: str
    port: int
    node: str
    container_ip: str
    model: str
    service_type: str  # "llm", "tts", "stt"

    @property
    def base_url(self) -> str:
        """Return the OpenAI-compatible base URL for this service."""
        return f"http://{self.container_ip}:{self.port}/v1"

    @property
    def display_name(self) -> str:
        """Return a human-readable display name."""
        model_part = self.model or "unknown"
        return f"{self.provider} — {model_part} ({self.node})"


def _classify_service(svc: dict[str, Any]) -> str:
    """Classify a raw service dict as llm, tts, or stt.

    Uses the enriched `serviceType` field from the API if available,
    otherwise falls back to classification from `isTts` + `providerId`.
    """
    # Prefer the enriched serviceType from the API
    service_type = svc.get("serviceType")
    if service_type in ("llm", "tts", "stt"):
        return service_type

    # Fallback: classify from isTts flag and provider ID
    if not svc.get("isTts", False):
        return "llm"
    if svc.get("providerId", "") in _STT_PROVIDERS:
        return "stt"
    return "tts"


async def discover_services(
    proxlab_url: str,
) -> list[ProxLabService]:
    """Query ProxLab active-services API to discover running services.

    Args:
        proxlab_url: Base URL for ProxLab (e.g., http://10.0.0.233:7777).

    Returns:
        List of discovered ProxLabService objects.
    """
    url = f"{proxlab_url.rstrip('/')}/api/ai/active-services"

    try:
        async with aiohttp.ClientSession(timeout=_API_TIMEOUT) as session:
            async with session.get(url) as response:
                if response.status != 200:
                    _LOGGER.warning(
                        "ProxLab API returned status %d from %s",
                        response.status,
                        url,
                    )
                    return []

                data = await response.json()

    except aiohttp.ClientError as err:
        _LOGGER.warning("Failed to connect to ProxLab at %s: %s", url, err)
        return []
    except Exception as err:
        _LOGGER.error("Unexpected error querying ProxLab: %s", err)
        return []

    services: list[ProxLabService] = []

    # The API returns { services: { id: {...}, ... } }
    raw_services = data.get("services", {})
    if isinstance(raw_services, dict):
        raw_services = raw_services.values()
    elif not isinstance(raw_services, list):
        raw_services = []

    for svc in raw_services:
        try:
            services.append(
                ProxLabService(
                    id=str(svc.get("id", "")),
                    provider=svc.get("providerName", svc.get("provider", "unknown")),
                    port=int(svc.get("port", 0)),
                    node=svc.get("node", "unknown"),
                    container_ip=svc.get("containerIp", ""),
                    model=svc.get("model", "unknown"),
                    service_type=_classify_service(svc),
                )
            )
        except (ValueError, TypeError) as err:
            _LOGGER.debug("Skipping malformed service entry: %s (%s)", svc, err)
            continue

    _LOGGER.debug("Discovered %d ProxLab services from %s", len(services), url)
    return services


async def check_proxlab_connection(proxlab_url: str) -> bool:
    """Quick connectivity check to ProxLab proxy services endpoint.

    Args:
        proxlab_url: Base URL for ProxLab.

    Returns:
        True if ProxLab is reachable.
    """
    url = f"{proxlab_url.rstrip('/')}/api/proxy/services"
    try:
        async with aiohttp.ClientSession(timeout=_API_TIMEOUT) as session:
            async with session.get(url) as response:
                return response.status == 200
    except Exception:
        return False


def filter_services_by_type(
    services: list[ProxLabService], service_type: str
) -> list[ProxLabService]:
    """Filter discovered services by type.

    Args:
        services: List of all discovered services.
        service_type: Type to filter by ("llm", "tts", "stt").

    Returns:
        Filtered list of services matching the type.
    """
    return [s for s in services if s.service_type == service_type]


def services_to_selector_options(
    services: list[ProxLabService],
) -> list[dict[str, str]]:
    """Convert services to HA selector options format.

    Args:
        services: List of discovered services.

    Returns:
        List of dicts with "value" and "label" keys for HA selectors.
    """
    return [
        {"value": svc.base_url, "label": svc.display_name}
        for svc in services
        if svc.container_ip and svc.port
    ]
