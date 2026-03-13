"""HuggingFace model enrichment for ProxLab.

Resolves provider model IDs to HuggingFace repo slugs, fetches metadata
from the HF API, and caches results persistently with a 7-day TTL.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from dataclasses import asdict, dataclass, field
from typing import Any

import aiohttp

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

# Cache entry TTL (seconds) — 7 days
_CACHE_TTL = 7 * 24 * 3600

# Max concurrent HF API requests
_HF_CONCURRENCY = 3

# HF API timeout (seconds)
_HF_TIMEOUT = 10

# ---------------------------------------------------------------------------
# Org map: model family prefix -> HuggingFace org
# ---------------------------------------------------------------------------

HF_ORG_MAP: dict[str, str] = {
    # Qwen
    "qwen3.5": "Qwen", "qwen3": "Qwen", "qwen2.5": "Qwen",
    "qwen2": "Qwen", "qwen": "Qwen",
    # Meta Llama
    "llama3.2": "meta-llama", "llama3.1": "meta-llama",
    "llama3.3": "meta-llama", "llama3": "meta-llama",
    "llama2": "meta-llama", "llama": "meta-llama",
    "codellama": "meta-llama",
    # Google
    "gemma2": "google", "gemma3": "google", "gemma": "google",
    # Mistral
    "mistral": "mistralai", "mixtral": "mistralai",
    "codestral": "mistralai", "mistral-nemo": "mistralai",
    # Microsoft
    "phi-3": "microsoft", "phi-4": "microsoft",
    "phi3": "microsoft", "phi4": "microsoft", "phi": "microsoft",
    # DeepSeek
    "deepseek": "deepseek-ai", "deepseek-r1": "deepseek-ai",
    "deepseek-v2": "deepseek-ai", "deepseek-v3": "deepseek-ai",
    "deepseek-coder": "deepseek-ai",
    # TheDrummer
    "rocinante": "TheDrummer", "cydonia": "TheDrummer",
    "behemoth": "TheDrummer", "donnager": "TheDrummer",
    # Others
    "starcoder": "bigcode", "starcoder2": "bigcode",
    "command-r": "CohereForAI", "aya": "CohereForAI",
    "yi": "01-ai",
    "internlm": "internlm",
    "falcon": "tiiuae",
    "solar": "upstage",
    "vicuna": "lmsys",
    "nous-hermes": "NousResearch", "hermes": "NousResearch",
}

# Common size suffixes in model names
_SIZE_PATTERN = re.compile(
    r"[:\-_](\d+(?:\.\d+)?[bBmM])",
)

# Quant suffixes to strip from GGUF filenames
_QUANT_PATTERN = re.compile(
    r"[-_](?:Q\d+_K(?:_[SML])?|IQ\d+_\w+|F(?:16|32)|BF16|FP16)(?:[-_]|\.gguf$)",
    re.IGNORECASE,
)


@dataclass
class HfModelInfo:
    """Enrichment data from HuggingFace API."""

    hf_repo: str = ""
    description: str = ""
    pipeline_tag: str = ""
    model_type: str = ""  # "Dense" | "MoE"
    tags: list[str] = field(default_factory=list)
    license: str = ""
    author: str = ""
    last_modified: str = ""
    downloads: int = 0
    likes: int = 0
    logo_url: str = ""
    card_data: dict[str, Any] = field(default_factory=dict)
    fetched_at: float = 0.0
    status: str = "ok"  # ok | not_found | error | unmapped


# ---------------------------------------------------------------------------
# Slug resolver
# ---------------------------------------------------------------------------


def _normalize_ollama_name(tag_name: str) -> tuple[str, str | None]:
    """Parse 'qwen2.5:7b-instruct-q6_K' -> ('qwen2.5', '7B')."""
    name = tag_name.split(":")[0]  # strip tag
    size_match = _SIZE_PATTERN.search(tag_name)
    size = size_match.group(1).upper() if size_match else None
    return name, size


def _find_org(name_lower: str) -> str | None:
    """Look up org from the longest matching prefix in HF_ORG_MAP."""
    best_match = ""
    for prefix in HF_ORG_MAP:
        if name_lower.startswith(prefix) and len(prefix) > len(best_match):
            best_match = prefix
    return HF_ORG_MAP.get(best_match)


def _build_hf_slug(org: str, name: str, size: str | None) -> str:
    """Construct a likely HF repo slug from org + model name + size."""
    # Capitalize first letter of each segment
    parts = name.replace(".", "-").replace("_", "-").split("-")
    pretty = "-".join(p.capitalize() if not p[0].isdigit() else p for p in parts if p)
    if size:
        pretty = f"{pretty}-{size}"
    return f"{org}/{pretty}"


def resolve_hf_slug(
    model_id: str,
    provider: str,
    family: str | None = None,
    extras: dict[str, Any] | None = None,
) -> str | None:
    """Resolve a provider model ID to a HuggingFace repo slug.

    Returns None if the model cannot be mapped (e.g., proprietary Claude models).
    """
    extras = extras or {}

    # Claude models are proprietary — no HF page
    if provider == "claude":
        return None

    # vLLM typically uses the HF repo slug directly
    if provider == "vllm":
        if "/" in model_id:
            return model_id
        # Try family-based lookup
        if family:
            org = _find_org(family.lower())
            if org:
                return _build_hf_slug(org, model_id, None)
        return None

    # Ollama: parse tag name
    if provider == "ollama":
        name, size = _normalize_ollama_name(model_id)
        org = _find_org(name.lower())
        if org:
            return _build_hf_slug(org, name, size)
        # Try family field
        if family:
            org = _find_org(family.lower())
            if org:
                return _build_hf_slug(org, family, size)
        return None

    # KoboldCpp: parse GGUF filename
    if provider == "koboldcpp":
        filename = extras.get("gguf_file") or model_id
        # Strip .gguf extension and quant suffix
        base = re.sub(r"\.gguf$", "", filename, flags=re.IGNORECASE)
        base = _QUANT_PATTERN.sub("", base).rstrip("-_")
        # Check if it already contains a slash (full HF path)
        if "/" in base:
            return base
        org = _find_org(base.lower())
        if org:
            return f"{org}/{base}"
        return None

    # Generic OpenAI-compatible
    if "/" in model_id:
        return model_id
    if family:
        org = _find_org(family.lower())
        if org:
            return _build_hf_slug(org, model_id, None)
    org = _find_org(model_id.lower())
    if org:
        return _build_hf_slug(org, model_id, None)
    return None


# ---------------------------------------------------------------------------
# HF API fetcher
# ---------------------------------------------------------------------------


async def fetch_hf_info(
    session: aiohttp.ClientSession,
    repo_slug: str,
) -> HfModelInfo:
    """Fetch model metadata from HuggingFace API."""
    url = f"https://huggingface.co/api/models/{repo_slug}"
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=_HF_TIMEOUT)) as resp:
            if resp.status == 404:
                return HfModelInfo(
                    hf_repo=repo_slug,
                    status="not_found",
                    fetched_at=time.time(),
                )
            if resp.status != 200:
                return HfModelInfo(
                    hf_repo=repo_slug,
                    status="error",
                    fetched_at=time.time(),
                )
            data = await resp.json()
    except Exception as err:
        _LOGGER.debug("HF API error for %s: %s", repo_slug, err)
        return HfModelInfo(
            hf_repo=repo_slug,
            status="error",
            fetched_at=time.time(),
        )

    # Extract fields
    tags = data.get("tags", [])
    card_data = data.get("cardData") or {}
    author = data.get("author", "")

    # Description: prefer cardData.model_summary, else first paragraph of model card
    description = ""
    if card_data.get("model_summary"):
        description = card_data["model_summary"]

    # License from tags
    license_str = ""
    for tag in tags:
        if tag.startswith("license:"):
            license_str = tag.split(":", 1)[1]
            break

    # Model type
    model_type = "MoE" if any("moe" in t.lower() for t in tags) else "Dense"

    # Pipeline tag
    pipeline_tag = data.get("pipeline_tag", "")

    # Org logo
    logo_url = f"https://huggingface.co/avatars/{author}" if author else ""

    return HfModelInfo(
        hf_repo=repo_slug,
        description=description,
        pipeline_tag=pipeline_tag,
        model_type=model_type,
        tags=tags[:20],  # limit stored tags
        license=license_str,
        author=author,
        last_modified=data.get("lastModified", ""),
        downloads=data.get("downloads", 0),
        likes=data.get("likes", 0),
        logo_url=logo_url,
        card_data={k: card_data[k] for k in list(card_data.keys())[:10]} if card_data else {},
        fetched_at=time.time(),
        status="ok",
    )


# ---------------------------------------------------------------------------
# Cache-aware enrichment orchestrator
# ---------------------------------------------------------------------------


async def enrich_models(
    hass: HomeAssistant,
    entry_id: str,
    models: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Enrich discovered models with HF metadata.

    Returns a dict keyed by "{connection_id}:{model_id}" -> HfModelInfo dict.
    Uses persistent cache with 7-day TTL per HF repo slug.
    """
    domain_data = hass.data.get(DOMAIN, {}).get(entry_id, {})
    hf_data = domain_data.get("hf_enrichment", {"models": {}, "updated_at": 0})
    hf_store = domain_data.get("hf_enrichment_store")
    cache = hf_data.get("models", {})

    now = time.time()
    sem = asyncio.Semaphore(_HF_CONCURRENCY)
    result: dict[str, dict[str, Any]] = {}

    # Build map: unique_key -> (slug, model_dict)
    to_fetch: dict[str, str] = {}  # slug -> first unique_key (for tracking)
    slug_map: dict[str, str | None] = {}  # unique_key -> slug

    for m in models:
        unique_key = f"{m.get('connection_id', '')}:{m.get('id', '')}"
        slug = resolve_hf_slug(
            model_id=m.get("id", ""),
            provider=m.get("provider", "unknown"),
            family=m.get("family"),
            extras=m.get("extras", {}),
        )
        slug_map[unique_key] = slug

        if slug is None:
            # Unmapped (e.g., Claude)
            info = HfModelInfo(status="unmapped", fetched_at=now)
            result[unique_key] = asdict(info)
            continue

        # Check cache
        cached = cache.get(slug)
        if cached and (now - cached.get("fetched_at", 0)) < _CACHE_TTL:
            result[unique_key] = cached
            continue

        # Need to fetch
        to_fetch[slug] = unique_key

    # Fetch missing/stale entries
    if to_fetch:
        async with aiohttp.ClientSession() as session:
            async def _fetch(slug: str) -> tuple[str, HfModelInfo]:
                async with sem:
                    return slug, await fetch_hf_info(session, slug)

            tasks = [_fetch(slug) for slug in to_fetch]
            fetched = await asyncio.gather(*tasks, return_exceptions=True)

        for item in fetched:
            if isinstance(item, Exception):
                _LOGGER.debug("HF fetch error: %s", item)
                continue
            slug, info = item
            info_dict = asdict(info)
            cache[slug] = info_dict

    # Map all results
    for unique_key, slug in slug_map.items():
        if unique_key in result:
            continue  # already set (unmapped or cached)
        if slug and slug in cache:
            result[unique_key] = cache[slug]
        else:
            result[unique_key] = asdict(HfModelInfo(status="error", fetched_at=now))

    # Persist cache
    hf_data["models"] = cache
    hf_data["updated_at"] = now
    if hf_store:
        await hf_store.async_save(hf_data)

    return result
