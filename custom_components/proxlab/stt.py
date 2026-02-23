"""ProxLab STT platform — OpenAI-compatible speech-to-text.

Calls POST {base_url}/audio/transcriptions with multipart form data
(Whisper API format) and returns transcribed text.
"""

from __future__ import annotations

import io
import logging
from collections.abc import AsyncIterable
from typing import Any

import aiohttp
from homeassistant.components.stt import (
    AudioBitRates,
    AudioChannels,
    AudioCodecs,
    AudioFormats,
    AudioSampleRates,
    SpeechMetadata,
    SpeechResult,
    SpeechResultState,
    SpeechToTextEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .connection_manager import resolve_connections_to_flat_config
from .const import (
    CONF_CONNECTIONS,
    CONF_STT_BASE_URL,
    CONF_STT_LANGUAGE,
    CONF_STT_MODEL,
    DEFAULT_STT_LANGUAGE,
    DEFAULT_STT_MODEL,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up ProxLab STT platform from a config entry."""
    config = dict(config_entry.data) | dict(config_entry.options)
    if CONF_CONNECTIONS in config:
        config = resolve_connections_to_flat_config(config)
    stt_base_url = config.get(CONF_STT_BASE_URL)

    if not stt_base_url:
        _LOGGER.debug("STT base URL not configured, skipping STT platform setup")
        return

    async_add_entities([ProxLabSTTEntity(hass, config_entry, config)])


class ProxLabSTTEntity(SpeechToTextEntity):
    """ProxLab STT entity using OpenAI-compatible transcription API."""

    _attr_has_entity_name = True
    _attr_name = "ProxLab STT"

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: ConfigEntry,
        config: dict[str, Any],
    ) -> None:
        """Initialize the STT entity."""
        self.hass = hass
        self._config = config
        self._attr_unique_id = f"{config_entry.entry_id}_stt"
        self._session: aiohttp.ClientSession | None = None

    @property
    def supported_languages(self) -> list[str]:
        """Return list of supported languages."""
        return [
            "en", "es", "fr", "de", "it", "pt", "nl", "pl", "ru", "zh",
            "ja", "ko", "ar", "hi", "tr", "sv", "da", "no", "fi",
        ]

    @property
    def supported_formats(self) -> list[AudioFormats]:
        """Return list of supported audio formats."""
        return [AudioFormats.WAV, AudioFormats.OGG]

    @property
    def supported_codecs(self) -> list[AudioCodecs]:
        """Return list of supported audio codecs."""
        return [AudioCodecs.PCM, AudioCodecs.OPUS]

    @property
    def supported_bit_rates(self) -> list[AudioBitRates]:
        """Return list of supported bit rates."""
        return [AudioBitRates.BITRATE_16]

    @property
    def supported_sample_rates(self) -> list[AudioSampleRates]:
        """Return list of supported sample rates."""
        return [AudioSampleRates.SAMPLERATE_16000]

    @property
    def supported_channels(self) -> list[AudioChannels]:
        """Return list of supported channels."""
        return [AudioChannels.CHANNEL_MONO]

    async def _ensure_session(self) -> aiohttp.ClientSession:
        """Ensure aiohttp session is available."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self._session

    async def async_process_audio_stream(
        self,
        metadata: SpeechMetadata,
        stream: AsyncIterable[bytes],
    ) -> SpeechResult:
        """Process audio stream and return transcription.

        Collects all audio chunks, then sends as a single multipart request
        to the OpenAI-compatible /audio/transcriptions endpoint.

        Args:
            metadata: Audio stream metadata.
            stream: Async iterable of audio bytes.

        Returns:
            SpeechResult with transcribed text or error state.
        """
        base_url = self._config.get(CONF_STT_BASE_URL, "").rstrip("/")
        if not base_url:
            _LOGGER.error("STT base URL not configured")
            return SpeechResult("", SpeechResultState.ERROR)

        model = self._config.get(CONF_STT_MODEL, DEFAULT_STT_MODEL)
        language = self._config.get(CONF_STT_LANGUAGE, DEFAULT_STT_LANGUAGE)

        # Collect audio chunks into buffer
        audio_buffer = io.BytesIO()
        async for chunk in stream:
            audio_buffer.write(chunk)
        audio_buffer.seek(0)

        audio_size = audio_buffer.getbuffer().nbytes
        if audio_size == 0:
            _LOGGER.warning("Received empty audio stream")
            return SpeechResult("", SpeechResultState.ERROR)

        # Determine file extension from format
        if metadata.format == AudioFormats.WAV:
            filename = "audio.wav"
        elif metadata.format == AudioFormats.OGG:
            filename = "audio.ogg"
        else:
            filename = "audio.wav"

        url = f"{base_url}/audio/transcriptions"

        try:
            session = await self._ensure_session()

            # Build multipart form data
            form = aiohttp.FormData()
            form.add_field(
                "file",
                audio_buffer,
                filename=filename,
                content_type=f"audio/{metadata.format.value}" if hasattr(metadata.format, 'value') else "audio/wav",
            )
            form.add_field("model", model)
            if language:
                form.add_field("language", language)
            form.add_field("response_format", "json")

            async with session.post(url, data=form) as response:
                if response.status != 200:
                    error_text = await response.text()
                    _LOGGER.error(
                        "STT API error %d: %s", response.status, error_text
                    )
                    return SpeechResult("", SpeechResultState.ERROR)

                result = await response.json()
                text = result.get("text", "").strip()

                _LOGGER.debug(
                    "STT transcribed %d bytes of audio to: '%s'",
                    audio_size,
                    text[:100],
                )

                if not text:
                    return SpeechResult("", SpeechResultState.ERROR)

                return SpeechResult(text, SpeechResultState.SUCCESS)

        except aiohttp.ClientError as err:
            _LOGGER.error("STT connection error: %s", err)
            return SpeechResult("", SpeechResultState.ERROR)
        except Exception as err:
            _LOGGER.error("STT unexpected error: %s", err)
            return SpeechResult("", SpeechResultState.ERROR)

    async def async_will_remove_from_hass(self) -> None:
        """Clean up when entity is removed."""
        if self._session and not self._session.closed:
            await self._session.close()
