"""Image generation tool for ProxLab.

Generates images from text prompts using an image generation API endpoint
(OpenAI DALL-E compatible, Stable Diffusion WebUI, ComfyUI, etc.).
Saves generated images as HA persistent notifications or media files.
"""

from __future__ import annotations

import base64
import logging
import os
import time
from typing import Any

import aiohttp
from homeassistant.core import HomeAssistant

from ..const import DOMAIN
from ..exceptions import ToolExecutionError
from .registry import BaseTool

_LOGGER = logging.getLogger(__name__)


class ImageGenerationTool(BaseTool):
    """Tool for generating images from text prompts."""

    def __init__(self, hass: HomeAssistant, config: dict[str, Any]) -> None:
        super().__init__(hass)
        self.config = config

    @property
    def name(self) -> str:
        return "generate_image"

    @property
    def description(self) -> str:
        return (
            "Generate an image from a text description using an AI image generation "
            "model. The image is saved to /config/www/proxlab/ and a URL is returned "
            "that can be used in HA notifications or dashboards. Requires an image "
            "generation endpoint to be configured in connections with the 'image_gen' "
            "capability."
        )

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "Detailed text description of the image to generate.",
                },
                "negative_prompt": {
                    "type": "string",
                    "description": "What to avoid in the image (optional).",
                },
                "size": {
                    "type": "string",
                    "description": (
                        "Image size. Options: '512x512', '1024x1024', '1024x768'. "
                        "Default: '1024x1024'."
                    ),
                },
                "filename": {
                    "type": "string",
                    "description": (
                        "Optional filename for the saved image (without extension). "
                        "Default: auto-generated timestamp."
                    ),
                },
            },
            "required": ["prompt"],
        }

    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        prompt = kwargs.get("prompt", "")
        negative_prompt = kwargs.get("negative_prompt", "")
        size = kwargs.get("size", "1024x1024")
        filename = kwargs.get("filename", "")

        if not prompt:
            raise ToolExecutionError("prompt is required")

        # Find an image generation connection
        connection = self._find_image_gen_connection()
        if not connection:
            return {
                "success": False,
                "error": "No image generation endpoint configured. "
                "Add a connection with 'image_gen' capability.",
            }

        try:
            image_data = await self._generate_image(
                connection, prompt, negative_prompt, size
            )

            if not image_data:
                return {
                    "success": False,
                    "error": "Image generation returned no data.",
                }

            # Save to /config/www/proxlab/
            file_path, web_url = await self._save_image(
                image_data, filename
            )

            return {
                "success": True,
                "prompt": prompt,
                "file_path": file_path,
                "url": web_url,
                "size": size,
                "image_size_bytes": len(image_data),
            }

        except ToolExecutionError:
            raise
        except Exception as err:
            _LOGGER.error("Image generation failed: %s", err, exc_info=True)
            raise ToolExecutionError(
                f"Image generation failed: {err}"
            ) from err

    def _find_image_gen_connection(self) -> dict[str, Any] | None:
        """Find a connection with image_gen capability."""
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
                    if "image_gen" in caps:
                        return conn
        return None

    async def _generate_image(
        self,
        connection: dict[str, Any],
        prompt: str,
        negative_prompt: str,
        size: str,
    ) -> bytes | None:
        """Call the image generation API."""
        base_url = connection.get("base_url", "").rstrip("/")
        api_key = connection.get("api_key", "")
        model = connection.get("model", "")

        if not base_url:
            raise ToolExecutionError("Image gen connection missing base_url")

        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        # OpenAI DALL-E compatible format
        payload: dict[str, Any] = {
            "prompt": prompt,
            "n": 1,
            "size": size,
            "response_format": "b64_json",
        }
        if model:
            payload["model"] = model
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt

        url = f"{base_url}/images/generations"
        if not url.startswith("http"):
            url = f"https://{url}"

        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=120)
        ) as session:
            async with session.post(url, json=payload, headers=headers) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise ToolExecutionError(
                        f"Image gen error {resp.status}: {text[:200]}"
                    )
                result = await resp.json()

        # Extract image data
        data = result.get("data", [])
        if not data:
            return None

        b64_data = data[0].get("b64_json", "")
        if b64_data:
            return base64.b64decode(b64_data)

        # Some APIs return URL instead
        image_url = data[0].get("url", "")
        if image_url:
            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30)
            ) as session:
                async with session.get(image_url) as resp:
                    if resp.status == 200:
                        return await resp.read()

        return None

    async def _save_image(
        self, image_data: bytes, filename: str
    ) -> tuple[str, str]:
        """Save image to /config/www/proxlab/ and return file path + web URL."""
        output_dir = os.path.join(self.hass.config.config_dir, "www", "proxlab")
        os.makedirs(output_dir, exist_ok=True)

        if not filename:
            filename = f"generated_{int(time.time())}"

        # Ensure safe filename
        filename = "".join(
            c for c in filename if c.isalnum() or c in ("-", "_")
        )

        file_path = os.path.join(output_dir, f"{filename}.png")
        with open(file_path, "wb") as f:
            f.write(image_data)

        web_url = f"/local/proxlab/{filename}.png"

        _LOGGER.info("Image saved to %s", file_path)
        return file_path, web_url
