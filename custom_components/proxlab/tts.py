"""ProxLab TTS platform — OpenAI-compatible text-to-speech.

Calls POST {base_url}/audio/speech with the OpenAI TTS API format
and returns raw audio bytes to Home Assistant's voice pipeline.
"""

from __future__ import annotations

import logging
from typing import Any

import aiohttp
from homeassistant.components.tts import (
    TextToSpeechEntity,
    TtsAudioType,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    CONF_TTS_BASE_URL,
    CONF_TTS_MODEL,
    CONF_TTS_VOICE,
    CONF_TTS_SPEED,
    CONF_TTS_FORMAT,
    DEFAULT_TTS_MODEL,
    DEFAULT_TTS_VOICE,
    DEFAULT_TTS_SPEED,
    DEFAULT_TTS_FORMAT,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)

# Map response_format to MIME type
_FORMAT_TO_CONTENT_TYPE = {
    "mp3": "audio/mpeg",
    "opus": "audio/ogg",
    "aac": "audio/aac",
    "flac": "audio/flac",
    "wav": "audio/wav",
    "pcm": "audio/pcm",
}


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up ProxLab TTS platform from a config entry."""
    config = dict(config_entry.data) | dict(config_entry.options)
    tts_base_url = config.get(CONF_TTS_BASE_URL)

    if not tts_base_url:
        _LOGGER.debug("TTS base URL not configured, skipping TTS platform setup")
        return

    async_add_entities([ProxLabTTSEntity(hass, config_entry, config)])


class ProxLabTTSEntity(TextToSpeechEntity):
    """ProxLab TTS entity using OpenAI-compatible speech API."""

    _attr_has_entity_name = True
    _attr_name = "ProxLab TTS"

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: ConfigEntry,
        config: dict[str, Any],
    ) -> None:
        """Initialize the TTS entity."""
        self.hass = hass
        self._config = config
        self._attr_unique_id = f"{config_entry.entry_id}_tts"
        self._session: aiohttp.ClientSession | None = None

    @property
    def default_language(self) -> str:
        """Return the default language."""
        return "en"

    @property
    def supported_languages(self) -> list[str]:
        """Return list of supported languages."""
        # OpenAI TTS supports many languages; the model auto-detects
        return [
            "en", "es", "fr", "de", "it", "pt", "nl", "pl", "ru", "zh",
            "ja", "ko", "ar", "hi", "tr", "sv", "da", "no", "fi",
        ]

    @property
    def supported_options(self) -> list[str]:
        """Return list of supported options."""
        return ["voice", "speed"]

    async def _ensure_session(self) -> aiohttp.ClientSession:
        """Ensure aiohttp session is available."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self._session

    async def async_get_tts_audio(
        self,
        message: str,
        language: str,
        options: dict[str, Any] | None = None,
    ) -> TtsAudioType:
        """Generate TTS audio from text using OpenAI-compatible API.

        Args:
            message: Text to convert to speech.
            language: Language code.
            options: Additional options (voice, speed).

        Returns:
            Tuple of (content_type, audio_bytes) or (None, None) on failure.
        """
        base_url = self._config.get(CONF_TTS_BASE_URL, "").rstrip("/")
        if not base_url:
            _LOGGER.error("TTS base URL not configured")
            return (None, None)

        model = self._config.get(CONF_TTS_MODEL, DEFAULT_TTS_MODEL)
        voice = (options or {}).get(
            "voice", self._config.get(CONF_TTS_VOICE, DEFAULT_TTS_VOICE)
        )
        speed = float(
            (options or {}).get(
                "speed", self._config.get(CONF_TTS_SPEED, DEFAULT_TTS_SPEED)
            )
        )
        response_format = self._config.get(CONF_TTS_FORMAT, DEFAULT_TTS_FORMAT)

        url = f"{base_url}/audio/speech"
        payload = {
            "model": model,
            "input": message,
            "voice": voice,
            "speed": speed,
            "response_format": response_format,
        }

        try:
            session = await self._ensure_session()
            async with session.post(url, json=payload) as response:
                if response.status != 200:
                    error_text = await response.text()
                    _LOGGER.error(
                        "TTS API error %d: %s", response.status, error_text
                    )
                    return (None, None)

                audio_bytes = await response.read()
                content_type = _FORMAT_TO_CONTENT_TYPE.get(
                    response_format, "audio/mpeg"
                )

                _LOGGER.debug(
                    "TTS generated %d bytes (%s) for %d chars",
                    len(audio_bytes),
                    content_type,
                    len(message),
                )

                return (content_type, audio_bytes)

        except aiohttp.ClientError as err:
            _LOGGER.error("TTS connection error: %s", err)
            return (None, None)
        except Exception as err:
            _LOGGER.error("TTS unexpected error: %s", err)
            return (None, None)

    async def async_will_remove_from_hass(self) -> None:
        """Clean up when entity is removed."""
        if self._session and not self._session.closed:
            await self._session.close()
