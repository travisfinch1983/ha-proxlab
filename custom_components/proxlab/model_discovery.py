"""Model discovery module for ProxLab.

Queries each configured connection to discover loaded models, capabilities,
and performance metadata. Supports provider-specific enrichment for KoboldCpp,
Ollama, vLLM, Claude API, and generic OpenAI-compatible endpoints.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import asdict, dataclass, field
from typing import Any

import aiohttp

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    CONF_CONNECTIONS,
    CONNECTION_TYPE_CLAUDE,
    CONNECTION_TYPE_CLAUDE_ADDON,
    CONNECTION_TYPE_LOCAL,
    CONNECTION_TYPE_OLLAMA,
    CONNECTION_TYPE_OPENAI,
    DOMAIN,
    MODEL_DISCOVERY_CACHE_TTL,
    MODEL_DISCOVERY_TIMEOUT,
)
from .helpers import is_ollama_backend

_LOGGER = logging.getLogger(__name__)

# Timeout for individual provider-detection probes (seconds)
_PROBE_TIMEOUT = 3


@dataclass
class ModelInfo:
    """Normalized model information across all providers."""

    # Identity
    id: str = ""
    connection_id: str = ""
    connection_name: str = ""
    provider: str = "unknown"  # koboldcpp, ollama, vllm, openai, claude

    # Model specs
    context_length: int | None = None
    parameter_count: str | None = None  # e.g. "7B", "13B"
    quantization: str | None = None  # e.g. "Q4_K_M", "Q6_K"
    architecture: str | None = None  # e.g. "llama", "qwen2"
    family: str | None = None
    format: str | None = None  # e.g. "gguf"

    # Capabilities
    supports_vision: bool = False
    supports_audio: bool = False
    supports_embeddings: bool = False
    supports_tts: bool = False
    supports_stt: bool = False
    supports_tool_use: bool = False
    supports_reranker: bool = False

    # Size
    size_bytes: int | None = None
    size_vram_bytes: int | None = None

    # Runtime / performance
    is_loaded: bool = False
    generation_speed: float | None = None  # tokens/sec
    prompt_speed: float | None = None  # tokens/sec
    uptime_seconds: float | None = None
    queue_depth: int | None = None

    # Provider-specific raw data
    extras: dict[str, Any] = field(default_factory=dict)

    # Status
    status: str = "ok"  # ok, error, offline
    error: str | None = None


# ---------------------------------------------------------------------------
# Provider auto-detection (for connection_type == "openai")
# ---------------------------------------------------------------------------


async def _detect_provider(
    session: aiohttp.ClientSession, base_url: str
) -> str:
    """Auto-detect the actual backend behind an OpenAI-compatible URL.

    Probe order:
    0. URL heuristic for Ollama (port 11434 or 'ollama' in URL)
    1. KoboldCpp: GET /api/extra/version
    2. vLLM: GET /version
    3. Ollama: GET /api/tags (if not caught by heuristic)
    4. Fallback: generic openai
    """
    url = base_url.rstrip("/")

    # Quick heuristic: Ollama standard port or hostname
    if is_ollama_backend(url):
        return "ollama"

    # Probe KoboldCpp
    try:
        async with session.get(
            f"{url}/api/extra/version", timeout=aiohttp.ClientTimeout(total=_PROBE_TIMEOUT)
        ) as resp:
            if resp.status == 200:
                return "koboldcpp"
    except Exception:
        pass

    # Probe vLLM
    try:
        async with session.get(
            f"{url}/version", timeout=aiohttp.ClientTimeout(total=_PROBE_TIMEOUT)
        ) as resp:
            if resp.status == 200:
                body = await resp.json()
                if isinstance(body, dict) and "version" in body:
                    return "vllm"
    except Exception:
        pass

    # Probe Ollama (non-standard port)
    try:
        async with session.get(
            f"{url}/api/tags", timeout=aiohttp.ClientTimeout(total=_PROBE_TIMEOUT)
        ) as resp:
            if resp.status == 200:
                body = await resp.json()
                if isinstance(body, dict) and "models" in body:
                    return "ollama"
    except Exception:
        pass

    return "openai"


# ---------------------------------------------------------------------------
# Model-name heuristics
# ---------------------------------------------------------------------------


_TTS_NAME_HINTS = {"tts", "kokoro", "piper", "coqui", "bark", "parler", "speech"}
_STT_NAME_HINTS = {"whisper", "faster-whisper", "transcri"}

# URL path fragments that indicate endpoint type (e.g. /api/proxy/tts/v1)
_URL_CAPABILITY_PATTERNS = {
    "/embed": "embeddings",
    "/tts": "tts",
    "/stt": "stt",
    "/rerank": "reranker",
}


def _apply_name_heuristics(info: ModelInfo) -> None:
    """Infer capability flags from a model's ID when the backend provides no metadata."""
    mid = info.id.lower()
    if "embed" in mid:
        info.supports_embeddings = True
    if "rerank" in mid:
        info.supports_reranker = True
    if any(hint in mid for hint in _TTS_NAME_HINTS):
        info.supports_tts = True
    if any(hint in mid for hint in _STT_NAME_HINTS):
        info.supports_stt = True


