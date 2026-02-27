"""Connection manager for ProxLab v2 connections+roles architecture.

Provides helpers to query connections and roles, and a resolution shim
that populates flat CONF_* keys so all existing consumers work unchanged.
"""

from __future__ import annotations

import logging
from typing import Any

from .const import (
    AGENT_CONVERSATION,
    AGENT_DEFINITIONS,
    AGENT_EMBEDDINGS,
    AGENT_STT,
    AGENT_TTS,
    ALL_ROLES,
    CAP_CONVERSATION,
    CAP_EMBEDDINGS,
    CAP_EXTERNAL_LLM,
    CAP_STT,
    CAP_TTS,
    CONF_AGENTS,
    CONF_CONNECTIONS,
    CONF_EMBEDDING_KEEP_ALIVE,
    CONF_EXTERNAL_LLM_API_KEY,
    CONF_EXTERNAL_LLM_AUTO_INCLUDE_CONTEXT,
    CONF_EXTERNAL_LLM_BASE_URL,
    CONF_EXTERNAL_LLM_ENABLED,
    CONF_EXTERNAL_LLM_KEEP_ALIVE,
    CONF_EXTERNAL_LLM_MAX_TOKENS,
    CONF_EXTERNAL_LLM_MODEL,
    CONF_EXTERNAL_LLM_TEMPERATURE,
    CONF_EXTERNAL_LLM_TOOL_DESCRIPTION,
    CONF_LLM_API_KEY,
    CONF_LLM_BASE_URL,
    CONF_LLM_KEEP_ALIVE,
    CONF_LLM_MAX_TOKENS,
    CONF_LLM_MODEL,
    CONF_LLM_PROXY_HEADERS,
    CONF_LLM_TEMPERATURE,
    CONF_LLM_TOP_P,
    CONF_OPENAI_API_KEY,
    CONF_ROLES,
    CONF_STT_BASE_URL,
    CONF_STT_LANGUAGE,
    CONF_STT_MODEL,
    CONF_THINKING_ENABLED,
    CONF_TTS_BASE_URL,
    CONF_TTS_FORMAT,
    CONF_TTS_MODEL,
    CONF_TTS_SPEED,
    CONF_TTS_VOICE,
    CONF_VECTOR_DB_EMBEDDING_BASE_URL,
    CONF_VECTOR_DB_EMBEDDING_MODEL,
    CONF_VECTOR_DB_EMBEDDING_PROVIDER,
    DEFAULT_EXTERNAL_LLM_AUTO_INCLUDE_CONTEXT,
    DEFAULT_EXTERNAL_LLM_KEEP_ALIVE,
    DEFAULT_EXTERNAL_LLM_MAX_TOKENS,
    DEFAULT_EXTERNAL_LLM_TEMPERATURE,
    DEFAULT_EXTERNAL_LLM_TOOL_DESCRIPTION,
    DEFAULT_LLM_KEEP_ALIVE,
    DEFAULT_MAX_TOKENS,
    DEFAULT_STT_LANGUAGE,
    DEFAULT_STT_MODEL,
    DEFAULT_TEMPERATURE,
    DEFAULT_THINKING_ENABLED,
    DEFAULT_TOP_P,
    DEFAULT_TTS_FORMAT,
    DEFAULT_TTS_MODEL,
    DEFAULT_TTS_SPEED,
    DEFAULT_TTS_VOICE,
    DEFAULT_VECTOR_DB_EMBEDDING_PROVIDER,
    ROLE_CONVERSATION,
    ROLE_EMBEDDINGS,
    ROLE_EXTERNAL_LLM,
    ROLE_STT,
    ROLE_TO_CAPABILITY,
    ROLE_TTS,
)

_LOGGER = logging.getLogger(__name__)


def get_connection_for_role(
    config: dict[str, Any], role: str
) -> dict[str, Any] | None:
    """Get the connection dict assigned to a role, or None.

    Args:
        config: Merged config dict (entry.data | entry.options).
        role: One of ALL_ROLES (e.g. "conversation", "tts").

    Returns:
        Connection dict or None if role is unassigned or connection missing.
    """
    roles = config.get(CONF_ROLES, {})
    conn_id = roles.get(role)
    if not conn_id:
        return None
    connections = config.get(CONF_CONNECTIONS, {})
    return connections.get(conn_id)


