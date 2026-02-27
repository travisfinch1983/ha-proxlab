"""WebSocket API for ProxLab panel.

Provides custom WS commands that the React frontend calls to read/write
config, health data, connections, agents, and settings.
"""

from __future__ import annotations

import asyncio
import logging
import time as _time
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
    CONF_LLM_API_KEY,
    CONF_LLM_BASE_URL,
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
    CONF_WEAVIATE_API_KEY,
    CONF_WEAVIATE_COLLECTION,
    CONF_WEAVIATE_URL,
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
    DEFAULT_WEAVIATE_COLLECTION,
    DEFAULT_WEAVIATE_URL,
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
    # Roadmap
    websocket_api.async_register_command(hass, ws_roadmap_list)
    websocket_api.async_register_command(hass, ws_roadmap_update)
    # Agent Registry (Phase 2)
    websocket_api.async_register_command(hass, ws_subscriptions_list)
    websocket_api.async_register_command(hass, ws_subscriptions_create)
    websocket_api.async_register_command(hass, ws_subscriptions_update)
    websocket_api.async_register_command(hass, ws_subscriptions_delete)
    websocket_api.async_register_command(hass, ws_schedules_list)
    websocket_api.async_register_command(hass, ws_schedules_create)
    websocket_api.async_register_command(hass, ws_schedules_update)
    websocket_api.async_register_command(hass, ws_schedules_delete)
    websocket_api.async_register_command(hass, ws_chains_list)
    websocket_api.async_register_command(hass, ws_chains_create)
    websocket_api.async_register_command(hass, ws_chains_update)
    websocket_api.async_register_command(hass, ws_chains_delete)
    websocket_api.async_register_command(hass, ws_chains_run)
    # MCP Marketplace (Phase 6)
    websocket_api.async_register_command(hass, ws_mcp_repos_list)
    websocket_api.async_register_command(hass, ws_mcp_repos_add)
    websocket_api.async_register_command(hass, ws_mcp_repos_remove)
    websocket_api.async_register_command(hass, ws_mcp_repos_refresh)
    websocket_api.async_register_command(hass, ws_mcp_catalog)
    websocket_api.async_register_command(hass, ws_mcp_servers_list)
    websocket_api.async_register_command(hass, ws_mcp_servers_create)
    websocket_api.async_register_command(hass, ws_mcp_servers_update)
    websocket_api.async_register_command(hass, ws_mcp_servers_delete)
    websocket_api.async_register_command(hass, ws_mcp_servers_reconnect)

    # Chat card commands
    websocket_api.async_register_command(hass, ws_card_config_get)
    websocket_api.async_register_command(hass, ws_card_config_list)
    websocket_api.async_register_command(hass, ws_card_config_save)
    websocket_api.async_register_command(hass, ws_card_config_delete)
    websocket_api.async_register_command(hass, ws_card_voices)
    websocket_api.async_register_command(hass, ws_card_avatar_upload)
    websocket_api.async_register_command(hass, ws_card_invoke)
    websocket_api.async_register_command(hass, ws_card_invoke_stream)
    websocket_api.async_register_command(hass, ws_card_agent_prompt)
    websocket_api.async_register_command(hass, ws_card_tts_speak)
    websocket_api.async_register_command(hass, ws_card_stt_transcribe)

    # Agent profile commands
    websocket_api.async_register_command(hass, ws_profile_list)
    websocket_api.async_register_command(hass, ws_profile_get)
    websocket_api.async_register_command(hass, ws_profile_save)
    websocket_api.async_register_command(hass, ws_profile_delete)

    # Group chat card commands
    websocket_api.async_register_command(hass, ws_group_config_get)
    websocket_api.async_register_command(hass, ws_group_config_save)
    websocket_api.async_register_command(hass, ws_group_config_list)
    websocket_api.async_register_command(hass, ws_group_config_delete)
    websocket_api.async_register_command(hass, ws_group_invoke)
    websocket_api.async_register_command(hass, ws_group_invoke_stream)


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

    result = {
            "entry_id": entry.entry_id,
            "connections": conns_with_ids,
            "roles": data.get(CONF_ROLES, {}),
            "agents": agents,
            "health": health,
            "context": context,
            "vector_db": vector_db,
            "memory": memory,
            "settings": settings,
        }
    connection.send_result(msg["id"], result)


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
        vol.Optional("name"): str,
        vol.Optional("base_url"): str,
        vol.Optional("api_key"): str,
        vol.Optional("model"): str,
        vol.Optional("capabilities"): [str],
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
            "weaviate_url": options.get(CONF_WEAVIATE_URL, DEFAULT_WEAVIATE_URL),
            "weaviate_api_key": options.get(CONF_WEAVIATE_API_KEY, ""),
            "weaviate_collection": options.get(CONF_WEAVIATE_COLLECTION, DEFAULT_WEAVIATE_COLLECTION),
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
        vol.Optional("weaviate_url"): str,
        vol.Optional("weaviate_api_key"): str,
        vol.Optional("weaviate_collection"): str,
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
        "weaviate_url": CONF_WEAVIATE_URL,
        "weaviate_api_key": CONF_WEAVIATE_API_KEY,
        "weaviate_collection": CONF_WEAVIATE_COLLECTION,
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
    {
        vol.Required("type"): "proxlab/debug/traces",
        vol.Optional("entry_id"): str,
        vol.Optional("limit", default=50): int,
        vol.Optional("offset", default=0): int,
    }
)
@websocket_api.async_response
async def ws_debug_traces(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Return recent conversation traces for the debug panel."""
    all_traces = hass.data.get(DOMAIN, {}).get("_debug_traces", [])
    total = len(all_traces)
    limit = msg.get("limit", 50)
    offset = msg.get("offset", 0)
    page = list(all_traces[offset : offset + limit] if limit > 0 else all_traces)

    def _trim(traces_page):
        lite = []
        for t in traces_page:
            entry = dict(t)
            rt = entry.get("response_text", "")
            if isinstance(rt, str) and len(rt) > 300:
                entry["response_text"] = rt[:300] + "\u2026"
            entry.pop("context", None)
            if "steps" in entry:
                trimmed = []
                for s in entry["steps"]:
                    sc = dict(s)
                    sc.pop("context_messages", None)
                    srt = sc.get("response_text", "")
                    if isinstance(srt, str) and len(srt) > 300:
                        sc["response_text"] = srt[:300] + "\u2026"
                    trimmed.append(sc)
                entry["steps"] = trimmed
            lite.append(entry)
        return lite

    lite = await hass.async_add_executor_job(_trim, page)
    connection.send_result(msg["id"], {"traces": lite, "total": total})


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


# ---------------------------------------------------------------------------
# Agent Registry — Subscriptions
# ---------------------------------------------------------------------------


def _get_registry(hass: HomeAssistant, entry: ConfigEntry):
    """Get the AgentRegistry for an entry."""
    entry_data = hass.data.get(DOMAIN, {}).get(entry.entry_id, {})
    return entry_data.get("agent_registry")


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/subscriptions/list",
        vol.Optional("entry_id"): str,
    }
)
@callback
def ws_subscriptions_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """List all event subscriptions."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], [])
        return
    registry = _get_registry(hass, entry)
    if not registry:
        connection.send_result(msg["id"], [])
        return
    connection.send_result(msg["id"], registry.list_subscriptions())


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/subscriptions/create",
        vol.Optional("entry_id"): str,
        vol.Required("event_type"): str,
        vol.Required("agent_id"): str,
        vol.Optional("event_filter", default={}): dict,
        vol.Optional("message_template", default=""): str,
        vol.Optional("context_template"): vol.Any(str, None),
        vol.Optional("cooldown_seconds"): vol.Coerce(int),
        vol.Optional("enabled", default=True): bool,
    }
)
@websocket_api.async_response
async def ws_subscriptions_create(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Create a new event subscription."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    registry = _get_registry(hass, entry)
    if not registry:
        connection.send_error(msg["id"], "not_ready", "Agent registry not initialized")
        return

    skip_keys = {"id", "type", "entry_id"}
    data = {k: v for k, v in msg.items() if k not in skip_keys}
    sub = await registry.create_subscription(data)
    connection.send_result(msg["id"], sub)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/subscriptions/update",
        vol.Optional("entry_id"): str,
        vol.Required("subscription_id"): str,
        vol.Optional("event_type"): str,
        vol.Optional("agent_id"): str,
        vol.Optional("event_filter"): dict,
        vol.Optional("message_template"): str,
        vol.Optional("context_template"): vol.Any(str, None),
        vol.Optional("cooldown_seconds"): vol.Coerce(int),
        vol.Optional("enabled"): bool,
    }
)
@websocket_api.async_response
async def ws_subscriptions_update(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Update an existing subscription."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    registry = _get_registry(hass, entry)
    if not registry:
        connection.send_error(msg["id"], "not_ready", "Agent registry not initialized")
        return

    sub_id = msg["subscription_id"]
    skip_keys = {"id", "type", "entry_id", "subscription_id"}
    updates = {k: v for k, v in msg.items() if k not in skip_keys}

    try:
        sub = await registry.update_subscription(sub_id, updates)
        connection.send_result(msg["id"], sub)
    except ValueError as err:
        connection.send_error(msg["id"], "not_found", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/subscriptions/delete",
        vol.Optional("entry_id"): str,
        vol.Required("subscription_id"): str,
    }
)
@websocket_api.async_response
async def ws_subscriptions_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Delete a subscription."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    registry = _get_registry(hass, entry)
    if not registry:
        connection.send_error(msg["id"], "not_ready", "Agent registry not initialized")
        return

    try:
        await registry.delete_subscription(msg["subscription_id"])
        connection.send_result(msg["id"], {})
    except ValueError as err:
        connection.send_error(msg["id"], "not_found", str(err))


