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

from .connection_manager import eligible_connections_for_role
from .const import (
    ALL_CAPABILITIES,
    ALL_ROLES,
    CAPABILITY_LABELS,
    CAP_CONVERSATION,
    CAP_EMBEDDINGS,
    CAP_STT,
    CAP_TTS,
    CAP_TOOL_USE,
    CLAUDE_API_BASE_URL,
    CLAUDE_MODELS,
    CONFIG_VERSION,
    CONNECTION_TYPE_CLAUDE,
    CONNECTION_TYPE_LOCAL,
    CONF_ADDITIONAL_COLLECTIONS,
    CONF_ADDITIONAL_L2_DISTANCE_THRESHOLD,
    CONF_ADDITIONAL_TOP_K,
    CONF_CONNECT_PROXLAB,
    CONF_CONNECTIONS,
    CONF_CONTEXT_FORMAT,
    CONF_CONTEXT_MODE,
    CONF_DEBUG_LOGGING,
    CONF_DIRECT_ENTITIES,
    CONF_EXTERNAL_LLM_ENABLED,
    CONF_HISTORY_ENABLED,
    CONF_HISTORY_MAX_MESSAGES,
    CONF_HISTORY_MAX_TOKENS,
    CONF_MAX_CONTEXT_TOKENS,
    CONF_MEMORY_COLLECTION_NAME,
    CONF_MEMORY_CONTEXT_TOP_K,
    CONF_MEMORY_ENABLED,
    CONF_MEMORY_EXTRACTION_ENABLED,
    CONF_MEMORY_EXTRACTION_LLM,
    CONF_MEMORY_MAX_MEMORIES,
    CONF_MEMORY_MIN_IMPORTANCE,
    CONF_MEMORY_MIN_WORDS,
    CONF_MILVUS_COLLECTION,
    CONF_MILVUS_HOST,
    CONF_MILVUS_PORT,
    CONF_OPENAI_API_KEY,
    CONF_PROMPT_CUSTOM_ADDITIONS,
    CONF_PROMPT_INCLUDE_LABELS,
    CONF_PROMPT_USE_DEFAULT,
    CONF_PROXLAB_URL,
    CONF_ROLES,
    CONF_SESSION_PERSISTENCE_ENABLED,
    CONF_SESSION_TIMEOUT,
    CONF_STREAMING_ENABLED,
    CONF_TOOLS_MAX_CALLS_PER_TURN,
    CONF_TOOLS_TIMEOUT,
    CONF_VECTOR_DB_BACKEND,
    CONF_VECTOR_DB_COLLECTION,
    CONF_VECTOR_DB_HOST,
    CONF_VECTOR_DB_PORT,
    CONF_VECTOR_DB_SIMILARITY_THRESHOLD,
    CONF_VECTOR_DB_TOP_K,
    CONTEXT_FORMAT_HYBRID,
    CONTEXT_FORMAT_JSON,
    CONTEXT_FORMAT_NATURAL_LANGUAGE,
    CONTEXT_MODE_DIRECT,
    CONTEXT_MODE_VECTOR_DB,
    DEFAULT_ADDITIONAL_COLLECTIONS,
    DEFAULT_ADDITIONAL_L2_DISTANCE_THRESHOLD,
    DEFAULT_ADDITIONAL_TOP_K,
    DEFAULT_CONTEXT_FORMAT,
    DEFAULT_CONTEXT_MODE,
    DEFAULT_DEBUG_LOGGING,
    DEFAULT_EXTERNAL_LLM_ENABLED,
    DEFAULT_HISTORY_ENABLED,
    DEFAULT_HISTORY_MAX_MESSAGES,
    DEFAULT_HISTORY_MAX_TOKENS,
    DEFAULT_LLM_KEEP_ALIVE,
    DEFAULT_LLM_MODEL,
    DEFAULT_MAX_CONTEXT_TOKENS,
    DEFAULT_MAX_TOKENS,
    DEFAULT_MEMORY_COLLECTION_NAME,
    DEFAULT_MEMORY_CONTEXT_TOP_K,
    DEFAULT_MEMORY_ENABLED,
    DEFAULT_MEMORY_EXTRACTION_ENABLED,
    DEFAULT_MEMORY_EXTRACTION_LLM,
    DEFAULT_MEMORY_MAX_MEMORIES,
    DEFAULT_MEMORY_MIN_IMPORTANCE,
    DEFAULT_MEMORY_MIN_WORDS,
    DEFAULT_MILVUS_COLLECTION,
    DEFAULT_MILVUS_HOST,
    DEFAULT_MILVUS_PORT,
    DEFAULT_NAME,
    DEFAULT_PROMPT_INCLUDE_LABELS,
    DEFAULT_PROMPT_USE_DEFAULT,
    DEFAULT_ROLES,
    DEFAULT_SESSION_PERSISTENCE_ENABLED,
    DEFAULT_SESSION_TIMEOUT,
    DEFAULT_STREAMING_ENABLED,
    DEFAULT_TEMPERATURE,
    DEFAULT_THINKING_ENABLED,
    DEFAULT_TOOLS_MAX_CALLS_PER_TURN,
    DEFAULT_TOOLS_TIMEOUT,
    DEFAULT_TTS_FORMAT,
    DEFAULT_TTS_MODEL,
    DEFAULT_TTS_SPEED,
    DEFAULT_TTS_VOICE,
    DEFAULT_VECTOR_DB_BACKEND,
    DEFAULT_VECTOR_DB_COLLECTION,
    DEFAULT_VECTOR_DB_HOST,
    DEFAULT_VECTOR_DB_PORT,
    DEFAULT_VECTOR_DB_SIMILARITY_THRESHOLD,
    DEFAULT_VECTOR_DB_TOP_K,
    DOMAIN,
    EMBEDDING_PROVIDER_OLLAMA,
    EMBEDDING_PROVIDER_OPENAI,
    LLM_CAPABILITIES,
    ROLE_LABELS,
    ROLE_TO_CAPABILITY,
    VECTOR_DB_BACKEND_CHROMADB,
    VECTOR_DB_BACKEND_MILVUS,
)
from .exceptions import AuthenticationError, ValidationError

