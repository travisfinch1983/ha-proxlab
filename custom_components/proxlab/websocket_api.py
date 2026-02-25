"""WebSocket API for ProxLab panel.

Provides custom WS commands that the React frontend calls to read/write
config, health data, connections, agents, and settings.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback

from .agent_prompts import get_default_prompt
from .connection_health import ConnectionCheckResult, ConnectionHealthCoordinator
from .const import (
    AGENT_DEFINITIONS,
    AGENT_TOOL_MAP,
    ALL_AGENTS,
    CONF_AGENTS,
    CONF_CONNECTIONS,
    CONF_CONTEXT_FORMAT,
    CONF_CONTEXT_MODE,
    CONF_DEBUG_LOGGING,
    CONF_DIRECT_ENTITIES,
    CONF_HISTORY_ENABLED,
    CONF_HISTORY_MAX_MESSAGES,
    CONF_HISTORY_MAX_TOKENS,
    CONF_MAX_CONTEXT_TOKENS,
    CONF_MEMORY_COLLECTION_NAME,
    CONF_MEMORY_CONTEXT_TOP_K,
    CONF_MEMORY_ENABLED,
    CONF_MEMORY_MAX_MEMORIES,
    CONF_MEMORY_MIN_IMPORTANCE,
    CONF_MEMORY_MIN_WORDS,
    CONF_MEMORY_UNIVERSAL_ACCESS,
    CONF_MILVUS_COLLECTION,
    CONF_MILVUS_HOST,
    CONF_MILVUS_PORT,
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
    DEFAULT_CONTEXT_FORMAT,
    DEFAULT_CONTEXT_MODE,
    DEFAULT_DEBUG_LOGGING,
    DEFAULT_HISTORY_ENABLED,
    DEFAULT_HISTORY_MAX_MESSAGES,
    DEFAULT_HISTORY_MAX_TOKENS,
    DEFAULT_MAX_CONTEXT_TOKENS,
    DEFAULT_MEMORY_COLLECTION_NAME,
    DEFAULT_MEMORY_CONTEXT_TOP_K,
    DEFAULT_MEMORY_ENABLED,
    DEFAULT_MEMORY_MAX_MEMORIES,
    DEFAULT_MEMORY_MIN_IMPORTANCE,
    DEFAULT_MEMORY_MIN_WORDS,
    DEFAULT_MEMORY_UNIVERSAL_ACCESS,
    DEFAULT_MILVUS_COLLECTION,
    DEFAULT_MILVUS_HOST,
    DEFAULT_MILVUS_PORT,
    DEFAULT_SESSION_PERSISTENCE_ENABLED,
    DEFAULT_SESSION_TIMEOUT,
    DEFAULT_STREAMING_ENABLED,
    DEFAULT_TOOLS_MAX_CALLS_PER_TURN,
    DEFAULT_TOOLS_TIMEOUT,
    DEFAULT_VECTOR_DB_BACKEND,
    DEFAULT_VECTOR_DB_COLLECTION,
    DEFAULT_VECTOR_DB_HOST,
    DEFAULT_VECTOR_DB_PORT,
    DEFAULT_VECTOR_DB_SIMILARITY_THRESHOLD,
    DEFAULT_VECTOR_DB_TOP_K,
    DOMAIN,
    OPTIONAL_AGENTS,
    PRIMARY_AGENTS,
    ROUTABLE_AGENTS,
    SYSTEM_AGENTS,
)
from .proxlab_api import discover_services

_LOGGER = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_entry(hass: HomeAssistant, msg: dict[str, Any]) -> ConfigEntry | None:
    """Resolve a config entry from the WS message."""
    entry_id = msg.get("entry_id")
    if entry_id:
        return hass.config_entries.async_get_entry(entry_id)
    entries = hass.config_entries.async_entries(DOMAIN)
    return entries[0] if entries else None


def _health_to_dict(result: ConnectionCheckResult) -> dict[str, Any]:
    """Serialize a ConnectionCheckResult to a plain dict."""
    return {
        "reachable": result.reachable,
        "api_valid": result.api_valid,
        "detail": result.detail,
        "error": result.error,
        "model_name": result.model_name,
    }


def _get_coordinator(
    hass: HomeAssistant, entry: ConfigEntry
) -> ConnectionHealthCoordinator | None:
    """Get the health coordinator for an entry."""
    entry_data = hass.data.get(DOMAIN, {}).get(entry.entry_id, {})
    return entry_data.get("coordinator")


def _agent_group(agent_id: str) -> str:
    if agent_id in PRIMARY_AGENTS:
        return "primary"
    if agent_id in SYSTEM_AGENTS:
        return "system"
    return "optional"


def _build_agent_info(
    entry: ConfigEntry, agent_id: str
) -> dict[str, Any]:
    """Build a full agent info dict for the frontend."""
    defn = AGENT_DEFINITIONS[agent_id]
    agents_cfg = dict(entry.options).get(CONF_AGENTS, {})
    agent_cfg = agents_cfg.get(agent_id, {})

    return {
        "id": defn.id,
        "name": defn.name,
        "description": defn.description,
        "mandatory": defn.mandatory,
        "required_capabilities": defn.required_capabilities,
        "has_prompt": defn.has_prompt,
        "gates": defn.gates,
        "group": _agent_group(agent_id),
        "default_prompt": get_default_prompt(agent_id),
        "config": {
            "enabled": defn.mandatory or agent_cfg.get("enabled", False),
            "primary_connection": agent_cfg.get("primary_connection"),
            "secondary_connection": agent_cfg.get("secondary_connection"),
            "system_prompt": agent_cfg.get("system_prompt"),
        },
    }


def _connection_with_id(conn_id: str, conn: dict[str, Any]) -> dict[str, Any]:
    """Attach id to a connection dict for the frontend."""
    return {"id": conn_id, **conn}


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Register all ProxLab websocket commands."""
    websocket_api.async_register_command(hass, ws_config_get)
    websocket_api.async_register_command(hass, ws_health_get)
    websocket_api.async_register_command(hass, ws_health_refresh)
    websocket_api.async_register_command(hass, ws_connections_list)
    websocket_api.async_register_command(hass, ws_connections_create)
    websocket_api.async_register_command(hass, ws_connections_update)
    websocket_api.async_register_command(hass, ws_connections_delete)
    websocket_api.async_register_command(hass, ws_connections_test)
    websocket_api.async_register_command(hass, ws_agents_list)
    websocket_api.async_register_command(hass, ws_agents_update)
    websocket_api.async_register_command(hass, ws_agents_default_prompt)
    websocket_api.async_register_command(hass, ws_context_get)
    websocket_api.async_register_command(hass, ws_context_update)
    websocket_api.async_register_command(hass, ws_vector_db_get)
    websocket_api.async_register_command(hass, ws_vector_db_update)
    websocket_api.async_register_command(hass, ws_vector_db_delete)
    websocket_api.async_register_command(hass, ws_memory_get)
    websocket_api.async_register_command(hass, ws_memory_update)
    websocket_api.async_register_command(hass, ws_settings_get)
    websocket_api.async_register_command(hass, ws_settings_update)
    websocket_api.async_register_command(hass, ws_discovery_services)
    websocket_api.async_register_command(hass, ws_debug_traces)
    websocket_api.async_register_command(hass, ws_debug_clear)
    websocket_api.async_register_command(hass, ws_debug_config)
    websocket_api.async_register_command(hass, ws_debug_delete_older)
    websocket_api.async_register_command(hass, ws_api_usage)
    websocket_api.async_register_command(hass, ws_api_usage_reset)
    websocket_api.async_register_command(hass, ws_api_admin_report)
    websocket_api.async_register_command(hass, ws_api_config)
    websocket_api.async_register_command(hass, ws_issues_list)
    websocket_api.async_register_command(hass, ws_issues_create)
    websocket_api.async_register_command(hass, ws_issues_update)
    websocket_api.async_register_command(hass, ws_issues_delete)
    websocket_api.async_register_command(hass, ws_agent_invoke)
    websocket_api.async_register_command(hass, ws_agent_available)


