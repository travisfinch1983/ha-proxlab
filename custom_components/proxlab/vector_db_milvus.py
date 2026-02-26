"""Milvus vector database backend for entity embeddings.

Alternative to ChromaDB — connects to a Milvus instance for semantic
search of Home Assistant entities and memory storage.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from collections import OrderedDict
from typing import Any

import aiohttp

from .const import (
    CONF_EMBEDDING_KEEP_ALIVE,
    CONF_MILVUS_COLLECTION,
    CONF_MILVUS_HOST,
    CONF_MILVUS_PORT,
    CONF_VECTOR_DB_EMBEDDING_BASE_URL,
    CONF_VECTOR_DB_EMBEDDING_MODEL,
    DEFAULT_EMBEDDING_KEEP_ALIVE,
    DEFAULT_MILVUS_COLLECTION,
    DEFAULT_MILVUS_HOST,
    DEFAULT_MILVUS_PORT,
    DEFAULT_VECTOR_DB_EMBEDDING_BASE_URL,
    DEFAULT_VECTOR_DB_EMBEDDING_MODEL,
)
from .exceptions import ContextInjectionError

# Conditional import for pymilvus
try:
    from pymilvus import (
        Collection,
        CollectionSchema,
        DataType,
        FieldSchema,
        MilvusClient,
        connections,
        utility,
    )

    MILVUS_AVAILABLE = True
except ImportError:
    MILVUS_AVAILABLE = False

_LOGGER = logging.getLogger(__name__)

# Embedding config
EMBEDDING_CACHE_MAX_SIZE = 1000
EMBEDDING_DIM = 4096  # qwen3-embedding:8b dimension


class MilvusVectorDB:
    """Milvus vector database backend.

    Implements the same interface as the ChromaDB VectorDBManager
    but stores embeddings in Milvus instead.
    """

    def __init__(self, hass: Any, config: dict[str, Any]) -> None:
        """Initialize Milvus backend.

        Args:
            hass: Home Assistant instance.
            config: Configuration dictionary.
        """
        if not MILVUS_AVAILABLE:
            raise ContextInjectionError(
                "pymilvus not installed. Install with: pip install pymilvus"
            )

        self.hass = hass
        self.config = config

        self.host = config.get(CONF_MILVUS_HOST, DEFAULT_MILVUS_HOST)
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

        self._collection: Any | None = None
        self._embedding_cache: OrderedDict[str, list[float]] = OrderedDict()
        self._aiohttp_session: aiohttp.ClientSession | None = None
        self._connected = False

        _LOGGER.info(
            "Milvus backend initialized (host=%s:%s, collection=%s)",
            self.host,
            self.port,
            self.collection_name,
        )

    async def async_setup(self) -> None:
        """Connect to Milvus and ensure collection exists."""
        try:
            await self.hass.async_add_executor_job(self._connect_and_init)
            _LOGGER.info("Milvus backend setup complete")
        except Exception as err:
            _LOGGER.error("Failed to set up Milvus backend: %s", err)
            raise ContextInjectionError(f"Milvus setup failed: {err}") from err

    def _connect_and_init(self) -> None:
        """Connect to Milvus and create collection if needed (sync, runs in executor)."""
        alias = f"proxlab_{self.host}_{self.port}"

        connections.connect(
            alias=alias,
            host=self.host,
            port=self.port,
            timeout=10,
        )

        if not utility.has_collection(self.collection_name, using=alias):
            _LOGGER.info("Creating Milvus collection: %s", self.collection_name)
            fields = [
                FieldSchema(
                    name="id",
                    dtype=DataType.VARCHAR,
                    is_primary=True,
                    max_length=256,
                ),
                FieldSchema(
                    name="text",
                    dtype=DataType.VARCHAR,
                    max_length=4096,
                ),
                FieldSchema(
                    name="embedding",
                    dtype=DataType.FLOAT_VECTOR,
                    dim=EMBEDDING_DIM,
                ),
                FieldSchema(
                    name="metadata",
                    dtype=DataType.JSON,
                ),
            ]
            schema = CollectionSchema(
                fields=fields,
                description="ProxLab entity embeddings",
            )
            self._collection = Collection(
                name=self.collection_name,
                schema=schema,
                using=alias,
            )
            # Create IVF_FLAT index for similarity search
            index_params = {
                "metric_type": "L2",
                "index_type": "IVF_FLAT",
                "params": {"nlist": 128},
            }
            self._collection.create_index("embedding", index_params)
            _LOGGER.info("Created Milvus collection with IVF_FLAT index")
        else:
            self._collection = Collection(
                name=self.collection_name, using=alias
            )

        # Load collection into memory for searching
        self._collection.load()
        self._connected = True

    async def async_shutdown(self) -> None:
        """Shut down Milvus connection."""
        if self._aiohttp_session and not self._aiohttp_session.closed:
            await self._aiohttp_session.close()
            self._aiohttp_session = None

        if self._collection is not None:
            try:
                await self.hass.async_add_executor_job(self._collection.release)
            except Exception:
                pass

        self._embedding_cache.clear()
        self._connected = False
        _LOGGER.info("Milvus backend shut down")

    async def async_index_entity(self, entity_id: str) -> None:
        """Index a single entity.

        Args:
            entity_id: The HA entity ID to index.
        """
        if not self._connected or self._collection is None:
            raise ContextInjectionError("Milvus not connected")

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

        collection = self._collection

        # Upsert: delete existing, then insert
        await self.hass.async_add_executor_job(
            lambda: collection.delete(expr=f'id == "{entity_id}"')
        )
        await self.hass.async_add_executor_job(
            lambda: collection.insert([
                [entity_id],
                [text[:4096]],
                [embedding],
                [metadata],
            ])
        )

        _LOGGER.debug("Milvus indexed entity: %s", entity_id)

    async def async_remove_entity(self, entity_id: str) -> None:
        """Remove an entity from the index."""
        if not self._connected or self._collection is None:
            return

        collection = self._collection
        await self.hass.async_add_executor_job(
            lambda: collection.delete(expr=f'id == "{entity_id}"')
        )

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
        if not self._connected or self._collection is None:
            return []

        embedding = await self._embed_text(query)

        collection = self._collection

        def _search() -> list[dict[str, Any]]:
            results = collection.search(
                data=[embedding],
                anns_field="embedding",
                param={"metric_type": "L2", "params": {"nprobe": 16}},
                limit=top_k,
                output_fields=["id", "text", "metadata"],
            )

            hits = []
            for hit in results[0]:
                if hit.distance <= threshold:
                    hits.append({
                        "entity_id": hit.id,
                        "text": hit.entity.get("text", ""),
                        "metadata": hit.entity.get("metadata", {}),
                        "distance": hit.distance,
                    })
            return hits

        return await self.hass.async_add_executor_job(_search)

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

    async def _embed_text(self, text: str) -> list[float]:
        """Embed text using Ollama embeddings API.

        Args:
            text: Text to embed.

        Returns:
            Embedding vector of dimension EMBEDDING_DIM.
        """
        cache_key = hashlib.md5(text.encode()).hexdigest()
        if cache_key in self._embedding_cache:
            self._embedding_cache.move_to_end(cache_key)
            return self._embedding_cache[cache_key]

        url = f"{self.embedding_base_url.rstrip('/')}/api/embeddings"
        payload = {
            "model": self.embedding_model,
            "prompt": text,
            "keep_alive": self.config.get(
                CONF_EMBEDDING_KEEP_ALIVE, DEFAULT_EMBEDDING_KEEP_ALIVE
            ),
        }

        try:
            session = await self._ensure_aiohttp_session()
            async with session.post(url, json=payload) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise ContextInjectionError(
                        f"Ollama embedding error {response.status}: {error_text}"
                    )
                result = await response.json()
                embedding: list[float] = result["embedding"]
        except aiohttp.ClientError as err:
            raise ContextInjectionError(
                f"Failed to get embedding from Ollama: {err}"
            ) from err

        self._embedding_cache[cache_key] = embedding
        while len(self._embedding_cache) > EMBEDDING_CACHE_MAX_SIZE:
            self._embedding_cache.popitem(last=False)

        return embedding

    async def _ensure_aiohttp_session(self) -> aiohttp.ClientSession:
        """Ensure aiohttp session exists."""
        if self._aiohttp_session is None or self._aiohttp_session.closed:
            self._aiohttp_session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self._aiohttp_session

    # --- Per-card collection methods ---

    async def create_card_collection(self, card_id: str) -> str:
        """Create a dedicated Milvus collection for a chat card.

        Returns the collection name.
        """
        collection_name = f"proxlab_card_{card_id.replace('-', '_')}"
        await self.hass.async_add_executor_job(
            self._init_card_collection, collection_name
        )
        return collection_name

    def _init_card_collection(self, collection_name: str) -> None:
        """Create card collection (sync, runs in executor)."""
        alias = f"proxlab_{self.host}_{self.port}"

        if not utility.has_collection(collection_name, using=alias):
            _LOGGER.info("Creating card Milvus collection: %s", collection_name)
            fields = [
                FieldSchema(
                    name="id",
                    dtype=DataType.VARCHAR,
                    is_primary=True,
                    max_length=256,
                ),
                FieldSchema(
                    name="text",
                    dtype=DataType.VARCHAR,
                    max_length=8192,
                ),
                FieldSchema(
                    name="embedding",
                    dtype=DataType.FLOAT_VECTOR,
                    dim=EMBEDDING_DIM,
                ),
                FieldSchema(
                    name="metadata",
                    dtype=DataType.JSON,
                ),
            ]
            schema = CollectionSchema(
                fields=fields,
                description=f"ProxLab chat card embeddings ({collection_name})",
            )
            col = Collection(
                name=collection_name,
                schema=schema,
                using=alias,
            )
            index_params = {
                "metric_type": "L2",
                "index_type": "IVF_FLAT",
                "params": {"nlist": 128},
            }
            col.create_index("embedding", index_params)
            col.load()

    async def store_card_embedding(
        self, collection_name: str, text: str, metadata: dict[str, Any]
    ) -> None:
        """Store a text embedding in a card's dedicated collection."""
        embedding = await self._embed_text(text)
        doc_id = hashlib.md5(text.encode()).hexdigest()

        def _insert() -> None:
            alias = f"proxlab_{self.host}_{self.port}"
            col = Collection(name=collection_name, using=alias)
            col.upsert([
                [doc_id],
                [text[:8192]],
                [embedding],
                [metadata],
            ])

        await self.hass.async_add_executor_job(_insert)

    async def search_card_collection(
        self, collection_name: str, query: str, top_k: int = 5
    ) -> list[dict[str, Any]]:
        """Search a card's dedicated collection for similar text."""
        query_embedding = await self._embed_text(query)

        def _search() -> list[dict[str, Any]]:
            alias = f"proxlab_{self.host}_{self.port}"
            if not utility.has_collection(collection_name, using=alias):
                return []
            col = Collection(name=collection_name, using=alias)
            col.load()
            results = col.search(
                data=[query_embedding],
                anns_field="embedding",
                param={"metric_type": "L2", "params": {"nprobe": 16}},
                limit=top_k,
                output_fields=["text", "metadata"],
            )
            hits: list[dict[str, Any]] = []
            for hit in results[0]:
                hits.append({
                    "text": hit.entity.get("text", ""),
                    "metadata": hit.entity.get("metadata", {}),
                    "distance": hit.distance,
                })
            return hits

        return await self.hass.async_add_executor_job(_search)