def _apply_url_heuristics(models: list[ModelInfo], base_url: str) -> None:
    """Infer capability flags from the connection's base URL path.

    Proxy URLs like /api/proxy/tts/v1 or /api/proxy/embed/v1 explicitly
    declare the endpoint type. This is the most reliable signal for
    connections behind aggregating proxies.
    """
    url_lower = base_url.lower()
    for fragment, capability in _URL_CAPABILITY_PATTERNS.items():
        if fragment in url_lower:
            for m in models:
                setattr(m, f"supports_{capability}", True)
            break


# ---------------------------------------------------------------------------
# Provider-specific discovery
# ---------------------------------------------------------------------------


async def _discover_koboldcpp(
    session: aiohttp.ClientSession,
    conn_id: str,
    conn: dict[str, Any],
    base_url: str,
) -> list[ModelInfo]:
    """Discover the single model loaded in a KoboldCpp instance."""
    url = base_url.rstrip("/")
    model = ModelInfo(
        connection_id=conn_id,
        connection_name=conn.get("name", ""),
        provider="koboldcpp",
        is_loaded=True,
    )

    # /api/extra/version — software version + model path + capability flags
    try:
        async with session.get(f"{url}/api/extra/version") as resp:
            if resp.status == 200:
                data = await resp.json()
                model.extras["software_version"] = data.get("version", "")
                model_path = data.get("model_path", "")
                if model_path:
                    model.extras["model_path"] = model_path
                    # Derive model ID from filename
                    model.id = model_path.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
                # Extract capability flags (different field names than /props)
                # These serve as defaults; /props can override below
                if data.get("embeddings"):
                    model.supports_embeddings = True
                if data.get("vision"):
                    model.supports_vision = True
                if data.get("audio"):
                    model.supports_audio = True
                if data.get("tts"):
                    model.supports_tts = True
    except Exception as err:
        _LOGGER.debug("KoboldCpp /api/extra/version failed: %s", err)

    # Fallback: try /v1/models for model ID if not yet set
    if not model.id:
        try:
            async with session.get(f"{url}/v1/models") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    items = data.get("data", [])
                    if items:
                        model.id = items[0].get("id", "")
        except Exception:
            pass

    # Final fallback
    if not model.id:
        model.id = conn.get("model") or "koboldcpp-model"

    # /props — capability flags, context size
    # KoboldCpp's /props has has_multimodal/has_audio/has_embeddings/has_tts.
    # Newer versions (or llama.cpp) use modalities.vision/modalities.audio instead.
    # Only override capabilities that are explicitly present to avoid clobbering
    # values already set by /api/extra/version above.
    try:
        async with session.get(f"{url}/props") as resp:
            if resp.status == 200:
                data = await resp.json()
                ctx = data.get("default_gen_params", {}).get("max_length")
                if ctx:
                    model.context_length = ctx
                elif data.get("n_ctx"):
                    model.context_length = data["n_ctx"]
                # KoboldCpp-style flags (only set if key exists)
                if "has_multimodal" in data:
                    model.supports_vision = data["has_multimodal"]
                if "has_audio" in data:
                    model.supports_audio = data["has_audio"]
                if "has_embeddings" in data:
                    model.supports_embeddings = data["has_embeddings"]
                if "has_tts" in data:
                    model.supports_tts = data["has_tts"]
                # llama.cpp modalities fallback
                modalities = data.get("modalities", {})
                if modalities.get("vision") and not model.supports_vision:
                    model.supports_vision = True
                if modalities.get("audio") and not model.supports_audio:
                    model.supports_audio = True
                model.extras["props"] = data
    except Exception as err:
        _LOGGER.debug("KoboldCpp /props failed: %s", err)

    # /api/extra/true_max_context_length — actual max context
    try:
        async with session.get(f"{url}/api/extra/true_max_context_length") as resp:
            if resp.status == 200:
                data = await resp.json()
                if isinstance(data, dict) and "value" in data:
                    model.context_length = data["value"]
                elif isinstance(data, int):
                    model.context_length = data
    except Exception as err:
        _LOGGER.debug("KoboldCpp /api/extra/true_max_context_length failed: %s", err)

    # /api/extra/perf — performance stats
    try:
        async with session.get(f"{url}/api/extra/perf") as resp:
            if resp.status == 200:
                data = await resp.json()
                model.generation_speed = data.get("last_gen_speed")
                model.prompt_speed = data.get("last_prompt_speed")
                model.uptime_seconds = data.get("uptime")
                model.queue_depth = data.get("queue_count", 0)
                model.extras["perf"] = data
    except Exception as err:
        _LOGGER.debug("KoboldCpp /api/extra/perf failed: %s", err)

    # Final fallback: infer capabilities from model name
    _apply_name_heuristics(model)

    return [model]