_LOGGER = logging.getLogger(__name__)

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

OPENAI_BASE_URL = "https://api.openai.com/v1"


def normalize_url(url: str) -> str:
    """Normalize a URL for OpenAI-compatible endpoints."""
    url = url.strip().rstrip("/")
    if not url:
        return url
    if not url.startswith(("http://", "https://")):
        url = f"http://{url}"
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return url
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
                        description={"suggested_value": "http://10.0.0.233:7777"},
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
# OptionsFlow (v2: Connections + Roles)
# -------------------------------------------------------------------


class ProxLabAgentOptionsFlow(config_entries.OptionsFlow):
    """Handle options flow for ProxLab v2."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize the options flow."""
        self._config_entry = config_entry
        self._proxlab_services: list | None = None
        # Temp state for multi-step connection flows
        self._adding_connection: dict[str, Any] = {}
        self._editing_connection_id: str | None = None
        self._editing_connection: dict[str, Any] = {}

    # -----------------------------------------------------------
    # ProxLab service discovery helpers
    # -----------------------------------------------------------

    async def _get_proxlab_services(self) -> list:
        """Fetch and cache ProxLab services for this options session."""
        if self._proxlab_services is not None:
            return self._proxlab_services
        proxlab_url = self._config_entry.data.get(CONF_PROXLAB_URL, "")
        if not proxlab_url:
            self._proxlab_services = []
            return self._proxlab_services
        try:
            from .proxlab_api import discover_services

            self._proxlab_services = await discover_services(proxlab_url)
        except Exception as err:
            _LOGGER.warning("Failed to fetch ProxLab services: %s", err)
            self._proxlab_services = []
        return self._proxlab_services

    # -----------------------------------------------------------
    # Main menu
    # -----------------------------------------------------------

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Options main menu."""
        return self.async_show_menu(
            step_id="init",
            menu_options=[
                "connections",
                "role_assignments",
                "proxlab_settings",
                "context_settings",
                "vector_db_settings",
                "history_settings",
                "memory_settings",
                "prompt_settings",
                "tool_settings",
                "debug_settings",
            ],
        )

    # ===========================================================
    # CONNECTIONS SUB-FLOW
    # ===========================================================

    async def async_step_connections(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Connections picker: select existing or create new."""
        connections = dict(self._config_entry.data.get(CONF_CONNECTIONS, {}))

        if user_input is not None:
            selected = user_input.get("connection", "")
            if selected == "__new__":
                return await self.async_step_add_connection_type()
            if selected in connections:
                self._editing_connection_id = selected
                self._editing_connection = dict(connections[selected])
                return await self.async_step_edit_connection()
            return await self.async_step_connections()

        options = []
        for cid, conn in connections.items():
            name = conn.get("name", cid)
            options.append({"value": cid, "label": name})
        options.append({"value": "__new__", "label": "Create New Connection"})

        return self.async_show_form(
            step_id="connections",
            data_schema=vol.Schema(
                {
                    vol.Required("connection"): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=options,
                            mode=selector.SelectSelectorMode.DROPDOWN,
                        )
                    ),
                }
            ),
        )

    # -----------------------------------------------------------
    # Add Connection Type (new: Local vs Claude)
    # -----------------------------------------------------------

    async def async_step_add_connection_type(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Choose connection type: Local or Claude API."""
        if user_input is not None:
            conn_type = user_input.get("connection_type", CONNECTION_TYPE_LOCAL)
            if conn_type == CONNECTION_TYPE_CLAUDE:
                return await self.async_step_add_connection_claude()
            return await self.async_step_add_connection()

        return self.async_show_form(
            step_id="add_connection_type",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        "connection_type", default=CONNECTION_TYPE_LOCAL
                    ): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=[
                                {"value": CONNECTION_TYPE_LOCAL, "label": "Local Connection"},
                                {"value": CONNECTION_TYPE_CLAUDE, "label": "Claude API"},
                            ],
                            mode=selector.SelectSelectorMode.DROPDOWN,
                        )
                    ),
                }
            ),
        )

    # -----------------------------------------------------------
    # Add Connection (local endpoint)
    # -----------------------------------------------------------

    async def async_step_add_connection(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Add local connection: name, URL, API key, model, capabilities."""
        errors: dict[str, str] = {}

        if user_input is not None:
            base_url = user_input.get("base_url", "")
            if base_url:
                base_url = normalize_url(base_url)
                parsed = urlparse(base_url)
                if not parsed.scheme or not parsed.netloc:
                    errors["base"] = "invalid_config"
            user_input["base_url"] = base_url

            caps = user_input.get("capabilities", [])
            if not caps:
                errors["base"] = "invalid_config"

            if not errors:
                self._adding_connection = {
                    "name": user_input.get("name", "New Connection"),
                    "connection_type": CONNECTION_TYPE_LOCAL,
                    "base_url": base_url,
                    "api_key": user_input.get("api_key", ""),
                    "model": user_input.get("model", ""),
                    "capabilities": caps,
                }
                return await self.async_step_connection_details()

        # Build capabilities multi-select options
        cap_options = [
            {"value": cap, "label": CAPABILITY_LABELS.get(cap, cap)}
            for cap in ALL_CAPABILITIES
        ]

        # Optional ProxLab import dropdown
        schema_fields: dict[Any, Any] = {}
        proxlab_url = self._config_entry.data.get(CONF_PROXLAB_URL, "")
        if proxlab_url:
            services = await self._get_proxlab_services()
            if services:
                import_options = [{"value": "__none__", "label": "(Don't import)"}]
                for svc in services:
                    if hasattr(svc, "base_url") and svc.base_url:
                        import_options.append(
                            {"value": svc.base_url, "label": svc.display_name}
                        )
                schema_fields[vol.Optional("import_from_proxlab")] = (
                    selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=import_options,
                            mode=selector.SelectSelectorMode.DROPDOWN,
                        )
                    )
                )

        schema_fields.update(
            {
                vol.Required("name", default="New Connection"): str,
                vol.Required("base_url", default=""): str,
                vol.Optional("api_key", default=""): str,
                vol.Optional("model", default=""): str,
                vol.Required("capabilities"): selector.SelectSelector(
                    selector.SelectSelectorConfig(
                        options=cap_options,
                        multiple=True,
                        mode=selector.SelectSelectorMode.DROPDOWN,
                    )
                ),
            }
        )

        return self.async_show_form(
            step_id="add_connection",
            data_schema=vol.Schema(schema_fields),
            errors=errors,
        )

    # -----------------------------------------------------------
    # Add Connection (step 2: type-specific details)
    # -----------------------------------------------------------

    async def async_step_connection_details(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Add connection step 2: type-specific fields based on capabilities."""
        if user_input is not None:
            conn = dict(self._adding_connection)
            conn.update(self._extract_detail_fields(user_input, conn["capabilities"]))

            # Validate proxy headers
            if "proxy_headers" in conn and isinstance(conn["proxy_headers"], str):
                try:
                    conn["proxy_headers"] = _validate_proxy_headers(conn["proxy_headers"])
                except ValidationError:
                    conn["proxy_headers"] = {}

            # Save connection
            cid = _new_connection_id()
            new_data = dict(self._config_entry.data)
            connections = dict(new_data.get(CONF_CONNECTIONS, {}))
            connections[cid] = conn
            new_data[CONF_CONNECTIONS] = connections
            self.hass.config_entries.async_update_entry(
                self._config_entry, data=new_data
            )
            self._adding_connection = {}
            return self.async_create_entry(title="", data=self._config_entry.options)

        caps = self._adding_connection.get("capabilities", [])
        schema_fields = self._build_detail_schema(caps, {})

        if not schema_fields:
            # No detail fields needed, save directly
            return await self.async_step_connection_details({})

        return self.async_show_form(
            step_id="connection_details",
            data_schema=vol.Schema(schema_fields),
            description_placeholders={
                "connection_name": self._adding_connection.get("name", ""),
            },
        )

    # -----------------------------------------------------------
    # Add Connection (Claude API)
    # -----------------------------------------------------------

    async def async_step_add_connection_claude(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Add Claude API connection: name, API key, model dropdown."""
        errors: dict[str, str] = {}

        if user_input is not None:
            name = user_input.get("name", "").strip()
            api_key = user_input.get("api_key", "").strip()
            model = user_input.get("model", CLAUDE_MODELS[0])

            if not name:
                errors["base"] = "invalid_config"
            if not api_key:
                errors["base"] = "invalid_config"

            if not errors:
                conn = {
                    "name": name,
                    "connection_type": CONNECTION_TYPE_CLAUDE,
                    "base_url": CLAUDE_API_BASE_URL,
                    "api_key": api_key,
                    "model": model,
                    "capabilities": [CAP_CONVERSATION, CAP_TOOL_USE],
                    "temperature": 1.0,
                    "max_tokens": 4096,
                    "top_p": 1.0,
                }

                cid = _new_connection_id()
                new_data = dict(self._config_entry.data)
                connections = dict(new_data.get(CONF_CONNECTIONS, {}))
                connections[cid] = conn
                new_data[CONF_CONNECTIONS] = connections
                self.hass.config_entries.async_update_entry(
                    self._config_entry, data=new_data
                )
                return self.async_create_entry(
                    title="", data=self._config_entry.options
                )

        model_options = [
            {"value": m, "label": m} for m in CLAUDE_MODELS
        ]

        return self.async_show_form(
            step_id="add_connection_claude",
            data_schema=vol.Schema(
                {
                    vol.Required("name", default="Claude"): str,
                    vol.Required("api_key"): str,
                    vol.Required("model", default=CLAUDE_MODELS[0]): (
                        selector.SelectSelector(
                            selector.SelectSelectorConfig(
                                options=model_options,
                                mode=selector.SelectSelectorMode.DROPDOWN,
                            )
                        )
                    ),
                }
            ),
            errors=errors,
        )

    # -----------------------------------------------------------
    # Edit Connection (merged: basics + details + delete toggle)
    # -----------------------------------------------------------

    async def async_step_edit_connection(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Edit connection — single merged form with delete toggle."""
        errors: dict[str, str] = {}
        conn = self._editing_connection
        cid = self._editing_connection_id
        is_claude = conn.get("connection_type") == CONNECTION_TYPE_CLAUDE

        if user_input is not None:
            # Handle delete toggle
            if user_input.get("__delete__", False):
                # Remove device and its entities from the registry
                device_reg = dr.async_get(self.hass)
                device = device_reg.async_get_device(
                    identifiers={
                        (DOMAIN, f"{self._config_entry.entry_id}_{cid}")
                    }
                )
                if device:
                    device_reg.async_remove_device(device.id)

                new_data = dict(self._config_entry.data)
                new_connections = dict(new_data.get(CONF_CONNECTIONS, {}))
                new_connections.pop(cid, None)
                new_data[CONF_CONNECTIONS] = new_connections

                # Null any roles pointing to deleted connection
                new_roles = dict(new_data.get(CONF_ROLES, {}))
                for role, assigned_cid in new_roles.items():
                    if assigned_cid == cid:
                        new_roles[role] = None
                new_data[CONF_ROLES] = new_roles

                self.hass.config_entries.async_update_entry(
                    self._config_entry, data=new_data
                )
                self._editing_connection_id = None
                self._editing_connection = {}
                return self.async_create_entry(
                    title="", data=self._config_entry.options
                )

            # Normal save flow
            if is_claude:
                # Claude connections: name, api_key, model only
                conn["name"] = user_input.get("name", conn.get("name", ""))
                conn["api_key"] = user_input.get("api_key", conn.get("api_key", ""))
                conn["model"] = user_input.get("model", conn.get("model", ""))
            else:
                # Local connections: full field set
                base_url = user_input.get("base_url", "")
                if base_url:
                    base_url = normalize_url(base_url)
                    parsed = urlparse(base_url)
                    if not parsed.scheme or not parsed.netloc:
                        errors["base"] = "invalid_config"

                caps = user_input.get("capabilities", [])
                if not caps:
                    errors["base"] = "invalid_config"

                if not errors:
                    conn["name"] = user_input.get("name", conn.get("name", ""))
                    conn["base_url"] = base_url
                    conn["api_key"] = user_input.get(
                        "api_key", conn.get("api_key", "")
                    )
                    conn["model"] = user_input.get("model", conn.get("model", ""))
                    conn["capabilities"] = caps

                    # Extract detail fields
                    conn.update(self._extract_detail_fields(user_input, caps))

                    if "proxy_headers" in conn and isinstance(
                        conn["proxy_headers"], str
                    ):
                        try:
                            conn["proxy_headers"] = _validate_proxy_headers(
                                conn["proxy_headers"]
                            )
                        except ValidationError:
                            conn["proxy_headers"] = {}

            if not errors:
                new_data = dict(self._config_entry.data)
                connections = dict(new_data.get(CONF_CONNECTIONS, {}))
                connections[cid] = conn
                new_data[CONF_CONNECTIONS] = connections
                self.hass.config_entries.async_update_entry(
                    self._config_entry, data=new_data
                )
                self._editing_connection_id = None
                self._editing_connection = {}
                return self.async_create_entry(
                    title="", data=self._config_entry.options
                )

        # Build schema based on connection type
        schema_fields: dict[Any, Any] = {}

        if is_claude:
            model_options = [
                {"value": m, "label": m} for m in CLAUDE_MODELS
            ]
            schema_fields.update(
                {
                    vol.Required("name", default=conn.get("name", "")): str,
                    vol.Required(
                        "api_key",
                        description={"suggested_value": conn.get("api_key", "")},
                    ): str,
                    vol.Required(
                        "model", default=conn.get("model", CLAUDE_MODELS[0])
                    ): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=model_options,
                            mode=selector.SelectSelectorMode.DROPDOWN,
                        )
                    ),
                }
            )
        else:
            # Local connection: basics + detail fields merged
            cap_options = [
                {"value": cap, "label": CAPABILITY_LABELS.get(cap, cap)}
                for cap in ALL_CAPABILITIES
            ]
            schema_fields.update(
                {
                    vol.Required("name", default=conn.get("name", "")): str,
                    vol.Required(
                        "base_url", default=conn.get("base_url", "")
                    ): str,
                    vol.Optional(
                        "api_key",
                        description={"suggested_value": conn.get("api_key", "")},
                    ): str,
                    vol.Optional("model", default=conn.get("model", "")): str,
                    vol.Required(
                        "capabilities", default=conn.get("capabilities", [])
                    ): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=cap_options,
                            multiple=True,
                            mode=selector.SelectSelectorMode.DROPDOWN,
                        )
                    ),
                }
            )

            # Merge detail fields inline
            caps = conn.get("capabilities", [])
            detail_fields = self._build_detail_schema(caps, conn)
            schema_fields.update(detail_fields)

        # Delete toggle at the bottom
        schema_fields[vol.Optional("__delete__", default=False)] = bool

        return self.async_show_form(
            step_id="edit_connection",
            data_schema=vol.Schema(schema_fields),
            errors=errors,
            description_placeholders={
                "connection_name": conn.get("name", cid or "Unknown"),
            },
        )

    # -----------------------------------------------------------
    # Detail schema helpers
    # -----------------------------------------------------------

    def _build_detail_schema(
        self, caps: list[str], defaults: dict[str, Any]
    ) -> dict[Any, Any]:
        """Build type-specific detail fields based on capabilities.

        Args:
            caps: List of capability strings.
            defaults: Existing values for pre-population.

        Returns:
            Dict of voluptuous schema fields.
        """
        fields: dict[Any, Any] = {}
        has_llm = bool(set(caps) & LLM_CAPABILITIES)
        has_tts = CAP_TTS in caps
        has_stt = CAP_STT in caps
        has_emb = CAP_EMBEDDINGS in caps

        if has_llm:
            proxy_headers = defaults.get("proxy_headers", {})
            proxy_headers_str = (
                json.dumps(proxy_headers, indent=2) if proxy_headers else ""
            )
            fields.update(
                {
                    vol.Optional(
                        "temperature",
                        default=defaults.get("temperature", DEFAULT_TEMPERATURE),
                    ): vol.All(vol.Coerce(float), vol.Range(min=0.0, max=2.0)),
                    vol.Optional(
                        "max_tokens",
                        default=defaults.get("max_tokens", DEFAULT_MAX_TOKENS),
                    ): vol.All(vol.Coerce(int), vol.Range(min=1, max=100000)),
                    vol.Optional(
                        "top_p",
                        default=defaults.get("top_p", 1.0),
                    ): vol.All(vol.Coerce(float), vol.Range(min=0.0, max=1.0)),
                    vol.Optional(
                        "keep_alive",
                        default=defaults.get("keep_alive", DEFAULT_LLM_KEEP_ALIVE),
                    ): str,
                    vol.Optional(
                        "proxy_headers",
                        description={"suggested_value": proxy_headers_str},
                    ): str,
                    vol.Optional(
                        "thinking_enabled",
                        default=defaults.get(
                            "thinking_enabled", DEFAULT_THINKING_ENABLED
                        ),
                    ): bool,
                }
            )

        if has_tts:
            fields.update(
                {
                    vol.Optional(
                        "voice",
                        default=defaults.get("voice", DEFAULT_TTS_VOICE),
                    ): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=[
                                "alloy",
                                "echo",
                                "fable",
                                "onyx",
                                "nova",
                                "shimmer",
                            ],
                            custom_value=True,
                        )
                    ),
                    vol.Optional(
                        "speed",
                        default=defaults.get("speed", DEFAULT_TTS_SPEED),
                    ): vol.All(vol.Coerce(float), vol.Range(min=0.25, max=4.0)),
                    vol.Optional(
                        "format",
                        default=defaults.get("format", DEFAULT_TTS_FORMAT),
                    ): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=["mp3", "opus", "aac", "flac", "wav", "pcm"],
                        )
                    ),
                }
            )

        if has_stt:
            fields[
                vol.Optional(
                    "language", default=defaults.get("language", "en")
                )
            ] = str

        if has_emb:
            fields.update(
                {
                    vol.Optional(
                        "embedding_provider",
                        default=defaults.get("embedding_provider", "ollama"),
                    ): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=[
                                EMBEDDING_PROVIDER_OPENAI,
                                EMBEDDING_PROVIDER_OLLAMA,
                            ],
                            translation_key="embedding_provider",
                        )
                    ),
                    vol.Optional(
                        "keep_alive",
                        default=defaults.get("keep_alive", "5m"),
                    ): str,
                }
            )

        return fields

    def _extract_detail_fields(
        self, user_input: dict[str, Any], caps: list[str]
    ) -> dict[str, Any]:
        """Extract type-specific fields from user input.

        Args:
            user_input: Form submission data.
            caps: List of capability strings.

        Returns:
            Dict of detail fields to merge into connection.
        """
        fields: dict[str, Any] = {}
        has_llm = bool(set(caps) & LLM_CAPABILITIES)
        has_tts = CAP_TTS in caps
        has_stt = CAP_STT in caps
        has_emb = CAP_EMBEDDINGS in caps

        if has_llm:
            for key in (
                "temperature",
                "max_tokens",
                "top_p",
                "keep_alive",
                "proxy_headers",
                "thinking_enabled",
            ):
                if key in user_input:
                    fields[key] = user_input[key]

        if has_tts:
            for key in ("voice", "speed", "format"):
                if key in user_input:
                    fields[key] = user_input[key]

        if has_stt:
            if "language" in user_input:
                fields["language"] = user_input["language"]

        if has_emb:
            for key in ("embedding_provider", "keep_alive"):
                if key in user_input:
                    fields[key] = user_input[key]

        return fields

    # ===========================================================
    # ROLE ASSIGNMENTS
    # ===========================================================

    async def async_step_role_assignments(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Assign connections to roles."""
        if user_input is not None:
            new_roles: dict[str, str | None] = {}
            for role in ALL_ROLES:
                val = user_input.get(role, "__none__")
                new_roles[role] = None if val == "__none__" else val

            new_data = dict(self._config_entry.data)
            new_data[CONF_ROLES] = new_roles
            self.hass.config_entries.async_update_entry(
                self._config_entry, data=new_data
            )
            return self.async_create_entry(title="", data=self._config_entry.options)

        config = dict(self._config_entry.data) | dict(self._config_entry.options)
        current_roles = config.get(CONF_ROLES, {})
        connections = config.get(CONF_CONNECTIONS, {})

        schema_fields: dict[Any, Any] = {}
        for role in ALL_ROLES:
            required_cap = ROLE_TO_CAPABILITY.get(role, role)
            # Filter connections to those with the required capability
            eligible = [
                (cid, conn)
                for cid, conn in connections.items()
                if required_cap in conn.get("capabilities", [])
            ]

            options = [{"value": "__none__", "label": "(Not assigned)"}]
            for cid, conn in eligible:
                options.append(
                    {"value": cid, "label": conn.get("name", cid)}
                )

            current_val = current_roles.get(role)
            default = current_val if current_val and current_val in connections else "__none__"

            schema_fields[
                vol.Optional(role, default=default)
            ] = selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=options,
                    mode=selector.SelectSelectorMode.DROPDOWN,
                )
            )

        return self.async_show_form(
            step_id="role_assignments",
            data_schema=vol.Schema(schema_fields),
        )

    # ===========================================================
    # PROXLAB SETTINGS (unchanged from v1)
    # ===========================================================

    async def async_step_proxlab_settings(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Configure ProxLab service discovery settings."""
        errors: dict[str, str] = {}

        if user_input is not None:
            proxlab_url = user_input.get(CONF_PROXLAB_URL, "").strip().rstrip("/")
            user_input[CONF_PROXLAB_URL] = proxlab_url

            if proxlab_url:
                try:
                    from .proxlab_api import discover_services

                    await discover_services(proxlab_url)
                except Exception as err:
                    _LOGGER.warning("ProxLab connection test failed: %s", err)
                    errors["base"] = "cannot_connect"

            if not errors:
                new_data = {**self._config_entry.data, **user_input}
                self.hass.config_entries.async_update_entry(
                    self._config_entry, data=new_data
                )
                return self.async_create_entry(
                    title="", data=self._config_entry.options
                )

        current_data = self._config_entry.data

        return self.async_show_form(
            step_id="proxlab_settings",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_PROXLAB_URL,
                        description={
                            "suggested_value": current_data.get(CONF_PROXLAB_URL, "")
                        },
                    ): str,
                }
            ),
            errors=errors,
        )

    # ===========================================================
    # CONTEXT SETTINGS (unchanged from v1)
    # ===========================================================

    async def async_step_context_settings(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Configure context injection settings."""
        if user_input is not None:
            updated_options = {**self._config_entry.options, **user_input}
            return self.async_create_entry(title="", data=updated_options)

        current_options = self._config_entry.options
        current_data = self._config_entry.data

        return self.async_show_form(
            step_id="context_settings",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_CONTEXT_MODE,
                        default=current_options.get(
                            CONF_CONTEXT_MODE,
                            current_data.get(CONF_CONTEXT_MODE, DEFAULT_CONTEXT_MODE),
                        ),
                    ): vol.In([CONTEXT_MODE_DIRECT, CONTEXT_MODE_VECTOR_DB]),
                    vol.Optional(
                        CONF_CONTEXT_FORMAT,
                        default=current_options.get(
                            CONF_CONTEXT_FORMAT,
                            current_data.get(
                                CONF_CONTEXT_FORMAT, DEFAULT_CONTEXT_FORMAT
                            ),
                        ),
                    ): vol.In(
                        [
                            CONTEXT_FORMAT_JSON,
                            CONTEXT_FORMAT_NATURAL_LANGUAGE,
                            CONTEXT_FORMAT_HYBRID,
                        ]
                    ),
                    vol.Optional(
                        CONF_DIRECT_ENTITIES,
                        default=current_options.get(
                            CONF_DIRECT_ENTITIES,
                            current_data.get(CONF_DIRECT_ENTITIES, ""),
                        ),
                    ): str,
                    vol.Optional(
                        CONF_MAX_CONTEXT_TOKENS,
                        default=current_options.get(
                            CONF_MAX_CONTEXT_TOKENS,
                            current_data.get(
                                CONF_MAX_CONTEXT_TOKENS, DEFAULT_MAX_CONTEXT_TOKENS
                            ),
                        ),
                    ): vol.All(vol.Coerce(int), vol.Range(min=1000, max=128000)),
                }
            ),
            description_placeholders={
                "direct_mode": CONTEXT_MODE_DIRECT,
                "vector_db_mode": CONTEXT_MODE_VECTOR_DB,
                "entity_format": "sensor.temperature,light.living_room",
            },
        )

    # ===========================================================
    # VECTOR DB SETTINGS (simplified: no embedding URL/model)
    # ===========================================================

    async def async_step_vector_db_settings(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Configure Vector DB settings."""
        if user_input is not None:
            if CONF_ADDITIONAL_COLLECTIONS in user_input:
                collections_str = user_input[CONF_ADDITIONAL_COLLECTIONS]
                if isinstance(collections_str, str):
                    collections_list = [
                        c.strip() for c in collections_str.split(",") if c.strip()
                    ]
                    user_input[CONF_ADDITIONAL_COLLECTIONS] = collections_list

            updated_options = {**self._config_entry.options, **user_input}
            return self.async_create_entry(title="", data=updated_options)

        current_options = self._config_entry.options
        current_data = self._config_entry.data

        additional_collections = current_options.get(
            CONF_ADDITIONAL_COLLECTIONS, DEFAULT_ADDITIONAL_COLLECTIONS
        )
        if isinstance(additional_collections, list):
            additional_collections_str = ", ".join(additional_collections)
        else:
            additional_collections_str = ""

        return self.async_show_form(
            step_id="vector_db_settings",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_VECTOR_DB_BACKEND,
                        default=current_options.get(
                            CONF_VECTOR_DB_BACKEND,
                            current_data.get(
                                CONF_VECTOR_DB_BACKEND, DEFAULT_VECTOR_DB_BACKEND
                            ),
                        ),
                    ): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=[
                                VECTOR_DB_BACKEND_CHROMADB,
                                VECTOR_DB_BACKEND_MILVUS,
                            ],
                            translation_key="vector_db_backend",
                        )
                    ),
                    vol.Optional(
                        CONF_VECTOR_DB_HOST,
                        default=current_options.get(
                            CONF_VECTOR_DB_HOST,
                            current_data.get(
                                CONF_VECTOR_DB_HOST, DEFAULT_VECTOR_DB_HOST
                            ),
                        ),
                    ): str,
                    vol.Optional(
                        CONF_VECTOR_DB_PORT,
                        default=current_options.get(
                            CONF_VECTOR_DB_PORT,
                            current_data.get(
                                CONF_VECTOR_DB_PORT, DEFAULT_VECTOR_DB_PORT
                            ),
                        ),
                    ): vol.All(vol.Coerce(int), vol.Range(min=1, max=65535)),
                    vol.Optional(
                        CONF_VECTOR_DB_COLLECTION,
                        default=current_options.get(
                            CONF_VECTOR_DB_COLLECTION,
                            current_data.get(
                                CONF_VECTOR_DB_COLLECTION,
                                DEFAULT_VECTOR_DB_COLLECTION,
                            ),
                        ),
                    ): str,
                    vol.Optional(
                        CONF_VECTOR_DB_TOP_K,
                        default=current_options.get(
                            CONF_VECTOR_DB_TOP_K,
                            current_data.get(
                                CONF_VECTOR_DB_TOP_K, DEFAULT_VECTOR_DB_TOP_K
                            ),
                        ),
                    ): vol.All(vol.Coerce(int), vol.Range(min=1, max=50)),
                    vol.Optional(
                        CONF_VECTOR_DB_SIMILARITY_THRESHOLD,
                        default=current_options.get(
                            CONF_VECTOR_DB_SIMILARITY_THRESHOLD,
                            current_data.get(
                                CONF_VECTOR_DB_SIMILARITY_THRESHOLD,
                                DEFAULT_VECTOR_DB_SIMILARITY_THRESHOLD,
                            ),
                        ),
                    ): vol.All(
                        vol.Coerce(float), vol.Range(min=0.0, max=1000.0)
                    ),
                    vol.Optional(
                        CONF_ADDITIONAL_COLLECTIONS,
                        default=additional_collections_str,
                    ): str,
                    vol.Optional(
                        CONF_ADDITIONAL_TOP_K,
                        default=current_options.get(
                            CONF_ADDITIONAL_TOP_K, DEFAULT_ADDITIONAL_TOP_K
                        ),
                    ): vol.All(vol.Coerce(int), vol.Range(min=1, max=50)),
                    vol.Optional(
                        CONF_ADDITIONAL_L2_DISTANCE_THRESHOLD,
                        default=current_options.get(
                            CONF_ADDITIONAL_L2_DISTANCE_THRESHOLD,
                            DEFAULT_ADDITIONAL_L2_DISTANCE_THRESHOLD,
                        ),
                    ): vol.All(
                        vol.Coerce(float), vol.Range(min=0.0, max=2000.0)
                    ),
                    vol.Optional(
                        CONF_MILVUS_HOST,
                        default=current_options.get(
                            CONF_MILVUS_HOST,
                            current_data.get(CONF_MILVUS_HOST, DEFAULT_MILVUS_HOST),
                        ),
                    ): str,
                    vol.Optional(
                        CONF_MILVUS_PORT,
                        default=current_options.get(
                            CONF_MILVUS_PORT,
                            current_data.get(CONF_MILVUS_PORT, DEFAULT_MILVUS_PORT),
                        ),
                    ): vol.All(vol.Coerce(int), vol.Range(min=1, max=65535)),
                    vol.Optional(
                        CONF_MILVUS_COLLECTION,
                        default=current_options.get(
                            CONF_MILVUS_COLLECTION,
                            current_data.get(
                                CONF_MILVUS_COLLECTION, DEFAULT_MILVUS_COLLECTION
                            ),
                        ),
                    ): str,
                }
            ),
            description_placeholders={
                "default_host": DEFAULT_VECTOR_DB_HOST,
                "default_port": str(DEFAULT_VECTOR_DB_PORT),
                "default_collection": DEFAULT_VECTOR_DB_COLLECTION,
            },
        )

    # ===========================================================
    # HISTORY SETTINGS (unchanged from v1)
    # ===========================================================

    async def async_step_history_settings(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Configure conversation history settings."""
        if user_input is not None:
            if CONF_SESSION_TIMEOUT in user_input:
                user_input[CONF_SESSION_TIMEOUT] = (
                    user_input[CONF_SESSION_TIMEOUT] * 60
                )
            updated_options = {**self._config_entry.options, **user_input}
            return self.async_create_entry(title="", data=updated_options)

        current_options = self._config_entry.options
        current_data = self._config_entry.data

        return self.async_show_form(
            step_id="history_settings",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_HISTORY_ENABLED,
                        default=current_options.get(
                            CONF_HISTORY_ENABLED,
                            current_data.get(
                                CONF_HISTORY_ENABLED, DEFAULT_HISTORY_ENABLED
                            ),
                        ),
                    ): bool,
                    vol.Optional(
                        CONF_HISTORY_MAX_MESSAGES,
                        default=current_options.get(
                            CONF_HISTORY_MAX_MESSAGES,
                            current_data.get(
                                CONF_HISTORY_MAX_MESSAGES,
                                DEFAULT_HISTORY_MAX_MESSAGES,
                            ),
                        ),
                    ): vol.All(vol.Coerce(int), vol.Range(min=1, max=100)),
                    vol.Optional(
                        CONF_HISTORY_MAX_TOKENS,
                        default=current_options.get(
                            CONF_HISTORY_MAX_TOKENS,
                            current_data.get(
                                CONF_HISTORY_MAX_TOKENS, DEFAULT_HISTORY_MAX_TOKENS
                            ),
                        ),
                    ): vol.All(vol.Coerce(int), vol.Range(min=100, max=50000)),
                    vol.Required(
                        CONF_SESSION_PERSISTENCE_ENABLED,
                        default=current_options.get(
                            CONF_SESSION_PERSISTENCE_ENABLED,
                            current_data.get(
                                CONF_SESSION_PERSISTENCE_ENABLED,
                                DEFAULT_SESSION_PERSISTENCE_ENABLED,
                            ),
                        ),
                    ): bool,
                    vol.Optional(
                        CONF_SESSION_TIMEOUT,
                        default=current_options.get(
                            CONF_SESSION_TIMEOUT,
                            current_data.get(
                                CONF_SESSION_TIMEOUT, DEFAULT_SESSION_TIMEOUT
                            ),
                        )
                        // 60,
                    ): vol.All(vol.Coerce(int), vol.Range(min=1, max=120)),
                }
            ),
        )

    # ===========================================================
    # PROMPT SETTINGS (unchanged from v1)
    # ===========================================================

    async def async_step_prompt_settings(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Configure system prompt settings."""
        if user_input is not None:
            updated_options = {**self._config_entry.options, **user_input}
            return self.async_create_entry(title="", data=updated_options)

        current_options = self._config_entry.options
        current_data = self._config_entry.data

        return self.async_show_form(
            step_id="prompt_settings",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_PROMPT_USE_DEFAULT,
                        default=current_options.get(
                            CONF_PROMPT_USE_DEFAULT,
                            current_data.get(
                                CONF_PROMPT_USE_DEFAULT, DEFAULT_PROMPT_USE_DEFAULT
                            ),
                        ),
                    ): bool,
                    vol.Optional(
                        CONF_PROMPT_INCLUDE_LABELS,
                        default=current_options.get(
                            CONF_PROMPT_INCLUDE_LABELS,
                            current_data.get(
                                CONF_PROMPT_INCLUDE_LABELS,
                                DEFAULT_PROMPT_INCLUDE_LABELS,
                            ),
                        ),
                    ): bool,
                    vol.Optional(
                        CONF_PROMPT_CUSTOM_ADDITIONS,
                        description={
                            "suggested_value": current_options.get(
                                CONF_PROMPT_CUSTOM_ADDITIONS,
                                current_data.get(CONF_PROMPT_CUSTOM_ADDITIONS, ""),
                            )
                        },
                    ): selector.TemplateSelector(),
                }
            ),
            description_placeholders={
                "example_addition": (
                    "Additional context about my home:\n"
                    "- The thermostat prefers 68-72\u00b0F\n"
                    "- Keep doors locked after 10 PM"
                ),
            },
        )

    # ===========================================================
    # TOOL SETTINGS (unchanged from v1)
    # ===========================================================

    async def async_step_tool_settings(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Configure tool execution settings."""
        if user_input is not None:
            updated_options = {**self._config_entry.options, **user_input}
            return self.async_create_entry(title="", data=updated_options)

        current_options = self._config_entry.options
        current_data = self._config_entry.data

        return self.async_show_form(
            step_id="tool_settings",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_TOOLS_MAX_CALLS_PER_TURN,
                        default=current_options.get(
                            CONF_TOOLS_MAX_CALLS_PER_TURN,
                            current_data.get(
                                CONF_TOOLS_MAX_CALLS_PER_TURN,
                                DEFAULT_TOOLS_MAX_CALLS_PER_TURN,
                            ),
                        ),
                    ): vol.All(vol.Coerce(int), vol.Range(min=1, max=20)),
                    vol.Optional(
                        CONF_TOOLS_TIMEOUT,
                        default=current_options.get(
                            CONF_TOOLS_TIMEOUT,
                            current_data.get(
                                CONF_TOOLS_TIMEOUT, DEFAULT_TOOLS_TIMEOUT
                            ),
                        ),
                    ): vol.All(vol.Coerce(int), vol.Range(min=5, max=300)),
                }
            ),
        )

    # ===========================================================
    # MEMORY SETTINGS (unchanged from v1)
    # ===========================================================

    async def async_step_memory_settings(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Configure long-term memory system settings."""
        errors: dict[str, str] = {}

        if user_input is not None:
            if user_input.get(CONF_MEMORY_EXTRACTION_LLM) == "external":
                current_data = self._config_entry.data
                current_options = self._config_entry.options
                # In v2, check if external_llm role is assigned
                roles = current_data.get(CONF_ROLES, {})
                ext_assigned = roles.get("external_llm") is not None
                ext_enabled = current_options.get(
                    CONF_EXTERNAL_LLM_ENABLED,
                    current_data.get(CONF_EXTERNAL_LLM_ENABLED, DEFAULT_EXTERNAL_LLM_ENABLED),
                )
                if not ext_assigned and not ext_enabled:
                    errors["base"] = "external_llm_required"

            if not errors:
                updated_options = {**self._config_entry.options, **user_input}
                return self.async_create_entry(title="", data=updated_options)

        current_options = self._config_entry.options
        current_data = self._config_entry.data

        return self.async_show_form(
            step_id="memory_settings",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_MEMORY_ENABLED,
                        default=current_options.get(
                            CONF_MEMORY_ENABLED,
                            current_data.get(
                                CONF_MEMORY_ENABLED, DEFAULT_MEMORY_ENABLED
                            ),
                        ),
                    ): bool,
                    vol.Required(
                        CONF_MEMORY_EXTRACTION_ENABLED,
                        default=current_options.get(
                            CONF_MEMORY_EXTRACTION_ENABLED,
                            current_data.get(
                                CONF_MEMORY_EXTRACTION_ENABLED,
                                DEFAULT_MEMORY_EXTRACTION_ENABLED,
                            ),
                        ),
                    ): bool,
                    vol.Required(
                        CONF_MEMORY_EXTRACTION_LLM,
                        default=current_options.get(
                            CONF_MEMORY_EXTRACTION_LLM,
                            current_data.get(
                                CONF_MEMORY_EXTRACTION_LLM,
                                DEFAULT_MEMORY_EXTRACTION_LLM,
                            ),
                        ),
                    ): vol.In(["external", "local"]),
                    vol.Optional(
                        CONF_MEMORY_MAX_MEMORIES,
                        default=current_options.get(
                            CONF_MEMORY_MAX_MEMORIES,
                            current_data.get(
                                CONF_MEMORY_MAX_MEMORIES,
                                DEFAULT_MEMORY_MAX_MEMORIES,
                            ),
                        ),
                    ): vol.All(vol.Coerce(int), vol.Range(min=10, max=1000)),
                    vol.Optional(
                        CONF_MEMORY_MIN_IMPORTANCE,
                        default=current_options.get(
                            CONF_MEMORY_MIN_IMPORTANCE,
                            current_data.get(
                                CONF_MEMORY_MIN_IMPORTANCE,
                                DEFAULT_MEMORY_MIN_IMPORTANCE,
                            ),
                        ),
                    ): vol.All(
                        vol.Coerce(float), vol.Range(min=0.0, max=1.0)
                    ),
                    vol.Optional(
                        CONF_MEMORY_MIN_WORDS,
                        default=current_options.get(
                            CONF_MEMORY_MIN_WORDS,
                            current_data.get(
                                CONF_MEMORY_MIN_WORDS, DEFAULT_MEMORY_MIN_WORDS
                            ),
                        ),
                    ): vol.All(vol.Coerce(int), vol.Range(min=1, max=50)),
                    vol.Optional(
                        CONF_MEMORY_CONTEXT_TOP_K,
                        default=current_options.get(
                            CONF_MEMORY_CONTEXT_TOP_K,
                            current_data.get(
                                CONF_MEMORY_CONTEXT_TOP_K,
                                DEFAULT_MEMORY_CONTEXT_TOP_K,
                            ),
                        ),
                    ): vol.All(vol.Coerce(int), vol.Range(min=1, max=20)),
                    vol.Optional(
                        CONF_MEMORY_COLLECTION_NAME,
                        default=current_options.get(
                            CONF_MEMORY_COLLECTION_NAME,
                            current_data.get(
                                CONF_MEMORY_COLLECTION_NAME,
                                DEFAULT_MEMORY_COLLECTION_NAME,
                            ),
                        ),
                    ): str,
                }
            ),
            errors=errors,
            description_placeholders={
                "external_llm_note": (
                    "Memory extraction using external LLM requires the "
                    "external LLM role to be assigned in Role Assignments."
                ),
            },
        )

    # ===========================================================
    # DEBUG SETTINGS (unchanged from v1)
    # ===========================================================

    async def async_step_debug_settings(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Configure debug and logging settings."""
        if user_input is not None:
            updated_options = {**self._config_entry.options, **user_input}
            return self.async_create_entry(title="", data=updated_options)

        current_options = self._config_entry.options
        current_data = self._config_entry.data

        return self.async_show_form(
            step_id="debug_settings",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_DEBUG_LOGGING,
                        default=current_options.get(
                            CONF_DEBUG_LOGGING,
                            current_data.get(
                                CONF_DEBUG_LOGGING, DEFAULT_DEBUG_LOGGING
                            ),
                        ),
                    ): bool,
                    vol.Required(
                        CONF_STREAMING_ENABLED,
                        default=current_options.get(
                            CONF_STREAMING_ENABLED,
                            current_data.get(
                                CONF_STREAMING_ENABLED, DEFAULT_STREAMING_ENABLED
                            ),
                        ),
                    ): bool,
                }
            ),
            description_placeholders={
                "warning": (
                    "Debug logging may expose sensitive information "
                    "in Home Assistant logs. Use with caution."
                ),
                "streaming_info": (
                    "Enable streaming responses for low-latency TTS integration. "
                    "Requires Assist Pipeline with Wyoming TTS. "
                    "When enabled, responses are sent incrementally for faster audio playback. "
                    "Automatically falls back to standard mode if streaming fails."
                ),
            },
        )