# ---------------------------------------------------------------------------
# Agent Registry — Schedules
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/schedules/list",
        vol.Optional("entry_id"): str,
    }
)
@callback
def ws_schedules_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """List all schedules."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], [])
        return
    registry = _get_registry(hass, entry)
    if not registry:
        connection.send_result(msg["id"], [])
        return
    connection.send_result(msg["id"], registry.list_schedules())


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/schedules/create",
        vol.Optional("entry_id"): str,
        vol.Required("agent_id"): str,
        vol.Optional("schedule_type", default="interval"): str,
        vol.Optional("schedule_config", default={}): dict,
        vol.Optional("message_template", default=""): str,
        vol.Optional("context_template"): vol.Any(str, None),
        vol.Optional("cooldown_seconds"): vol.Coerce(int),
        vol.Optional("enabled", default=True): bool,
    }
)
@websocket_api.async_response
async def ws_schedules_create(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Create a new schedule."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    registry = _get_registry(hass, entry)
    if not registry:
        connection.send_error(msg["id"], "not_ready", "Agent registry not initialized")
        return

    skip_keys = {"id", "type", "entry_id"}
    data = {k: v for k, v in msg.items() if k not in skip_keys}
    sched = await registry.create_schedule(data)
    connection.send_result(msg["id"], sched)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/schedules/update",
        vol.Optional("entry_id"): str,
        vol.Required("schedule_id"): str,
        vol.Optional("agent_id"): str,
        vol.Optional("schedule_type"): str,
        vol.Optional("schedule_config"): dict,
        vol.Optional("message_template"): str,
        vol.Optional("context_template"): vol.Any(str, None),
        vol.Optional("cooldown_seconds"): vol.Coerce(int),
        vol.Optional("enabled"): bool,
    }
)
@websocket_api.async_response
async def ws_schedules_update(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Update an existing schedule."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    registry = _get_registry(hass, entry)
    if not registry:
        connection.send_error(msg["id"], "not_ready", "Agent registry not initialized")
        return

    sched_id = msg["schedule_id"]
    skip_keys = {"id", "type", "entry_id", "schedule_id"}
    updates = {k: v for k, v in msg.items() if k not in skip_keys}

    try:
        sched = await registry.update_schedule(sched_id, updates)
        connection.send_result(msg["id"], sched)
    except ValueError as err:
        connection.send_error(msg["id"], "not_found", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/schedules/delete",
        vol.Optional("entry_id"): str,
        vol.Required("schedule_id"): str,
    }
)
@websocket_api.async_response
async def ws_schedules_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Delete a schedule."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    registry = _get_registry(hass, entry)
    if not registry:
        connection.send_error(msg["id"], "not_ready", "Agent registry not initialized")
        return

    try:
        await registry.delete_schedule(msg["schedule_id"])
        connection.send_result(msg["id"], {})
    except ValueError as err:
        connection.send_error(msg["id"], "not_found", str(err))


# ---------------------------------------------------------------------------
# Agent Registry — Chains
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/chains/list",
        vol.Optional("entry_id"): str,
    }
)
@callback
def ws_chains_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """List all chains."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], [])
        return
    registry = _get_registry(hass, entry)
    if not registry:
        connection.send_result(msg["id"], [])
        return
    connection.send_result(msg["id"], registry.list_chains())


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/chains/create",
        vol.Optional("entry_id"): str,
        vol.Optional("name"): str,
        vol.Required("steps"): list,
        vol.Optional("enabled", default=True): bool,
    }
)
@websocket_api.async_response
async def ws_chains_create(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Create a new chain."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    registry = _get_registry(hass, entry)
    if not registry:
        connection.send_error(msg["id"], "not_ready", "Agent registry not initialized")
        return

    skip_keys = {"id", "type", "entry_id"}
    data = {k: v for k, v in msg.items() if k not in skip_keys}
    chain = await registry.create_chain(data)
    connection.send_result(msg["id"], chain)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/chains/update",
        vol.Optional("entry_id"): str,
        vol.Required("chain_id"): str,
        vol.Optional("name"): str,
        vol.Optional("steps"): list,
        vol.Optional("enabled"): bool,
    }
)
@websocket_api.async_response
async def ws_chains_update(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Update an existing chain."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    registry = _get_registry(hass, entry)
    if not registry:
        connection.send_error(msg["id"], "not_ready", "Agent registry not initialized")
        return

    chain_id = msg["chain_id"]
    skip_keys = {"id", "type", "entry_id", "chain_id"}
    updates = {k: v for k, v in msg.items() if k not in skip_keys}

    try:
        chain = await registry.update_chain(chain_id, updates)
        connection.send_result(msg["id"], chain)
    except ValueError as err:
        connection.send_error(msg["id"], "not_found", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/chains/delete",
        vol.Optional("entry_id"): str,
        vol.Required("chain_id"): str,
    }
)
@websocket_api.async_response
async def ws_chains_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Delete a chain."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    registry = _get_registry(hass, entry)
    if not registry:
        connection.send_error(msg["id"], "not_ready", "Agent registry not initialized")
        return

    try:
        await registry.delete_chain(msg["chain_id"])
        connection.send_result(msg["id"], {})
    except ValueError as err:
        connection.send_error(msg["id"], "not_found", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/agent/chains/run",
        vol.Optional("entry_id"): str,
        vol.Required("chain_id"): str,
        vol.Optional("initial_message", default=""): str,
        vol.Optional("initial_context"): dict,
    }
)
@websocket_api.async_response
async def ws_chains_run(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Execute a chain and return the result."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    registry = _get_registry(hass, entry)
    if not registry:
        connection.send_error(msg["id"], "not_ready", "Agent registry not initialized")
        return

    try:
        chain_result = await registry.run_chain(
            chain_id=msg["chain_id"],
            initial_message=msg.get("initial_message", ""),
            initial_context=msg.get("initial_context"),
        )
        connection.send_result(msg["id"], chain_result)
    except ValueError as err:
        connection.send_error(msg["id"], "not_found", str(err))
    except Exception as err:
        _LOGGER.error("Chain run failed: %s", err, exc_info=True)
        connection.send_error(msg["id"], "chain_failed", str(err))


# ---------------------------------------------------------------------------
# Roadmap
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {vol.Required("type"): "proxlab/roadmap/list", vol.Optional("entry_id"): str}
)
@callback
def ws_roadmap_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Return all roadmap headers with items."""
    roadmap_data = hass.data.get(DOMAIN, {}).get("_roadmap", {"headers": []})
    connection.send_result(msg["id"], {"headers": roadmap_data.get("headers", [])})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/roadmap/update",
        vol.Optional("entry_id"): str,
        vol.Required("action"): str,
        vol.Optional("title"): str,
        vol.Optional("header_id"): str,
        vol.Optional("collapsed"): bool,
        vol.Optional("header_ids"): [str],
        vol.Optional("text"): str,
        vol.Optional("item_id"): str,
        vol.Optional("completed"): bool,
    }
)
@websocket_api.async_response
async def ws_roadmap_update(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Dispatch roadmap mutations by action field."""
    import time

    domain_data = hass.data.get(DOMAIN, {})
    roadmap_data = domain_data.get("_roadmap")
    store = domain_data.get("_roadmap_store")

    if roadmap_data is None or store is None:
        connection.send_error(msg["id"], "not_ready", "Roadmap store not initialized")
        return

    headers: list[dict] = roadmap_data.setdefault("headers", [])
    action = msg["action"]

    if action == "create_header":
        header_id = uuid4().hex[:8]
        headers.append({
            "id": header_id,
            "title": msg.get("title", "New Phase"),
            "position": len(headers),
            "collapsed": False,
            "created_at": time.time(),
            "items": [],
        })
        await store.async_save(roadmap_data)
        connection.send_result(msg["id"], {"header_id": header_id})

    elif action == "update_header":
        header_id = msg.get("header_id")
        for h in headers:
            if h["id"] == header_id:
                if "title" in msg:
                    h["title"] = msg["title"]
                if "collapsed" in msg:
                    h["collapsed"] = msg["collapsed"]
                await store.async_save(roadmap_data)
                connection.send_result(msg["id"], {})
                return
        connection.send_error(msg["id"], "not_found", f"Header {header_id} not found")

    elif action == "delete_header":
        header_id = msg.get("header_id")
        original_len = len(headers)
        roadmap_data["headers"] = [h for h in headers if h["id"] != header_id]
        if len(roadmap_data["headers"]) == original_len:
            connection.send_error(msg["id"], "not_found", f"Header {header_id} not found")
            return
        await store.async_save(roadmap_data)
        connection.send_result(msg["id"], {})

    elif action == "reorder_headers":
        ordered_ids = msg.get("header_ids", [])
        by_id = {h["id"]: h for h in headers}
        reordered = []
        for i, hid in enumerate(ordered_ids):
            if hid in by_id:
                h = by_id[hid]
                h["position"] = i
                reordered.append(h)
        # Append any headers not in the list (safety net)
        seen = set(ordered_ids)
        for h in headers:
            if h["id"] not in seen:
                h["position"] = len(reordered)
                reordered.append(h)
        roadmap_data["headers"] = reordered
        await store.async_save(roadmap_data)
        connection.send_result(msg["id"], {})

    elif action == "create_item":
        header_id = msg.get("header_id")
        for h in headers:
            if h["id"] == header_id:
                item_id = uuid4().hex[:8]
                h["items"].append({
                    "id": item_id,
                    "text": msg.get("text", ""),
                    "completed": False,
                    "created_at": time.time(),
                    "completed_at": None,
                })
                await store.async_save(roadmap_data)
                connection.send_result(msg["id"], {"item_id": item_id})
                return
        connection.send_error(msg["id"], "not_found", f"Header {header_id} not found")

    elif action == "update_item":
        header_id = msg.get("header_id")
        item_id = msg.get("item_id")
        for h in headers:
            if h["id"] == header_id:
                for item in h["items"]:
                    if item["id"] == item_id:
                        if "completed" in msg:
                            item["completed"] = msg["completed"]
                            item["completed_at"] = time.time() if msg["completed"] else None
                        if "text" in msg:
                            item["text"] = msg["text"]
                        await store.async_save(roadmap_data)
                        connection.send_result(msg["id"], {})
                        return
                connection.send_error(msg["id"], "not_found", f"Item {item_id} not found")
                return
        connection.send_error(msg["id"], "not_found", f"Header {header_id} not found")

    elif action == "delete_item":
        header_id = msg.get("header_id")
        item_id = msg.get("item_id")
        for h in headers:
            if h["id"] == header_id:
                original_len = len(h["items"])
                h["items"] = [it for it in h["items"] if it["id"] != item_id]
                if len(h["items"]) == original_len:
                    connection.send_error(msg["id"], "not_found", f"Item {item_id} not found")
                    return
                await store.async_save(roadmap_data)
                connection.send_result(msg["id"], {})
                return
        connection.send_error(msg["id"], "not_found", f"Header {header_id} not found")

    else:
        connection.send_error(msg["id"], "invalid_action", f"Unknown action: {action}")


