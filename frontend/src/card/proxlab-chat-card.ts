import { LitElement, html, nothing, PropertyValues } from "lit";
import { cardStyles } from "./styles";
import type {
  HomeAssistant,
  ProxLabChatCardYamlConfig,
  ProxLabChatCardConfig,
  CardChatMessage,
  CardInvokeResponse,
} from "./types";

// Import editor so it's included in the bundle
import "./proxlab-chat-card-editor";

// SVG icons (inlined to avoid dependencies)
const sendIcon = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
const micIcon = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`;
const chatIcon = html`<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`;

export class ProxLabChatCard extends LitElement {
  static styles = cardStyles;

  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _cardConfig: { state: true },
    _messages: { state: true },
    _loading: { state: true },
    _inputValue: { state: true },
    _recording: { state: true },
    _configLoaded: { state: true },
  };

  hass!: HomeAssistant;
  _config?: ProxLabChatCardYamlConfig;
  _cardConfig?: ProxLabChatCardConfig;
  _messages: CardChatMessage[] = [];
  _loading = false;
  _inputValue = "";
  _recording = false;
  _configLoaded = false;

  private _mediaRecorder?: MediaRecorder;
  private _audioChunks: Blob[] = [];

  // ---- Lovelace lifecycle ----

  setConfig(config: ProxLabChatCardYamlConfig): void {
    if (!config.card_id) {
      throw new Error("Please set a card_id in the card configuration");
    }
    this._config = config;
    this._configLoaded = false;
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("proxlab-chat-card-editor");
  }

  static getStubConfig(): Record<string, unknown> {
    const id = Math.random().toString(36).substring(2, 10);
    return {
      type: "custom:proxlab-chat-card",
      card_id: id,
    };
  }

  getCardSize(): number {
    return Math.max(3, Math.ceil((this._cardConfig?.card_height ?? 500) / 50));
  }

  getLayoutOptions() {
    return {
      grid_columns: 4,
      grid_min_columns: 3,
      grid_rows: "auto",
      grid_min_rows: 3,
    };
  }

  // ---- Reactive updates ----

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has("hass") && this._config && !this._configLoaded) {
      this._loadCardConfig();
    }
  }

  private async _loadCardConfig(): Promise<void> {
    if (!this.hass || !this._config?.card_id) return;
    this._configLoaded = true;

    try {
      const config = await this.hass.callWS<ProxLabChatCardConfig | null>({
        type: "proxlab/card/config/get",
        card_id: this._config.card_id,
      });
      this._cardConfig = config ?? undefined;

      // Show first_mes if personality is enabled and no messages yet
      if (
        this._messages.length === 0 &&
        config?.personality_enabled &&
        config?.personality?.first_mes
      ) {
        this._messages = [
          {
            role: "assistant",
            content: config.personality.first_mes,
            timestamp: Date.now(),
          },
        ];
      }
    } catch {
      // Config not saved yet — card is unconfigured, show empty state
    }
  }

  // ---- Rendering ----

  protected render() {
    if (!this._config) {
      return html`<ha-card><div class="not-configured">No configuration</div></ha-card>`;
    }

    // Check user visibility
    if (this._cardConfig?.allowed_users?.length) {
      const userId = this.hass?.user?.id;
      if (userId && !this._cardConfig.allowed_users.includes(userId)) {
        return html``;
      }
    }

    const height = this._cardConfig?.card_height ?? 500;
    const hideHeader = this._cardConfig?.hide_header ?? false;
    const avatar = this._cardConfig?.avatar;
    const hasPortrait = !!avatar;

    // Resolve display name and status
    const name = this._resolveTitle();
    const status = this._resolveStatus();

    return html`
      <ha-card>
        <div class="card-container" style="height: ${height}px">
          ${hideHeader ? nothing : this._renderHeader(name, status, avatar)}
          ${hasPortrait
            ? html`
                <div class="card-layout">
                  ${this._renderPortraitPanel(avatar!, name, status)}
                  <div class="chat-area">
                    ${this._renderMessages()}
                    ${this._renderInputBar()}
                  </div>
                </div>
              `
            : html`
                ${this._renderMessages()}
                ${this._renderInputBar()}
              `}
        </div>
      </ha-card>
    `;
  }

  private _resolveTitle(): string {
    if (this._cardConfig?.title_override) return this._cardConfig.title_override;
    if (this._cardConfig?.personality_enabled && this._cardConfig?.personality?.name) {
      return this._cardConfig.personality.name;
    }
    return "ProxLab Chat";
  }

  private _resolveStatus(): string {
    if (this._cardConfig?.status_override) return this._cardConfig.status_override;
    return this._loading ? "Thinking..." : "Online";
  }

  private _renderHeader(name: string, status: string, avatar?: string) {
    return html`
      <div class="card-header">
        <div class="avatar">
          ${avatar
            ? html`<img src="${avatar}" alt="${name}" />`
            : name.charAt(0).toUpperCase()}
        </div>
        <div class="header-info">
          <div class="header-name">${name}</div>
          <div class="header-status">${status}</div>
        </div>
      </div>
    `;
  }

  private _renderPortraitPanel(avatar: string, name: string, status: string) {
    return html`
      <div class="portrait-panel">
        <img src="${avatar}" alt="${name}" />
        <div class="portrait-name">${name}</div>
        <div class="portrait-status">${status}</div>
      </div>
    `;
  }

  private _renderMessages() {
    if (this._messages.length === 0 && !this._loading) {
      return html`
        <div class="messages" style="flex: 1">
          <div class="empty-state">
            ${chatIcon}
            <span>Start a conversation</span>
          </div>
        </div>
      `;
    }

    return html`
      <div class="messages">
        ${this._messages.map(
          (msg) => html`
            <div class="message ${msg.role}">
              <div class="bubble">${msg.content}</div>
              ${this._cardConfig?.show_metadata !== false && msg.metadata
                ? html`<div class="meta">
                    ${msg.metadata.model ? msg.metadata.model : ""}
                    ${msg.metadata.tokens ? ` | ${msg.metadata.tokens} tokens` : ""}
                    ${msg.metadata.duration_ms
                      ? ` | ${(msg.metadata.duration_ms / 1000).toFixed(1)}s`
                      : ""}
                  </div>`
                : nothing}
            </div>
          `
        )}
        ${this._loading
          ? html`<div class="typing">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>`
          : nothing}
      </div>
    `;
  }

  private _renderInputBar() {
    return html`
      <div class="input-bar">
        <button
          class="btn-icon btn-mic ${this._recording ? "recording" : ""}"
          @click=${this._toggleRecording}
          title="Voice input"
        >
          ${micIcon}
        </button>
        <input
          type="text"
          placeholder="Type a message..."
          .value=${this._inputValue}
          @input=${(e: Event) => {
            this._inputValue = (e.target as HTMLInputElement).value;
          }}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              this._sendMessage();
            }
          }}
          ?disabled=${this._loading}
        />
        <button
          class="btn-icon btn-send"
          @click=${this._sendMessage}
          ?disabled=${this._loading || !this._inputValue.trim()}
          title="Send"
        >
          ${sendIcon}
        </button>
      </div>
    `;
  }

  // ---- Actions ----

  private async _sendMessage(): Promise<void> {
    const text = this._inputValue.trim();
    if (!text || this._loading || !this.hass || !this._config?.card_id) return;

    // Add user message
    this._messages = [
      ...this._messages,
      { role: "user", content: text, timestamp: Date.now() },
    ];
    this._inputValue = "";
    this._loading = true;
    this._scrollToBottom();

    try {
      const result = await this.hass.callWS<CardInvokeResponse>({
        type: "proxlab/card/invoke",
        card_id: this._config.card_id,
        message: text,
        conversation_id: `card_${this._config.card_id}`,
      });

      this._messages = [
        ...this._messages,
        {
          role: "assistant",
          content: result.response_text || "No response",
          timestamp: Date.now(),
          metadata: {
            agent_name: result.agent_name,
            tokens: result.tokens,
            duration_ms: result.duration_ms,
            model: result.model,
            tool_results: result.tool_results,
          },
        },
      ];

      // TTS playback
      if (result.tts_audio_url && this._cardConfig?.tts_voice) {
        this._playAudio(result.tts_audio_url);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this._messages = [
        ...this._messages,
        {
          role: "assistant",
          content: `Error: ${errMsg}`,
          timestamp: Date.now(),
        },
      ];
    } finally {
      this._loading = false;
      this._scrollToBottom();
    }
  }

  private _scrollToBottom(): void {
    requestAnimationFrame(() => {
      const el = this.renderRoot?.querySelector(".messages") as HTMLElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  private _playAudio(url: string): void {
    try {
      const audio = new Audio(url);
      audio.play().catch(() => {});
    } catch {
      // Ignore audio errors
    }
  }

  // ---- STT (Mic) ----

  private async _toggleRecording(): Promise<void> {
    if (this._recording) {
      this._mediaRecorder?.stop();
      this._recording = false;
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._audioChunks = [];
      this._mediaRecorder = new MediaRecorder(stream);

      this._mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) this._audioChunks.push(e.data);
      };

      this._mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(this._audioChunks, { type: "audio/webm" });
        await this._transcribeAudio(blob);
      };

      this._mediaRecorder.start();
      this._recording = true;
    } catch {
      // Mic access denied or unavailable
    }
  }

  private async _transcribeAudio(blob: Blob): Promise<void> {
    try {
      // Convert to base64 and send to STT via HA
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || "");
        };
        reader.readAsDataURL(blob);
      });

      // Use HA STT pipeline if available
      if (this.hass.config.components.includes("stt")) {
        const result = await this.hass.callWS<{ text: string }>({
          type: "stt/stream",
          audio_data: base64,
          language: this.hass.language || "en",
        });
        if (result?.text) {
          this._inputValue = result.text;
        }
      }
    } catch {
      // STT failed silently
    }
  }
}

// Manual custom element registration (no decorators)
customElements.define("proxlab-chat-card", ProxLabChatCard);

// Register in window.customCards for HA card picker
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "proxlab-chat-card",
  name: "ProxLab Chat",
  description: "Chat with ProxLab agents directly from your dashboard",
  preview: true,
  documentationURL: "https://github.com/travisfinch1983/ha-proxlab",
});