async def _discover_ollama(
    session: aiohttp.ClientSession,
    conn_id: str,
    conn: dict[str, Any],
    base_url: str,
) -> list[ModelInfo]:
    """Discover all models available in an Ollama instance."""
    url = base_url.rstrip("/")
    models: list[ModelInfo] = []

    # /api/tags — list all models
    try:
        async with session.get(f"{url}/api/tags") as resp:
            if resp.status != 200:
                return []
            data = await resp.json()
    except Exception as err:
        _LOGGER.debug("Ollama /api/tags failed: %s", err)
        return []

    model_list = data.get("models", [])
    if not model_list:
        return []

    # /api/ps — running models (loaded in VRAM)
    running_models: dict[str, dict] = {}
    try:
        async with session.get(f"{url}/api/ps") as resp:
            if resp.status == 200:
                ps_data = await resp.json()
                for rm in ps_data.get("models", []):
                    running_models[rm.get("name", "")] = rm
    except Exception as err:
        _LOGGER.debug("Ollama /api/ps failed: %s", err)

    # /api/show — detailed info per model (semaphore-limited)
    sem = asyncio.Semaphore(5)

    async def _enrich(m: dict) -> ModelInfo:
        name = m.get("name", "unknown")
        info = ModelInfo(
            id=name,
            connection_id=conn_id,
            connection_name=conn.get("name", ""),
            provider="ollama",
            size_bytes=m.get("size"),
            format=m.get("details", {}).get("format"),
            family=m.get("details", {}).get("family"),
            parameter_count=m.get("details", {}).get("parameter_size"),
            quantization=m.get("details", {}).get("quantization_level"),
        )

        # Check if running
        rm = running_models.get(name)
        if rm:
            info.is_loaded = True
            info.size_vram_bytes = rm.get("size_vram")

        # Get detailed model info
        async with sem:
            try:
                async with session.post(
                    f"{url}/api/show",
                    json={"name": name},
                ) as resp:
                    if resp.status == 200:
                        show_data = await resp.json()
                        model_info = show_data.get("model_info", {})
                        # Architecture
                        arch = model_info.get("general.architecture")
                        if arch:
                            info.architecture = arch
                        # Context length
                        ctx = model_info.get(f"{arch}.context_length") if arch else None
                        if ctx is None:
                            ctx = model_info.get("llama.context_length")
                        if ctx:
                            info.context_length = ctx
                        # Embedding length (indicates embedding model)
                        emb_len = model_info.get(f"{arch}.embedding_length") if arch else None
                        if emb_len is None:
                            emb_len = model_info.get("llama.embedding_length")
                        if emb_len:
                            info.extras["embedding_length"] = emb_len
                        # Pooling type (indicates embedding model)
                        pool = model_info.get(f"{arch}.pooling_type") if arch else None
                        if pool is not None:
                            info.supports_embeddings = True
                            info.extras["pooling_type"] = pool
                        # Capabilities from template
                        template = show_data.get("template", "")
                        if ".tools" in template or "tool_call" in template.lower():
                            info.supports_tool_use = True
                        # Store raw model_info keys
                        info.extras["model_info_keys"] = list(model_info.keys())
            except Exception as err:
                _LOGGER.debug("Ollama /api/show for %s failed: %s", name, err)

        return info

    enriched = await asyncio.gather(*[_enrich(m) for m in model_list])
    models.extend(enriched)
    return models


