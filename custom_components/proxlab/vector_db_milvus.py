"""Milvus vector database backend for entity embeddings.

Alternative to ChromaDB — connects to a Milvus instance for semantic
search of Home Assistant entities and memory storage.

Uses the Milvus v2 REST API (aiohttp) instead of pymilvus/grpcio to
avoid import deadlocks caused by HA's blocking-call detector
monkey-patching system calls.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from collections import OrderedDict
from typing import Any

import aiohttp

from .const import (
    CANARY_PHRASE,
    CONF_EMBEDDING_KEEP_ALIVE,
    CONF_MILVUS_COLLECTION,
    CONF_MILVUS_HOST,
    CONF_MILVUS_PORT,
    CONF_OPENAI_API_KEY,
    CONF_VECTOR_DB_EMBEDDING_BASE_URL,
    CONF_VECTOR_DB_EMBEDDING_MODEL,
    CONF_VECTOR_DB_EMBEDDING_PROVIDER,
    DEFAULT_EMBEDDING_KEEP_ALIVE,
    DEFAULT_MILVUS_COLLECTION,
    DEFAULT_MILVUS_HOST,
    DEFAULT_MILVUS_PORT,
    DEFAULT_VECTOR_DB_EMBEDDING_BASE_URL,
    DEFAULT_VECTOR_DB_EMBEDDING_MODEL,
    DEFAULT_VECTOR_DB_EMBEDDING_PROVIDER,
    EMBEDDING_PROVIDER_OLLAMA,
    EMBEDDING_PROVIDER_OPENAI,
    ENTITY_COLLECTION_PREFIX,
)
from .exceptions import ContextInjectionError

_LOGGER = logging.getLogger(__name__)

# Embedding config
EMBEDDING_CACHE_MAX_SIZE = 1000
DEFAULT_EMBEDDING_DIM = 4096  # qwen3-embedding:8b dimension


class MilvusVectorDB:
    """Milvus vector database backend.

    Implements the same interface as the ChromaDB VectorDBManager
    but stores embeddings in Milvus instead.

    All Milvus operations use the v2 REST API via aiohttp — no pymilvus
    dependency required.
    """

    def __init__(self, hass: Any, config: dict[str, Any]) -> None:
        """Initialize Milvus backend.

        Args:
            hass: Home Assistant instance.
            config: Configuration dictionary.
        """
        self.hass = hass
        self.config = config

        raw_host = config.get(CONF_MILVUS_HOST, DEFAULT_MILVUS_HOST)
        # Strip scheme prefix — we build REST URLs ourselves
        for prefix in ("http://", "https://"):
            if raw_host.startswith(prefix):
                raw_host = raw_host[len(prefix):]
        self.host = raw_host.rstrip("/")
        self.port = config.get(CONF_MILVUS_PORT, DEFAULT_MILVUS_PORT)
        self.collection_name = config.get(
            CONF_MILVUS_COLLECTION, DEFAULT_MILVUS_COLLECTION
        )
        self.embedding_model = config.get(
            CONF_VECTOR_DB_EMBEDDING_MODEL, DEFAULT_VECTOR_DB_EMBEDDING_MODEL
        )
        self.embedding_base_url = config.get(
            CONF_VECTOR_DB_EMBEDDING_BASE_URL, DEFAULT_VECTOR_DB_EMBEDDING_BASE_URL
        )
        self.embedding_provider = config.get(
            CONF_VECTOR_DB_EMBEDDING_PROVIDER, DEFAULT_VECTOR_DB_EMBEDDING_PROVIDER
        )
        self.openai_api_key = config.get(CONF_OPENAI_API_KEY, "")

        self._embedding_cache: OrderedDict[str, list[float]] = OrderedDict()
        self._aiohttp_session: aiohttp.ClientSession | None = None
        self._connected = False

        # Dynamic embedding dimension and canary fingerprint
        self.embedding_dim: int = DEFAULT_EMBEDDING_DIM
        self._fingerprint: str | None = None
        self._entity_collection_name: str | None = None

        _LOGGER.info(
            "Milvus backend initialized (host=%s:%s, collection=%s, "
            "embedding_provider=%s, model=%s, base_url=%s)",
            self.host,
            self.port,
            self.collection_name,
            self.embedding_provider,
            self.embedding_model,
            self.embedding_base_url,
        )

    # --- REST API helper ---

    async def _milvus_rest(
        self, endpoint: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Call Milvus v2 REST API.

        Args:
            endpoint: REST path, e.g. '/v2/vectordb/collections/has'.
            payload: JSON body.

        Returns:
            Parsed JSON response dict.

        Raises:
            ContextInjectionError: On non-zero response code or HTTP error.
        """
        url = f"http://{self.host}:{self.port}{endpoint}"
        session = await self._ensure_aiohttp_session()
        try:
            async with session.post(url, json=payload) as resp:
                result = await resp.json()
                if result.get("code") != 0:
                    raise ContextInjectionError(
                        f"Milvus API error on {endpoint}: {result}"
                    )
                return result
        except aiohttp.ClientError as err:
            raise ContextInjectionError(
                f"Milvus REST request failed ({endpoint}): {err}"
            ) from err

    # --- Setup / teardown ---

    async def async_setup(self) -> None:
        """Connect to Milvus and ensure collection exists.

        Computes a canary fingerprint to derive a model-specific entity
        collection name.  If the embedding model is unreachable the
        fingerprint is left as None and entity indexing is disabled, but
        Milvus connection proceeds so card collections still work.
        """
        # 1. Compute canary fingerprint (15s timeout)
        try:
            fp, dim = await asyncio.wait_for(
                self._async_compute_canary_fingerprint(), timeout=15.0
            )
            self._fingerprint = fp
            self.embedding_dim = dim
            self._entity_collection_name = f"{ENTITY_COLLECTION_PREFIX}{fp}"
            _LOGGER.info(
                "Canary fingerprint: %s  (dim=%d, collection=%s)",
                fp,
                dim,
                self._entity_collection_name,
            )
        except Exception as err:
            _LOGGER.warning(
                "Could not compute canary fingerprint — entity indexing "
                "disabled until next restart: %s",
                err,
            )
            self._fingerprint = None
            self._entity_collection_name = None

        # 2. Connect to Milvus (entity + card collections) via REST
        try:
            await self._async_connect_and_init()
            _LOGGER.info("Milvus backend setup complete")
        except Exception as err:
            _LOGGER.error("Failed to set up Milvus backend: %s", err)
            raise ContextInjectionError(f"Milvus setup failed: {err}") from err

    async def _async_connect_and_init(self) -> None:
        """Check/create/load the entity collection via Milvus REST API."""
        entity_col_name = self._entity_collection_name or self.collection_name

        # Check if collection exists
        has_result = await self._milvus_rest(
            "/v2/vectordb/collections/has",
            {"collectionName": entity_col_name},
        )
        has_collection = has_result.get("data", {}).get("has", False)

        if not has_collection:
            _LOGGER.info("Creating Milvus collection: %s", entity_col_name)
            await self._milvus_rest(
                "/v2/vectordb/collections/create",
                {
                    "collectionName": entity_col_name,
                    "schema": {
                        "fields": [
                            {
                                "fieldName": "id",
                                "dataType": "VarChar",
                                "isPrimary": True,
                                "elementTypeParams": {"max_length": "256"},
                            },
                            {
                                "fieldName": "text",
                                "dataType": "VarChar",
                                "elementTypeParams": {"max_length": "4096"},
                            },
                            {
                                "fieldName": "embedding",
                                "dataType": "FloatVector",
                                "elementTypeParams": {
                                    "dim": str(self.embedding_dim)
                                },
                            },
                            {
                                "fieldName": "metadata",
                                "dataType": "JSON",
                            },
                        ],
                    },
                    "indexParams": [
                        {
                            "fieldName": "embedding",
                            "indexName": "embedding_idx",
                            "metricType": "L2",
                            "indexType": "IVF_FLAT",
                            "params": {"nlist": 128},
                        },
                    ],
                },
            )
            _LOGGER.info("Created Milvus collection with IVF_FLAT index")

        # Load collection into memory for searching
        await self._milvus_rest(
            "/v2/vectordb/collections/load",
            {"collectionName": entity_col_name},
        )
        self._connected = True

    async def async_shutdown(self) -> None:
        """Shut down Milvus connection."""
        if self._connected:
            entity_col_name = (
                self._entity_collection_name or self.collection_name
            )
            try:
                await self._milvus_rest(
                    "/v2/vectordb/collections/release",
                    {"collectionName": entity_col_name},
                )
            except Exception:
                pass

        if self._aiohttp_session and not self._aiohttp_session.closed:
            await self._aiohttp_session.close()
            self._aiohttp_session = None

        self._embedding_cache.clear()
        self._connected = False
        _LOGGER.info("Milvus backend shut down")

    # --- Entity indexing ---

    async def async_index_entity(self, entity_id: str) -> None:
        """Index a single entity.

        Args:
            entity_id: The HA entity ID to index.
        """
        if not self._connected:
            raise ContextInjectionError("Milvus not connected")
        if self._fingerprint is None:
            raise ContextInjectionError(
                "Entity indexing disabled — embedding model fingerprint unavailable"
            )

        state = self.hass.states.get(entity_id)
        if state is None:
            return

        text = self._create_entity_text(state)
        embedding = await self._embed_text(text)

        metadata = {
            "entity_id": entity_id,
            "domain": entity_id.split(".")[0],
            "state": state.state,
            "friendly_name": state.attributes.get("friendly_name", entity_id),
        }

        entity_col_name = self._entity_collection_name or self.collection_name

        # Upsert via REST (handles insert-or-update in one call)
        await self._milvus_rest(
            "/v2/vectordb/entities/upsert",
            {
                "collectionName": entity_col_name,
                "data": [
                    {
                        "id": entity_id,
                        "text": text[:4096],
                        "embedding": embedding,
                        "metadata": metadata,
                    },
                ],
            },
        )

        _LOGGER.debug("Milvus indexed entity: %s", entity_id)

    async def async_remove_entity(self, entity_id: str) -> None:
        """Remove an entity from the index."""
        if not self._connected:
            return

        entity_col_name = self._entity_collection_name or self.collection_name
        try:
            await self._milvus_rest(
                "/v2/vectordb/entities/delete",
                {
                    "collectionName": entity_col_name,
                    "filter": f'id == "{entity_id}"',
                },
            )
        except Exception:
            pass

    async def async_search(
        self, query: str, top_k: int = 5, threshold: float = 250.0
    ) -> list[dict[str, Any]]:
        """Search for entities similar to query.

        Args:
            query: Search query text.
            top_k: Number of results to return.
            threshold: Maximum L2 distance threshold.

        Returns:
            List of dicts with entity_id, text, metadata, distance.
        """
        if not self._connected:
            return []

        embedding = await self._embed_text(query)

        entity_col_name = self._entity_collection_name or self.collection_name

        result = await self._milvus_rest(
            "/v2/vectordb/entities/search",
            {
                "collectionName": entity_col_name,
                "data": [embedding],
                "annsField": "embedding",
                "limit": top_k,
                "outputFields": ["id", "text", "metadata"],
                "searchParams": {
                    "metric_type": "L2",
                    "params": {"nprobe": 16},
                },
            },
        )

        hits: list[dict[str, Any]] = []
        for item in result.get("data", []):
            distance = item.get("distance", 999.0)
            if distance <= threshold:
                hits.append({
                    "entity_id": item.get("id", ""),
                    "text": item.get("text", ""),
                    "metadata": item.get("metadata", {}),
                    "distance": distance,
                })

        return hits

    async def async_reindex_all_entities(self) -> dict[str, Any]:
        """Reindex all HA entities."""
        all_states = self.hass.states.async_all()
        total = len(all_states)
        indexed = 0
        failed = 0
        skipped = 0

        for state in all_states:
            try:
                if self._should_skip_entity(state.entity_id):
                    skipped += 1
                    continue
                await self.async_index_entity(state.entity_id)
                indexed += 1
            except Exception as err:
                _LOGGER.warning(
                    "Failed to index %s in Milvus: %s", state.entity_id, err
                )
                failed += 1

            # Yield to event loop periodically
            if indexed % 50 == 0:
                await asyncio.sleep(0)

        _LOGGER.info(
            "Milvus reindex: %d indexed, %d failed, %d skipped",
            indexed, failed, skipped,
        )
        return {
            "total": total,
            "indexed": indexed,
            "failed": failed,
            "skipped": skipped,
        }

    def _should_skip_entity(self, entity_id: str) -> bool:
        """Check if entity should be skipped."""
        if entity_id.startswith("group.all_"):
            return True
        if entity_id == "sun.sun":
            return True
        if entity_id.startswith("persistent_notification."):
            return True
        # Try to check exposure, but don't fail if not available
        try:
            from homeassistant.components import conversation as ha_conversation
            from homeassistant.components.homeassistant.exposed_entities import (
                async_should_expose,
            )
            if not async_should_expose(
                self.hass, ha_conversation.DOMAIN, entity_id
            ):
                return True
        except Exception:
            pass
        return False

    def _create_entity_text(self, state: Any) -> str:
        """Create text representation of entity for embedding."""
        entity_id = state.entity_id
        domain = entity_id.split(".")[0]
        friendly_name = state.attributes.get("friendly_name", entity_id)

        parts = [
            f"Entity: {friendly_name} ({entity_id})",
            f"Type: {domain}",
            f"Current state: {state.state}",
        ]

        if domain == "sensor":
            unit = state.attributes.get("unit_of_measurement")
            if unit:
                parts.append(f"Unit: {unit}")
            device_class = state.attributes.get("device_class")
            if device_class:
                parts.append(f"Measures: {device_class}")
        elif domain in ("light", "switch", "fan"):
            parts.append(f"Can be turned {state.state}")
        elif domain == "climate":
            temp = state.attributes.get("current_temperature")
            if temp:
                parts.append(f"Temperature: {temp}")
        elif domain == "cover":
            position = state.attributes.get("current_position")
            if position is not None:
                parts.append(f"Position: {position}%")
        elif domain == "media_player":
            source = state.attributes.get("source")
            if source:
                parts.append(f"Source: {source}")

        area = state.attributes.get("area")
        if area:
            parts.append(f"Location: {area}")

        return " | ".join(parts)

    # --- Embedding ---

    async def _embed_text(self, text: str) -> list[float]:
        """Embed text using the configured embedding provider.

        Supports both OpenAI-compatible and Ollama endpoints.

        Args:
            text: Text to embed.

        Returns:
            Embedding vector.
        """
        cache_key = hashlib.md5(text.encode()).hexdigest()
        if cache_key in self._embedding_cache:
            self._embedding_cache.move_to_end(cache_key)
            return self._embedding_cache[cache_key]

        embedding = await self._call_embedding_api(text)

        self._embedding_cache[cache_key] = embedding
        while len(self._embedding_cache) > EMBEDDING_CACHE_MAX_SIZE:
            self._embedding_cache.popitem(last=False)

        return embedding

    async def _call_embedding_api(self, text: str) -> list[float]:
        """Call the embedding API based on configured provider.

        Args:
            text: Text to embed.

        Returns:
            Embedding vector.
        """
        session = await self._ensure_aiohttp_session()

        if self.embedding_provider == EMBEDDING_PROVIDER_OPENAI:
            return await self._embed_openai(session, text)
        if self.embedding_provider == EMBEDDING_PROVIDER_OLLAMA:
            return await self._embed_ollama(session, text)
        raise ContextInjectionError(
            f"Unknown embedding provider: {self.embedding_provider}"
        )

    async def _embed_openai(
        self, session: aiohttp.ClientSession, text: str
    ) -> list[float]:
        """Embed via OpenAI-compatible /embeddings endpoint."""
        url = f"{self.embedding_base_url.rstrip('/')}/embeddings"
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.openai_api_key:
            headers["Authorization"] = f"Bearer {self.openai_api_key}"
        payload = {"model": self.embedding_model, "input": text}

        try:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    raise ContextInjectionError(
                        f"Embedding API error {resp.status}: {error_text}"
                    )
                result = await resp.json()
                return result["data"][0]["embedding"]
        except aiohttp.ClientError as err:
            raise ContextInjectionError(
                f"Failed to get embedding from {url}: {err}"
            ) from err

    async def _embed_ollama(
        self, session: aiohttp.ClientSession, text: str
    ) -> list[float]:
        """Embed via Ollama /api/embeddings endpoint."""
        url = f"{self.embedding_base_url.rstrip('/')}/api/embeddings"
        payload = {
            "model": self.embedding_model,
            "prompt": text,
            "keep_alive": self.config.get(
                CONF_EMBEDDING_KEEP_ALIVE, DEFAULT_EMBEDDING_KEEP_ALIVE
            ),
        }

        try:
            async with session.post(url, json=payload) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    raise ContextInjectionError(
                        f"Ollama embedding error {resp.status}: {error_text}"
                    )
                result = await resp.json()
                return result["embedding"]
        except aiohttp.ClientError as err:
            raise ContextInjectionError(
                f"Failed to get embedding from Ollama: {err}"
            ) from err

    async def _ensure_aiohttp_session(self) -> aiohttp.ClientSession:
        """Ensure aiohttp session exists."""
        if self._aiohttp_session is None or self._aiohttp_session.closed:
            self._aiohttp_session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self._aiohttp_session

    # --- Canary fingerprint & model info ---

    async def _embed_text_raw(self, text: str) -> list[float]:
        """Embed text WITHOUT caching — used only for canary fingerprint."""
        return await self._call_embedding_api(text)

    async def _async_compute_canary_fingerprint(self) -> tuple[str, int]:
        """Compute a deterministic fingerprint for the current embedding model.

        Returns (fingerprint_hex_12, actual_dimension).
        """
        vec = await self._embed_text_raw(CANARY_PHRASE)
        dim = len(vec)
        # Take first 8 floats, truncate to 6 decimal places
        sample = ",".join(f"{v:.6f}" for v in vec[:8])
        tag = f"{dim}:{sample}"
        fp = hashlib.sha256(tag.encode()).hexdigest()[:12]
        return fp, dim

    @property
    def model_info(self) -> dict[str, Any]:
        """Return model/fingerprint metadata for UI display."""
        return {
            "fingerprint": self._fingerprint,
            "embedding_model": self.embedding_model,
            "embedding_dim": self.embedding_dim,
            "collection_name": self._entity_collection_name or self.collection_name,
            "connected": self._connected,
        }

    # --- Per-card collection methods ---

    async def create_card_collection(self, card_id: str) -> str:
        """Create a dedicated Milvus collection for a chat card.

        Returns the collection name.
        """
        collection_name = f"proxlab_card_{card_id.replace('-', '_')}"
        await self._async_init_card_collection(collection_name)
        return collection_name

    async def _async_init_card_collection(self, collection_name: str) -> None:
        """Create card collection via REST API if it doesn't exist."""
        has_result = await self._milvus_rest(
            "/v2/vectordb/collections/has",
            {"collectionName": collection_name},
        )
        has_collection = has_result.get("data", {}).get("has", False)

        if not has_collection:
            _LOGGER.info("Creating card Milvus collection: %s", collection_name)
            await self._milvus_rest(
                "/v2/vectordb/collections/create",
                {
                    "collectionName": collection_name,
                    "schema": {
                        "fields": [
                            {
                                "fieldName": "id",
                                "dataType": "VarChar",
                                "isPrimary": True,
                                "elementTypeParams": {"max_length": "256"},
                            },
                            {
                                "fieldName": "text",
                                "dataType": "VarChar",
                                "elementTypeParams": {"max_length": "8192"},
                            },
                            {
                                "fieldName": "embedding",
                                "dataType": "FloatVector",
                                "elementTypeParams": {
                                    "dim": str(self.embedding_dim)
                                },
                            },
                            {
                                "fieldName": "metadata",
                                "dataType": "JSON",
                            },
                        ],
                    },
                    "indexParams": [
                        {
                            "fieldName": "embedding",
                            "indexName": "embedding_idx",
                            "metricType": "L2",
                            "indexType": "IVF_FLAT",
                            "params": {"nlist": 128},
                        },
                    ],
                },
            )
            # Load the new collection
            await self._milvus_rest(
                "/v2/vectordb/collections/load",
                {"collectionName": collection_name},
            )

    async def store_card_embedding(
        self, collection_name: str, text: str, metadata: dict[str, Any]
    ) -> None:
        """Store a text embedding in a card's dedicated collection."""
        embedding = await self._embed_text(text)
        doc_id = hashlib.md5(text.encode()).hexdigest()

        await self._milvus_rest(
            "/v2/vectordb/entities/upsert",
            {
                "collectionName": collection_name,
                "data": [
                    {
                        "id": doc_id,
                        "text": text[:8192],
                        "embedding": embedding,
                        "metadata": metadata,
                    },
                ],
            },
        )

    async def search_card_collection(
        self, collection_name: str, query: str, top_k: int = 5
    ) -> list[dict[str, Any]]:
        """Search a card's dedicated collection for similar text."""
        query_embedding = await self._embed_text(query)

        # Check collection exists first
        has_result = await self._milvus_rest(
            "/v2/vectordb/collections/has",
            {"collectionName": collection_name},
        )
        if not has_result.get("data", {}).get("has", False):
            return []

        # Ensure loaded
        await self._milvus_rest(
            "/v2/vectordb/collections/load",
            {"collectionName": collection_name},
        )

        result = await self._milvus_rest(
            "/v2/vectordb/entities/search",
            {
                "collectionName": collection_name,
                "data": [query_embedding],
                "annsField": "embedding",
                "limit": top_k,
                "outputFields": ["text", "metadata"],
                "searchParams": {
                    "metric_type": "L2",
                    "params": {"nprobe": 16},
                },
            },
        )

        hits: list[dict[str, Any]] = []
        for item in result.get("data", []):
            hits.append({
                "text": item.get("text", ""),
                "metadata": item.get("metadata", {}),
                "distance": item.get("distance", 999.0),
            })

        return hits
