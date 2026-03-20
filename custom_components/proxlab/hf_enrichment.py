"""HuggingFace model enrichment for ProxLab.

Resolves provider model IDs to HuggingFace repo slugs, fetches metadata
from the HF API (including org avatars), and provides on-demand README
fetching and GGUF quant-repo search.  Results cached persistently with
a 7-day TTL.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from dataclasses import asdict, dataclass, field
from typing import Any

import aiohttp

from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

# Cache entry TTL (seconds) — 7 days
_CACHE_TTL = 7 * 24 * 3600

# Org avatar cache TTL — 30 days
_ORG_AVATAR_TTL = 30 * 24 * 3600

# Max concurrent HF API requests
_HF_CONCURRENCY = 3

# HF API timeout (seconds)
_HF_TIMEOUT = 10

# README fetch timeout (seconds)
_README_TIMEOUT = 15

# Max README size to store (characters)
_README_MAX_CHARS = 50_000

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
    "f5-tts": "SWivid", "f5tts": "SWivid",
    "glm": "THUDM", "glm-4": "THUDM",
    "medgemma": "google",
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
    """Resolve a provider model ID to a HuggingFace repo slug."""
    extras = extras or {}

    if provider == "claude":
        return None

    if provider == "vllm":
        if "/" in model_id:
            return model_id
        if family:
            org = _find_org(family.lower())
            if org:
                return _build_hf_slug(org, model_id, None)
        return None

    if provider == "ollama":
        name, size = _normalize_ollama_name(model_id)
        org = _find_org(name.lower())
        if org:
            return _build_hf_slug(org, name, size)
        if family:
            org = _find_org(family.lower())
            if org:
                return _build_hf_slug(org, family, size)
        return None

    if provider == "koboldcpp":
        filename = extras.get("gguf_file") or model_id
        base = re.sub(r"\.gguf$", "", filename, flags=re.IGNORECASE)
        base = _QUANT_PATTERN.sub("", base).rstrip("-_")
        if "/" in base:
            return base
        org = _find_org(base.lower())
        if org:
            return f"{org}/{base}"
        return None

    # Generic OpenAI-compatible
    if "/" in model_id:
        prefix, remainder = model_id.split("/", 1)
        # Only trust slash-separated IDs where prefix is a known HF org
        known_orgs = set(HF_ORG_MAP.values())
        if prefix in known_orgs or (
            any(c.isupper() for c in prefix)
            and any(c.islower() for c in prefix)
            and prefix not in {"koboldcpp", "openai", "lmstudio", "llamacpp"}
        ):
            return model_id
        # Strip the non-HF prefix and resolve the filename portion
        model_id = remainder

    # Clean GGUF filename: strip extension, quant suffixes, split indicator
    cleaned = re.sub(r"\.gguf$", "", model_id, flags=re.IGNORECASE)
    cleaned = _QUANT_PATTERN.sub("", cleaned).rstrip("-_")
    cleaned = re.sub(r"-\d{5}-of-\d{5}$", "", cleaned).rstrip("-_")

    if family:
        org = _find_org(family.lower())
        if org:
            return _build_hf_slug(org, cleaned, None)
    org = _find_org(cleaned.lower())
    if org:
        return _build_hf_slug(org, cleaned, None)
    return None


# ---------------------------------------------------------------------------
# Org avatar fetcher (cached per-org)
# ---------------------------------------------------------------------------

# In-memory org avatar cache: {org_name: {"url": str, "fetched_at": float}}
_org_avatar_cache: dict[str, dict[str, Any]] = {}


async def _fetch_org_avatar(
    session: aiohttp.ClientSession,
    author: str,
) -> str:
    """Fetch org/user avatar URL from HuggingFace API."""
    if not author:
        return ""

    # Check in-memory cache
    cached = _org_avatar_cache.get(author)
    if cached and (time.time() - cached.get("fetched_at", 0)) < _ORG_AVATAR_TTL:
        return cached["url"]

    # Try organization endpoint first, then user endpoint (both need /overview)
    for endpoint in (
        f"https://huggingface.co/api/organizations/{author}/overview",
        f"https://huggingface.co/api/users/{author}/overview",
    ):
        try:
            async with session.get(
                endpoint, timeout=aiohttp.ClientTimeout(total=5)
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    avatar = data.get("avatarUrl", "")
                    if avatar:
                        _org_avatar_cache[author] = {
                            "url": avatar,
                            "fetched_at": time.time(),
                        }
                        return avatar
        except Exception:
            continue

    # Cache the miss too
    _org_avatar_cache[author] = {"url": "", "fetched_at": time.time()}
    return ""


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

    tags = data.get("tags", [])
    card_data = data.get("cardData") or {}
    author = data.get("author", "")

    # Description from cardData
    description = card_data.get("model_summary", "")

    # License from tags
    license_str = ""
    for tag in tags:
        if tag.startswith("license:"):
            license_str = tag.split(":", 1)[1]
            break

    # Model type
    model_type = "MoE" if any("moe" in t.lower() for t in tags) else "Dense"

    # Org avatar
    logo_url = await _fetch_org_avatar(session, author)

    return HfModelInfo(
        hf_repo=repo_slug,
        description=description,
        pipeline_tag=data.get("pipeline_tag", ""),
        model_type=model_type,
        tags=tags[:20],
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
# README fetcher (on-demand, not cached in persistent store)
# ---------------------------------------------------------------------------


def _strip_yaml_frontmatter(text: str) -> str:
    """Strip YAML frontmatter (---...---) from README content."""
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            text = text[end + 3:].lstrip("\n")
    return text


async def fetch_readme(
    session: aiohttp.ClientSession,
    repo_slug: str,
) -> str:
    """Fetch README.md content from a HuggingFace repo."""
    url = f"https://huggingface.co/{repo_slug}/raw/main/README.md"
    try:
        async with session.get(
            url, timeout=aiohttp.ClientTimeout(total=_README_TIMEOUT)
        ) as resp:
            if resp.status != 200:
                return ""
            text = await resp.text()
            text = _strip_yaml_frontmatter(text)
            return text[:_README_MAX_CHARS]
    except Exception as err:
        _LOGGER.debug("README fetch error for %s: %s", repo_slug, err)
        return ""


# ---------------------------------------------------------------------------
# GGUF quant-repo search
# ---------------------------------------------------------------------------


async def search_gguf_repo(
    session: aiohttp.ClientSession,
    model_name: str,
) -> str | None:
    """Search HuggingFace for a GGUF repo matching the model name.

    Returns the best-matching repo slug, or None.
    """
    # Build search query: strip common suffixes, add -GGUF
    search_name = re.sub(r"[-_](?:instruct|chat|base)$", "", model_name, flags=re.IGNORECASE)
    search_query = f"{search_name}-GGUF"

    url = "https://huggingface.co/api/models"
    params = {
        "search": search_query,
        "filter": "gguf",
        "sort": "likes",
        "direction": "-1",
        "limit": "5",
    }
    try:
        async with session.get(
            url, params=params, timeout=aiohttp.ClientTimeout(total=_HF_TIMEOUT)
        ) as resp:
            if resp.status != 200:
                return None
            results = await resp.json()
    except Exception as err:
        _LOGGER.debug("GGUF search error for %s: %s", search_query, err)
        return None

    if not results:
        return None

    # Prefer exact match (contains the model name in the repo ID)
    name_lower = model_name.lower().replace(".", "-")
    for r in results:
        rid = r.get("_id", r.get("id", "")).lower()
        if name_lower in rid and "gguf" in rid:
            return r.get("id", r.get("_id"))

    # Fall back to first result
    return results[0].get("id", results[0].get("_id"))


# ---------------------------------------------------------------------------
# HuggingFace search fallback for unmapped models
# ---------------------------------------------------------------------------

# Minimum token-overlap score to accept a search result
_SEARCH_MIN_SCORE = 0.5


def _clean_model_name_for_search(
    model_id: str, provider: str, extras: dict | None = None
) -> str:
    """Extract a clean, searchable model name from a raw provider ID."""
    extras = extras or {}

    # For KoboldCpp, prefer the GGUF filename
    if provider == "koboldcpp":
        name = extras.get("gguf_file") or model_id
    else:
        name = model_id

    # Strip provider prefixes like "koboldcpp/"
    if "/" in name:
        prefix, rest = name.split("/", 1)
        if prefix.lower() in ("koboldcpp", "openai", "lmstudio", "llamacpp"):
            name = rest

    # Strip .gguf extension
    name = re.sub(r"\.gguf$", "", name, flags=re.IGNORECASE)
    # Strip quant suffixes (Q4_K_M, IQ4_XS, F16, etc.)
    name = _QUANT_PATTERN.sub("", name).rstrip("-_")
    # Strip split indicators (-00001-of-00003)
    name = re.sub(r"-\d{5}-of-\d{5}$", "", name).rstrip("-_")

    return name


def _score_search_result(query_name: str, result_id: str) -> float:
    """Score how well a search result matches the query (0.0-1.0)."""
    q_tokens = set(re.split(r"[-_./]", query_name.lower()))
    q_tokens.discard("")
    r_tokens = set(re.split(r"[-_./]", result_id.lower()))
    r_tokens.discard("")

    if not q_tokens:
        return 0.0

    overlap = q_tokens & r_tokens
    query_coverage = len(overlap) / len(q_tokens)
    return query_coverage


async def search_hf_slug(
    session: aiohttp.ClientSession,
    model_id: str,
    provider: str,
    extras: dict | None = None,
) -> str | None:
    """Search HuggingFace API for a model when static resolution fails."""
    clean_name = _clean_model_name_for_search(model_id, provider, extras)
    if not clean_name or len(clean_name) < 3:
        return None

    url = "https://huggingface.co/api/models"
    params = {
        "search": clean_name,
        "sort": "likes",
        "direction": "-1",
        "limit": "5",
    }
    try:
        async with session.get(
            url, params=params, timeout=aiohttp.ClientTimeout(total=_HF_TIMEOUT)
        ) as resp:
            if resp.status != 200:
                return None
            results = await resp.json()
    except Exception as err:
        _LOGGER.debug("HF search error for '%s': %s", clean_name, err)
        return None

    if not results:
        return None

    # Score each result, pick best above threshold
    best_slug = None
    best_score = 0.0
    for r in results:
        rid = r.get("id", r.get("_id", ""))
        if not rid:
            continue
        # Skip GGUF quant repos — we want the base model
        if rid.lower().endswith("-gguf"):
            continue
        score = _score_search_result(clean_name, rid)
        if score > best_score:
            best_score = score
            best_slug = rid

    if best_score >= _SEARCH_MIN_SCORE and best_slug:
        _LOGGER.debug(
            "HF search matched '%s' -> '%s' (score=%.2f)",
            clean_name, best_slug, best_score,
        )
        return best_slug

    return None


# ---------------------------------------------------------------------------
# On-demand README + GGUF info for a single model
# ---------------------------------------------------------------------------


async def fetch_model_readmes(
    hass: HomeAssistant,
    entry_id: str,
    model_id: str,
    provider: str,
    family: str | None = None,
    extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Fetch README content for base model and GGUF quant repo.

    Returns:
        {
            "base_repo": "Qwen/Qwen3-8B",
            "base_readme": "# Qwen3-8B\n...",
            "quant_repo": "bartowski/Qwen3-8B-GGUF" | null,
            "quant_readme": "# ...\n..." | "",
        }
    """
    slug = resolve_hf_slug(model_id, provider, family, extras)

    async with aiohttp.ClientSession() as session:
        # Search fallback if static resolution failed
        if not slug:
            slug = await search_hf_slug(session, model_id, provider, extras)

        if not slug:
            return {
                "base_repo": None,
                "base_readme": "",
                "quant_repo": None,
                "quant_readme": "",
            }

        # Fetch base README
        base_readme = await fetch_readme(session, slug)

        # Search for GGUF quant repo
        # Extract just the model name (after org/)
        base_name = slug.split("/", 1)[1] if "/" in slug else slug
        quant_repo = await search_gguf_repo(session, base_name)

        quant_readme = ""
        if quant_repo and quant_repo != slug:
            quant_readme = await fetch_readme(session, quant_repo)

    return {
        "base_repo": slug,
        "base_readme": base_readme,
        "quant_repo": quant_repo,
        "quant_readme": quant_readme,
    }


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
    """
    domain_data = hass.data.get(DOMAIN, {}).get(entry_id, {})
    hf_data = domain_data.get("hf_enrichment", {"models": {}, "updated_at": 0})
    hf_store = domain_data.get("hf_enrichment_store")
    cache = hf_data.get("models", {})

    now = time.time()
    sem = asyncio.Semaphore(_HF_CONCURRENCY)
    result: dict[str, dict[str, Any]] = {}

    to_fetch: dict[str, str] = {}
    slug_map: dict[str, str | None] = {}

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
            info = HfModelInfo(status="unmapped", fetched_at=now)
            result[unique_key] = asdict(info)
            continue

        cached = cache.get(slug)
        if cached and (now - cached.get("fetched_at", 0)) < _CACHE_TTL:
            # Re-fetch if previously not_found (slug resolution may have improved)
            if cached.get("status") == "not_found":
                to_fetch[slug] = unique_key
                continue
            result[unique_key] = cached
            continue

        to_fetch[slug] = unique_key

    # --- Search fallback for unmapped models ---
    unmapped_keys = [k for k, v in result.items() if v.get("status") == "unmapped"]

    async with aiohttp.ClientSession() as session:
        # Search HF API for unmapped models
        if unmapped_keys:
            for unique_key in unmapped_keys:
                # Check negative cache
                neg_key = f"_search_miss:{unique_key}"
                neg_cached = cache.get(neg_key)
                if neg_cached and (now - neg_cached.get("fetched_at", 0)) < _CACHE_TTL:
                    continue

                # Find the original model dict
                m_data = next(
                    (m for m in models
                     if f"{m.get('connection_id', '')}:{m.get('id', '')}" == unique_key),
                    None,
                )
                if not m_data:
                    continue

                async with sem:
                    found_slug = await search_hf_slug(
                        session,
                        m_data.get("id", ""),
                        m_data.get("provider", "unknown"),
                        m_data.get("extras", {}),
                    )

                if found_slug:
                    slug_map[unique_key] = found_slug
                    if found_slug not in cache or cache[found_slug].get("status") in (
                        "not_found", "error",
                    ):
                        to_fetch[found_slug] = unique_key
                    else:
                        result[unique_key] = cache[found_slug]
                else:
                    cache[neg_key] = {"status": "search_miss", "fetched_at": now}

        # Fetch metadata for all slugs that need it
        if to_fetch:
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

    for unique_key, slug in slug_map.items():
        if unique_key in result:
            # Skip if already resolved (but not if still "unmapped")
            if result[unique_key].get("status") != "unmapped":
                continue
        if slug and slug in cache:
            result[unique_key] = cache[slug]
        elif unique_key not in result:
            result[unique_key] = asdict(HfModelInfo(status="error", fetched_at=now))

    hf_data["models"] = cache
    hf_data["updated_at"] = now
    if hf_store:
        await hf_store.async_save(hf_data)

    return result