async def _discover_vllm(
    session: aiohttp.ClientSession,
    conn_id: str,
    conn: dict[str, Any],
    base_url: str,
) -> list[ModelInfo]:
    """Discover models from a vLLM server."""
    url = base_url.rstrip("/")
    models: list[ModelInfo] = []

    # /version — vLLM version
    vllm_version = None
    try:
        async with session.get(f"{url}/version") as resp:
            if resp.status == 200:
                data = await resp.json()
                vllm_version = data.get("version")
    except Exception:
        pass

    # /v1/models — model list
    try:
        async with session.get(f"{url}/v1/models") as resp:
            if resp.status != 200:
                return []
            data = await resp.json()
    except Exception as err:
        _LOGGER.debug("vLLM /v1/models failed: %s", err)
        return []

    for m in data.get("data", []):
        info = ModelInfo(
            id=m.get("id", "unknown"),
            connection_id=conn_id,
            connection_name=conn.get("name", ""),
            provider="vllm",
            is_loaded=True,
        )
        # max_model_len from model object
        if "max_model_len" in m:
            info.context_length = m["max_model_len"]
        if vllm_version:
            info.extras["vllm_version"] = vllm_version
        info.extras["owned_by"] = m.get("owned_by", "")
        info.extras["created"] = m.get("created")
        # Infer capabilities from model name
        _apply_name_heuristics(info)
        models.append(info)

    return models


async def _discover_openai_generic(
    session: aiohttp.ClientSession,
    conn_id: str,
    conn: dict[str, Any],
    base_url: str,
) -> list[ModelInfo]:
    """Discover models from a generic OpenAI-compatible endpoint."""
    url = base_url.rstrip("/")
    models: list[ModelInfo] = []

    # Build endpoint list — avoid doubling /v1 if URL already ends with it
    if url.endswith("/v1"):
        endpoints = [f"{url}/models"]
    else:
        endpoints = [f"{url}/v1/models", f"{url}/models"]

    data = None
    for endpoint in endpoints:
        try:
            async with session.get(endpoint) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if isinstance(data, dict) and "data" in data:
                        break
                    data = None  # Got 200 but not valid model list
        except Exception:
            continue

    if not data or "data" not in data:
        return []

    for m in data["data"]:
        model_id = m.get("id", "unknown")
        info = ModelInfo(
            id=model_id,
            connection_id=conn_id,
            connection_name=conn.get("name", ""),
            provider="openai",
        )
        info.extras["owned_by"] = m.get("owned_by", "")
        info.extras["created"] = m.get("created")
        # Infer capabilities from model name
        _apply_name_heuristics(info)
        models.append(info)

    return models


