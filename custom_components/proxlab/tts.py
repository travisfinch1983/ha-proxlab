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
    Voice,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .connection_manager import resolve_connections_to_flat_config
from .const import (
    CONF_CONNECTIONS,
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

# Valid audio extensions for TtsAudioType (HA expects file extension, not MIME)
_VALID_EXTENSIONS = {"mp3", "opus", "aac", "flac", "wav", "pcm"}


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up ProxLab TTS platform from a config entry."""
    config = dict(config_entry.data) | dict(config_entry.options)
    if CONF_CONNECTIONS in config:
        config = resolve_connections_to_flat_config(config)
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
        self._voices: list[Voice] | None = None

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

    @callback
    def async_get_supported_voices(self, language: str) -> list[Voice] | None:
        """Return a list of supported voices for a language."""
        return self._voices

    async def async_added_to_hass(self) -> None:
        """Fetch available voices when entity is added."""
        await self._fetch_voices()

    async def _fetch_voices(self) -> None:
        """Fetch available voices from the TTS server."""
        base_url = self._config.get(CONF_TTS_BASE_URL, "").rstrip("/")
        if not base_url:
            return
        try:
            session = await self._ensure_session()
            async with session.get(f"{base_url}/voices", timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    voice_list = data.get("voices", [])
                    self._voices = [
                        Voice(
                            voice_id=v["id"] if isinstance(v, dict) else v,
                            name=v["id"] if isinstance(v, dict) else v,
                        )
                        for v in voice_list
                    ]
                    _LOGGER.debug("Fetched %d TTS voices", len(self._voices))
                else:
                    _LOGGER.debug("TTS voices endpoint returned %d", resp.status)
        except Exception as err:
            _LOGGER.debug("Could not fetch TTS voices: %s", err)

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
            Tuple of (extension, audio_bytes) or (None, None) on failure.
        """
        base_url = self._config.get(CONF_TTS_BASE_URL, "").rstrip("/")
        if not base_url:
            _LOGGER.error("TTS base URL not configured")
            return (None, None)

        model = self._config.get(CONF_TTS_MODEL, DEFAULT_TTS_MODEL)
        # Use first server voice as fallback instead of OpenAI default
        default_voice = DEFAULT_TTS_VOICE
        if self._voices:
            default_voice = self._voices[0].voice_id
        voice = (options or {}).get("voice") or self._config.get(
            CONF_TTS_VOICE
        ) or default_voice
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
                extension = response_format if response_format in _VALID_EXTENSIONS else "mp3"

                _LOGGER.debug(
                    "TTS generated %d bytes (.%s) for %d chars",
                    len(audio_bytes),
                    extension,
                    len(message),
                )

                return (extension, audio_bytes)

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
