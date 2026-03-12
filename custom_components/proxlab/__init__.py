"""ProxLab - Intelligent conversation agent for Home Assistant.

This custom component provides advanced conversational AI capabilities with
tool calling, context injection, and conversation history management.
"""

from __future__ import annotations

import asyncio
import logging
import pathlib
from typing import Any, cast
from uuid import uuid4

from homeassistant.components import conversation as ha_conversation
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse, callback
from homeassistant.helpers.typing import ConfigType

from homeassistant.components.frontend import async_register_built_in_panel, async_remove_panel
from homeassistant.components.http import StaticPathConfig

from .agent import ProxLabAgent
from .connection_health import ConnectionHealthCoordinator
from .connection_manager import resolve_connections_to_flat_config
from .websocket_api import async_register_websocket_commands
from .const import (
    ALL_ROLES,
    CAP_CONVERSATION,
    CAP_EMBEDDINGS,
    CAP_EXTERNAL_LLM,
    CAP_STT,
    CAP_TTS,
    CAP_TOOL_USE,
    CONFIG_VERSION,
    CONF_CONNECTIONS,
    CONF_CONTEXT_MODE,
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
    CONF_MEMORY_ENABLED,
    CONF_MILVUS_HOST,
    CONF_MILVUS_PORT,
    CONF_OPENAI_API_KEY,
    CONF_PROXLAB_URL,
    CONF_ROLES,
    CONF_SESSION_PERSISTENCE_ENABLED,
    CONF_SESSION_TIMEOUT,
    CONF_STT_BASE_URL,
    CONF_STT_LANGUAGE,
    CONF_STT_MODEL,
    CONF_THINKING_ENABLED,
    CONF_TOOLS_CUSTOM,
    CONF_TTS_BASE_URL,
    CONF_TTS_FORMAT,
    CONF_TTS_MODEL,
    CONF_TTS_SPEED,
    CONF_TTS_VOICE,
    CONF_VECTOR_DB_BACKEND,
    CONF_VECTOR_DB_EMBEDDING_BASE_URL,
    CONF_VECTOR_DB_EMBEDDING_MODEL,
    CONF_VECTOR_DB_EMBEDDING_PROVIDER,
    CONF_VECTOR_DB_HOST,
    CONF_VECTOR_DB_PORT,
    CONTEXT_MODE_VECTOR_DB,
    DEFAULT_EMBEDDING_KEEP_ALIVE,
    DEFAULT_EXTERNAL_LLM_AUTO_INCLUDE_CONTEXT,
    DEFAULT_EXTERNAL_LLM_KEEP_ALIVE,
    DEFAULT_EXTERNAL_LLM_MAX_TOKENS,
    DEFAULT_EXTERNAL_LLM_MODEL,
    DEFAULT_EXTERNAL_LLM_TEMPERATURE,
    DEFAULT_EXTERNAL_LLM_TOOL_DESCRIPTION,
    DEFAULT_LLM_KEEP_ALIVE,
    DEFAULT_LLM_MODEL,
    DEFAULT_MAX_TOKENS,
    DEFAULT_MEMORY_ENABLED,
    DEFAULT_MILVUS_HOST,
    DEFAULT_MILVUS_PORT,
    DEFAULT_ROLES,
    DEFAULT_SESSION_PERSISTENCE_ENABLED,
    DEFAULT_SESSION_TIMEOUT,
    DEFAULT_STT_LANGUAGE,
    DEFAULT_STT_MODEL,
    DEFAULT_TEMPERATURE,
    DEFAULT_THINKING_ENABLED,
    DEFAULT_TOP_P,
    DEFAULT_TTS_FORMAT,
    DEFAULT_TTS_MODEL,
    DEFAULT_TTS_SPEED,
    DEFAULT_TTS_VOICE,
    DEFAULT_VECTOR_DB_BACKEND,
    DEFAULT_VECTOR_DB_EMBEDDING_BASE_URL,
    DEFAULT_VECTOR_DB_EMBEDDING_MODEL,
    DEFAULT_VECTOR_DB_EMBEDDING_PROVIDER,
    DEFAULT_VECTOR_DB_HOST,
    DEFAULT_VECTOR_DB_PORT,
    DOMAIN,
    EMBEDDING_PROVIDER_OLLAMA,
    ROLE_CONVERSATION,
    ROLE_EMBEDDINGS,
    ROLE_EXTERNAL_LLM,
    ROLE_STT,
    ROLE_TOOL_USE,
    ROLE_TTS,
    VECTOR_DB_BACKEND_MILVUS,
)
from .conversation_session import ConversationSessionManager
from .helpers import check_ollama_health