async def _discover_claude(
    session: aiohttp.ClientSession,
    conn_id: str,
    conn: dict[str, Any],
    base_url: str,
) -> list[ModelInfo]:
    """Discover models from the Anthropic Claude API or Claude Code addon proxy."""
    url = base_url.rstrip("/")
    api_key = conn.get("api_key", "")
    connection_type = conn.get("connection_type", "")

    # Build URL
    if url.endswith("/v1"):
        models_url = f"{url}/models"
    else:
        models_url = f"{url}/v1/models"

    # Anthropic API needs special headers; addon proxy doesn't
    headers: dict[str, str] = {}
    if api_key:
        headers["x-api-key"] = api_key
        headers["anthropic-version"] = "2023-06-01"

    data = None
    try:
        async with session.get(models_url, headers=headers) as resp:
            if resp.status == 200:
                data = await resp.json()
    except Exception as err:
        _LOGGER.debug("Claude /v1/models failed for %s: %s", conn_id, err)

    # For addon connections that don't have a /v1/models endpoint,
    # fall back to the known Claude model list
    if not data or "data" not in data:
        if connection_type == CONNECTION_TYPE_CLAUDE_ADDON:
            from .const import CLAUDE_MODELS

            models: list[ModelInfo] = []
            for model_id in CLAUDE_MODELS:
                display = model_id.replace("claude-", "Claude ").replace("-", " ").title()
                info = ModelInfo(
                    id=model_id,
                    connection_id=conn_id,
                    connection_name=conn.get("name", ""),
                    provider="claude",
                    supports_tool_use=True,
                    supports_vision=True,
                )
                info.extras["display_name"] = display
                models.append(info)
            return models
        return []

    models = []
    for m in data.get("data", []):
        model_id = m.get("id", "unknown")
        supports_vision = "claude-3" in model_id or "claude-4" in model_id
        info = ModelInfo(
            id=model_id,
            connection_id=conn_id,
            connection_name=conn.get("name", ""),
            provider="claude",
            supports_tool_use=True,
            supports_vision=supports_vision,
        )
        if m.get("display_name"):
            info.extras["display_name"] = m["display_name"]
        if m.get("created_at"):
            info.extras["created_at"] = m["created_at"]
        models.append(info)

    return models


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


async def discover_connection_models(
    session: aiohttp.ClientSession,
    conn_id: str,
    conn: dict[str, Any],
) -> list[ModelInfo]:
    """Discover models for a single connection."""
    base_url = conn.get("base_url", "").rstrip("/")
    if not base_url:
        return []

    connection_type = conn.get("connection_type", "")

    # Strip /v1 suffix for native API probing (Ollama, KoboldCpp use non-OpenAI paths)
    native_base = base_url
    if native_base.endswith("/v1"):
        native_base = native_base[:-3]

    models: list[ModelInfo] = []
    try:
        if connection_type in (CONNECTION_TYPE_CLAUDE, CONNECTION_TYPE_CLAUDE_ADDON):
            models = await _discover_claude(session, conn_id, conn, base_url)
        elif connection_type == CONNECTION_TYPE_OLLAMA:
            models = await _discover_ollama(session, conn_id, conn, native_base)
        elif connection_type in (
            CONNECTION_TYPE_OPENAI,
            CONNECTION_TYPE_LOCAL,
            "",
        ) or not connection_type:
            # Auto-detect the actual provider behind this endpoint
            provider = await _detect_provider(session, native_base)
            if provider == "koboldcpp":
                models = await _discover_koboldcpp(session, conn_id, conn, native_base)
            elif provider == "vllm":
                models = await _discover_vllm(session, conn_id, conn, native_base)
            elif provider == "ollama":
                models = await _discover_ollama(session, conn_id, conn, native_base)
            else:
                models = await _discover_openai_generic(session, conn_id, conn, base_url)
        else:
            # Unknown connection type — try auto-detect then generic OpenAI
            provider = await _detect_provider(session, native_base)
            if provider == "koboldcpp":
                models = await _discover_koboldcpp(session, conn_id, conn, native_base)
            elif provider == "vllm":
                models = await _discover_vllm(session, conn_id, conn, native_base)
            elif provider == "ollama":
                models = await _discover_ollama(session, conn_id, conn, native_base)
            else:
                models = await _discover_openai_generic(session, conn_id, conn, base_url)
    except Exception as err:
        _LOGGER.warning(
            "Model discovery failed for connection %s (%s): %s",
            conn_id,
            conn.get("name", ""),
            err,
        )
        models = [
            ModelInfo(
                id=conn.get("model", "unknown"),
                connection_id=conn_id,
                connection_name=conn.get("name", ""),
                provider=connection_type or "unknown",
                status="error",
                error=str(err),
            )
        ]

    # Post-processing: infer capabilities from the base URL path.
    # Proxy URLs like /api/proxy/tts/v1 explicitly declare the endpoint type
    # and are the most reliable signal for connections behind proxies.
    _apply_url_heuristics(models, base_url)

    return models