def connections_for_capability(
    config: dict[str, Any], capability: str
) -> list[tuple[str, dict[str, Any]]]:
    """Return (id, connection) pairs whose capabilities include the given one.

    Args:
        config: Merged config dict.
        capability: A capability string (e.g. "conversation", "tts").

    Returns:
        List of (connection_id, connection_dict) tuples.
    """
    connections = config.get(CONF_CONNECTIONS, {})
    return [
        (cid, conn)
        for cid, conn in connections.items()
        if capability in conn.get("capabilities", [])
    ]


def has_role_assigned(config: dict[str, Any], role: str) -> bool:
    """Check if a role has a valid connection assigned.

    Args:
        config: Merged config dict.
        role: Role name.

    Returns:
        True if the role points to an existing connection.
    """
    return get_connection_for_role(config, role) is not None


def eligible_connections_for_role(
    config: dict[str, Any], role: str
) -> list[tuple[str, dict[str, Any]]]:
    """Return connections eligible for a given role (matching capability).

    Args:
        config: Merged config dict.
        role: Role name.

    Returns:
        List of (connection_id, connection_dict) tuples.
    """
    cap = ROLE_TO_CAPABILITY.get(role)
    if not cap:
        return []
    return connections_for_capability(config, cap)


def eligible_connections_for_agent(
    config: dict[str, Any], agent_id: str
) -> list[tuple[str, dict[str, Any]]]:
    """Return connections eligible for an agent using OR-of-AND capability matching.

    Args:
        config: Merged config dict.
        agent_id: Agent ID from AGENT_DEFINITIONS.

    Returns:
        List of (connection_id, connection_dict) tuples.
    """
    agent_def = AGENT_DEFINITIONS.get(agent_id)
    if not agent_def:
        return []
    connections = config.get(CONF_CONNECTIONS, {})
    eligible = []
    for cid, conn in connections.items():
        conn_caps = set(conn.get("capabilities", []))
        for cap_group in agent_def.required_capabilities:
            if set(cap_group).issubset(conn_caps):
                eligible.append((cid, conn))
                break
    return eligible


def _get_agent_connection(
    config: dict[str, Any], agent_id: str
) -> dict[str, Any] | None:
    """Get the primary connection dict for an agent, or None."""
    agents = config.get(CONF_AGENTS, {})
    agent_cfg = agents.get(agent_id, {})
    conn_id = agent_cfg.get("primary_connection")
    if not conn_id:
        return None
    connections = config.get(CONF_CONNECTIONS, {})
    return connections.get(conn_id)


def resolve_agent_to_flat_config(
    config: dict[str, Any], agent_id: str
) -> dict[str, Any] | None:
    """Resolve an agent's primary connection to a flat CONF_LLM_* config dict.

    This allows the orchestrator to build per-agent LLM configs without
    mutating the shared config dict.

    Args:
        config: The integration config dict (with connections/agents).
        agent_id: The agent whose connection to resolve.

    Returns:
        Dict with CONF_LLM_* keys, or None if the agent has no connection.
    """
    from .config_flow import normalize_url

    conn = _get_agent_connection(config, agent_id)
    if not conn:
        return None
    return {
        CONF_LLM_BASE_URL: normalize_url(conn.get("base_url", "")),
        CONF_LLM_API_KEY: conn.get("api_key", ""),
        CONF_LLM_MODEL: conn.get("model", ""),
        CONF_LLM_TEMPERATURE: conn.get("temperature", DEFAULT_TEMPERATURE),
        CONF_LLM_MAX_TOKENS: conn.get("max_tokens", DEFAULT_MAX_TOKENS),
        CONF_LLM_TOP_P: conn.get("top_p", DEFAULT_TOP_P),
        CONF_LLM_KEEP_ALIVE: conn.get("keep_alive", DEFAULT_LLM_KEEP_ALIVE),
        CONF_LLM_PROXY_HEADERS: conn.get("proxy_headers", {}),
        CONF_THINKING_ENABLED: conn.get("thinking_enabled", DEFAULT_THINKING_ENABLED),
        "connection_type": conn.get("connection_type", "local"),
    }


