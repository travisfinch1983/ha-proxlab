# ProxLab (ha-proxlab)

A Home Assistant custom integration that connects HA's voice assistant pipeline to ProxLab-managed LLM/TTS/STT inference servers. Built on top of the hass-agent-llm conversation agent with full tool calling, device control, RAG, long-term memory, and streaming — plus TTS, STT, and ProxLab service discovery.

## Key Features

- **Conversation Agent** — OpenAI-compatible LLM with tool calling for device control (30+ HA entity domains)
- **TTS Platform** — OpenAI-compatible `/v1/audio/speech` text-to-speech
- **STT Platform** — OpenAI-compatible `/v1/audio/transcriptions` speech-to-text (Whisper)
- **ProxLab Discovery** — Auto-discover running LLM/TTS/STT endpoints from ProxLab DV-Lab
- **Vector Database** — ChromaDB or Milvus backends for semantic entity search
- **Long-Term Memory** — Automatic extraction and recall of facts, preferences, and context
- **Streaming Responses** — Low-latency streaming for voice assistant integration
- **Custom Tools** — REST API and HA service tool framework
- **URL Auto-Normalization** — `10.0.0.232:8000` automatically becomes `http://10.0.0.232:8000/v1`
