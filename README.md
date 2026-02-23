# ProxLab (ha-proxlab)

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/travisfinch1983/ha-proxlab)](https://github.com/travisfinch1983/ha-proxlab/releases)

A Home Assistant custom integration that connects HA's voice assistant pipeline to local LLM/TTS/STT inference servers. Full tool calling, device control (30+ domains), RAG via ChromaDB/Milvus, long-term memory, streaming responses, and ProxLab service discovery.

## Installation

### HACS (Recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=travisfinch1983&repository=ha-proxlab&category=integration)

### Manual

1. Clone or download this repository
2. Copy `custom_components/proxlab/` into your Home Assistant `config/custom_components/proxlab/`
3. Restart Home Assistant
4. Add the integration:

[![Open your Home Assistant instance and start setting up a new integration.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=proxlab)

## Features

- **Conversation Agent** — OpenAI-compatible LLM with tool calling for device control
- **TTS Platform** — OpenAI-compatible text-to-speech
- **STT Platform** — OpenAI-compatible speech-to-text (Whisper)
- **Multi-Agent System** — Orchestrator, Conversation, Worker, Memory, Embeddings, and more
- **Connection Pool** — Manage multiple LLM/TTS/STT endpoints with capability-based routing
- **ProxLab Discovery** — Auto-discover running endpoints from ProxLab DV-Lab
- **Vector Database** — ChromaDB or Milvus backends for semantic entity search
- **Long-Term Memory** — Per-user memory extraction and recall with universal access toggle
- **Streaming Responses** — Low-latency streaming for voice assistant integration
- **Custom Tools** — REST API and HA service tool framework
- **URL Auto-Normalization** — `10.0.0.232:8000` automatically becomes `http://10.0.0.232:8000/v1`

## Configuration

After installation, configure ProxLab in **Settings > Devices & Services > ProxLab > Configure**:

1. **Connections** — Add your LLM, TTS, STT, and Embeddings endpoints
2. **Agents** — Assign connections to agents and customize system prompts
3. **Vector Database** — Configure ChromaDB or Milvus for semantic search
4. **Memory System** — Enable per-user long-term memory
5. **Context Settings** — Choose between direct entity injection or vector DB mode

## License

See [LICENSE](LICENSE) for details.