_LOGGER = logging.getLogger(__name__)


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Migrate config entry to current version.

    v1→v2: Flat keys to connections+roles architecture.
    v2→v3: Remove obsolete memory extraction keys.

    Called automatically by HA when entry.version < ConfigFlow.VERSION.

    Args:
        hass: Home Assistant instance.
        entry: The config entry to migrate.

    Returns:
        True if migration succeeded, False otherwise.
    """
    if entry.version == 1:
        _LOGGER.info("Migrating ProxLab config entry from v1 to v2")

        old_data = dict(entry.data)
        old_options = dict(entry.options)
        merged = old_data | old_options

        connections: dict[str, dict[str, Any]] = {}
        roles: dict[str, str | None] = dict(DEFAULT_ROLES)

        def _new_id() -> str:
            return uuid4().hex[:8]

        # --- Migrate primary LLM ---
        llm_url = merged.get(CONF_LLM_BASE_URL, "")
        if llm_url:
            cid = _new_id()
            caps = [CAP_CONVERSATION, CAP_TOOL_USE]
            connections[cid] = {
                "name": f"LLM ({merged.get(CONF_LLM_MODEL, DEFAULT_LLM_MODEL)})",
                "base_url": llm_url,
                "api_key": merged.get(CONF_LLM_API_KEY, ""),
                "model": merged.get(CONF_LLM_MODEL, DEFAULT_LLM_MODEL),
                "capabilities": caps,
                "temperature": merged.get(CONF_LLM_TEMPERATURE, DEFAULT_TEMPERATURE),
                "max_tokens": merged.get(CONF_LLM_MAX_TOKENS, DEFAULT_MAX_TOKENS),
                "top_p": merged.get(CONF_LLM_TOP_P, DEFAULT_TOP_P),
                "keep_alive": merged.get(CONF_LLM_KEEP_ALIVE, DEFAULT_LLM_KEEP_ALIVE),
                "proxy_headers": merged.get(CONF_LLM_PROXY_HEADERS, {}),
                "thinking_enabled": merged.get(
                    CONF_THINKING_ENABLED, DEFAULT_THINKING_ENABLED
                ),
            }
            roles[ROLE_CONVERSATION] = cid
            roles[ROLE_TOOL_USE] = cid

        # --- Migrate TTS ---
        tts_url = merged.get(CONF_TTS_BASE_URL, "")
        if tts_url:
            cid = _new_id()
            connections[cid] = {
                "name": f"TTS ({merged.get(CONF_TTS_MODEL, DEFAULT_TTS_MODEL)})",
                "base_url": tts_url,
                "api_key": "",
                "model": merged.get(CONF_TTS_MODEL, DEFAULT_TTS_MODEL),
                "capabilities": [CAP_TTS],
                "voice": merged.get(CONF_TTS_VOICE, DEFAULT_TTS_VOICE),
                "speed": merged.get(CONF_TTS_SPEED, DEFAULT_TTS_SPEED),
                "format": merged.get(CONF_TTS_FORMAT, DEFAULT_TTS_FORMAT),
            }
            roles[ROLE_TTS] = cid

        # --- Migrate STT ---
        stt_url = merged.get(CONF_STT_BASE_URL, "")
        if stt_url:
            cid = _new_id()
            connections[cid] = {
                "name": f"STT ({merged.get(CONF_STT_MODEL, DEFAULT_STT_MODEL)})",
                "base_url": stt_url,
                "api_key": "",
                "model": merged.get(CONF_STT_MODEL, DEFAULT_STT_MODEL),
                "capabilities": [CAP_STT],
                "language": merged.get(CONF_STT_LANGUAGE, DEFAULT_STT_LANGUAGE),
            }
            roles[ROLE_STT] = cid

        # --- Migrate External LLM ---
        ext_enabled = merged.get(CONF_EXTERNAL_LLM_ENABLED, False)
        ext_url = merged.get(CONF_EXTERNAL_LLM_BASE_URL, "")
        if ext_enabled and ext_url:
            cid = _new_id()
            connections[cid] = {
                "name": f"External LLM ({merged.get(CONF_EXTERNAL_LLM_MODEL, DEFAULT_EXTERNAL_LLM_MODEL)})",
                "base_url": ext_url,
                "api_key": merged.get(CONF_EXTERNAL_LLM_API_KEY, ""),
                "model": merged.get(CONF_EXTERNAL_LLM_MODEL, DEFAULT_EXTERNAL_LLM_MODEL),
                "capabilities": [CAP_EXTERNAL_LLM],
                "temperature": merged.get(
                    CONF_EXTERNAL_LLM_TEMPERATURE, DEFAULT_EXTERNAL_LLM_TEMPERATURE
                ),
                "max_tokens": merged.get(
                    CONF_EXTERNAL_LLM_MAX_TOKENS, DEFAULT_EXTERNAL_LLM_MAX_TOKENS
                ),
                "keep_alive": merged.get(
                    CONF_EXTERNAL_LLM_KEEP_ALIVE, DEFAULT_EXTERNAL_LLM_KEEP_ALIVE
                ),
                "tool_description": merged.get(
                    CONF_EXTERNAL_LLM_TOOL_DESCRIPTION,
                    DEFAULT_EXTERNAL_LLM_TOOL_DESCRIPTION,
                ),
                "auto_include_context": merged.get(
                    CONF_EXTERNAL_LLM_AUTO_INCLUDE_CONTEXT,
                    DEFAULT_EXTERNAL_LLM_AUTO_INCLUDE_CONTEXT,
                ),
            }
            roles[ROLE_EXTERNAL_LLM] = cid

        # --- Migrate Embeddings ---
        emb_url = merged.get(CONF_VECTOR_DB_EMBEDDING_BASE_URL, "")
        if emb_url:
            cid = _new_id()
            connections[cid] = {
                "name": f"Embeddings ({merged.get(CONF_VECTOR_DB_EMBEDDING_MODEL, DEFAULT_VECTOR_DB_EMBEDDING_MODEL)})",
                "base_url": emb_url,
                "api_key": merged.get(CONF_OPENAI_API_KEY, ""),
                "model": merged.get(
                    CONF_VECTOR_DB_EMBEDDING_MODEL, DEFAULT_VECTOR_DB_EMBEDDING_MODEL
                ),
                "capabilities": [CAP_EMBEDDINGS],
                "embedding_provider": merged.get(
                    CONF_VECTOR_DB_EMBEDDING_PROVIDER,
                    DEFAULT_VECTOR_DB_EMBEDDING_PROVIDER,
                ),
                "keep_alive": merged.get(
                    CONF_EMBEDDING_KEEP_ALIVE, DEFAULT_EMBEDDING_KEEP_ALIVE
                ),
            }
            roles[ROLE_EMBEDDINGS] = cid

        # Build new entry.data: keep non-endpoint fields, add connections+roles
        # Keys that belong in the new data dict
        new_data: dict[str, Any] = {
            "name": old_data.get("name", "ProxLab"),
            CONF_CONNECTIONS: connections,
            CONF_ROLES: roles,
        }
        # Preserve proxlab_url if set
        if CONF_PROXLAB_URL in old_data:
            new_data[CONF_PROXLAB_URL] = old_data[CONF_PROXLAB_URL]

        # Strip endpoint keys from options (they now live in connections)
        _ENDPOINT_KEYS = {
            CONF_LLM_BASE_URL, CONF_LLM_API_KEY, CONF_LLM_MODEL,
            CONF_LLM_TEMPERATURE, CONF_LLM_MAX_TOKENS, CONF_LLM_TOP_P,
            CONF_LLM_KEEP_ALIVE, CONF_LLM_PROXY_HEADERS, CONF_THINKING_ENABLED,
            CONF_TTS_BASE_URL, CONF_TTS_MODEL, CONF_TTS_VOICE, CONF_TTS_SPEED,
            CONF_TTS_FORMAT, CONF_STT_BASE_URL, CONF_STT_MODEL, CONF_STT_LANGUAGE,
            CONF_EXTERNAL_LLM_ENABLED, CONF_EXTERNAL_LLM_BASE_URL,
            CONF_EXTERNAL_LLM_API_KEY, CONF_EXTERNAL_LLM_MODEL,
            CONF_EXTERNAL_LLM_TEMPERATURE, CONF_EXTERNAL_LLM_MAX_TOKENS,
            CONF_EXTERNAL_LLM_KEEP_ALIVE, CONF_EXTERNAL_LLM_TOOL_DESCRIPTION,
            CONF_EXTERNAL_LLM_AUTO_INCLUDE_CONTEXT,
            CONF_VECTOR_DB_EMBEDDING_BASE_URL, CONF_VECTOR_DB_EMBEDDING_MODEL,
            CONF_VECTOR_DB_EMBEDDING_PROVIDER, CONF_OPENAI_API_KEY,
            CONF_EMBEDDING_KEEP_ALIVE,
            # Source keys from v1 ProxLab routing
            "llm_source", "tts_source", "stt_source", "external_llm_source",
            "llm_backend", "azure_api_version",
        }
        new_options = {
            k: v for k, v in old_options.items() if k not in _ENDPOINT_KEYS
        }

        hass.config_entries.async_update_entry(
            entry, data=new_data, options=new_options, version=2
        )

        _LOGGER.info(
            "Migration v1→v2 complete: %d connections, roles=%s",
            len(connections),
            {r: ("set" if v else "empty") for r, v in roles.items()},
        )

    if entry.version == 2:
        _LOGGER.info("Migrating ProxLab config entry from v2 to v3")

        # Remove obsolete memory extraction keys
        _OBSOLETE_KEYS = {
            "memory_extraction_enabled",
            "memory_extraction_llm",
        }

        new_data = {k: v for k, v in dict(entry.data).items() if k not in _OBSOLETE_KEYS}
        new_options = {k: v for k, v in dict(entry.options).items() if k not in _OBSOLETE_KEYS}

        hass.config_entries.async_update_entry(
            entry, data=new_data, options=new_options, version=CONFIG_VERSION
        )

        _LOGGER.info("Migration v2→v3 complete: removed obsolete memory extraction keys")

    return True


def _get_platforms(config: dict[str, Any]) -> list[Platform]:
    """Determine which platforms to register based on config."""
    platforms: list[Platform] = []
    if config.get(CONF_TTS_BASE_URL):
        platforms.append(Platform.TTS)
    if config.get(CONF_STT_BASE_URL):
        platforms.append(Platform.STT)
    # Connection health monitoring entities
    if config.get(CONF_CONNECTIONS):
        platforms.extend([
            Platform.SENSOR,
            Platform.BINARY_SENSOR,
            Platform.TEXT,
            Platform.BUTTON,
        ])
    return platforms


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the ProxLab component from YAML configuration.

    Args:
        hass: Home Assistant instance
        config: Configuration dictionary

    Returns:
        True if setup was successful
    """
    # Store YAML config for later use (especially custom tools)
    hass.data.setdefault(DOMAIN, {})
    if DOMAIN in config:
        hass.data[DOMAIN]["yaml_config"] = config[DOMAIN]
        _LOGGER.info("Loaded ProxLab YAML configuration")

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up ProxLab from a config entry.

    Args:
        hass: Home Assistant instance
        entry: Config entry instance

    Returns:
        True if setup was successful
    """
    _LOGGER.info("Setting up ProxLab config entry: %s", entry.entry_id)

    # Merge config data
    config = dict(entry.data) | dict(entry.options)

    # v2 resolution shim: populate flat CONF_* keys from connections+roles
    if CONF_CONNECTIONS in config:
        config = resolve_connections_to_flat_config(config)

    # Also merge YAML config for custom tools (if present)
    # This allows users to define custom tools in configuration.yaml
    if "yaml_config" in hass.data.get(DOMAIN, {}):
        yaml_config = hass.data[DOMAIN]["yaml_config"]
        if CONF_TOOLS_CUSTOM in yaml_config:
            config[CONF_TOOLS_CUSTOM] = yaml_config[CONF_TOOLS_CUSTOM]
            _LOGGER.info(
                "Loaded %d custom tool(s) from YAML configuration",
                len(yaml_config[CONF_TOOLS_CUSTOM]),
            )

    # Initialize conversation session manager for persistent voice conversations
    session_persistence_enabled = config.get(
        CONF_SESSION_PERSISTENCE_ENABLED, DEFAULT_SESSION_PERSISTENCE_ENABLED
    )
    if session_persistence_enabled:
        # Get timeout from config (stored in minutes, convert to seconds)
        session_timeout_minutes = config.get(CONF_SESSION_TIMEOUT, DEFAULT_SESSION_TIMEOUT // 60)
        session_timeout = session_timeout_minutes * 60  # Convert to seconds
    else:
        # Disabled - use 0 which makes get_conversation_id always return None
        session_timeout = 0
    session_manager = ConversationSessionManager(hass, session_timeout)
    await session_manager.async_load()
    if session_persistence_enabled:
        _LOGGER.info(
            "Conversation Session Manager initialized with persistence enabled (timeout: %ds)",
            session_timeout,
        )
    else:
        _LOGGER.info("Conversation Session Manager initialized with persistence disabled")

    # Guard against empty LLM URL — user may configure later via options
    llm_base_url = config.get(CONF_LLM_BASE_URL, "")
    agent = None

    if llm_base_url:
        # Create ProxLab instance with session manager
        agent = ProxLabAgent(hass, config, session_manager, entry_id=entry.entry_id)
    else:
        _LOGGER.warning(
            "ProxLab: LLM base URL not configured — conversation agent disabled. "
            "Configure it in integration options (LLM Settings)."
        )

    # Store agent instance and session manager
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {
        "agent": agent,
        "session_manager": session_manager,
        "model_cache": {"data": [], "timestamp": 0},
    }

    # Set up agent registry (event-driven reactive layer)
    from .agent_registry import AgentRegistry

    registry = AgentRegistry(hass, entry.entry_id)
    await registry.async_load()
    hass.data[DOMAIN][entry.entry_id]["agent_registry"] = registry

    # Set up MCP Manager (MCP server marketplace)
    try:
        from .mcp_manager import McpManager

        mcp_manager = McpManager(hass, entry.entry_id)
        await mcp_manager.async_load()
        hass.data[DOMAIN][entry.entry_id]["mcp_manager"] = mcp_manager
    except ImportError:
        _LOGGER.debug("MCP Manager not available (mcp_manager.py not found)")
    except Exception as err:
        _LOGGER.warning("Failed to set up MCP Manager: %s", err)

    # Set up connection health coordinator if connections exist
    if entry.data.get(CONF_CONNECTIONS):
        coordinator = ConnectionHealthCoordinator(hass, entry)
        await coordinator.async_config_entry_first_refresh()
        hass.data[DOMAIN][entry.entry_id]["coordinator"] = coordinator
        _LOGGER.info(
            "Connection health coordinator started for %d connection(s)",
            len(entry.data[CONF_CONNECTIONS]),
        )

    # Perform health checks if using vector DB mode
    context_mode = config.get(CONF_CONTEXT_MODE)
    if context_mode == CONTEXT_MODE_VECTOR_DB:
        # Get configuration values
        embedding_provider = config.get(CONF_VECTOR_DB_EMBEDDING_PROVIDER)
        embedding_base_url = config.get(
            CONF_VECTOR_DB_EMBEDDING_BASE_URL, DEFAULT_VECTOR_DB_EMBEDDING_BASE_URL
        )

        # Check vector DB backend health (only ChromaDB has a dedicated health check)
        vector_backend = config.get(CONF_VECTOR_DB_BACKEND, DEFAULT_VECTOR_DB_BACKEND)
        if vector_backend == VECTOR_DB_BACKEND_MILVUS:
            milvus_host = config.get(CONF_MILVUS_HOST, DEFAULT_MILVUS_HOST)
            milvus_port = config.get(CONF_MILVUS_PORT, DEFAULT_MILVUS_PORT)
            _LOGGER.info(
                "Vector DB backend: Milvus at %s:%s (health checked during setup)",
                milvus_host, milvus_port,
            )
        else:
            chromadb_host = config.get(CONF_VECTOR_DB_HOST, DEFAULT_VECTOR_DB_HOST)
            chromadb_port = config.get(CONF_VECTOR_DB_PORT, DEFAULT_VECTOR_DB_PORT)
            from .helpers import check_chromadb_health  # noqa: F811
            chromadb_healthy, chromadb_msg = await check_chromadb_health(chromadb_host, chromadb_port)
            if not chromadb_healthy:
                _LOGGER.warning(
                    "ChromaDB health check failed at %s:%s - %s. "
                    "Vector DB features may not work until ChromaDB is available.",
                    chromadb_host,
                    chromadb_port,
                    chromadb_msg,
                )
            else:
                _LOGGER.info("ChromaDB health check passed: %s", chromadb_msg)

        # Check Ollama health if using Ollama embeddings
        if embedding_provider == EMBEDDING_PROVIDER_OLLAMA:
            ollama_healthy, ollama_msg = await check_ollama_health(embedding_base_url)
            if not ollama_healthy:
                _LOGGER.warning(
                    "Ollama health check failed at %s - %s. "
                    "Embedding generation may not work until Ollama is available.",
                    embedding_base_url,
                    ollama_msg,
                )
            else:
                _LOGGER.info("Ollama health check passed: %s", ollama_msg)

    # Register as a conversation agent (only if agent was created)
    if agent:
        ha_conversation.async_set_agent(hass, entry, agent)
        agent.conversation_manager.setup_scheduled_cleanup()

    # Register services (before vector DB so Milvus can't block registration)
    await async_setup_services(hass, entry.entry_id)

    # Forward TTS/STT platforms if configured
    platforms = _get_platforms(config)
    if platforms:
        await hass.config_entries.async_forward_entry_setups(entry, platforms)
        _LOGGER.info("Forwarded platforms: %s", [p.value for p in platforms])

    # --- WebSocket API + Panel Registration (once per hass) ---
    if not hass.data[DOMAIN].get("_ws_registered"):
        try:
            async_register_websocket_commands(hass)
            hass.data[DOMAIN]["_ws_registered"] = True
            _LOGGER.warning("ProxLab: Registered WebSocket commands")
        except Exception as err:
            _LOGGER.error("ProxLab: Failed to register WebSocket commands: %s", err)

    if not hass.data[DOMAIN].get("_panel_registered"):
        try:
            panel_dir = pathlib.Path(__file__).parent / "panel"
            panel_url = "/proxlab_panel"
            _LOGGER.warning("ProxLab: Registering panel from %s", panel_dir)

            await hass.http.async_register_static_paths(
                [StaticPathConfig(panel_url, str(panel_dir), cache_headers=False)]
            )
            _LOGGER.warning("ProxLab: Static paths registered at %s", panel_url)

            # Cache-bust: hash the JS bundle filename so the iframe URL
            # changes whenever the frontend is rebuilt.
            asset_dir = panel_dir / "assets"
            cache_bust = ""
            if asset_dir.is_dir():
                js_files = sorted(asset_dir.glob("index-*.js"))
                if js_files:
                    # Use the hash portion of the filename (e.g. "AlUjtQCM")
                    cache_bust = js_files[0].stem.split("-", 1)[-1]

            async_register_built_in_panel(
                hass,
                component_name="iframe",
                sidebar_title="ProxLab",
                sidebar_icon="mdi:robot-happy",
                frontend_url_path="proxlab",
                config={"url": f"{panel_url}/index.html?entry_id={entry.entry_id}&v={cache_bust}"},
                require_admin=False,
            )
            hass.data[DOMAIN]["_panel_registered"] = True
            _LOGGER.warning("ProxLab: Sidebar panel registered successfully")

            # Register chat card JS static path + Lovelace resource
            card_dir = pathlib.Path(__file__).parent / "card"
            card_url = "/proxlab_panel/card"
            card_js_file = card_dir / "proxlab-chat-card.js"
            # Cache-bust: use file content hash (mtime unreliable across git pulls)
            card_version = ""
            if card_js_file.is_file():
                import hashlib
                content = card_js_file.read_bytes()
                card_version = hashlib.md5(content).hexdigest()[:8]
            card_js_url = f"{card_url}/proxlab-chat-card.js"
            card_js_url_versioned = f"{card_js_url}?v={card_version}" if card_version else card_js_url
            if card_dir.is_dir():
                await hass.http.async_register_static_paths(
                    [StaticPathConfig(card_url, str(card_dir), cache_headers=False)]
                )
                # Register as Lovelace resource (persists in .storage/lovelace_resources)
                # This is the standard way to load custom card JS (same as HACS)
                try:
                    from homeassistant.components.lovelace.const import LOVELACE_DATA
                    lovelace_data = hass.data[LOVELACE_DATA]
                    resource_collection = lovelace_data.resources
                    items = resource_collection.async_items()
                    existing = [r for r in items if r["url"].split("?")[0] == card_js_url]
                    if not existing:
                        await resource_collection.async_create_item(
                            {"res_type": "module", "url": card_js_url_versioned}
                        )
                        _LOGGER.warning("ProxLab: Chat card registered as Lovelace resource")
                    elif existing[0]["url"] != card_js_url_versioned:
                        # Update version param to bust browser cache
                        await resource_collection.async_update_item(
                            existing[0]["id"],
                            {"url": card_js_url_versioned},
                        )
                        _LOGGER.debug("ProxLab: Chat card Lovelace resource version updated")
                    else:
                        _LOGGER.debug("ProxLab: Chat card Lovelace resource already exists")
                except Exception as res_err:
                    _LOGGER.warning("ProxLab: Could not auto-register Lovelace resource: %s", res_err)
                    _LOGGER.warning("ProxLab: Manually add resource: %s (type: module)", card_js_url_versioned)
        except Exception as err:
            _LOGGER.error("ProxLab: PANEL REGISTRATION FAILED: %s", err, exc_info=True)

    # --- Persistent debug trace collector (once per hass) ---
    if not hass.data[DOMAIN].get("_trace_listener"):
        from homeassistant.helpers.storage import Store
        from .const import (
            API_USAGE_STORAGE_KEY,
            API_USAGE_STORAGE_VERSION,
            EVENT_CONVERSATION_FINISHED,
            ISSUES_STORAGE_KEY,
            ISSUES_STORAGE_VERSION,
        )
        from .helpers import estimate_claude_cost

        # -- Persistent trace storage --
        trace_store = Store(hass, 1, f"{DOMAIN}.debug_traces")
        trace_data = await trace_store.async_load() or {
            "traces": [],
            "max_entries": 200,
        }
        hass.data[DOMAIN]["_debug_traces"] = trace_data["traces"]
        hass.data[DOMAIN]["_debug_trace_store"] = trace_store
        hass.data[DOMAIN]["_debug_trace_max"] = trace_data.get("max_entries", 200)
        _trace_save_pending = False

        async def _save_traces():
            nonlocal _trace_save_pending
            if _trace_save_pending:
                return
            _trace_save_pending = True
            await trace_store.async_save({
                "traces": hass.data[DOMAIN]["_debug_traces"],
                "max_entries": hass.data[DOMAIN].get("_debug_trace_max", 200),
            })
            _trace_save_pending = False

        hass.data[DOMAIN]["_debug_trace_save"] = _save_traces

        # -- Persistent API usage storage --
        usage_store = Store(hass, API_USAGE_STORAGE_VERSION, API_USAGE_STORAGE_KEY)
        usage_data = await usage_store.async_load() or {
            "models": {},
            "agents": {},
            "total": {"input_tokens": 0, "output_tokens": 0, "messages": 0, "cost_usd": 0.0},
            "last_updated": 0.0,
        }
        hass.data[DOMAIN]["_api_usage"] = usage_data
        hass.data[DOMAIN]["_api_usage_store"] = usage_store
        _usage_save_pending = False

        async def _save_usage():
            nonlocal _usage_save_pending
            if _usage_save_pending:
                return
            _usage_save_pending = True
            await usage_store.async_save(usage_data)
            _usage_save_pending = False

        # -- Persistent issues tracker storage --
        issues_store = Store(hass, ISSUES_STORAGE_VERSION, ISSUES_STORAGE_KEY)
        issues_data = await issues_store.async_load() or {"items": []}
        hass.data[DOMAIN]["_issues"] = issues_data
        hass.data[DOMAIN]["_issues_store"] = issues_store

        # -- Persistent roadmap storage --
        from .const import ROADMAP_STORAGE_KEY, ROADMAP_STORAGE_VERSION
        roadmap_store = Store(hass, ROADMAP_STORAGE_VERSION, ROADMAP_STORAGE_KEY)
        roadmap_data = await roadmap_store.async_load() or {"headers": []}
        hass.data[DOMAIN]["_roadmap"] = roadmap_data
        hass.data[DOMAIN]["_roadmap_store"] = roadmap_store

        # -- Persistent chat cards storage --
        from .const import CHAT_CARDS_STORAGE_KEY, CHAT_CARDS_STORAGE_VERSION
        chat_cards_store = Store(hass, CHAT_CARDS_STORAGE_VERSION, CHAT_CARDS_STORAGE_KEY)
        chat_cards_data = await chat_cards_store.async_load() or {"cards": {}}
        hass.data[DOMAIN]["_chat_cards"] = chat_cards_data
        hass.data[DOMAIN]["_chat_cards_store"] = chat_cards_store

        # -- Persistent agent profiles storage --
        from .const import AGENT_PROFILES_STORAGE_KEY, AGENT_PROFILES_STORAGE_VERSION
        profiles_store = Store(hass, AGENT_PROFILES_STORAGE_VERSION, AGENT_PROFILES_STORAGE_KEY)
        profiles_data = await profiles_store.async_load() or {"profiles": {}}
        hass.data[DOMAIN]["_agent_profiles"] = profiles_data
        hass.data[DOMAIN]["_agent_profiles_store"] = profiles_store

        # -- Persistent group chat cards storage --
        from .const import GROUP_CHAT_CARDS_STORAGE_KEY, GROUP_CHAT_CARDS_STORAGE_VERSION
        group_store = Store(hass, GROUP_CHAT_CARDS_STORAGE_VERSION, GROUP_CHAT_CARDS_STORAGE_KEY)
        group_data = await group_store.async_load() or {"cards": {}}
        hass.data[DOMAIN]["_group_chat_cards"] = group_data
        hass.data[DOMAIN]["_group_chat_cards_store"] = group_store

        @callback
        def _on_conversation_finished(event):
            """Capture conversation trace and accumulate API usage."""
            import time as _time

            trace_entry = dict(event.data)
            trace_entry["timestamp"] = _time.time()

            # Calculate total cost across all steps for this trace
            total_cost = 0.0
            steps = trace_entry.get("steps", [])
            for step in steps:
                cost = step.get("cost_estimate")
                if cost is not None:
                    total_cost += cost
            if total_cost > 0:
                trace_entry["total_cost"] = round(total_cost, 6)

            traces_list = hass.data[DOMAIN]["_debug_traces"]
            traces_list.append(trace_entry)

            # Enforce max entries (-1 = unlimited)
            max_entries = hass.data[DOMAIN].get("_debug_trace_max", 200)
            if max_entries >= 0 and len(traces_list) > max_entries:
                del traces_list[: len(traces_list) - max_entries]

            # Schedule debounced save
            hass.async_create_task(_save_traces())

            # --- Accumulate API usage ---
            for step in steps:
                conn_type = step.get("connection_type", "local")
                if conn_type != "claude_api":
                    continue
                model = step.get("model", "unknown")
                agent_id = step.get("agent_id", "unknown")
                tokens = step.get("tokens", {})
                in_tok = tokens.get("prompt", 0)
                out_tok = tokens.get("completion", 0)
                cost = step.get("cost_estimate", 0.0) or 0.0

                # Per-model
                if model not in usage_data["models"]:
                    usage_data["models"][model] = {
                        "input_tokens": 0, "output_tokens": 0,
                        "messages": 0, "cost_usd": 0.0,
                    }
                m = usage_data["models"][model]
                m["input_tokens"] += in_tok
                m["output_tokens"] += out_tok
                m["messages"] += 1
                m["cost_usd"] = round(m["cost_usd"] + cost, 6)

                # Per-agent
                if agent_id not in usage_data["agents"]:
                    usage_data["agents"][agent_id] = {
                        "model": model, "input_tokens": 0,
                        "output_tokens": 0, "messages": 0, "cost_usd": 0.0,
                    }
                a = usage_data["agents"][agent_id]
                a["model"] = model
                a["input_tokens"] += in_tok
                a["output_tokens"] += out_tok
                a["messages"] += 1
                a["cost_usd"] = round(a["cost_usd"] + cost, 6)

                # Total
                t = usage_data["total"]
                t["input_tokens"] += in_tok
                t["output_tokens"] += out_tok
                t["messages"] += 1
                t["cost_usd"] = round(t["cost_usd"] + cost, 6)

            usage_data["last_updated"] = _time.time()
            hass.async_create_task(_save_usage())

        unsub = hass.bus.async_listen(EVENT_CONVERSATION_FINISHED, _on_conversation_finished)
        hass.data[DOMAIN]["_trace_listener"] = unsub

    # --- Vector DB + Memory Manager (background, non-blocking) ---
    # Moved after service/WS/panel registration so Milvus/ChromaDB can't block them.

    async def _setup_vector_and_memory() -> None:
        """Set up vector DB backend and memory manager in background."""
        vector_manager = None
        _vector_backend = config.get(
            CONF_VECTOR_DB_BACKEND, DEFAULT_VECTOR_DB_BACKEND
        )
        _LOGGER.info(
            "Background vector/memory setup: vector_backend=%s, context_mode=%s",
            _vector_backend,
            context_mode,
        )

        # Always init MilvusVectorDB when Milvus is the configured backend,
        # regardless of context_mode — entity vectorization needs it even
        # when the newer context provider system handles RAG context.
        if _vector_backend == VECTOR_DB_BACKEND_MILVUS:
            try:
                from .vector_db_milvus import MilvusVectorDB

                vector_manager = MilvusVectorDB(hass, config)
                _LOGGER.info("Running MilvusVectorDB.async_setup()...")
                await asyncio.wait_for(
                    vector_manager.async_setup(), timeout=60.0
                )
                hass.data[DOMAIN][entry.entry_id][
                    "vector_manager"
                ] = vector_manager
                _LOGGER.info("Milvus Vector DB backend enabled for this entry")

                # Set up entity auto-scan timer if configured
                try:
                    from .websocket_api import _rebuild_entity_scan_timer
                    _rebuild_entity_scan_timer(hass, entry)
                except Exception as timer_err:
                    _LOGGER.warning(
                        "Failed to set up entity scan timer: %s", timer_err
                    )
            except asyncio.TimeoutError:
                _LOGGER.warning(
                    "Milvus Vector DB setup timed out — "
                    "continuing without Milvus"
                )
            except Exception as err:
                _LOGGER.error("Failed to set up Milvus backend: %s", err)
        elif context_mode == CONTEXT_MODE_VECTOR_DB:
            # ChromaDB only when context_mode explicitly requires it
            try:
                from .vector_db_manager import VectorDBManager

                vector_manager = VectorDBManager(hass, config)
                await asyncio.wait_for(
                    vector_manager.async_setup(), timeout=15.0
                )
                hass.data[DOMAIN][entry.entry_id][
                    "vector_manager"
                ] = vector_manager
                _LOGGER.info("ChromaDB Vector DB backend enabled for this entry")
            except asyncio.TimeoutError:
                _LOGGER.warning(
                    "ChromaDB Vector DB setup timed out — "
                    "continuing without ChromaDB"
                )
            except Exception as err:
                _LOGGER.error("Failed to set up ChromaDB backend: %s", err)

        # Set up memory manager if enabled
        memory_enabled = config.get(CONF_MEMORY_ENABLED, DEFAULT_MEMORY_ENABLED)
        if memory_enabled:
            try:
                from .memory_manager import MemoryManager

                memory_manager = MemoryManager(
                    hass=hass,
                    vector_db_manager=vector_manager,
                    config=config,
                )
                await memory_manager.async_initialize()
                hass.data[DOMAIN][entry.entry_id][
                    "memory_manager"
                ] = memory_manager
                _LOGGER.info("Memory Manager enabled for this entry")
            except Exception as err:
                _LOGGER.error("Failed to set up Memory Manager: %s", err)

    hass.async_create_task(_setup_vector_and_memory())

    # NOTE: We intentionally do NOT register an update listener here.
    # Config entry data is modified in-place by async_update_entry(), so the
    # health coordinator and entities already see the latest data without a
    # full integration reload.  A full reload (unload + setup of 40+ entities,
    # services, coordinator, vector DB, etc.) is extremely expensive and causes
    # HA to become sluggish after every connection save.  New connections will
    # be picked up by the health coordinator on its next cycle; entity creation
    # for new connections happens on next HA restart or manual integration reload.

    _LOGGER.info("ProxLab setup complete")
    return True


async def async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload the config entry when it's updated.

    Args:
        hass: Home Assistant instance
        entry: Config entry that was updated
    """
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry.

    Args:
        hass: Home Assistant instance
        entry: Config entry instance

    Returns:
        True if unload was successful
    """
    _LOGGER.info("Unloading ProxLab config entry: %s", entry.entry_id)

    # Unload TTS/STT platforms
    config = dict(entry.data) | dict(entry.options)
    if CONF_CONNECTIONS in config:
        config = resolve_connections_to_flat_config(config)
    platforms = _get_platforms(config)
    if platforms:
        await hass.config_entries.async_unload_platforms(entry, platforms)

    # Unregister conversation agent
    ha_conversation.async_unset_agent(hass, entry)

    # Clean up agent, memory manager, and vector DB manager
    if entry.entry_id in hass.data[DOMAIN]:
        entry_data = hass.data[DOMAIN][entry.entry_id]

        # Shut down MCP manager if it exists
        if "mcp_manager" in entry_data:
            try:
                await entry_data["mcp_manager"].async_shutdown()
            except Exception as err:
                _LOGGER.warning("Error shutting down MCP manager: %s", err)

        # Shut down agent registry if it exists
        if "agent_registry" in entry_data:
            await entry_data["agent_registry"].async_shutdown()

        # Shut down health coordinator if it exists
        if "coordinator" in entry_data:
            await entry_data["coordinator"].async_shutdown()

        # Cancel entity scan timer if it exists
        unsub = entry_data.pop("_entity_scan_unsub", None)
        if unsub is not None:
            unsub()

        # Shut down memory manager if it exists
        if "memory_manager" in entry_data:
            await entry_data["memory_manager"].async_shutdown()

        # Shut down vector DB manager if it exists
        if "vector_manager" in entry_data:
            await entry_data["vector_manager"].async_shutdown()

        # Clean up agent (may be None if LLM URL was not configured)
        agent = entry_data.get("agent")

        if agent:
            agent.conversation_manager.shutdown_scheduled_cleanup()
            await agent.close()

        del hass.data[DOMAIN][entry.entry_id]

    # Remove services if this was the last entry
    # (but keep panel + WS commands registered — they survive reloads
    # and will be cleaned up by HA if the integration is fully removed)
    remaining = [k for k in hass.data.get(DOMAIN, {}) if not k.startswith("_")]
    if not remaining:
        await async_remove_services(hass)

    return True


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Clean up when the integration is permanently removed."""
    # Remove sidebar panel
    if hass.data.get(DOMAIN, {}).get("_panel_registered"):
        async_remove_panel(hass, "proxlab")
        hass.data[DOMAIN]["_panel_registered"] = False
        _LOGGER.info("Removed ProxLab sidebar panel")

    # Clean up domain data
    if DOMAIN in hass.data and not any(
        k for k in hass.data[DOMAIN] if not k.startswith("_")
    ):
        hass.data.pop(DOMAIN, None)