def resolve_connection_to_flat_config(
    config: dict[str, Any], connection_id: str
) -> dict[str, Any] | None:
    """Resolve a connection ID directly to a flat CONF_LLM_* config dict.

    Used by agent profiles that link directly to a connection rather than
    going through agent→connection resolution.

    Args:
        config: The integration config dict (with connections).
        connection_id: The connection ID to resolve.

    Returns:
        Dict with CONF_LLM_* keys, or None if connection not found.
    """
    from .config_flow import normalize_url

    connections = config.get(CONF_CONNECTIONS, {})
    conn = connections.get(connection_id)
    if not conn:
        return None
    return {
        CONF_LLM_BASE_URL: normalize_url(conn.get("base_url", "")),
        CONF_LLM_API_KEY: conn.get("api_key", ""),
        CONF_LLM_MODEL: conn.get("model", ""),
        CONF_LLM_TEMPERATURE: conn.get("temperature", DEFAULT_TEMPERATURE),
        CONF_LLM_MAX_TOKENS: conn.get("max_tokens", DEFAULT_MAX_TOKENS),
        CONF_LLM_TOP_P: conn.get("top_p", DEFAULT_TOP_P),
        CONF_LLM_KEEP_ALIVE: conn.get("keep_alive", DEFAULT_LLM_KEEP_ALIVE),
        CONF_LLM_PROXY_HEADERS: conn.get("proxy_headers", {}),
        CONF_THINKING_ENABLED: conn.get("thinking_enabled", DEFAULT_THINKING_ENABLED),
        "connection_type": conn.get("connection_type", "local"),
    }


