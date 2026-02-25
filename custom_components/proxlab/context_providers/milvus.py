"""Milvus vector DB context provider for ProxLab.

This module provides semantic search-based context injection using the Milvus
vector database backend. It wraps the MilvusVectorDB instance (created during
integration setup) to perform entity similarity search and format results
for LLM consumption.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from homeassistant.core import HomeAssistant

from ..const import (
    CONF_EMIT_EVENTS,
    CONF_VECTOR_DB_SIMILARITY_THRESHOLD,
    CONF_VECTOR_DB_TOP_K,
    DEFAULT_VECTOR_DB_SIMILARITY_THRESHOLD,
    DEFAULT_VECTOR_DB_TOP_K,
    DOMAIN,
    EVENT_VECTOR_DB_QUERIED,
)
from ..exceptions import ContextInjectionError
from .base import ContextProvider
from .direct import DirectContextProvider

_LOGGER = logging.getLogger(__name__)


class MilvusContextProvider(ContextProvider):
    """Context provider using Milvus for semantic entity search."""

    def __init__(self, hass: HomeAssistant, config: dict[str, Any]) -> None:
        """Initialize the Milvus context provider."""
        super().__init__(hass, config)

        self.top_k = config.get(CONF_VECTOR_DB_TOP_K, DEFAULT_VECTOR_DB_TOP_K)
        self.similarity_threshold = config.get(
            CONF_VECTOR_DB_SIMILARITY_THRESHOLD, DEFAULT_VECTOR_DB_SIMILARITY_THRESHOLD
        )
        self._emit_events = config.get(CONF_EMIT_EVENTS, True)
        self._fallback_provider: DirectContextProvider | None = None
        self._milvus_backend: Any | None = None

        _LOGGER.info("Milvus context provider initialized")

    def _get_milvus_backend(self) -> Any | None:
        """Get the MilvusVectorDB instance from hass.data."""
        if self._milvus_backend is not None:
            return self._milvus_backend

        domain_data = self.hass.data.get(DOMAIN, {})
        for entry_data in domain_data.values():
            if isinstance(entry_data, dict) and "vector_manager" in entry_data:
                manager = entry_data["vector_manager"]
                # Verify it's actually a Milvus backend (not ChromaDB)
                if hasattr(manager, "async_search") and not hasattr(manager, "_client"):
                    self._milvus_backend = manager
                    return manager
        return None

    async def get_context(self, user_input: str) -> str:
        """Get relevant context via Milvus semantic search."""
        try:
            backend = self._get_milvus_backend()
            if backend is None:
                _LOGGER.warning("Milvus backend not available, falling back to direct")
                return await self._fallback_to_direct(user_input)

            # Search Milvus for similar entities
            results = await backend.async_search(
                query=user_input,
                top_k=self.top_k,
                threshold=self.similarity_threshold,
            )

            if not results:
                return "No relevant context found."

            # Build entity context from search results
            entity_ids = [r["entity_id"] for r in results]
            entities = []

            for entity_id in entity_ids:
                try:
                    entity_state = self._get_entity_state(entity_id)
                    if entity_state:
                        entity_state["available_services"] = self._get_entity_services(
                            entity_id
                        )
                        entities.append(entity_state)
                except Exception as err:
                    _LOGGER.warning("Failed to get state for %s: %s", entity_id, err)

            # Fire event for vector DB query
            if self._emit_events:
                try:
                    self.hass.bus.async_fire(
                        EVENT_VECTOR_DB_QUERIED,
                        {
                            "collection": "milvus",
                            "results_count": len(entities),
                            "top_k": self.top_k,
                            "entity_ids": entity_ids,
                        },
                    )
                except Exception as err:
                    _LOGGER.warning("Failed to fire vector DB query event: %s", err)

            if entities:
                return json.dumps(
                    {"entities": entities, "count": len(entities)}, indent=2
                )

            return "No relevant context found."

        except ContextInjectionError:
            return await self._fallback_to_direct(user_input)
        except Exception as err:
            _LOGGER.error("Milvus context retrieval failed: %s", err, exc_info=True)
            return await self._fallback_to_direct(user_input)

    def _get_fallback_provider(self) -> DirectContextProvider:
        """Lazy-initialize fallback direct context provider."""
        if self._fallback_provider is None:
            self._fallback_provider = DirectContextProvider(self.hass, {"entities": []})
        return self._fallback_provider

    async def _fallback_to_direct(self, user_input: str) -> str:
        """Fall back to direct context when Milvus fails."""
        _LOGGER.warning("Falling back to direct context provider")
        fallback = self._get_fallback_provider()
        context = await fallback.get_context(user_input)
        return f"[Fallback mode - Vector DB unavailable]\n{context}" if context else ""

    async def async_shutdown(self) -> None:
        """Clean up resources (Milvus connection managed by __init__.py)."""
        self._milvus_backend = None