# ---------------------------------------------------------------------------
# Config snapshot
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/config/get", vol.Optional("entry_id"): str}
)
@websocket_api.async_response
async def ws_config_get(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Return full config snapshot for the panel."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return

    data = dict(entry.data)
    options = dict(entry.options)
    connections = data.get(CONF_CONNECTIONS, {})

    # Health
    coordinator = _get_coordinator(hass, entry)
    health: dict[str, Any] = {}
    if coordinator and coordinator.data:
        health = {
            cid: _health_to_dict(result) for cid, result in coordinator.data.items()
        }

    # Agents
    agents = [_build_agent_info(entry, aid) for aid in ALL_AGENTS]

    # Context
    context = {
        "context_mode": options.get(CONF_CONTEXT_MODE, DEFAULT_CONTEXT_MODE),
        "context_format": options.get(CONF_CONTEXT_FORMAT, DEFAULT_CONTEXT_FORMAT),
        "direct_entities": options.get(CONF_DIRECT_ENTITIES, ""),
        "max_context_tokens": options.get(CONF_MAX_CONTEXT_TOKENS, DEFAULT_MAX_CONTEXT_TOKENS),
    }

    # Vector DB
    vector_db = None
    if options.get(CONF_VECTOR_DB_BACKEND) or options.get(CONF_VECTOR_DB_HOST):
        vector_db = {
            "vector_db_backend": options.get(CONF_VECTOR_DB_BACKEND, DEFAULT_VECTOR_DB_BACKEND),
            "vector_db_host": options.get(CONF_VECTOR_DB_HOST, DEFAULT_VECTOR_DB_HOST),
            "vector_db_port": options.get(CONF_VECTOR_DB_PORT, DEFAULT_VECTOR_DB_PORT),
            "vector_db_collection": options.get(CONF_VECTOR_DB_COLLECTION, DEFAULT_VECTOR_DB_COLLECTION),
            "vector_db_top_k": options.get(CONF_VECTOR_DB_TOP_K, DEFAULT_VECTOR_DB_TOP_K),
            "vector_db_similarity_threshold": options.get(
                CONF_VECTOR_DB_SIMILARITY_THRESHOLD, DEFAULT_VECTOR_DB_SIMILARITY_THRESHOLD
            ),
            "milvus_host": options.get(CONF_MILVUS_HOST, DEFAULT_MILVUS_HOST),
            "milvus_port": options.get(CONF_MILVUS_PORT, DEFAULT_MILVUS_PORT),
            "milvus_collection": options.get(CONF_MILVUS_COLLECTION, DEFAULT_MILVUS_COLLECTION),
        }

    # Memory
    memory = {
        "memory_enabled": options.get(CONF_MEMORY_ENABLED, DEFAULT_MEMORY_ENABLED),
        "memory_universal_access": options.get(CONF_MEMORY_UNIVERSAL_ACCESS, DEFAULT_MEMORY_UNIVERSAL_ACCESS),
        "memory_max_memories": options.get(CONF_MEMORY_MAX_MEMORIES, DEFAULT_MEMORY_MAX_MEMORIES),
        "memory_min_importance": options.get(CONF_MEMORY_MIN_IMPORTANCE, DEFAULT_MEMORY_MIN_IMPORTANCE),
        "memory_min_words": options.get(CONF_MEMORY_MIN_WORDS, DEFAULT_MEMORY_MIN_WORDS),
        "memory_context_top_k": options.get(CONF_MEMORY_CONTEXT_TOP_K, DEFAULT_MEMORY_CONTEXT_TOP_K),
        "memory_collection_name": options.get(CONF_MEMORY_COLLECTION_NAME, DEFAULT_MEMORY_COLLECTION_NAME),
    }

    # Settings
    settings = {
        "proxlab_url": data.get(CONF_PROXLAB_URL, ""),
        "history_enabled": options.get(CONF_HISTORY_ENABLED, DEFAULT_HISTORY_ENABLED),
        "history_max_messages": options.get(CONF_HISTORY_MAX_MESSAGES, DEFAULT_HISTORY_MAX_MESSAGES),
        "history_max_tokens": options.get(CONF_HISTORY_MAX_TOKENS, DEFAULT_HISTORY_MAX_TOKENS),
        "session_persistence_enabled": options.get(
            CONF_SESSION_PERSISTENCE_ENABLED, DEFAULT_SESSION_PERSISTENCE_ENABLED
        ),
        "session_timeout": options.get(CONF_SESSION_TIMEOUT, DEFAULT_SESSION_TIMEOUT // 60),
        "tools_max_calls_per_turn": options.get(CONF_TOOLS_MAX_CALLS_PER_TURN, DEFAULT_TOOLS_MAX_CALLS_PER_TURN),
        "tools_timeout": options.get(CONF_TOOLS_TIMEOUT, DEFAULT_TOOLS_TIMEOUT),
        "debug_logging": options.get(CONF_DEBUG_LOGGING, DEFAULT_DEBUG_LOGGING),
        "streaming_enabled": options.get(CONF_STREAMING_ENABLED, DEFAULT_STREAMING_ENABLED),
    }

    # Enrich connections with IDs
    conns_with_ids = {
        cid: _connection_with_id(cid, conn) for cid, conn in connections.items()
    }

    connection.send_result(
        msg["id"],
        {
            "entry_id": entry.entry_id,
            "connections": conns_with_ids,
            "roles": data.get(CONF_ROLES, {}),
            "agents": agents,
            "health": health,
            "context": context,
            "vector_db": vector_db,
            "memory": memory,
            "settings": settings,
        },
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/health/get", vol.Optional("entry_id"): str}
)
@websocket_api.async_response
async def ws_health_get(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Return current health data."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], {})
        return

    coordinator = _get_coordinator(hass, entry)
    if not coordinator or not coordinator.data:
        connection.send_result(msg["id"], {})
        return

    connection.send_result(
        msg["id"],
        {cid: _health_to_dict(r) for cid, r in coordinator.data.items()},
    )


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/health/refresh", vol.Optional("entry_id"): str}
)
@websocket_api.async_response
async def ws_health_refresh(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Force a health refresh and return new results."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], {})
        return

    coordinator = _get_coordinator(hass, entry)
    if not coordinator:
        connection.send_result(msg["id"], {})
        return

    await coordinator.async_request_refresh()

    if coordinator.data:
        connection.send_result(
            msg["id"],
            {cid: _health_to_dict(r) for cid, r in coordinator.data.items()},
        )
    else:
        connection.send_result(msg["id"], {})


# ---------------------------------------------------------------------------
# Connections
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/connections/list", vol.Optional("entry_id"): str}
)
@websocket_api.async_response
async def ws_connections_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """List all connections with health overlay."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], {})
        return

    connections = dict(entry.data).get(CONF_CONNECTIONS, {})
    coordinator = _get_coordinator(hass, entry)
    health_data = coordinator.data if coordinator and coordinator.data else {}

    result = {}
    for cid, conn in connections.items():
        enriched = _connection_with_id(cid, conn)
        h = health_data.get(cid)
        if h:
            enriched["health"] = _health_to_dict(h)
        result[cid] = enriched

    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/connections/create",
        vol.Optional("entry_id"): str,
        vol.Required("name"): str,
        vol.Required("base_url"): str,
        vol.Optional("api_key", default=""): str,
        vol.Optional("model", default=""): str,
        vol.Optional("capabilities", default=[]): [str],
        vol.Optional("connection_type"): str,
        vol.Optional("temperature"): vol.Coerce(float),
        vol.Optional("max_tokens"): vol.Coerce(int),
        vol.Optional("top_p"): vol.Coerce(float),
        vol.Optional("keep_alive"): str,
        vol.Optional("proxy_headers"): dict,
        vol.Optional("thinking_enabled"): bool,
        vol.Optional("voice"): str,
        vol.Optional("speed"): vol.Coerce(float),
        vol.Optional("format"): str,
        vol.Optional("language"): str,
        vol.Optional("embedding_provider"): str,
        vol.Optional("tool_description"): str,
        vol.Optional("auto_include_context"): bool,
    }
)
@websocket_api.async_response
async def ws_connections_create(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Create a new connection."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return

    conn_id = uuid4().hex[:8]

    # Build connection dict from msg, excluding WS boilerplate keys
    skip_keys = {"id", "type", "entry_id"}
    conn_data: dict[str, Any] = {
        k: v for k, v in msg.items() if k not in skip_keys
    }

    # Normalize URL
    from .config_flow import normalize_url
    conn_data["base_url"] = normalize_url(conn_data["base_url"])

    new_data = dict(entry.data)
    new_conns = dict(new_data.get(CONF_CONNECTIONS, {}))
    new_conns[conn_id] = conn_data
    new_data[CONF_CONNECTIONS] = new_conns

    hass.config_entries.async_update_entry(entry, data=new_data)

    connection.send_result(msg["id"], {"connection_id": conn_id})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/connections/update",
        vol.Optional("entry_id"): str,
        vol.Required("connection_id"): str,
    }
)
@websocket_api.async_response
async def ws_connections_update(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Update fields on an existing connection."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return

    conn_id = msg["connection_id"]
    new_data = dict(entry.data)
    new_conns = dict(new_data.get(CONF_CONNECTIONS, {}))

    if conn_id not in new_conns:
        connection.send_error(msg["id"], "not_found", f"Connection {conn_id} not found")
        return

    # Merge provided fields (exclude WS boilerplate)
    skip_keys = {"id", "type", "entry_id", "connection_id"}
    updates = {k: v for k, v in msg.items() if k not in skip_keys}

    if "base_url" in updates:
        from .config_flow import normalize_url
        updates["base_url"] = normalize_url(updates["base_url"])

    conn = dict(new_conns[conn_id])
    conn.update(updates)
    new_conns[conn_id] = conn
    new_data[CONF_CONNECTIONS] = new_conns

    hass.config_entries.async_update_entry(entry, data=new_data)

    connection.send_result(msg["id"], {})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/connections/delete",
        vol.Optional("entry_id"): str,
        vol.Required("connection_id"): str,
    }
)
@websocket_api.async_response
async def ws_connections_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Delete a connection and clean up references."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return

    conn_id = msg["connection_id"]
    new_data = dict(entry.data)
    new_conns = dict(new_data.get(CONF_CONNECTIONS, {}))

    if conn_id not in new_conns:
        connection.send_error(msg["id"], "not_found", f"Connection {conn_id} not found")
        return

    del new_conns[conn_id]
    new_data[CONF_CONNECTIONS] = new_conns

    # Clean up roles that reference this connection
    new_roles = dict(new_data.get(CONF_ROLES, {}))
    for role, rid in list(new_roles.items()):
        if rid == conn_id:
            new_roles[role] = None
    new_data[CONF_ROLES] = new_roles

    # Clean up agent configs that reference this connection
    new_options = dict(entry.options)
    new_agents = dict(new_options.get(CONF_AGENTS, {}))
    for aid, acfg in new_agents.items():
        acfg = dict(acfg)
        if acfg.get("primary_connection") == conn_id:
            acfg["primary_connection"] = None
        if acfg.get("secondary_connection") == conn_id:
            acfg["secondary_connection"] = None
        new_agents[aid] = acfg
    new_options[CONF_AGENTS] = new_agents

    hass.config_entries.async_update_entry(entry, data=new_data, options=new_options)

    connection.send_result(msg["id"], {})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/connections/test",
        vol.Optional("entry_id"): str,
        vol.Required("base_url"): str,
        vol.Optional("api_key", default=""): str,
        vol.Optional("capabilities", default=[]): [str],
        vol.Optional("connection_type"): str,
    }
)
@websocket_api.async_response
async def ws_connections_test(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """One-shot health check on a URL."""
    entry = _get_entry(hass, msg)

    # Create a temporary coordinator to run a single check
    coordinator = _get_coordinator(hass, entry) if entry else None

    # Build a temporary connection dict for checking
    temp_conn = {
        "base_url": msg["base_url"],
        "api_key": msg.get("api_key", ""),
        "capabilities": msg.get("capabilities", []),
        "connection_type": msg.get("connection_type"),
    }

    if coordinator:
        result = await coordinator._check_connection("test", temp_conn)
        connection.send_result(msg["id"], _health_to_dict(result))
    else:
        # Fall back: create a temporary coordinator
        import aiohttp
        import asyncio

        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            reachable = False
            try:
                async with session.get(f"{msg['base_url'].rstrip('/')}/models") as resp:
                    reachable = True
                    api_valid = resp.status == 200
            except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as err:
                connection.send_result(
                    msg["id"],
                    {
                        "reachable": False,
                        "api_valid": False,
                        "detail": str(err),
                        "error": "Unreachable",
                        "model_name": None,
                    },
                )
                return

            connection.send_result(
                msg["id"],
                {
                    "reachable": reachable,
                    "api_valid": api_valid if reachable else False,
                    "detail": "OK" if api_valid else "API check failed",
                    "error": None if api_valid else "API Mismatch",
                    "model_name": None,
                },
            )


# ---------------------------------------------------------------------------
# Agents
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/agents/list", vol.Optional("entry_id"): str}
)
@websocket_api.async_response
async def ws_agents_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """List all agents with their config."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], [])
        return

    agents = [_build_agent_info(entry, aid) for aid in ALL_AGENTS]
    connection.send_result(msg["id"], agents)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agents/update",
        vol.Optional("entry_id"): str,
        vol.Required("agent_id"): str,
        vol.Optional("enabled"): bool,
        vol.Optional("primary_connection"): vol.Any(str, None),
        vol.Optional("secondary_connection"): vol.Any(str, None),
        vol.Optional("system_prompt"): vol.Any(str, None),
    }
)
@websocket_api.async_response
async def ws_agents_update(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Update an agent's config."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return

    agent_id = msg["agent_id"]
    if agent_id not in AGENT_DEFINITIONS:
        connection.send_error(msg["id"], "not_found", f"Unknown agent: {agent_id}")
        return

    new_options = dict(entry.options)
    new_agents = dict(new_options.get(CONF_AGENTS, {}))
    agent_cfg = dict(new_agents.get(agent_id, {}))

    # Apply updates
    for key in ("enabled", "primary_connection", "secondary_connection", "system_prompt"):
        if key in msg:
            agent_cfg[key] = msg[key]

    new_agents[agent_id] = agent_cfg
    new_options[CONF_AGENTS] = new_agents

    hass.config_entries.async_update_entry(entry, options=new_options)

    connection.send_result(msg["id"], {})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agents/default_prompt",
        vol.Optional("entry_id"): str,
        vol.Required("agent_id"): str,
    }
)
@callback
def ws_agents_default_prompt(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Return the default system prompt for an agent."""
    agent_id = msg["agent_id"]
    prompt = get_default_prompt(agent_id)
    connection.send_result(msg["id"], {"prompt": prompt})


# ---------------------------------------------------------------------------
# Context
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/context/get", vol.Optional("entry_id"): str}
)
@callback
def ws_context_get(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Return context settings."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], {})
        return

    options = dict(entry.options)
    connection.send_result(
        msg["id"],
        {
            "context_mode": options.get(CONF_CONTEXT_MODE, DEFAULT_CONTEXT_MODE),
            "context_format": options.get(CONF_CONTEXT_FORMAT, DEFAULT_CONTEXT_FORMAT),
            "direct_entities": options.get(CONF_DIRECT_ENTITIES, ""),
            "max_context_tokens": options.get(CONF_MAX_CONTEXT_TOKENS, DEFAULT_MAX_CONTEXT_TOKENS),
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/context/update",
        vol.Optional("entry_id"): str,
        vol.Optional("context_mode"): str,
        vol.Optional("context_format"): str,
        vol.Optional("direct_entities"): str,
        vol.Optional("max_context_tokens"): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def ws_context_update(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Update context settings."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return

    new_options = dict(entry.options)
    key_map = {
        "context_mode": CONF_CONTEXT_MODE,
        "context_format": CONF_CONTEXT_FORMAT,
        "direct_entities": CONF_DIRECT_ENTITIES,
        "max_context_tokens": CONF_MAX_CONTEXT_TOKENS,
    }

    for param, conf_key in key_map.items():
        if param in msg:
            new_options[conf_key] = msg[param]

    hass.config_entries.async_update_entry(entry, options=new_options)
    connection.send_result(msg["id"], {})


# ---------------------------------------------------------------------------
# Vector DB
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/vector_db/get", vol.Optional("entry_id"): str}
)
@callback
def ws_vector_db_get(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Return vector DB settings."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], None)
        return

    options = dict(entry.options)
    if not options.get(CONF_VECTOR_DB_BACKEND) and not options.get(CONF_VECTOR_DB_HOST):
        connection.send_result(msg["id"], None)
        return

    connection.send_result(
        msg["id"],
        {
            "vector_db_backend": options.get(CONF_VECTOR_DB_BACKEND, DEFAULT_VECTOR_DB_BACKEND),
            "vector_db_host": options.get(CONF_VECTOR_DB_HOST, DEFAULT_VECTOR_DB_HOST),
            "vector_db_port": options.get(CONF_VECTOR_DB_PORT, DEFAULT_VECTOR_DB_PORT),
            "vector_db_collection": options.get(CONF_VECTOR_DB_COLLECTION, DEFAULT_VECTOR_DB_COLLECTION),
            "vector_db_top_k": options.get(CONF_VECTOR_DB_TOP_K, DEFAULT_VECTOR_DB_TOP_K),
            "vector_db_similarity_threshold": options.get(
                CONF_VECTOR_DB_SIMILARITY_THRESHOLD, DEFAULT_VECTOR_DB_SIMILARITY_THRESHOLD
            ),
            "milvus_host": options.get(CONF_MILVUS_HOST, DEFAULT_MILVUS_HOST),
            "milvus_port": options.get(CONF_MILVUS_PORT, DEFAULT_MILVUS_PORT),
            "milvus_collection": options.get(CONF_MILVUS_COLLECTION, DEFAULT_MILVUS_COLLECTION),
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/vector_db/update",
        vol.Optional("entry_id"): str,
        vol.Optional("vector_db_backend"): str,
        vol.Optional("vector_db_host"): str,
        vol.Optional("vector_db_port"): vol.Coerce(int),
        vol.Optional("vector_db_collection"): str,
        vol.Optional("vector_db_top_k"): vol.Coerce(int),
        vol.Optional("vector_db_similarity_threshold"): vol.Coerce(float),
        vol.Optional("milvus_host"): str,
        vol.Optional("milvus_port"): vol.Coerce(int),
        vol.Optional("milvus_collection"): str,
    }
)
@websocket_api.async_response
async def ws_vector_db_update(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Update vector DB settings."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return

    new_options = dict(entry.options)
    key_map = {
        "vector_db_backend": CONF_VECTOR_DB_BACKEND,
        "vector_db_host": CONF_VECTOR_DB_HOST,
        "vector_db_port": CONF_VECTOR_DB_PORT,
        "vector_db_collection": CONF_VECTOR_DB_COLLECTION,
        "vector_db_top_k": CONF_VECTOR_DB_TOP_K,
        "vector_db_similarity_threshold": CONF_VECTOR_DB_SIMILARITY_THRESHOLD,
        "milvus_host": CONF_MILVUS_HOST,
        "milvus_port": CONF_MILVUS_PORT,
        "milvus_collection": CONF_MILVUS_COLLECTION,
    }

    for param, conf_key in key_map.items():
        if param in msg:
            new_options[conf_key] = msg[param]

    hass.config_entries.async_update_entry(entry, options=new_options)
    connection.send_result(msg["id"], {})


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/vector_db/delete", vol.Optional("entry_id"): str}
)
@websocket_api.async_response
async def ws_vector_db_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Remove all vector DB config."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return

    new_options = dict(entry.options)
    vdb_keys = [
        CONF_VECTOR_DB_BACKEND,
        CONF_VECTOR_DB_HOST,
        CONF_VECTOR_DB_PORT,
        CONF_VECTOR_DB_COLLECTION,
        CONF_VECTOR_DB_TOP_K,
        CONF_VECTOR_DB_SIMILARITY_THRESHOLD,
        CONF_MILVUS_HOST,
        CONF_MILVUS_PORT,
        CONF_MILVUS_COLLECTION,
    ]
    for key in vdb_keys:
        new_options.pop(key, None)

    # Reset context mode to direct if it was vector_db
    if new_options.get(CONF_CONTEXT_MODE) == "vector_db":
        new_options[CONF_CONTEXT_MODE] = "direct"

    hass.config_entries.async_update_entry(entry, options=new_options)
    connection.send_result(msg["id"], {})


# ---------------------------------------------------------------------------
# Memory
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/memory/get", vol.Optional("entry_id"): str}
)
@callback
def ws_memory_get(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Return memory settings."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], {})
        return

    options = dict(entry.options)
    connection.send_result(
        msg["id"],
        {
            "memory_enabled": options.get(CONF_MEMORY_ENABLED, DEFAULT_MEMORY_ENABLED),
            "memory_universal_access": options.get(CONF_MEMORY_UNIVERSAL_ACCESS, DEFAULT_MEMORY_UNIVERSAL_ACCESS),
            "memory_max_memories": options.get(CONF_MEMORY_MAX_MEMORIES, DEFAULT_MEMORY_MAX_MEMORIES),
            "memory_min_importance": options.get(CONF_MEMORY_MIN_IMPORTANCE, DEFAULT_MEMORY_MIN_IMPORTANCE),
            "memory_min_words": options.get(CONF_MEMORY_MIN_WORDS, DEFAULT_MEMORY_MIN_WORDS),
            "memory_context_top_k": options.get(CONF_MEMORY_CONTEXT_TOP_K, DEFAULT_MEMORY_CONTEXT_TOP_K),
            "memory_collection_name": options.get(CONF_MEMORY_COLLECTION_NAME, DEFAULT_MEMORY_COLLECTION_NAME),
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/memory/update",
        vol.Optional("entry_id"): str,
        vol.Optional("memory_enabled"): bool,
        vol.Optional("memory_universal_access"): bool,
        vol.Optional("memory_max_memories"): vol.Coerce(int),
        vol.Optional("memory_min_importance"): vol.Coerce(float),
        vol.Optional("memory_min_words"): vol.Coerce(int),
        vol.Optional("memory_context_top_k"): vol.Coerce(int),
        vol.Optional("memory_collection_name"): str,
    }
)
@websocket_api.async_response
async def ws_memory_update(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Update memory settings."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return

    new_options = dict(entry.options)
    key_map = {
        "memory_enabled": CONF_MEMORY_ENABLED,
        "memory_universal_access": CONF_MEMORY_UNIVERSAL_ACCESS,
        "memory_max_memories": CONF_MEMORY_MAX_MEMORIES,
        "memory_min_importance": CONF_MEMORY_MIN_IMPORTANCE,
        "memory_min_words": CONF_MEMORY_MIN_WORDS,
        "memory_context_top_k": CONF_MEMORY_CONTEXT_TOP_K,
        "memory_collection_name": CONF_MEMORY_COLLECTION_NAME,
    }

    for param, conf_key in key_map.items():
        if param in msg:
            new_options[conf_key] = msg[param]

    hass.config_entries.async_update_entry(entry, options=new_options)
    connection.send_result(msg["id"], {})


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/settings/get", vol.Optional("entry_id"): str}
)
@callback
def ws_settings_get(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Return general settings."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], {})
        return

    data = dict(entry.data)
    options = dict(entry.options)
    connection.send_result(
        msg["id"],
        {
            "proxlab_url": data.get(CONF_PROXLAB_URL, ""),
            "history_enabled": options.get(CONF_HISTORY_ENABLED, DEFAULT_HISTORY_ENABLED),
            "history_max_messages": options.get(CONF_HISTORY_MAX_MESSAGES, DEFAULT_HISTORY_MAX_MESSAGES),
            "history_max_tokens": options.get(CONF_HISTORY_MAX_TOKENS, DEFAULT_HISTORY_MAX_TOKENS),
            "session_persistence_enabled": options.get(
                CONF_SESSION_PERSISTENCE_ENABLED, DEFAULT_SESSION_PERSISTENCE_ENABLED
            ),
            "session_timeout": options.get(CONF_SESSION_TIMEOUT, DEFAULT_SESSION_TIMEOUT // 60),
            "tools_max_calls_per_turn": options.get(CONF_TOOLS_MAX_CALLS_PER_TURN, DEFAULT_TOOLS_MAX_CALLS_PER_TURN),
            "tools_timeout": options.get(CONF_TOOLS_TIMEOUT, DEFAULT_TOOLS_TIMEOUT),
            "debug_logging": options.get(CONF_DEBUG_LOGGING, DEFAULT_DEBUG_LOGGING),
            "streaming_enabled": options.get(CONF_STREAMING_ENABLED, DEFAULT_STREAMING_ENABLED),
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/settings/update",
        vol.Optional("entry_id"): str,
        vol.Optional("proxlab_url"): str,
        vol.Optional("history_enabled"): bool,
        vol.Optional("history_max_messages"): vol.Coerce(int),
        vol.Optional("history_max_tokens"): vol.Coerce(int),
        vol.Optional("session_persistence_enabled"): bool,
        vol.Optional("session_timeout"): vol.Coerce(int),
        vol.Optional("tools_max_calls_per_turn"): vol.Coerce(int),
        vol.Optional("tools_timeout"): vol.Coerce(int),
        vol.Optional("debug_logging"): bool,
        vol.Optional("streaming_enabled"): bool,
    }
)
@websocket_api.async_response
async def ws_settings_update(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Update general settings."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return

    new_data = dict(entry.data)
    new_options = dict(entry.options)

    # proxlab_url lives in entry.data
    if "proxlab_url" in msg:
        new_data[CONF_PROXLAB_URL] = msg["proxlab_url"]

    # Everything else lives in options
    options_map = {
        "history_enabled": CONF_HISTORY_ENABLED,
        "history_max_messages": CONF_HISTORY_MAX_MESSAGES,
        "history_max_tokens": CONF_HISTORY_MAX_TOKENS,
        "session_persistence_enabled": CONF_SESSION_PERSISTENCE_ENABLED,
        "session_timeout": CONF_SESSION_TIMEOUT,
        "tools_max_calls_per_turn": CONF_TOOLS_MAX_CALLS_PER_TURN,
        "tools_timeout": CONF_TOOLS_TIMEOUT,
        "debug_logging": CONF_DEBUG_LOGGING,
        "streaming_enabled": CONF_STREAMING_ENABLED,
    }

    for param, conf_key in options_map.items():
        if param in msg:
            new_options[conf_key] = msg[param]

    hass.config_entries.async_update_entry(entry, data=new_data, options=new_options)
    connection.send_result(msg["id"], {})


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/discovery/services", vol.Optional("entry_id"): str}
)
@websocket_api.async_response
async def ws_discovery_services(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Fetch services from ProxLab API."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], {"services": []})
        return

    proxlab_url = dict(entry.data).get(CONF_PROXLAB_URL, "")
    if not proxlab_url:
        connection.send_result(msg["id"], {"services": []})
        return

    try:
        services = await discover_services(proxlab_url)
        connection.send_result(
            msg["id"],
            {
                "services": [
                    {
                        "id": svc.id,
                        "provider": svc.provider,
                        "port": svc.port,
                        "node": svc.node,
                        "container_ip": svc.container_ip,
                        "model": svc.model,
                        "service_type": svc.service_type,
                        "base_url": svc.base_url,
                        "display_name": svc.display_name,
                    }
                    for svc in services
                ]
            },
        )
    except Exception as err:
        _LOGGER.error("Service discovery failed: %s", err)
        connection.send_error(msg["id"], "discovery_failed", str(err))


# ---------------------------------------------------------------------------
# Debug traces
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/debug/traces", vol.Optional("entry_id"): str}
)
@callback
def ws_debug_traces(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Return recent conversation traces for the debug panel."""
    traces = list(hass.data.get(DOMAIN, {}).get("_debug_traces", []))
    connection.send_result(msg["id"], {"traces": traces})


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/debug/clear", vol.Optional("entry_id"): str}
)
@websocket_api.async_response
async def ws_debug_clear(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Clear the debug trace buffer."""
    traces = hass.data.get(DOMAIN, {}).get("_debug_traces")
    if traces is not None:
        traces.clear()
    save_fn = hass.data.get(DOMAIN, {}).get("_debug_trace_save")
    if save_fn:
        await save_fn()
    connection.send_result(msg["id"], {"cleared": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/debug/config",
        vol.Optional("entry_id"): str,
        vol.Optional("max_entries"): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def ws_debug_config(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Get or set debug trace configuration."""
    domain_data = hass.data.get(DOMAIN, {})

    if "max_entries" in msg:
        domain_data["_debug_trace_max"] = msg["max_entries"]
        save_fn = domain_data.get("_debug_trace_save")
        if save_fn:
            await save_fn()

    connection.send_result(msg["id"], {
        "max_entries": domain_data.get("_debug_trace_max", 200),
    })


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/debug/delete_older",
        vol.Optional("entry_id"): str,
        vol.Required("days"): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def ws_debug_delete_older(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Delete traces older than N days."""
    import time

    domain_data = hass.data.get(DOMAIN, {})
    traces = domain_data.get("_debug_traces")
    if traces is None:
        connection.send_result(msg["id"], {"deleted": 0})
        return

    cutoff = time.time() - (msg["days"] * 86400)
    original_len = len(traces)

    # Filter in place: keep only traces newer than cutoff
    kept = [t for t in traces if t.get("timestamp", 0) >= cutoff]
    traces.clear()
    traces.extend(kept)

    deleted = original_len - len(traces)
    save_fn = domain_data.get("_debug_trace_save")
    if save_fn:
        await save_fn()

    connection.send_result(msg["id"], {"deleted": deleted})


# ---------------------------------------------------------------------------
# API Usage & Admin
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/api/usage", vol.Optional("entry_id"): str}
)
@callback
def ws_api_usage(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Return accumulated API usage stats."""
    usage = hass.data.get(DOMAIN, {}).get("_api_usage", {})
    connection.send_result(msg["id"], usage)


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/api/usage/reset", vol.Optional("entry_id"): str}
)
@websocket_api.async_response
async def ws_api_usage_reset(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Reset accumulated API usage stats."""
    domain_data = hass.data.get(DOMAIN, {})
    usage = domain_data.get("_api_usage")
    if usage:
        usage["models"] = {}
        usage["agents"] = {}
        usage["total"] = {"input_tokens": 0, "output_tokens": 0, "messages": 0, "cost_usd": 0.0}
        usage["last_updated"] = 0.0
        store = domain_data.get("_api_usage_store")
        if store:
            await store.async_save(usage)
    connection.send_result(msg["id"], {"reset": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/api/admin_report",
        vol.Optional("entry_id"): str,
        vol.Optional("admin_key"): str,
        vol.Optional("days", default=30): vol.Coerce(int),
    }
)
@websocket_api.async_response
async def ws_api_admin_report(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Fetch usage and cost reports from Anthropic Admin API."""
    from .admin_api import fetch_cost_report, fetch_usage_report

    admin_key = msg.get("admin_key", "")

    # Try stored key if none provided
    if not admin_key:
        entry = _get_entry(hass, msg)
        if entry:
            admin_key = dict(entry.options).get("admin_api_key", "")

    if not admin_key:
        connection.send_error(msg["id"], "no_key", "Admin API key not configured")
        return

    days = msg.get("days", 30)
    usage = await fetch_usage_report(admin_key, days)
    cost = await fetch_cost_report(admin_key, days)

    connection.send_result(msg["id"], {"usage": usage, "cost": cost})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/api/config",
        vol.Optional("entry_id"): str,
        vol.Optional("admin_key"): str,
        vol.Optional("budget"): vol.Any(float, int, None),
    }
)
@websocket_api.async_response
async def ws_api_config(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Save or load admin API config (admin key + budget)."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return

    save_needed = False
    new_options = dict(entry.options)

    if "admin_key" in msg:
        new_options["admin_api_key"] = msg["admin_key"]
        save_needed = True

    if "budget" in msg:
        new_options["api_budget"] = msg["budget"]
        save_needed = True

    if save_needed:
        hass.config_entries.async_update_entry(entry, options=new_options)
        connection.send_result(msg["id"], {"saved": True})
    else:
        admin_key = new_options.get("admin_api_key", "")
        budget = new_options.get("api_budget")
        connection.send_result(msg["id"], {"admin_key": admin_key, "budget": budget})


# ---------------------------------------------------------------------------
# Issues Tracker
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/issues/list", vol.Optional("entry_id"): str}
)
@callback
def ws_issues_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Return all issues."""
    issues_data = hass.data.get(DOMAIN, {}).get("_issues", {"items": []})
    connection.send_result(msg["id"], {"items": issues_data.get("items", [])})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/issues/create",
        vol.Optional("entry_id"): str,
        vol.Required("category"): vol.In(["bug", "feature"]),
        vol.Required("text"): str,
    }
)
@websocket_api.async_response
async def ws_issues_create(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Create a new issue."""
    import time

    domain_data = hass.data.get(DOMAIN, {})
    issues_data = domain_data.get("_issues")
    store = domain_data.get("_issues_store")

    if issues_data is None or store is None:
        connection.send_error(msg["id"], "not_ready", "Issues store not initialized")
        return

    issue_id = uuid4().hex[:8]
    item = {
        "id": issue_id,
        "category": msg["category"],
        "text": msg["text"],
        "completed": False,
        "created_at": time.time(),
        "completed_at": None,
    }
    issues_data["items"].append(item)
    await store.async_save(issues_data)

    connection.send_result(msg["id"], {"id": issue_id})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/issues/update",
        vol.Optional("entry_id"): str,
        vol.Required("issue_id"): str,
        vol.Optional("completed"): bool,
        vol.Optional("text"): str,
    }
)
@websocket_api.async_response
async def ws_issues_update(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Update an existing issue (toggle completed, edit text)."""
    import time

    domain_data = hass.data.get(DOMAIN, {})
    issues_data = domain_data.get("_issues")
    store = domain_data.get("_issues_store")

    if issues_data is None or store is None:
        connection.send_error(msg["id"], "not_ready", "Issues store not initialized")
        return

    issue_id = msg["issue_id"]
    for item in issues_data["items"]:
        if item["id"] == issue_id:
            if "completed" in msg:
                item["completed"] = msg["completed"]
                item["completed_at"] = time.time() if msg["completed"] else None
            if "text" in msg:
                item["text"] = msg["text"]
            await store.async_save(issues_data)
            connection.send_result(msg["id"], {})
            return

    connection.send_error(msg["id"], "not_found", f"Issue {issue_id} not found")


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/issues/delete",
        vol.Optional("entry_id"): str,
        vol.Required("issue_id"): str,
    }
)
@websocket_api.async_response
async def ws_issues_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Delete an issue."""
    domain_data = hass.data.get(DOMAIN, {})
    issues_data = domain_data.get("_issues")
    store = domain_data.get("_issues_store")

    if issues_data is None or store is None:
        connection.send_error(msg["id"], "not_ready", "Issues store not initialized")
        return

    issue_id = msg["issue_id"]
    original_len = len(issues_data["items"])
    issues_data["items"] = [i for i in issues_data["items"] if i["id"] != issue_id]

    if len(issues_data["items"]) == original_len:
        connection.send_error(msg["id"], "not_found", f"Issue {issue_id} not found")
        return

    await store.async_save(issues_data)
    connection.send_result(msg["id"], {})


# ---------------------------------------------------------------------------
# Agent Invoke API
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/invoke",
        vol.Optional("entry_id"): str,
        vol.Required("agent_id"): str,
        vol.Required("message"): str,
        vol.Optional("context"): dict,
        vol.Optional("user_id"): str,
        vol.Optional("conversation_id"): str,
        vol.Optional("include_history", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_agent_invoke(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Directly invoke a specific agent, bypassing the orchestrator."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return

    entry_data = hass.data.get(DOMAIN, {}).get(entry.entry_id, {})
    agent = entry_data.get("agent")

    if agent is None:
        connection.send_error(
            msg["id"], "not_configured", "LLM not configured — agent unavailable"
        )
        return

    try:
        result = await agent.invoke_agent(
            agent_id=msg["agent_id"],
            message=msg["message"],
            context=msg.get("context"),
            user_id=msg.get("user_id"),
            conversation_id=msg.get("conversation_id"),
            include_history=msg.get("include_history", False),
        )
        connection.send_result(msg["id"], result)
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_agent", str(err))
    except Exception as err:
        _LOGGER.error("Agent invoke failed: %s", err, exc_info=True)
        connection.send_error(msg["id"], "invoke_failed", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/available",
        vol.Optional("entry_id"): str,
    }
)
@callback
def ws_agent_available(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Return list of agents available for direct invocation."""
    from .connection_manager import resolve_agent_to_flat_config

    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], [])
        return

    config = dict(entry.data) | dict(entry.options)
    agents_cfg = config.get(CONF_AGENTS, {})

    result: list[dict[str, Any]] = []
    for agent_id in ROUTABLE_AGENTS:
        defn = AGENT_DEFINITIONS.get(agent_id)
        if defn is None:
            continue

        # Check if agent is mandatory or enabled
        if not defn.mandatory:
            acfg = agents_cfg.get(agent_id, {})
            if not acfg.get("enabled", False):
                continue

        # Check if agent has a connection (or can fall back to default)
        has_connection = resolve_agent_to_flat_config(config, agent_id) is not None

        tool_names = AGENT_TOOL_MAP.get(agent_id)

        result.append({
            "id": defn.id,
            "name": defn.name,
            "description": defn.description,
            "group": _agent_group(agent_id),
            "has_connection": has_connection,
            "tools": tool_names if tool_names is not None else [],
        })

    connection.send_result(msg["id"], result)