# ---------------------------------------------------------------------------
# MCP Marketplace — Repos
# ---------------------------------------------------------------------------


def _get_mcp_manager(hass: HomeAssistant, entry: ConfigEntry):
    """Get the McpManager for an entry."""
    entry_data = hass.data.get(DOMAIN, {}).get(entry.entry_id, {})
    return entry_data.get("mcp_manager")


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/mcp/repos/list",
        vol.Optional("entry_id"): str,
    }
)
@callback
def ws_mcp_repos_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """List configured MCP repos."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], [])
        return
    mgr = _get_mcp_manager(hass, entry)
    if not mgr:
        connection.send_result(msg["id"], [])
        return
    connection.send_result(msg["id"], mgr.list_repos())


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/mcp/repos/add",
        vol.Optional("entry_id"): str,
        vol.Required("url"): str,
    }
)
@websocket_api.async_response
async def ws_mcp_repos_add(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Add a repo URL."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    mgr = _get_mcp_manager(hass, entry)
    if not mgr:
        connection.send_error(msg["id"], "not_ready", "MCP manager not initialized")
        return
    try:
        repo = await mgr.add_repo(msg["url"])
        connection.send_result(msg["id"], repo)
    except Exception as err:
        connection.send_error(msg["id"], "add_failed", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/mcp/repos/remove",
        vol.Optional("entry_id"): str,
        vol.Required("repo_id"): str,
    }
)
@websocket_api.async_response
async def ws_mcp_repos_remove(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Remove a repo."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    mgr = _get_mcp_manager(hass, entry)
    if not mgr:
        connection.send_error(msg["id"], "not_ready", "MCP manager not initialized")
        return
    try:
        await mgr.remove_repo(msg["repo_id"])
        connection.send_result(msg["id"], {})
    except ValueError as err:
        connection.send_error(msg["id"], "not_found", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/mcp/repos/refresh",
        vol.Optional("entry_id"): str,
        vol.Required("repo_id"): str,
    }
)
@websocket_api.async_response
async def ws_mcp_repos_refresh(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Re-fetch a repo's manifest."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    mgr = _get_mcp_manager(hass, entry)
    if not mgr:
        connection.send_error(msg["id"], "not_ready", "MCP manager not initialized")
        return
    try:
        repo = await mgr.refresh_repo(msg["repo_id"])
        connection.send_result(msg["id"], repo)
    except ValueError as err:
        connection.send_error(msg["id"], "not_found", str(err))


# ---------------------------------------------------------------------------
# MCP Marketplace — Catalog
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/mcp/catalog",
        vol.Optional("entry_id"): str,
    }
)
@websocket_api.async_response
async def ws_mcp_catalog(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Get merged catalog from all repos."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], [])
        return
    mgr = _get_mcp_manager(hass, entry)
    if not mgr:
        connection.send_result(msg["id"], [])
        return
    catalog = await mgr.get_catalog()
    connection.send_result(msg["id"], catalog)


# ---------------------------------------------------------------------------
# MCP Marketplace — Servers
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/mcp/servers/list",
        vol.Optional("entry_id"): str,
    }
)
@callback
def ws_mcp_servers_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """List installed MCP servers with status."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], [])
        return
    mgr = _get_mcp_manager(hass, entry)
    if not mgr:
        connection.send_result(msg["id"], [])
        return
    connection.send_result(msg["id"], mgr.list_servers())


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/mcp/servers/create",
        vol.Optional("entry_id"): str,
        vol.Required("name"): str,
        vol.Optional("description", default=""): str,
        vol.Optional("repo_id", default=""): str,
        vol.Optional("catalog_id", default=""): str,
        vol.Optional("transport", default="stdio"): str,
        vol.Optional("enabled", default=True): bool,
        vol.Optional("command"): str,
        vol.Optional("args", default=[]): list,
        vol.Optional("env", default={}): dict,
        vol.Optional("url"): str,
        vol.Optional("headers", default={}): dict,
        vol.Optional("parameters", default={}): dict,
    }
)
@websocket_api.async_response
async def ws_mcp_servers_create(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Install a server (from catalog or manual)."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    mgr = _get_mcp_manager(hass, entry)
    if not mgr:
        connection.send_error(msg["id"], "not_ready", "MCP manager not initialized")
        return

    skip_keys = {"id", "type", "entry_id"}
    data = {k: v for k, v in msg.items() if k not in skip_keys}

    try:
        server = await mgr.create_server(data)
        connection.send_result(msg["id"], server)
    except Exception as err:
        _LOGGER.error("MCP server create failed: %s", err, exc_info=True)
        connection.send_error(msg["id"], "create_failed", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/mcp/servers/update",
        vol.Optional("entry_id"): str,
        vol.Required("server_id"): str,
        vol.Optional("name"): str,
        vol.Optional("description"): str,
        vol.Optional("enabled"): bool,
        vol.Optional("command"): str,
        vol.Optional("args"): list,
        vol.Optional("env"): dict,
        vol.Optional("url"): str,
        vol.Optional("headers"): dict,
        vol.Optional("parameters"): dict,
    }
)
@websocket_api.async_response
async def ws_mcp_servers_update(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Update server config."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    mgr = _get_mcp_manager(hass, entry)
    if not mgr:
        connection.send_error(msg["id"], "not_ready", "MCP manager not initialized")
        return

    server_id = msg["server_id"]
    skip_keys = {"id", "type", "entry_id", "server_id"}
    updates = {k: v for k, v in msg.items() if k not in skip_keys}

    try:
        server = await mgr.update_server(server_id, updates)
        connection.send_result(msg["id"], server)
    except ValueError as err:
        connection.send_error(msg["id"], "not_found", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/mcp/servers/delete",
        vol.Optional("entry_id"): str,
        vol.Required("server_id"): str,
    }
)
@websocket_api.async_response
async def ws_mcp_servers_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Remove a server."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    mgr = _get_mcp_manager(hass, entry)
    if not mgr:
        connection.send_error(msg["id"], "not_ready", "MCP manager not initialized")
        return

    try:
        await mgr.delete_server(msg["server_id"])
        connection.send_result(msg["id"], {})
    except ValueError as err:
        connection.send_error(msg["id"], "not_found", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/mcp/servers/reconnect",
        vol.Optional("entry_id"): str,
        vol.Required("server_id"): str,
    }
)
@websocket_api.async_response
async def ws_mcp_servers_reconnect(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Force reconnect a server."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return
    mgr = _get_mcp_manager(hass, entry)
    if not mgr:
        connection.send_error(msg["id"], "not_ready", "MCP manager not initialized")
        return

    try:
        server = await mgr.reconnect_server(msg["server_id"])
        connection.send_result(msg["id"], server)
    except ValueError as err:
        connection.send_error(msg["id"], "not_found", str(err))


# ---------------------------------------------------------------------------
# Chat Card API
# ---------------------------------------------------------------------------


def _get_chat_cards(hass: HomeAssistant) -> tuple[dict, Any]:
    """Return (cards_data dict, store) from hass.data."""
    data = hass.data.get(DOMAIN, {})
    cards_data = data.get("_chat_cards", {"cards": {}})
    store = data.get("_chat_cards_store")
    return cards_data, store


def _get_agent_profiles(hass: HomeAssistant) -> tuple[dict, Any]:
    """Return (profiles_data dict, store) from hass.data."""
    data = hass.data.get(DOMAIN, {})
    profiles_data = data.get("_agent_profiles", {"profiles": {}})
    store = data.get("_agent_profiles_store")
    return profiles_data, store


def _get_group_chat_cards(hass: HomeAssistant) -> tuple[dict, Any]:
    """Return (group_cards_data dict, store) from hass.data."""
    data = hass.data.get(DOMAIN, {})
    cards_data = data.get("_group_chat_cards", {"cards": {}})
    store = data.get("_group_chat_cards_store")
    return cards_data, store


def _build_profile_system_prompt(
    personality_enabled: bool, personality: dict, prompt_override: str
) -> str | None:
    """Build a system prompt from CCv3 personality + optional prompt override.

    Shared by ws_card_invoke and ws_group_invoke.
    """
    system_parts: list[str] = []

    if personality_enabled and personality:
        char_name = personality.get("name", "")
        sys_prompt = personality.get("system_prompt", "")
        desc = personality.get("description", "")
        persona = personality.get("personality", "")
        scenario = personality.get("scenario", "")
        examples = personality.get("mes_example", "")
        post_hist = personality.get("post_history_instructions", "")

        if sys_prompt:
            system_parts.append(sys_prompt.replace("{{char}}", char_name).replace("{{user}}", "User"))
        if desc:
            system_parts.append(f"Character: {desc}")
        if persona:
            system_parts.append(f"Personality: {persona}")
        if scenario:
            system_parts.append(f"Scenario: {scenario}")
        if examples:
            system_parts.append(f"Example dialogue:\n{examples}")
        if post_hist:
            system_parts.append(post_hist.replace("{{char}}", char_name).replace("{{user}}", "User"))

    if prompt_override:
        system_parts.append(f"Additional Instructions: {prompt_override}")

    return "\n\n".join(system_parts) if system_parts else None


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/card/config/get",
        vol.Optional("entry_id"): str,
        vol.Required("card_id"): str,
    }
)
@callback
def ws_card_config_get(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Get a card config by card_id."""
    cards_data, _ = _get_chat_cards(hass)
    card = cards_data.get("cards", {}).get(msg["card_id"])
    if card is None:
        connection.send_result(msg["id"], None)
        return
    connection.send_result(msg["id"], card)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/card/config/list",
        vol.Optional("entry_id"): str,
    }
)
@callback
def ws_card_config_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """List all card configs."""
    cards_data, _ = _get_chat_cards(hass)
    cards = list(cards_data.get("cards", {}).values())
    connection.send_result(msg["id"], cards)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/card/config/save",
        vol.Optional("entry_id"): str,
        vol.Required("card_id"): str,
        vol.Required("config"): dict,
    }
)
@websocket_api.async_response
async def ws_card_config_save(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Save or update a card config."""
    cards_data, store = _get_chat_cards(hass)
    if store is None:
        connection.send_error(msg["id"], "not_ready", "Chat cards store not initialized")
        return

    card_config = msg["config"]
    card_config["card_id"] = msg["card_id"]
    cards_data.setdefault("cards", {})[msg["card_id"]] = card_config
    await store.async_save(cards_data)
    connection.send_result(msg["id"], card_config)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/card/config/delete",
        vol.Optional("entry_id"): str,
        vol.Required("card_id"): str,
    }
)
@websocket_api.async_response
async def ws_card_config_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Delete a card config."""
    cards_data, store = _get_chat_cards(hass)
    if store is None:
        connection.send_error(msg["id"], "not_ready", "Chat cards store not initialized")
        return

    cards = cards_data.get("cards", {})
    removed = cards.pop(msg["card_id"], None)
    if removed is not None:
        await store.async_save(cards_data)
    connection.send_result(msg["id"], {"deleted": removed is not None})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/card/voices",
        vol.Optional("entry_id"): str,
    }
)
@websocket_api.async_response
async def ws_card_voices(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """List available TTS voices from configured TTS connections."""
    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_result(msg["id"], [])
        return

    from .connection_manager import resolve_agent_to_flat_config

    config = dict(entry.data) | dict(entry.options)
    tts_config = resolve_agent_to_flat_config(config, "tts_agent")

    voices: list[dict[str, str]] = []
    if tts_config:
        base_url = tts_config.get(CONF_LLM_BASE_URL, tts_config.get("base_url", "")).rstrip("/")
        api_key = tts_config.get(CONF_LLM_API_KEY, tts_config.get("api_key", ""))
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

        # Try multiple common voice-listing endpoints
        voice_urls = [
            f"{base_url}/voices",           # F5-TTS, AllTalk, etc.
            f"{base_url}/audio/voices",     # OpenAI-compatible
            f"{base_url}/v1/audio/voices",  # Some wrappers add v1 prefix
        ]

        import aiohttp

        try:
            async with aiohttp.ClientSession() as session:
                for url in voice_urls:
                    try:
                        async with session.get(
                            url,
                            headers=headers,
                            timeout=aiohttp.ClientTimeout(total=5),
                        ) as resp:
                            if resp.status == 200:
                                data = await resp.json()
                                for v in data.get("voices", data.get("data", [])):
                                    if isinstance(v, dict):
                                        voices.append({
                                            "id": v.get("voice_id", v.get("id", "")),
                                            "name": v.get("name", v.get("voice_id", v.get("id", ""))),
                                        })
                                    elif isinstance(v, str):
                                        voices.append({"id": v, "name": v})
                                if voices:
                                    break
                    except Exception:
                        continue
        except Exception:
            pass

    # If endpoint query still failed, include voice from TTS connection config
    if not voices and tts_config:
        configured_voice = tts_config.get("voice", "")
        if configured_voice:
            voices.append({"id": configured_voice, "name": configured_voice})

    connection.send_result(msg["id"], voices)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/card/tts/speak",
        vol.Optional("entry_id"): str,
        vol.Required("card_id"): str,
        vol.Required("segments"): [
            {
                vol.Required("text"): str,
                vol.Required("voice"): str,
            }
        ],
    }
)
@websocket_api.async_response
async def ws_card_tts_speak(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Generate TTS audio for multiple text segments with per-segment voices.

    Calls the TTS endpoint directly using the same config as tts.proxlab_tts.
    Returns base64 data-URL audio segments that the frontend plays via Audio().

    Designed for easy swap: to use a different TTS provider later, add a
    config-driven branch here (e.g. based on a card/entry setting).
    """
    import aiohttp
    import base64

    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return

    from .connection_manager import resolve_connections_to_flat_config
    from .const import (
        CONF_CONNECTIONS,
        CONF_TTS_BASE_URL,
        CONF_TTS_MODEL,
        CONF_TTS_SPEED,
        CONF_TTS_FORMAT,
        DEFAULT_TTS_MODEL,
        DEFAULT_TTS_SPEED,
        DEFAULT_TTS_FORMAT,
    )

    config = dict(entry.data) | dict(entry.options)
    if CONF_CONNECTIONS in config:
        config = resolve_connections_to_flat_config(config)

    tts_base_url = config.get(CONF_TTS_BASE_URL, "").rstrip("/")
    if not tts_base_url:
        connection.send_error(msg["id"], "no_tts", "No TTS base URL configured")
        return

    model = config.get(CONF_TTS_MODEL, DEFAULT_TTS_MODEL)
    speed = float(config.get(CONF_TTS_SPEED, DEFAULT_TTS_SPEED))
    resp_format = config.get(CONF_TTS_FORMAT, DEFAULT_TTS_FORMAT)
    speech_url = f"{tts_base_url}/audio/speech"

    audio_segments: list[dict[str, str]] = []

    try:
        async with aiohttp.ClientSession() as session:
            for seg in msg["segments"]:
                text = seg.get("text", "").strip()
                voice = seg.get("voice", "").strip()
                if not text or not voice:
                    continue

                payload = {
                    "model": model,
                    "input": text,
                    "voice": voice,
                    "speed": speed,
                    "response_format": resp_format,
                }

                try:
                    async with session.post(
                        speech_url,
                        json=payload,
                        timeout=aiohttp.ClientTimeout(total=30),
                    ) as resp:
                        if resp.status == 200:
                            audio_bytes = await resp.read()
                            b64 = base64.b64encode(audio_bytes).decode("ascii")
                            mime = f"audio/{resp_format}"
                            audio_segments.append(
                                {"url": f"data:{mime};base64,{b64}"}
                            )
                        else:
                            err_text = await resp.text()
                            _LOGGER.warning(
                                "TTS %d for voice=%s text=%s: %s",
                                resp.status, voice, text[:50], err_text[:200],
                            )
                except Exception as err:
                    _LOGGER.warning(
                        "TTS request failed for voice=%s text=%s: %s",
                        voice, text[:50], err,
                    )
    except Exception as err:
        _LOGGER.error("TTS session error: %s", err)
        connection.send_error(msg["id"], "tts_failed", str(err))
        return

    connection.send_result(msg["id"], {"audio_segments": audio_segments})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/card/stt/transcribe",
        vol.Optional("entry_id"): str,
        vol.Required("audio_data"): str,  # base64 audio (webm/ogg from browser)
    }
)
@websocket_api.async_response
async def ws_card_stt_transcribe(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Transcribe audio using the STT provider.

    Accepts base64-encoded audio (typically webm/opus from the browser's
    MediaRecorder), sends it to the configured STT backend endpoint, and
    returns transcribed text.

    Uses the ProxLab STT connection config directly.  To swap to a
    different STT provider later, add a config branch here.
    """
    import aiohttp
    import base64

    entry = _get_entry(hass, msg)
    if not entry:
        connection.send_error(msg["id"], "not_found", "No ProxLab config entry found")
        return

    from .connection_manager import resolve_connections_to_flat_config
    from .const import CONF_STT_BASE_URL, CONF_STT_MODEL, DEFAULT_STT_MODEL, CONF_CONNECTIONS

    config = dict(entry.data) | dict(entry.options)
    if CONF_CONNECTIONS in config:
        config = resolve_connections_to_flat_config(config)

    stt_base_url = config.get(CONF_STT_BASE_URL, "").rstrip("/")
    if not stt_base_url:
        connection.send_error(msg["id"], "no_stt", "No STT base URL configured")
        return

    stt_model = config.get(CONF_STT_MODEL, DEFAULT_STT_MODEL)

    try:
        audio_bytes = base64.b64decode(msg["audio_data"])
    except Exception:
        connection.send_error(msg["id"], "bad_audio", "Invalid base64 audio data")
        return

    if len(audio_bytes) == 0:
        connection.send_error(msg["id"], "empty_audio", "Empty audio data")
        return

    url = f"{stt_base_url}/audio/transcriptions"

    try:
        async with aiohttp.ClientSession() as session:
            form = aiohttp.FormData()
            form.add_field(
                "file",
                audio_bytes,
                filename="audio.webm",
                content_type="audio/webm",
            )
            form.add_field("model", stt_model)
            form.add_field("language", hass.config.language or "en")
            form.add_field("response_format", "json")

            async with session.post(
                url, data=form, timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    _LOGGER.error("STT API error %d: %s", resp.status, error_text)
                    connection.send_error(msg["id"], "stt_failed", error_text[:200])
                    return

                result = await resp.json()
                text = result.get("text", "").strip()
                connection.send_result(msg["id"], {"text": text})

    except Exception as err:
        _LOGGER.error("STT transcribe error: %s", err)
        connection.send_error(msg["id"], "stt_failed", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/card/avatar/upload",
        vol.Optional("entry_id"): str,
        vol.Required("card_id"): str,
        vol.Required("data"): str,  # base64 image data
        vol.Optional("filename", default="avatar.png"): str,
    }
)
@websocket_api.async_response
async def ws_card_avatar_upload(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Save base64 avatar image and return URL path."""
    import base64
    import pathlib

    avatar_dir = pathlib.Path(hass.config.path("www/proxlab/avatars"))
    avatar_dir.mkdir(parents=True, exist_ok=True)

    ext = pathlib.Path(msg["filename"]).suffix or ".png"
    filename = f"{msg['card_id']}{ext}"
    filepath = avatar_dir / filename

    try:
        image_data = base64.b64decode(msg["data"])
        await hass.async_add_executor_job(filepath.write_bytes, image_data)
        url = f"/local/proxlab/avatars/{filename}"
        connection.send_result(msg["id"], {"url": url})
    except Exception as err:
        connection.send_error(msg["id"], "upload_failed", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/card/invoke",
        vol.Optional("entry_id"): str,
        vol.Required("card_id"): str,
        vol.Required("message"): str,
        vol.Optional("conversation_id"): str,
    }
)
@websocket_api.async_response
async def ws_card_invoke(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Invoke agent with card-specific prompt composition.

    Prompt priority:
    1. personality_enabled + CCv3 fields → build system prompt from character card
    2. prompt_override → append as "Additional Instructions"
    3. Neither → fall back to agent default prompt
    """
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

    # Load card config
    cards_data, _ = _get_chat_cards(hass)
    card_config = cards_data.get("cards", {}).get(msg["card_id"], {})

    # If card is linked to a profile, load profile settings
    use_profile = card_config.get("use_profile", False)
    profile_id = card_config.get("profile_id", "")
    flat_config_override = None
    if use_profile and profile_id:
        profiles_data, _ = _get_agent_profiles(hass)
        profile = profiles_data.get("profiles", {}).get(profile_id, {})
        # Direct connection linking: if profile has connection_id, resolve it
        connection_id = profile.get("connection_id", "")
        if connection_id:
            from .connection_manager import resolve_connection_to_flat_config
            config = dict(entry.data) | dict(entry.options)
            flat_config_override = resolve_connection_to_flat_config(config, connection_id)
            agent_id = "conversation_agent"
        else:
            agent_id = profile.get("agent_id", "conversation_agent")
        prompt_override = profile.get("prompt_override", "")
        personality_enabled = profile.get("personality_enabled", False)
        personality = profile.get("personality", {})
    else:
        agent_id = card_config.get("agent_id", "conversation_agent")
        prompt_override = card_config.get("prompt_override", "")
        personality_enabled = card_config.get("personality_enabled", False)
        personality = card_config.get("personality", {})

    # Build system prompt from card config (shared helper)
    card_system_prompt = _build_profile_system_prompt(
        personality_enabled, personality, prompt_override
    )

    # Handle first_mes for new conversations
    first_mes = personality.get("first_mes", "") if personality_enabled else ""

    try:
        result = await agent.invoke_agent(
            agent_id=agent_id,
            message=msg["message"],
            conversation_id=msg.get("conversation_id", f"card_{msg['card_id']}"),
            include_history=True,
            system_prompt_override=card_system_prompt,
            config_override=flat_config_override,
        )
        # Attach first_mes if this was a new conversation
        result["first_mes"] = first_mes
        result["card_id"] = msg["card_id"]
        connection.send_result(msg["id"], result)
    except ValueError as err:
        connection.send_error(msg["id"], "invalid_agent", str(err))
    except Exception as err:
        _LOGGER.error("Card invoke failed: %s", err, exc_info=True)
        connection.send_error(msg["id"], "invoke_failed", str(err))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/card/invoke_stream",
        vol.Optional("entry_id"): str,
        vol.Required("card_id"): str,
        vol.Required("message"): str,
        vol.Optional("conversation_id"): str,
    }
)
@websocket_api.async_response
async def ws_card_invoke_stream(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Invoke agent with streaming — sends progressive text deltas as events."""
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

    # Load card config (same as ws_card_invoke)
    cards_data, _ = _get_chat_cards(hass)
    card_config = cards_data.get("cards", {}).get(msg["card_id"], {})

    use_profile = card_config.get("use_profile", False)
    profile_id = card_config.get("profile_id", "")
    flat_config_override = None
    if use_profile and profile_id:
        profiles_data, _ = _get_agent_profiles(hass)
        profile = profiles_data.get("profiles", {}).get(profile_id, {})
        connection_id = profile.get("connection_id", "")
        if connection_id:
            from .connection_manager import resolve_connection_to_flat_config
            config = dict(entry.data) | dict(entry.options)
            flat_config_override = resolve_connection_to_flat_config(config, connection_id)
            agent_id = "conversation_agent"
        else:
            agent_id = profile.get("agent_id", "conversation_agent")
        prompt_override = profile.get("prompt_override", "")
        personality_enabled = profile.get("personality_enabled", False)
        personality = profile.get("personality", {})
    else:
        agent_id = card_config.get("agent_id", "conversation_agent")
        prompt_override = card_config.get("prompt_override", "")
        personality_enabled = card_config.get("personality_enabled", False)
        personality = card_config.get("personality", {})

    card_system_prompt = _build_profile_system_prompt(
        personality_enabled, personality, prompt_override
    )

    # Confirm subscription
    connection.send_result(msg["id"])

    # Register unsubscribe handler
    connection.subscriptions[msg["id"]] = lambda: None

    try:
        async for chunk in agent.invoke_agent_streaming(
            agent_id=agent_id,
            message=msg["message"],
            conversation_id=msg.get("conversation_id", f"card_{msg['card_id']}"),
            include_history=True,
            system_prompt_override=card_system_prompt,
            config_override=flat_config_override,
        ):
            connection.send_message(
                websocket_api.event_message(msg["id"], chunk)
            )
    except Exception as err:
        _LOGGER.error("Card stream invoke failed: %s", err, exc_info=True)
        connection.send_message(
            websocket_api.event_message(msg["id"], {"type": "error", "error": str(err)})
        )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/group/invoke_stream",
        vol.Optional("entry_id"): str,
        vol.Required("card_id"): str,
        vol.Required("message"): str,
    }
)
@websocket_api.async_response
async def ws_group_invoke_stream(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Invoke multiple agents with streaming — sends progressive deltas per profile."""
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

    group_data, _ = _get_group_chat_cards(hass)
    group_config = group_data.get("cards", {}).get(msg["card_id"])
    if not group_config:
        connection.send_error(msg["id"], "not_found", "Group card config not found")
        return

    profile_ids = group_config.get("profile_ids", [])
    turn_mode = group_config.get("turn_mode", "round_robin")

    profiles_data, _ = _get_agent_profiles(hass)
    all_profiles = profiles_data.get("profiles", {})

    responding_profiles = []
    for pid in profile_ids:
        profile = all_profiles.get(pid)
        if profile:
            responding_profiles.append(profile)

    # Confirm subscription
    connection.send_result(msg["id"])
    connection.subscriptions[msg["id"]] = lambda: None

    if not responding_profiles:
        connection.send_message(
            websocket_api.event_message(msg["id"], {"type": "done"})
        )
        return

    # Filter by @mention if needed
    user_message = msg["message"]
    if turn_mode == "at_mention":
        mentioned = []
        lower_msg = user_message.lower()
        for p in responding_profiles:
            name = p.get("name", "")
            if name and f"@{name.lower()}" in lower_msg:
                mentioned.append(p)
        if not mentioned:
            connection.send_message(
                websocket_api.event_message(msg["id"], {"type": "done"})
            )
            return
        responding_profiles = mentioned

    async def _stream_profile(profile: dict, prior_responses: list[dict] | None = None) -> dict:
        """Stream a single profile and send events."""
        pid = profile["profile_id"]
        prompt_override = profile.get("prompt_override", "")
        personality_enabled = profile.get("personality_enabled", False)
        personality = profile.get("personality", {})

        connection_id = profile.get("connection_id", "")
        if connection_id:
            from .connection_manager import resolve_connection_to_flat_config
            config = dict(entry.data) | dict(entry.options)
            profile_config_override = resolve_connection_to_flat_config(config, connection_id)
            p_agent_id = "conversation_agent"
        else:
            profile_config_override = None
            p_agent_id = profile.get("agent_id", "conversation_agent")

        system_prompt = _build_profile_system_prompt(
            personality_enabled, personality, prompt_override
        )

        effective_message = user_message
        if prior_responses:
            context_lines = []
            for pr in prior_responses:
                if pr.get("success") and pr.get("response_text"):
                    context_lines.append(f"[{pr['profile_name']}]: {pr['response_text']}")
            if context_lines:
                effective_message = (
                    user_message
                    + "\n\n[The following agents have already responded to this message in the group chat:]\n"
                    + "\n".join(context_lines)
                )

        # Signal profile start
        connection.send_message(
            websocket_api.event_message(msg["id"], {
                "type": "profile_start",
                "profile_id": pid,
                "profile_name": profile.get("name", pid),
                "avatar": profile.get("avatar", ""),
            })
        )

        start = _time.monotonic()
        final_text = ""
        final_tokens = 0
        final_model = ""
        success = True

        try:
            async for chunk in agent.invoke_agent_streaming(
                agent_id=p_agent_id,
                message=effective_message,
                conversation_id=f"group_{msg['card_id']}_{pid}",
                include_history=True,
                system_prompt_override=system_prompt,
                config_override=profile_config_override,
            ):
                if chunk["type"] == "delta":
                    connection.send_message(
                        websocket_api.event_message(msg["id"], {
                            "type": "delta",
                            "text": chunk["text"],
                            "profile_id": pid,
                        })
                    )
                elif chunk["type"] == "done":
                    final_text = chunk.get("response_text", "")
                    final_tokens = chunk.get("tokens", 0)
                    final_model = chunk.get("model", "")
        except Exception as err:
            _LOGGER.error("Group stream invoke failed for profile %s: %s", pid, err)
            final_text = str(err)
            success = False

        duration_ms = int((_time.monotonic() - start) * 1000)

        connection.send_message(
            websocket_api.event_message(msg["id"], {
                "type": "profile_done",
                "profile_id": pid,
                "profile_name": profile.get("name", pid),
                "response_text": final_text,
                "tokens": final_tokens,
                "duration_ms": duration_ms,
                "model": final_model,
                "success": success,
            })
        )

        return {
            "profile_id": pid,
            "profile_name": profile.get("name", pid),
            "response_text": final_text,
            "success": success,
        }

    try:
        if turn_mode == "all_respond":
            await asyncio.gather(
                *[_stream_profile(p) for p in responding_profiles]
            )
        else:
            responses: list[dict] = []
            for p in responding_profiles:
                resp = await _stream_profile(p, prior_responses=responses)
                responses.append(resp)

        connection.send_message(
            websocket_api.event_message(msg["id"], {"type": "done"})
        )
    except Exception as err:
        _LOGGER.error("Group stream invoke failed: %s", err, exc_info=True)
        connection.send_message(
            websocket_api.event_message(msg["id"], {"type": "error", "error": str(err)})
        )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/card/agent_prompt",
        vol.Required("agent_id"): str,
        vol.Optional("entry_id"): str,
    }
)
@callback
def ws_card_agent_prompt(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Return an agent's default system prompt for the card editor."""
    agent_id = msg["agent_id"]

    # Check for a custom prompt set via the Agents tab first
    entry = _get_entry(hass, msg)
    if entry:
        config = dict(entry.data) | dict(entry.options)
        agents_cfg = config.get(CONF_AGENTS, {})
        custom_prompt = agents_cfg.get(agent_id, {}).get("system_prompt")
        if custom_prompt:
            connection.send_result(msg["id"], {"prompt": custom_prompt})
            return

    # Fall back to the built-in default prompt
    prompt = get_default_prompt(agent_id)
    connection.send_result(msg["id"], {"prompt": prompt})


# ---------------------------------------------------------------------------
# Agent Profiles API
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/profile/list",
        vol.Optional("entry_id"): str,
    }
)
@callback
def ws_profile_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """List all agent profiles."""
    profiles_data, _ = _get_agent_profiles(hass)
    profiles = list(profiles_data.get("profiles", {}).values())
    connection.send_result(msg["id"], profiles)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/profile/get",
        vol.Optional("entry_id"): str,
        vol.Required("profile_id"): str,
    }
)
@callback
def ws_profile_get(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Get a single agent profile by ID."""
    profiles_data, _ = _get_agent_profiles(hass)
    profile = profiles_data.get("profiles", {}).get(msg["profile_id"])
    connection.send_result(msg["id"], profile)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/profile/save",
        vol.Optional("entry_id"): str,
        vol.Required("profile_id"): str,
        vol.Required("profile"): dict,
    }
)
@websocket_api.async_response
async def ws_profile_save(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Save or update an agent profile."""
    profiles_data, store = _get_agent_profiles(hass)
    if store is None:
        connection.send_error(msg["id"], "not_ready", "Profiles store not initialized")
        return

    profile = msg["profile"]
    profile["profile_id"] = msg["profile_id"]
    profiles_data.setdefault("profiles", {})[msg["profile_id"]] = profile
    await store.async_save(profiles_data)
    connection.send_result(msg["id"], profile)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/profile/delete",
        vol.Optional("entry_id"): str,
        vol.Required("profile_id"): str,
    }
)
@websocket_api.async_response
async def ws_profile_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Delete an agent profile."""
    profiles_data, store = _get_agent_profiles(hass)
    if store is None:
        connection.send_error(msg["id"], "not_ready", "Profiles store not initialized")
        return

    profiles = profiles_data.get("profiles", {})
    removed = profiles.pop(msg["profile_id"], None)
    if removed is not None:
        await store.async_save(profiles_data)
    connection.send_result(msg["id"], {"deleted": removed is not None})


# ---------------------------------------------------------------------------
# Group Chat Cards API
# ---------------------------------------------------------------------------


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/group/config/list",
        vol.Optional("entry_id"): str,
    }
)
@callback
def ws_group_config_list(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """List all group chat card configs."""
    cards_data, _ = _get_group_chat_cards(hass)
    cards = list(cards_data.get("cards", {}).values())
    connection.send_result(msg["id"], cards)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/group/config/get",
        vol.Optional("entry_id"): str,
        vol.Required("card_id"): str,
    }
)
@callback
def ws_group_config_get(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Get a group chat card config by card_id."""
    cards_data, _ = _get_group_chat_cards(hass)
    card = cards_data.get("cards", {}).get(msg["card_id"])
    connection.send_result(msg["id"], card)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/group/config/save",
        vol.Optional("entry_id"): str,
        vol.Required("card_id"): str,
        vol.Required("config"): dict,
    }
)
@websocket_api.async_response
async def ws_group_config_save(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Save or update a group chat card config."""
    cards_data, store = _get_group_chat_cards(hass)
    if store is None:
        connection.send_error(msg["id"], "not_ready", "Group cards store not initialized")
        return

    card_config = msg["config"]
    card_config["card_id"] = msg["card_id"]
    cards_data.setdefault("cards", {})[msg["card_id"]] = card_config
    await store.async_save(cards_data)
    connection.send_result(msg["id"], card_config)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/group/config/delete",
        vol.Optional("entry_id"): str,
        vol.Required("card_id"): str,
    }
)
@websocket_api.async_response
async def ws_group_config_delete(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Delete a group chat card config."""
    cards_data, store = _get_group_chat_cards(hass)
    if store is None:
        connection.send_error(msg["id"], "not_ready", "Group cards store not initialized")
        return

    cards = cards_data.get("cards", {})
    removed = cards.pop(msg["card_id"], None)
    if removed is not None:
        await store.async_save(cards_data)
    connection.send_result(msg["id"], {"deleted": removed is not None})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "proxlab/group/invoke",
        vol.Optional("entry_id"): str,
        vol.Required("card_id"): str,
        vol.Required("message"): str,
    }
)
@websocket_api.async_response
async def ws_group_invoke(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
) -> None:
    """Invoke multiple agents in a group chat.

    Loads group card config to determine which profiles respond and how
    (round_robin, all_respond, at_mention).
    """
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

    # Load group card config
    group_data, _ = _get_group_chat_cards(hass)
    group_config = group_data.get("cards", {}).get(msg["card_id"])
    if not group_config:
        connection.send_error(msg["id"], "not_found", "Group card config not found")
        return

    profile_ids = group_config.get("profile_ids", [])
    turn_mode = group_config.get("turn_mode", "round_robin")

    # Load all profiles
    profiles_data, _ = _get_agent_profiles(hass)
    all_profiles = profiles_data.get("profiles", {})

    # Resolve which profiles participate
    responding_profiles = []
    for pid in profile_ids:
        profile = all_profiles.get(pid)
        if profile:
            responding_profiles.append(profile)

    if not responding_profiles:
        connection.send_result(msg["id"], {"success": True, "responses": [], "turn_mode": turn_mode})
        return

    # Filter by @mention if needed
    user_message = msg["message"]
    if turn_mode == "at_mention":
        mentioned = []
        lower_msg = user_message.lower()
        for p in responding_profiles:
            name = p.get("name", "")
            if name and f"@{name.lower()}" in lower_msg:
                mentioned.append(p)
        if not mentioned:
            # No @mentions found — no agents respond
            connection.send_result(
                msg["id"],
                {"success": True, "responses": [], "turn_mode": turn_mode},
            )
            return
        responding_profiles = mentioned

    async def _invoke_profile(profile: dict, prior_responses: list[dict] | None = None) -> dict:
        """Invoke a single profile's agent and return response dict.

        Args:
            profile: The agent profile dict.
            prior_responses: List of prior agent responses in this round
                (for round-robin context injection).
        """
        pid = profile["profile_id"]
        prompt_override = profile.get("prompt_override", "")
        personality_enabled = profile.get("personality_enabled", False)
        personality = profile.get("personality", {})

        # Direct connection linking: if profile has connection_id, resolve it
        connection_id = profile.get("connection_id", "")
        if connection_id:
            from .connection_manager import resolve_connection_to_flat_config
            config = dict(entry.data) | dict(entry.options)
            profile_config_override = resolve_connection_to_flat_config(config, connection_id)
            agent_id = "conversation_agent"
        else:
            profile_config_override = None
            agent_id = profile.get("agent_id", "conversation_agent")

        system_prompt = _build_profile_system_prompt(
            personality_enabled, personality, prompt_override
        )

        # Build the message: include prior agent responses for round-robin context
        effective_message = user_message
        if prior_responses:
            context_lines = []
            for pr in prior_responses:
                if pr.get("success") and pr.get("response_text"):
                    context_lines.append(
                        f"[{pr['profile_name']}]: {pr['response_text']}"
                    )
            if context_lines:
                effective_message = (
                    user_message
                    + "\n\n[The following agents have already responded to this message in the group chat:]\n"
                    + "\n".join(context_lines)
                )

        start = _time.monotonic()
        try:
            result = await agent.invoke_agent(
                agent_id=agent_id,
                message=effective_message,
                conversation_id=f"group_{msg['card_id']}_{pid}",
                include_history=True,
                system_prompt_override=system_prompt,
                config_override=profile_config_override,
            )
            duration_ms = int((_time.monotonic() - start) * 1000)
            return {
                "profile_id": pid,
                "profile_name": profile.get("name", pid),
                "avatar": profile.get("avatar", ""),
                "success": True,
                "response_text": result.get("response_text", ""),
                "agent_name": result.get("agent_name", agent_id),
                "tokens": result.get("tokens", {}).get("total", 0),
                "duration_ms": duration_ms,
                "model": result.get("model", ""),
            }
        except Exception as err:
            duration_ms = int((_time.monotonic() - start) * 1000)
            _LOGGER.error("Group invoke failed for profile %s: %s", pid, err)
            return {
                "profile_id": pid,
                "profile_name": profile.get("name", pid),
                "avatar": profile.get("avatar", ""),
                "success": False,
                "response_text": str(err),
                "agent_name": agent_id,
                "tokens": 0,
                "duration_ms": duration_ms,
                "model": "",
            }

    # Execute based on turn mode
    if turn_mode == "all_respond":
        # Parallel: all agents respond simultaneously (no cross-context)
        responses = await asyncio.gather(
            *[_invoke_profile(p) for p in responding_profiles]
        )
        responses = list(responses)
    else:
        # round_robin and at_mention: sequential, each agent sees prior responses
        responses = []
        for p in responding_profiles:
            resp = await _invoke_profile(p, prior_responses=responses)
            responses.append(resp)

    connection.send_result(
        msg["id"],
        {"success": True, "responses": responses, "turn_mode": turn_mode},
    )