async def async_setup_services(
    hass: HomeAssistant,
    entry_id: str,
) -> None:
    """Register ProxLab services.

    Args:
        hass: Home Assistant instance
        entry_id: Config entry ID
    """

    def _get_entry_data(target_entry_id: str) -> dict[str, Any]:
        """Get entry data, defaulting to provided entry_id."""
        if target_entry_id in hass.data[DOMAIN]:
            return cast(dict[str, Any], hass.data[DOMAIN][target_entry_id])
        return cast(dict[str, Any], hass.data[DOMAIN].get(entry_id, {}))

    async def handle_process(call: ServiceCall) -> dict[str, Any]:
        """Handle the process service call.

        Processes a user message through the agent and returns the response.
        """
        text = call.data.get("text", "")
        conversation_id = call.data.get("conversation_id")
        user_id = call.data.get("user_id")
        target_entry_id = call.data.get("entry_id", entry_id)

        # Get the right agent instance
        entry_data = _get_entry_data(target_entry_id)
        target_agent = entry_data.get("agent")

        if target_agent is None:
            raise ValueError("Agent not found for entry")

        target_agent = cast(ProxLabAgent, target_agent)

        try:
            response = await target_agent.process_message(
                text=text,
                conversation_id=conversation_id,
                user_id=user_id,
            )

            _LOGGER.info("Processed message successfully")

            # Return response (Home Assistant will handle this)
            return {
                "response": response,
                "conversation_id": conversation_id,
            }

        except Exception as err:
            _LOGGER.error("Failed to process message: %s", err)
            raise

    async def handle_clear_history(call: ServiceCall) -> None:
        """Handle the clear_history service call.

        Clears conversation history for a specific conversation or all conversations.
        """
        conversation_id = call.data.get("conversation_id")
        target_entry_id = call.data.get("entry_id", entry_id)

        # Get the right agent instance
        entry_data = _get_entry_data(target_entry_id)
        target_agent = entry_data.get("agent")

        if target_agent is None:
            raise ValueError("Agent not found for entry")

        target_agent = cast(ProxLabAgent, target_agent)

        await target_agent.clear_history(conversation_id)

        _LOGGER.info(
            "Cleared history for %s",
            conversation_id if conversation_id else "all conversations",
        )

    async def handle_reload_context(call: ServiceCall) -> None:
        """Handle the reload_context service call.

        Reloads entity context (useful after entity changes).
        """
        target_entry_id = call.data.get("entry_id", entry_id)

        # Get the right agent instance
        entry_data = _get_entry_data(target_entry_id)
        target_agent = entry_data.get("agent")

        if target_agent is None:
            raise ValueError("Agent not found for entry")

        target_agent = cast(ProxLabAgent, target_agent)

        await target_agent.reload_context()

        _LOGGER.info("Reloaded context")

    async def handle_execute_tool(call: ServiceCall) -> dict[str, Any]:
        """Handle the execute_tool service call (debug/testing).

        Manually executes a tool for testing purposes.
        """
        tool_name = call.data.get("tool_name", "")
        parameters = call.data.get("parameters", {})
        target_entry_id = call.data.get("entry_id", entry_id)

        # Get the right agent instance
        entry_data = _get_entry_data(target_entry_id)
        target_agent = entry_data.get("agent")

        if target_agent is None:
            raise ValueError("Agent not found for entry")

        target_agent = cast(ProxLabAgent, target_agent)

        try:
            result = await target_agent.execute_tool_debug(tool_name, parameters)

            _LOGGER.info("Executed tool %s successfully", tool_name)

            return {
                "tool_name": tool_name,
                "result": result,
            }

        except Exception as err:
            _LOGGER.error("Failed to execute tool %s: %s", tool_name, err)
            raise

    async def handle_reindex_entities(call: ServiceCall) -> dict[str, Any]:
        """Handle the reindex_entities service call.

        Forces a full reindex of all entities into the vector database.
        """
        target_entry_id = call.data.get("entry_id", entry_id)

        # Get vector DB manager
        entry_data = _get_entry_data(target_entry_id)
        vector_manager = entry_data.get("vector_manager")

        if not vector_manager:
            _LOGGER.error("Vector DB Manager not enabled for this entry")
            return {"error": "Vector DB Manager not enabled"}

        try:
            stats: dict[str, Any] = await vector_manager.async_reindex_all_entities()
            _LOGGER.info("Reindex complete: %s", stats)
            return stats

        except Exception as err:
            _LOGGER.error("Failed to reindex entities: %s", err)
            raise

    async def handle_index_entity(call: ServiceCall) -> dict[str, Any]:
        """Handle the index_entity service call.

        Indexes a specific entity into the vector database.
        """
        entity_id = call.data.get("entity_id")
        target_entry_id = call.data.get("entry_id", entry_id)

        if not entity_id:
            _LOGGER.error("entity_id is required")
            return {"error": "entity_id is required"}

        # Get vector DB manager
        entry_data = _get_entry_data(target_entry_id)
        vector_manager = entry_data.get("vector_manager")

        if not vector_manager:
            _LOGGER.error("Vector DB Manager not enabled for this entry")
            return {"error": "Vector DB Manager not enabled"}

        try:
            await vector_manager.async_index_entity(entity_id)
            _LOGGER.info("Indexed entity: %s", entity_id)
            return {"entity_id": entity_id, "status": "indexed"}

        except Exception as err:
            _LOGGER.error("Failed to index entity %s: %s", entity_id, err)
            raise

    # Memory management services
    async def handle_list_memories(call: ServiceCall) -> dict[str, Any]:
        """Handle the list_memories service call.

        Lists all stored memories with optional filtering.
        """
        target_entry_id = call.data.get("entry_id", entry_id)
        memory_type = call.data.get("memory_type")
        limit = call.data.get("limit")

        # Get memory manager
        entry_data = _get_entry_data(target_entry_id)
        memory_manager = entry_data.get("memory_manager")

        if not memory_manager:
            _LOGGER.error("Memory Manager not enabled for this entry")
            return {"error": "Memory Manager not enabled", "memories": [], "total": 0}

        try:
            memories = await memory_manager.list_all_memories(
                limit=limit,
                memory_type=memory_type,
            )

            # Format for service response
            return {
                "memories": [
                    {
                        "id": m["id"],
                        "type": m["type"],
                        "content": m["content"],
                        "importance": m["importance"],
                        "extracted_at": m["extracted_at"],
                        "last_accessed": m["last_accessed"],
                        "source_conversation_id": m.get("source_conversation_id"),
                    }
                    for m in memories
                ],
                "total": len(memories),
            }

        except Exception as err:
            _LOGGER.error("Failed to list memories: %s", err)
            raise

    async def handle_delete_memory(call: ServiceCall) -> None:
        """Handle the delete_memory service call.

        Deletes a specific memory by ID.
        """
        memory_id = call.data["memory_id"]
        target_entry_id = call.data.get("entry_id", entry_id)

        # Get memory manager
        entry_data = _get_entry_data(target_entry_id)
        memory_manager = entry_data.get("memory_manager")

        if not memory_manager:
            _LOGGER.error("Memory Manager not enabled for this entry")
            return

        try:
            success = await memory_manager.delete_memory(memory_id)

            if success:
                _LOGGER.info("Deleted memory %s", memory_id)
            else:
                _LOGGER.warning("Failed to delete memory %s", memory_id)

        except Exception as err:
            _LOGGER.error("Failed to delete memory %s: %s", memory_id, err)
            raise

    async def handle_clear_memories(call: ServiceCall) -> dict[str, Any]:
        """Handle the clear_memories service call.

        Clears all memories (requires confirmation).
        """
        confirm = call.data.get("confirm", False)
        target_entry_id = call.data.get("entry_id", entry_id)

        if not confirm:
            _LOGGER.error("Must set 'confirm: true' to clear all memories")
            return {"error": "confirmation_required", "deleted_count": 0}

        # Get memory manager
        entry_data = _get_entry_data(target_entry_id)
        memory_manager = entry_data.get("memory_manager")

        if not memory_manager:
            _LOGGER.error("Memory Manager not enabled for this entry")
            return {"error": "Memory Manager not enabled", "deleted_count": 0}

        try:
            deleted_count = await memory_manager.clear_all_memories()
            _LOGGER.info("Cleared %d memories", deleted_count)

            return {
                "deleted_count": deleted_count,
            }

        except Exception as err:
            _LOGGER.error("Failed to clear memories: %s", err)
            raise

    async def handle_search_memories(call: ServiceCall) -> dict[str, Any]:
        """Handle the search_memories service call.

        Searches memories by semantic similarity.
        """
        query = call.data["query"]
        limit = call.data.get("limit", 10)
        min_importance = call.data.get("min_importance", 0.0)
        target_entry_id = call.data.get("entry_id", entry_id)

        # Get memory manager
        entry_data = _get_entry_data(target_entry_id)
        memory_manager = entry_data.get("memory_manager")

        if not memory_manager:
            _LOGGER.error("Memory Manager not enabled for this entry")
            return {"error": "Memory Manager not enabled", "memories": [], "total": 0}

        try:
            memories = await memory_manager.search_memories(
                query=query,
                top_k=limit,
                min_importance=min_importance,
            )

            return {
                "memories": [
                    {
                        "id": m["id"],
                        "type": m["type"],
                        "content": m["content"],
                        "importance": m["importance"],
                        "relevance_score": m.get("relevance_score", 0.0),
                    }
                    for m in memories
                ],
                "total": len(memories),
            }

        except Exception as err:
            _LOGGER.error("Failed to search memories: %s", err)
            raise

    async def handle_add_memory(call: ServiceCall) -> dict[str, Any]:
        """Handle the add_memory service call.

        Manually adds a memory.
        """
        content = call.data["content"]
        memory_type = call.data.get("type", "fact")
        importance = call.data.get("importance", 0.5)
        target_entry_id = call.data.get("entry_id", entry_id)

        # Get memory manager
        entry_data = _get_entry_data(target_entry_id)
        memory_manager = entry_data.get("memory_manager")

        if not memory_manager:
            _LOGGER.error("Memory Manager not enabled for this entry")
            return {"error": "Memory Manager not enabled"}

        try:
            memory_id = await memory_manager.add_memory(
                content=content,
                memory_type=memory_type,
                conversation_id=None,
                importance=importance,
                metadata={
                    "extraction_method": "manual_service",
                    "topics": [],
                    "entities_involved": [],
                },
            )

            _LOGGER.info("Added memory via service: %s", memory_id)

            return {
                "memory_id": memory_id,
            }

        except Exception as err:
            _LOGGER.error("Failed to add memory: %s", err)
            raise

    async def handle_clear_conversation(call: ServiceCall) -> None:
        """Handle the clear_conversation service call.

        Clears conversation session for a user or device, allowing them to
        start a fresh conversation with no previous context.
        """
        user_id = call.data.get("user_id")
        device_id = call.data.get("device_id")
        target_entry_id = call.data.get("entry_id", entry_id)

        # Get session manager
        entry_data = _get_entry_data(target_entry_id)
        session_manager = entry_data.get("session_manager")

        if not session_manager:
            _LOGGER.error("Session Manager not available for this entry")
            return

        if user_id or device_id:
            # Clear specific session
            success = await session_manager.clear_session(
                user_id=user_id,
                device_id=device_id,
            )
            if success:
                _LOGGER.info(
                    "Cleared conversation session for user_id=%s device_id=%s",
                    user_id,
                    device_id,
                )
            else:
                _LOGGER.warning(
                    "No active conversation found for user_id=%s device_id=%s",
                    user_id,
                    device_id,
                )
        else:
            # Clear all sessions
            count = await session_manager.clear_all_sessions()
            _LOGGER.info("Cleared all %d conversation session(s)", count)

    async def handle_invoke_agent(call: ServiceCall) -> dict[str, Any]:
        """Handle the invoke_agent service call.

        Directly invokes a specific agent, bypassing orchestrator routing.
        Returns structured JSON with response, tool results, and metrics.
        """
        agent_id = call.data["agent_id"]
        message = call.data["message"]
        context = call.data.get("context")
        user_id = call.data.get("user_id")
        conversation_id = call.data.get("conversation_id")
        include_history = call.data.get("include_history", False)
        target_entry_id = call.data.get("entry_id", entry_id)

        entry_data = _get_entry_data(target_entry_id)
        target_agent = entry_data.get("agent")

        if target_agent is None:
            raise ValueError("Agent not found for entry — LLM not configured")

        target_agent = cast(ProxLabAgent, target_agent)

        return await target_agent.invoke_agent(
            agent_id=agent_id,
            message=message,
            context=context,
            user_id=user_id,
            conversation_id=conversation_id,
            include_history=include_history,
        )

    # Register services (only once for all instances)
    if not hass.services.has_service(DOMAIN, "process"):
        hass.services.async_register(DOMAIN, "process", handle_process)
        _LOGGER.debug("Registered service: process")

    if not hass.services.has_service(DOMAIN, "clear_history"):
        hass.services.async_register(DOMAIN, "clear_history", handle_clear_history)
        _LOGGER.debug("Registered service: clear_history")

    if not hass.services.has_service(DOMAIN, "reload_context"):
        hass.services.async_register(DOMAIN, "reload_context", handle_reload_context)
        _LOGGER.debug("Registered service: reload_context")

    if not hass.services.has_service(DOMAIN, "execute_tool"):
        hass.services.async_register(DOMAIN, "execute_tool", handle_execute_tool)
        _LOGGER.debug("Registered service: execute_tool")

    if not hass.services.has_service(DOMAIN, "reindex_entities"):
        hass.services.async_register(DOMAIN, "reindex_entities", handle_reindex_entities)
        _LOGGER.debug("Registered service: reindex_entities")

    if not hass.services.has_service(DOMAIN, "index_entity"):
        hass.services.async_register(DOMAIN, "index_entity", handle_index_entity)
        _LOGGER.debug("Registered service: index_entity")

    # Register memory management services
    if not hass.services.has_service(DOMAIN, "list_memories"):
        hass.services.async_register(
            DOMAIN,
            "list_memories",
            handle_list_memories,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: list_memories")

    if not hass.services.has_service(DOMAIN, "delete_memory"):
        hass.services.async_register(DOMAIN, "delete_memory", handle_delete_memory)
        _LOGGER.debug("Registered service: delete_memory")

    if not hass.services.has_service(DOMAIN, "clear_memories"):
        hass.services.async_register(
            DOMAIN,
            "clear_memories",
            handle_clear_memories,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: clear_memories")

    if not hass.services.has_service(DOMAIN, "search_memories"):
        hass.services.async_register(
            DOMAIN,
            "search_memories",
            handle_search_memories,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: search_memories")

    if not hass.services.has_service(DOMAIN, "add_memory"):
        hass.services.async_register(
            DOMAIN,
            "add_memory",
            handle_add_memory,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: add_memory")

    if not hass.services.has_service(DOMAIN, "clear_conversation"):
        hass.services.async_register(DOMAIN, "clear_conversation", handle_clear_conversation)
        _LOGGER.debug("Registered service: clear_conversation")

    if not hass.services.has_service(DOMAIN, "invoke_agent"):
        hass.services.async_register(
            DOMAIN,
            "invoke_agent",
            handle_invoke_agent,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: invoke_agent")

    # --- Agent Registry services (Phase 2) ---

    async def handle_create_agent_subscription(call: ServiceCall) -> dict[str, Any]:
        """Create an event subscription that triggers an agent."""
        target_entry_id = call.data.get("entry_id", entry_id)
        entry_data = _get_entry_data(target_entry_id)
        registry = entry_data.get("agent_registry")
        if not registry:
            raise ValueError("Agent registry not available")
        sub = await registry.create_subscription(dict(call.data))
        return {"subscription_id": sub["id"]}

    async def handle_remove_agent_subscription(call: ServiceCall) -> None:
        """Remove an event subscription."""
        target_entry_id = call.data.get("entry_id", entry_id)
        entry_data = _get_entry_data(target_entry_id)
        registry = entry_data.get("agent_registry")
        if not registry:
            raise ValueError("Agent registry not available")
        await registry.delete_subscription(call.data["subscription_id"])

    async def handle_create_agent_schedule(call: ServiceCall) -> dict[str, Any]:
        """Create a scheduled agent invocation."""
        target_entry_id = call.data.get("entry_id", entry_id)
        entry_data = _get_entry_data(target_entry_id)
        registry = entry_data.get("agent_registry")
        if not registry:
            raise ValueError("Agent registry not available")
        sched = await registry.create_schedule(dict(call.data))
        return {"schedule_id": sched["id"]}

    async def handle_remove_agent_schedule(call: ServiceCall) -> None:
        """Remove a scheduled agent invocation."""
        target_entry_id = call.data.get("entry_id", entry_id)
        entry_data = _get_entry_data(target_entry_id)
        registry = entry_data.get("agent_registry")
        if not registry:
            raise ValueError("Agent registry not available")
        await registry.delete_schedule(call.data["schedule_id"])

    async def handle_run_agent_chain(call: ServiceCall) -> dict[str, Any]:
        """Execute an agent chain."""
        target_entry_id = call.data.get("entry_id", entry_id)
        entry_data = _get_entry_data(target_entry_id)
        registry = entry_data.get("agent_registry")
        if not registry:
            raise ValueError("Agent registry not available")
        return await registry.run_chain(
            chain_id=call.data["chain_id"],
            initial_message=call.data.get("initial_message", ""),
            initial_context=call.data.get("initial_context"),
        )

    if not hass.services.has_service(DOMAIN, "create_agent_subscription"):
        hass.services.async_register(
            DOMAIN,
            "create_agent_subscription",
            handle_create_agent_subscription,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: create_agent_subscription")

    if not hass.services.has_service(DOMAIN, "remove_agent_subscription"):
        hass.services.async_register(
            DOMAIN,
            "remove_agent_subscription",
            handle_remove_agent_subscription,
        )
        _LOGGER.debug("Registered service: remove_agent_subscription")

    if not hass.services.has_service(DOMAIN, "create_agent_schedule"):
        hass.services.async_register(
            DOMAIN,
            "create_agent_schedule",
            handle_create_agent_schedule,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: create_agent_schedule")

    if not hass.services.has_service(DOMAIN, "remove_agent_schedule"):
        hass.services.async_register(
            DOMAIN,
            "remove_agent_schedule",
            handle_remove_agent_schedule,
        )
        _LOGGER.debug("Registered service: remove_agent_schedule")

    if not hass.services.has_service(DOMAIN, "run_agent_chain"):
        hass.services.async_register(
            DOMAIN,
            "run_agent_chain",
            handle_run_agent_chain,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: run_agent_chain")

    # --- KoboldCpp Hot-Swap service ---

    async def handle_swap_model(call: ServiceCall) -> dict[str, Any]:
        """Hot-swap model on a running KoboldCpp service."""
        service_id = call.data["service_id"]
        model_family = call.data["model_family"]
        model_variant = call.data["model_variant"]
        quant = call.data["quant"]
        target_entry_id = call.data.get("entry_id", entry_id)

        config_entry = hass.config_entries.async_get_entry(target_entry_id)
        if not config_entry:
            raise ValueError(f"Config entry {target_entry_id} not found")

        proxlab_url = dict(config_entry.data).get(CONF_PROXLAB_URL, "")
        if not proxlab_url:
            raise ValueError("ProxLab URL not configured")

        from .proxlab_api import swap_model
        return await swap_model(
            proxlab_url, service_id, model_family, model_variant, quant
        )

    if not hass.services.has_service(DOMAIN, "swap_model"):
        hass.services.async_register(
            DOMAIN,
            "swap_model",
            handle_swap_model,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: swap_model")


async def async_remove_services(hass: HomeAssistant) -> None:
    """Remove ProxLab services.

    Args:
        hass: Home Assistant instance
    """
    services = [
        "process",
        "clear_history",
        "reload_context",
        "execute_tool",
        "reindex_entities",
        "index_entity",
        "list_memories",
        "delete_memory",
        "clear_memories",
        "search_memories",
        "add_memory",
        "clear_conversation",
        "invoke_agent",
        "create_agent_subscription",
        "remove_agent_subscription",
        "create_agent_schedule",
        "remove_agent_schedule",
        "run_agent_chain",
        "swap_model",
    ]

    for service in services:
        if hass.services.has_service(DOMAIN, service):
            hass.services.async_remove(DOMAIN, service)
            _LOGGER.debug("Removed service: %s", service)