def resolve_connections_to_flat_config(config: dict[str, Any]) -> dict[str, Any]:
    """Resolution shim: populate flat CONF_* keys from connections+roles.

    This allows all downstream consumers (agent/llm.py, tts.py, stt.py, etc.)
    to keep reading config[CONF_LLM_BASE_URL] etc. without any changes.

    Args:
        config: Mutable merged config dict. Modified in-place and returned.

    Returns:
        The same config dict with flat keys populated.
    """
    # Import URL normalizer to strip endpoint suffixes from stored URLs.
    # Connections created before the WS API may have /chat/completions baked in.
    from .config_flow import normalize_url

    # --- Conversation / primary LLM ---
    # Prefer agent-based config; fall back to role-based
    conv_conn = _get_agent_connection(config, AGENT_CONVERSATION) or get_connection_for_role(
        config, ROLE_CONVERSATION
    )
    if conv_conn:
        config[CONF_LLM_BASE_URL] = normalize_url(conv_conn.get("base_url", ""))
        config[CONF_LLM_API_KEY] = conv_conn.get("api_key", "")
        config[CONF_LLM_MODEL] = conv_conn.get("model", "")
        config[CONF_LLM_TEMPERATURE] = conv_conn.get("temperature", DEFAULT_TEMPERATURE)
        config[CONF_LLM_MAX_TOKENS] = conv_conn.get("max_tokens", DEFAULT_MAX_TOKENS)
        config[CONF_LLM_TOP_P] = conv_conn.get("top_p", DEFAULT_TOP_P)
        config[CONF_LLM_KEEP_ALIVE] = conv_conn.get("keep_alive", DEFAULT_LLM_KEEP_ALIVE)
        config[CONF_LLM_PROXY_HEADERS] = conv_conn.get("proxy_headers", {})
        config[CONF_THINKING_ENABLED] = conv_conn.get(
            "thinking_enabled", DEFAULT_THINKING_ENABLED
        )

    # --- TTS ---
    tts_conn = _get_agent_connection(config, AGENT_TTS) or get_connection_for_role(
        config, ROLE_TTS
    )
    if tts_conn:
        config[CONF_TTS_BASE_URL] = normalize_url(tts_conn.get("base_url", ""))
        config[CONF_TTS_MODEL] = tts_conn.get("model", DEFAULT_TTS_MODEL)
        config[CONF_TTS_VOICE] = tts_conn.get("voice", DEFAULT_TTS_VOICE)
        config[CONF_TTS_SPEED] = tts_conn.get("speed", DEFAULT_TTS_SPEED)
        config[CONF_TTS_FORMAT] = tts_conn.get("format", DEFAULT_TTS_FORMAT)

    # --- STT ---
    stt_conn = _get_agent_connection(config, AGENT_STT) or get_connection_for_role(
        config, ROLE_STT
    )
    if stt_conn:
        config[CONF_STT_BASE_URL] = normalize_url(stt_conn.get("base_url", ""))
        config[CONF_STT_MODEL] = stt_conn.get("model", DEFAULT_STT_MODEL)
        config[CONF_STT_LANGUAGE] = stt_conn.get("language", DEFAULT_STT_LANGUAGE)

    # --- External LLM ---
    ext_conn = get_connection_for_role(config, ROLE_EXTERNAL_LLM)
    if ext_conn:
        config[CONF_EXTERNAL_LLM_ENABLED] = True
        config[CONF_EXTERNAL_LLM_BASE_URL] = normalize_url(ext_conn.get("base_url", ""))
        config[CONF_EXTERNAL_LLM_API_KEY] = ext_conn.get("api_key", "")
        config[CONF_EXTERNAL_LLM_MODEL] = ext_conn.get("model", "")
        config[CONF_EXTERNAL_LLM_TEMPERATURE] = ext_conn.get(
            "temperature", DEFAULT_EXTERNAL_LLM_TEMPERATURE
        )
        config[CONF_EXTERNAL_LLM_MAX_TOKENS] = ext_conn.get(
            "max_tokens", DEFAULT_EXTERNAL_LLM_MAX_TOKENS
        )
        config[CONF_EXTERNAL_LLM_KEEP_ALIVE] = ext_conn.get(
            "keep_alive", DEFAULT_EXTERNAL_LLM_KEEP_ALIVE
        )
        config[CONF_EXTERNAL_LLM_TOOL_DESCRIPTION] = ext_conn.get(
            "tool_description", DEFAULT_EXTERNAL_LLM_TOOL_DESCRIPTION
        )
        config[CONF_EXTERNAL_LLM_AUTO_INCLUDE_CONTEXT] = ext_conn.get(
            "auto_include_context", DEFAULT_EXTERNAL_LLM_AUTO_INCLUDE_CONTEXT
        )
    else:
        # Only set to False if not already set (preserve options-level override)
        config.setdefault(CONF_EXTERNAL_LLM_ENABLED, False)

    # --- Embeddings ---
    emb_conn = _get_agent_connection(config, AGENT_EMBEDDINGS) or get_connection_for_role(
        config, ROLE_EMBEDDINGS
    )
    if emb_conn:
        config[CONF_VECTOR_DB_EMBEDDING_BASE_URL] = normalize_url(emb_conn.get("base_url", ""))
        config[CONF_VECTOR_DB_EMBEDDING_MODEL] = emb_conn.get("model", "")
        config[CONF_VECTOR_DB_EMBEDDING_PROVIDER] = emb_conn.get(
            "embedding_provider", DEFAULT_VECTOR_DB_EMBEDDING_PROVIDER
        )
        config[CONF_OPENAI_API_KEY] = emb_conn.get("api_key", "")
        config[CONF_EMBEDDING_KEEP_ALIVE] = emb_conn.get("keep_alive", "5m")

    _LOGGER.debug(
        "Resolution shim: conversation=%s, tts=%s, stt=%s, ext_llm=%s, embeddings=%s",
        bool(conv_conn),
        bool(tts_conn),
        bool(stt_conn),
        bool(ext_conn),
        bool(emb_conn),
    )

    return config
