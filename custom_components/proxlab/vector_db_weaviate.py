"""Weaviate vector database backend for entity embeddings.

Alternative to ChromaDB/Milvus — connects to a Weaviate instance for semantic
search of Home Assistant entities. Weaviate provides built-in vectorization
(text2vec modules), hybrid search, and multi-modal support.
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
    CONF_VECTOR_DB_EMBEDDING_BASE_URL,
    CONF_VECTOR_DB_EMBEDDING_MODEL,
    CONF_WEAVIATE_API_KEY,
    CONF_WEAVIATE_COLLECTION,
    CONF_WEAVIATE_URL,
    DEFAULT_EMBEDDING_KEEP_ALIVE,
    DEFAULT_VECTOR_DB_EMBEDDING_BASE_URL,
    DEFAULT_VECTOR_DB_EMBEDDING_MODEL,
    DEFAULT_WEAVIATE_COLLECTION,
    DEFAULT_WEAVIATE_URL,
)
from .exceptions import ContextInjectionError

_LOGGER = logging.getLogger(__name__)

EMBEDDING_CACHE_MAX_SIZE = 1000
EMBEDDING_DIM = 4096


class WeaviateVectorDB:
    """Weaviate vector database backend.

    Uses Weaviate's REST API v1 directly via aiohttp (no weaviate-client dependency).
    Embeddings are generated externally via Ollama then stored in Weaviate.
    """

    def __init__(self, hass: Any, config: dict[str, Any]) -> None:
        self.hass = hass
        self.config = config

        self.url = config.get(CONF_WEAVIATE_URL, DEFAULT_WEAVIATE_URL).rstrip("/")
        self.api_key = config.get(CONF_WEAVIATE_API_KEY, "")
        self.collection_name = config.get(
            CONF_WEAVIATE_COLLECTION, DEFAULT_WEAVIATE_COLLECTION
        )
        self.embedding_model = config.get(
            CONF_VECTOR_DB_EMBEDDING_MODEL, DEFAULT_VECTOR_DB_EMBEDDING_MODEL
        )
        self.embedding_base_url = config.get(
            CONF_VECTOR_DB_EMBEDDING_BASE_URL, DEFAULT_VECTOR_DB_EMBEDDING_BASE_URL
        )

        self._session: aiohttp.ClientSession | None = None
        self._embedding_cache: OrderedDict[str, list[float]] = OrderedDict()
        self._connected = False

        _LOGGER.info(
            "Weaviate backend initialized (url=%s, collection=%s)",
            self.url,
            self.collection_name,
        )

    def _get_headers(self) -> dict[str, str]:
        """Get request headers including auth if configured."""
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self._session

    async def async_setup(self) -> None:
        """Connect to Weaviate and ensure collection (class) exists."""
        try:
            session = await self._ensure_session()

            # Check Weaviate is reachable
            async with session.get(
                f"{self.url}/v1/meta", headers=self._get_headers()
            ) as resp:
                if resp.status != 200:
                    raise ContextInjectionError(
                        f"Weaviate not reachable: HTTP {resp.status}"
                    )
                meta = await resp.json()
                _LOGGER.info("Connected to Weaviate %s", meta.get("version", "?"))

            # Check if class exists
            async with session.get(
                f"{self.url}/v1/schema/{self.collection_name}",
                headers=self._get_headers(),
            ) as resp:
                if resp.status == 200:
                    _LOGGER.info("Weaviate class '%s' already exists", self.collection_name)
                elif resp.status == 404:
                    await self._create_class(session)
                else:
                    text = await resp.text()
                    raise ContextInjectionError(
                        f"Weaviate schema check failed: {resp.status} {text}"
                    )

            self._connected = True
            _LOGGER.info("Weaviate backend setup complete")
        except ContextInjectionError:
            raise
        except Exception as err:
            _LOGGER.error("Failed to set up Weaviate backend: %s", err)
            raise ContextInjectionError(f"Weaviate setup failed: {err}") from err

    async def _create_class(self, session: aiohttp.ClientSession) -> None:
        """Create the Weaviate class (collection) with schema."""
        class_schema = {
            "class": self.collection_name,
            "description": "ProxLab Home Assistant entity embeddings",
            "vectorizer": "none",  # We supply vectors externally
            "properties": [
                {
                    "name": "entity_id",
                    "dataType": ["text"],
                    "description": "Home Assistant entity ID",
                },
                {
                    "name": "text",
                    "dataType": ["text"],
                    "description": "Entity text representation",
                },
                {
                    "name": "domain",
                    "dataType": ["text"],
                    "description": "Entity domain",
                },
                {
                    "name": "friendly_name",
                    "dataType": ["text"],
                    "description": "Human-friendly entity name",
                },
                {
                    "name": "state",
                    "dataType": ["text"],
                    "description": "Current entity state",
                },
            ],
        }

        async with session.post(
            f"{self.url}/v1/schema",
            json=class_schema,
            headers=self._get_headers(),
        ) as resp:
            if resp.status not in (200, 201):
                text = await resp.text()
                raise ContextInjectionError(
                    f"Failed to create Weaviate class: {resp.status} {text}"
                )
        _LOGGER.info("Created Weaviate class '%s'", self.collection_name)

    async def async_shutdown(self) -> None:
        """Shut down Weaviate connection."""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None
        self._embedding_cache.clear()
        self._connected = False
        _LOGGER.info("Weaviate backend shut down")

    async def async_index_entity(self, entity_id: str) -> None:
        """Index a single entity in Weaviate."""
        if not self._connected:
            raise ContextInjectionError("Weaviate not connected")

        state = self.hass.states.get(entity_id)
        if state is None:
            return

        text = self._create_entity_text(state)
        embedding = await self._embed_text(text)
        session = await self._ensure_session()

        # Delete existing object with this entity_id first
        await self._delete_by_entity_id(session, entity_id)

        # Insert new object with vector
        obj = {
            "class": self.collection_name,
            "properties": {
                "entity_id": entity_id,
                "text": text[:4096],
                "domain": entity_id.split(".")[0],
                "friendly_name": state.attributes.get("friendly_name", entity_id),
                "state": state.state,
            },
            "vector": embedding,
        }

        async with session.post(
            f"{self.url}/v1/objects",
            json=obj,
            headers=self._get_headers(),
        ) as resp:
            if resp.status not in (200, 201):
                text_resp = await resp.text()
                raise ContextInjectionError(
                    f"Weaviate insert failed: {resp.status} {text_resp}"
                )

        _LOGGER.debug("Weaviate indexed entity: %s", entity_id)

    async def _delete_by_entity_id(
        self, session: aiohttp.ClientSession, entity_id: str
    ) -> None:
        """Delete all objects matching an entity_id."""
        # Use batch delete with where filter
        payload = {
            "match": {
                "class": self.collection_name,
                "where": {
                    "path": ["entity_id"],
                    "operator": "Equal",
                    "valueText": entity_id,
                },
            },
        }
        async with session.delete(
            f"{self.url}/v1/batch/objects",
            json=payload,
            headers=self._get_headers(),
        ) as resp:
            if resp.status not in (200, 204):
                _LOGGER.debug("Weaviate delete returned %s", resp.status)

    async def async_remove_entity(self, entity_id: str) -> None:
        """Remove an entity from the index."""
        if not self._connected:
            return
        session = await self._ensure_session()
        await self._delete_by_entity_id(session, entity_id)

    async def async_search(
        self, query: str, top_k: int = 5, threshold: float = 250.0
    ) -> list[dict[str, Any]]:
        """Search for entities similar to query using nearVector.

        Args:
            query: Search query text.
            top_k: Number of results to return.
            threshold: Maximum L2 distance threshold (converted to certainty).

        Returns:
            List of dicts with entity_id, text, metadata, distance.
        """
        if not self._connected:
            return []

        embedding = await self._embed_text(query)
        session = await self._ensure_session()

        # Weaviate uses certainty (0-1) or distance; convert L2 threshold
        # Lower L2 distance = more similar. Certainty = 1 - (distance / 2)
        # For compatibility with Milvus thresholds, we use distance directly
        gql_query = {
            "query": (
                "{"
                f"  Get {{ {self.collection_name}("
                f'    nearVector: {{ vector: {embedding}, certainty: 0.5 }}'
                f"    limit: {top_k}"
                "  ) {"
                "    entity_id text domain friendly_name state"
                "    _additional { distance certainty id }"
                "  }}"
                "}"
            )
        }

        async with session.post(
            f"{self.url}/v1/graphql",
            json=gql_query,
            headers=self._get_headers(),
        ) as resp:
            if resp.status != 200:
                text_resp = await resp.text()
                _LOGGER.error("Weaviate search failed: %s %s", resp.status, text_resp)
                return []
            result = await resp.json()

        hits = []
        data = result.get("data", {}).get("Get", {}).get(self.collection_name, [])

        for obj in data:
            additional = obj.get("_additional", {})
            distance = additional.get("distance", 999)

            # Filter by L2-equivalent threshold
            if distance <= threshold:
                hits.append({
                    "entity_id": obj.get("entity_id", ""),
                    "text": obj.get("text", ""),
                    "metadata": {
                        "entity_id": obj.get("entity_id", ""),
                        "domain": obj.get("domain", ""),
                        "state": obj.get("state", ""),
                        "friendly_name": obj.get("friendly_name", ""),
                    },
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
                    "Failed to index %s in Weaviate: %s", state.entity_id, err
                )
                failed += 1

            if indexed % 50 == 0:
                await asyncio.sleep(0)

        _LOGGER.info(
            "Weaviate reindex: %d indexed, %d failed, %d skipped",
            indexed, failed, skipped,
        )
        return {
            "total": total,
            "indexed": indexed,
            "failed": failed,
            "skipped": skipped,
        }

    def _should_skip_entity(self, entity_id: str) -> bool:
        if entity_id.startswith("group.all_"):
            return True
        if entity_id == "sun.sun":
            return True
        if entity_id.startswith("persistent_notification."):
            return True
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
        """Embed text using Ollama embeddings API."""
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
            session = await self._ensure_session()
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