async def discover_all_models(
    hass: HomeAssistant,
    entry: ConfigEntry,
    force_refresh: bool = False,
) -> list[dict[str, Any]]:
    """Discover models across all configured connections.

    Returns cached data if fresh (< TTL) and not force_refresh.
    Fans out discovery per connection with asyncio.gather, each wrapped
    in asyncio.wait_for(timeout=MODEL_DISCOVERY_TIMEOUT).
    """
    entry_data = hass.data.get(DOMAIN, {}).get(entry.entry_id, {})
    cache = entry_data.get("model_cache", {"data": [], "timestamp": 0})

    # Return cached if fresh
    if not force_refresh and cache["data"]:
        age = time.time() - cache["timestamp"]
        if age < MODEL_DISCOVERY_CACHE_TTL:
            _LOGGER.debug("Model discovery cache hit (age=%.0fs)", age)
            return cache["data"]

    connections = dict(entry.data).get(CONF_CONNECTIONS, {})
    if not connections:
        return []

    timeout = aiohttp.ClientTimeout(total=MODEL_DISCOVERY_TIMEOUT)

    async def _discover_one(conn_id: str, conn: dict) -> list[ModelInfo]:
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                return await asyncio.wait_for(
                    discover_connection_models(session, conn_id, conn),
                    timeout=MODEL_DISCOVERY_TIMEOUT,
                )
        except asyncio.TimeoutError:
            _LOGGER.warning(
                "Model discovery timed out for %s (%s)",
                conn_id,
                conn.get("name", ""),
            )
            return [
                ModelInfo(
                    id=conn.get("model", "unknown"),
                    connection_id=conn_id,
                    connection_name=conn.get("name", ""),
                    provider=conn.get("connection_type", "unknown"),
                    status="error",
                    error="Discovery timed out",
                )
            ]
        except Exception as err:
            _LOGGER.warning(
                "Model discovery error for %s: %s", conn_id, err
            )
            return [
                ModelInfo(
                    id=conn.get("model", "unknown"),
                    connection_id=conn_id,
                    connection_name=conn.get("name", ""),
                    provider=conn.get("connection_type", "unknown"),
                    status="error",
                    error=str(err),
                )
            ]

    # Fan out discovery
    results = await asyncio.gather(
        *[_discover_one(cid, conn) for cid, conn in connections.items()]
    )

    # Flatten and serialize
    all_models: list[dict[str, Any]] = []
    for model_list in results:
        for model in model_list:
            all_models.append(asdict(model))

    # Update cache
    cache["data"] = all_models
    cache["timestamp"] = time.time()
    if entry.entry_id in hass.data.get(DOMAIN, {}):
        hass.data[DOMAIN][entry.entry_id]["model_cache"] = cache

    _LOGGER.info(
        "Model discovery complete: %d models from %d connections",
        len(all_models),
        len(connections),
    )
    return all_models
