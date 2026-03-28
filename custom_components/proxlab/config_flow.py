"""Config flow for ProxLab integration.

v2 architecture: Connections pool + Roles assignment system.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

import aiohttp
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import device_registry as dr, entity_registry as er, selector

from .const import (
    CONF_CONNECT_PROXLAB,
    CONF_CONNECTIONS,
    CONF_PROXLAB_URL,
    CONF_ROLES,
    CONFIG_VERSION,
    DEFAULT_NAME,
    DEFAULT_ROLES,
    DOMAIN,
)
from .exceptions import AuthenticationError, ValidationError

_LOGGER = logging.getLogger(__name__)

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

OPENAI_BASE_URL = "https://api.openai.com/v1"


def normalize_url(url: str) -> str:
    """Normalize a URL for OpenAI-compatible endpoints.

    Strips known endpoint suffixes (/chat/completions, /embeddings, etc.)
    so the base URL can be reused for any endpoint type. Adds /v1 if no
    path is present (bare IP:PORT).
    """
    url = url.strip().rstrip("/")
    if not url:
        return url
    if not url.startswith(("http://", "https://")):
        url = f"http://{url}"
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return url
    # Strip known endpoint suffixes that the code appends automatically
    _ENDPOINT_SUFFIXES = (
        "/chat/completions",
        "/audio/speech",
        "/audio/transcriptions",
        "/embeddings",
        "/models",
    )
    for suffix in _ENDPOINT_SUFFIXES:
        if url.endswith(suffix):
            url = url[:-len(suffix)].rstrip("/")
            break
    if not parsed.path or parsed.path == "/":
        url = f"{url}/v1"
    return url


def _validate_proxy_headers(headers_input: str | dict[str, str] | None) -> dict[str, str]:
    """Validate proxy headers configuration."""
    if not headers_input:
        return {}
    if isinstance(headers_input, str):
        headers_input = headers_input.strip()
        if not headers_input:
            return {}
        try:
            headers = json.loads(headers_input)
        except json.JSONDecodeError as err:
            raise ValidationError(f"Invalid JSON format for proxy headers: {err}") from err
    else:
        headers = headers_input
    if not isinstance(headers, dict):
        raise ValidationError("Proxy headers must be a JSON object (dictionary)")
    for key, value in headers.items():
        if not re.match(r"^[a-zA-Z0-9\-_]+$", key):
            raise ValidationError(
                f"Invalid header name '{key}'. Header names must contain only "
                "alphanumeric characters, hyphens, and underscores (RFC 7230)"
            )
        if not isinstance(value, str):
            raise ValidationError(
                f"Header value for '{key}' must be a string, got {type(value).__name__}"
            )
    return headers


def _new_connection_id() -> str:
    """Generate a short unique connection ID."""
    return uuid4().hex[:8]


# -------------------------------------------------------------------
# ConfigFlow (initial setup)
# -------------------------------------------------------------------


class ProxLabAgentConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):  # type: ignore[call-arg]
    """Handle initial config flow for ProxLab (v2)."""

    VERSION = CONFIG_VERSION

    def __init__(self) -> None:
        """Initialize the config flow."""
        self._data: dict[str, Any] = {}

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Handle the initial step - simplified setup.

        Collects: name, connect_proxlab checkbox, proxlab_url.
        Creates entry with empty connections/roles (v2 data shape).
        """
        errors: dict[str, str] = {}

        if user_input is not None:
            try:
                connect_proxlab = user_input.get(CONF_CONNECT_PROXLAB, False)
                proxlab_url = user_input.get(CONF_PROXLAB_URL, "").strip().rstrip("/")

                entry_data: dict[str, Any] = {
                    "name": user_input.get("name", DEFAULT_NAME),
                    CONF_CONNECTIONS: {},
                    CONF_ROLES: dict(DEFAULT_ROLES),
                }

                if connect_proxlab and proxlab_url:
                    from .proxlab_api import check_proxlab_connection

                    reachable = await check_proxlab_connection(proxlab_url)
                    if not reachable:
                        errors["base"] = "cannot_connect"
                        raise ValidationError("Cannot connect to ProxLab")
                    entry_data[CONF_PROXLAB_URL] = proxlab_url

                self._data.update(entry_data)

                return self.async_create_entry(
                    title=user_input.get("name", DEFAULT_NAME),
                    data=self._data,
                )

            except ValidationError:
                if not errors:
                    errors["base"] = "invalid_config"
            except Exception as err:
                _LOGGER.exception("Unexpected error during config flow: %s", err)
                errors["base"] = "unknown"

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required("name", default=DEFAULT_NAME): str,
                    vol.Optional(CONF_CONNECT_PROXLAB, default=False): bool,
                    vol.Optional(
                        CONF_PROXLAB_URL,
                        description={"suggested_value": "http://10.0.0.140:7777"},
                    ): str,
                }
            ),
            errors=errors,
            description_placeholders={
                "setup_message": (
                    "Configure connections and roles in integration options after setup."
                ),
            },
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> ProxLabAgentOptionsFlow:
        """Get the options flow for this handler."""
        return ProxLabAgentOptionsFlow(config_entry)


# -------------------------------------------------------------------
# OptionsFlow — redirects to sidebar panel
# -------------------------------------------------------------------


class ProxLabAgentOptionsFlow(config_entries.OptionsFlow):
    """Minimal options flow that redirects to the sidebar panel."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize the options flow."""
        self._config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Show message directing users to the sidebar panel."""
        if user_input is not None:
            return self.async_create_entry(data=self._config_entry.options)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({}),
            description_placeholders={
                "panel_url": "/proxlab",
            },
        )
