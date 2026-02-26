"""Camera vision tool for ProxLab.

Captures a snapshot from a Home Assistant camera entity and sends it
to a vision-capable LLM endpoint for analysis. Returns the LLM's
description/analysis of the image.
"""

from __future__ import annotations

import base64
import logging
from typing import Any

import aiohttp
from homeassistant.core import HomeAssistant

from ..const import DOMAIN
from ..exceptions import ToolExecutionError
from .registry import BaseTool

_LOGGER = logging.getLogger(__name__)


class CameraVisionTool(BaseTool):
    """Tool for analyzing camera snapshots with a vision-capable LLM."""

    def __init__(self, hass: HomeAssistant, config: dict[str, Any]) -> None:
        super().__init__(hass)
        self.config = config

    @property
    def name(self) -> str:
        return "camera_vision"

    @property
    def description(self) -> str:
        return (
            "Capture a snapshot from a Home Assistant camera and analyze it using "
            "a vision-capable LLM. Use this to describe what a camera sees, detect "
            "objects or people, check security footage, or answer questions about "
            "a camera's current view. Requires a camera entity_id and an optional "
            "prompt describing what to look for."
        )

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "entity_id": {
                    "type": "string",
                    "description": (
                        "The camera entity ID to capture from, e.g. 'camera.front_door'"
                    ),
                },
                "prompt": {
                    "type": "string",
                    "description": (
                        "What to analyze or look for in the image. "
                        "Default: 'Describe what you see in this camera image in detail.'"
                    ),
                },
            },
            "required": ["entity_id"],
        }

    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        entity_id = kwargs.get("entity_id", "")
        prompt = kwargs.get(
            "prompt",
            "Describe what you see in this camera image in detail. "
            "Note any people, vehicles, objects, or anomalies.",
        )

        if not entity_id or not entity_id.startswith("camera."):
            raise ToolExecutionError(
                f"Invalid camera entity: {entity_id}. Must start with 'camera.'"
            )

        # Check entity exists
        state = self.hass.states.get(entity_id)
        if state is None:
            raise ToolExecutionError(f"Camera entity not found: {entity_id}")

        try:
            # Get camera snapshot as image bytes
            image_data = await self._get_camera_image(entity_id)
            if not image_data:
                raise ToolExecutionError(
                    f"Failed to get snapshot from {entity_id}"
                )

            # Encode as base64
            image_b64 = base64.b64encode(image_data).decode("utf-8")

            # Find a vision-capable connection
            connection = self._find_vision_connection()
            if not connection:
                return {
                    "success": False,
                    "error": "No vision-capable LLM connection configured. "
                    "Add a connection with 'vision' capability.",
                    "entity_id": entity_id,
                }

            # Send to vision LLM
            analysis = await self._analyze_image(
                connection, image_b64, prompt
            )

            return {
                "success": True,
                "entity_id": entity_id,
                "analysis": analysis,
                "image_size_bytes": len(image_data),
            }

        except ToolExecutionError:
            raise
        except Exception as err:
            _LOGGER.error("Camera vision failed: %s", err, exc_info=True)
            raise ToolExecutionError(
                f"Camera vision analysis failed: {err}"
            ) from err

    async def _get_camera_image(self, entity_id: str) -> bytes | None:
        """Get a camera snapshot image."""
        try:
            from homeassistant.components.camera import async_get_image

            image = await async_get_image(self.hass, entity_id)
            return image.content
        except Exception as err:
            _LOGGER.error("Failed to get camera image: %s", err)
            return None

    def _find_vision_connection(self) -> dict[str, Any] | None:
        """Find a connection with vision capability."""
        domain_data = self.hass.data.get(DOMAIN, {})
        for entry_data in domain_data.values():
            if not isinstance(entry_data, dict):
                continue
            entry = entry_data.get("entry")
            if not entry:
                continue
            connections = dict(entry.options).get("connections", {})
            for conn in connections.values():
                if isinstance(conn, dict):
                    caps = conn.get("capabilities", [])
                    if "vision" in caps:
                        return conn
        return None

    async def _analyze_image(
        self,
        connection: dict[str, Any],
        image_b64: str,
        prompt: str,
    ) -> str:
        """Send image to vision LLM for analysis."""
        base_url = connection.get("base_url", "").rstrip("/")
        api_key = connection.get("api_key", "")
        model = connection.get("model", "")

        if not base_url or not model:
            raise ToolExecutionError(
                "Vision connection missing base_url or model"
            )

        # Build OpenAI-compatible vision request
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_b64}",
                        },
                    },
                ],
            }
        ]

        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": 1024,
        }

        url = f"{base_url}/chat/completions"
        if not url.startswith("http"):
            url = f"https://{url}"

        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=60)
        ) as session:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise ToolExecutionError(
                        f"Vision LLM error {resp.status}: {text[:200]}"
                    )
                result = await resp.json()

        choices = result.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "")
        return "No analysis returned from vision model."
