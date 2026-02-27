import { LitElement, html, nothing, PropertyValues } from "lit";
import { cardStyles } from "./styles";
import type {
  HomeAssistant,
  ProxLabChatCardYamlConfig,
  ProxLabChatCardConfig,
  CardChatMessage,
  CardInvokeResponse,
} from "./types";
import { parseFormattedText } from "./format-parser";

// Import editor so it's included in the bundle
import "./proxlab-chat-card-editor";

// SVG icons (inlined to avoid dependencies)
const sendIcon = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
const micIcon = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`;
const chatIcon = html`<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`;
const editIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
const regenerateIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
const checkIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
const cancelIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`;
const deleteIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;

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
    _portraitWidth: { state: true },
    _editingIndex: { state: true },
    _editValue: { state: true },
  };

  hass!: HomeAssistant;
  _config?: ProxLabChatCardYamlConfig;
  _cardConfig?: ProxLabChatCardConfig;
  _messages: CardChatMessage[] = [];
  _loading = false;
  _inputValue = "";
  _recording = false;
  _configLoaded = false;
  _portraitWidth = 0;
  _editingIndex = -1;
  _editValue = "";

  private _mediaRecorder?: MediaRecorder;
  private _audioChunks: Blob[] = [];
  private _lastAvatarUrl = "";
  private _audioQueue: string[] = [];
  private _audioPlaying = false;

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

      // Measure avatar for portrait panel sizing
      if (config?.avatar && config.avatar !== this._lastAvatarUrl) {
        this._lastAvatarUrl = config.avatar;
        this._measureAvatar(config.avatar, config.card_height ?? 500);
      }

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

  private _measureAvatar(url: string, cardHeight: number): void {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      // Available height = card height - header (~56px) - input bar (~52px) - panel padding (16px) - name/status (~36px)
      const availableHeight = cardHeight - 56 - 52 - 16 - 36;
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      const idealWidth = Math.round(availableHeight * aspectRatio);
      // Clamp: at least 80px, no more than half the card
      this._portraitWidth = Math.max(80, Math.min(idealWidth, 600));
    };
    img.src = url;
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
    const configWidth = this._cardConfig?.portrait_width ?? "auto";
    const isManual = typeof configWidth === "number" && configWidth > 0;
    const panelWidth = isManual ? configWidth : this._portraitWidth;
    const widthStyle = panelWidth
      ? `width: ${panelWidth}px; max-width: 50%;`
      : "width: 25%; max-width: 50%;";
    // Manual width: image can overflow card height, crop with cover (shows face at top)
    // Auto: image fits within card height, no cropping (contain)
    const imgClass = isManual ? "portrait-img-cover" : "portrait-img-contain";
    return html`
      <div class="portrait-panel" style="${widthStyle}">
        <img class="${imgClass}" src="${avatar}" alt="${name}" />
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

    const lastAssistantIdx = this._findLastAssistantIndex();

    return html`
      <div class="messages">
        ${this._messages.map(
          (msg, idx) => html`
            <div class="message ${msg.role}">
              ${this._editingIndex === idx
                ? this._renderEditBubble(idx)
                : html`
                    <div class="bubble">${this._formatContent(msg.content)}</div>
                    <div class="msg-actions">
                      ${this._cardConfig?.show_metadata !== false && msg.metadata
                        ? html`<span class="meta-inline">
                            ${msg.metadata.model ?? ""}${msg.metadata.tokens ? ` | ${msg.metadata.tokens} tok` : ""}${msg.metadata.duration_ms ? ` | ${(msg.metadata.duration_ms / 1000).toFixed(1)}s` : ""}
                          </span>`
                        : nothing}
                      ${!this._loading
                        ? html`
                            <button class="msg-btn" title="Edit" @click=${() => this._startEdit(idx)}>
                              ${editIcon}
                            </button>
                            <button class="msg-btn delete" title="Delete" @click=${() => this._deleteMessage(idx)}>
                              ${deleteIcon}
                            </button>
                            ${msg.role === "assistant" && idx === lastAssistantIdx
                              ? html`<button class="msg-btn" title="Regenerate" @click=${() => this._regenerate()}>
                                  ${regenerateIcon}
                                </button>`
                              : nothing}
                          `
                        : nothing}
                    </div>
                  `}
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

  private _renderEditBubble(idx: number) {
    return html`
      <div class="edit-bubble">
        <textarea
          class="edit-textarea"
          .value=${this._editValue}
          @input=${(e: Event) => { this._editValue = (e.target as HTMLTextAreaElement).value; }}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              this._confirmEdit(idx);
            }
            if (e.key === "Escape") {
              this._cancelEdit();
            }
          }}
        ></textarea>
        <div class="edit-actions">
          <button class="msg-btn confirm" title="Save" @click=${() => this._confirmEdit(idx)}>
            ${checkIcon}
          </button>
          <button class="msg-btn" title="Cancel" @click=${() => this._cancelEdit()}>
            ${cancelIcon}
          </button>
        </div>
      </div>
    `;
  }

  private _findLastAssistantIndex(): number {
    for (let i = this._messages.length - 1; i >= 0; i--) {
      if (this._messages[i].role === "assistant") return i;
    }
    return -1;
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

  // ---- Edit & Regenerate ----

  private _startEdit(idx: number): void {
    this._editingIndex = idx;
    this._editValue = this._messages[idx].content;
  }

  private _cancelEdit(): void {
    this._editingIndex = -1;
    this._editValue = "";
  }

  private _confirmEdit(idx: number): void {
    const newContent = this._editValue.trim();
    if (!newContent) return;

    const msg = this._messages[idx];
    // Update the message content
    const updated = [...this._messages];
    updated[idx] = { ...msg, content: newContent };

    if (msg.role === "user") {
      // If editing a user message, remove everything after it and re-send
      this._messages = updated.slice(0, idx + 1);
      this._editingIndex = -1;
      this._editValue = "";
      this._resendFromIndex(idx);
    } else {
      // If editing an assistant message, just update the text in place
      this._messages = updated;
      this._editingIndex = -1;
      this._editValue = "";
    }
  }

  private async _regenerate(): Promise<void> {
    if (this._loading || !this.hass || !this._config?.card_id) return;

    // Find the last user message
    let lastUserIdx = -1;
    for (let i = this._messages.length - 1; i >= 0; i--) {
      if (this._messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;

    // Remove messages from that user message's assistant response onward
    this._messages = this._messages.slice(0, lastUserIdx + 1);
    this._resendFromIndex(lastUserIdx);
  }

  private async _resendFromIndex(userMsgIdx: number): Promise<void> {
    const text = this._messages[userMsgIdx].content;
    if (!text || !this.hass || !this._config?.card_id) return;

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

      // TTS playback — per-segment voices
      this._speakSegments(result.response_text || "");
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

      // TTS playback — per-segment voices
      this._speakSegments(result.response_text || "");
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

  private _formatContent(content: string) {
    const segments = parseFormattedText(content);
    return segments.map((seg) => {
      if (seg.type === "normal") return html`<span>${seg.text}</span>`;
      return html`<span class="text-${seg.type}">${seg.text}</span>`;
    });
  }

  private _deleteMessage(idx: number): void {
    const updated = [...this._messages];
    updated.splice(idx, 1);
    this._messages = updated;
  }

  private async _speakSegments(responseText: string): Promise<void> {
    const voices = this._cardConfig?.tts_voices;
    if (!voices) return;

    // Check if any voice is configured
    const hasAnyVoice = voices.normal || voices.narration || voices.speech || voices.thoughts;
    if (!hasAnyVoice || !this.hass || !this._config?.card_id) return;

    const segments = parseFormattedText(responseText);

    // Build request segments: pair text with the configured voice for its type
    const reqSegments = segments
      .filter((s) => s.text.trim())
      .map((s) => ({ text: s.text, voice: voices[s.type] || "" }))
      .filter((s) => s.voice);

    if (reqSegments.length === 0) return;

    try {
      const result = await this.hass.callWS<{ audio_segments: { data_url: string }[] }>({
        type: "proxlab/card/tts/speak",
        card_id: this._config.card_id,
        segments: reqSegments,
      });

      if (result?.audio_segments?.length) {
        for (const seg of result.audio_segments) {
          if (seg.data_url) this._audioQueue.push(seg.data_url);
        }
        this._playAudioQueue();
      }
    } catch {
      // TTS failed silently
    }
  }

  private _playAudioQueue(): void {
    if (this._audioPlaying || this._audioQueue.length === 0) return;
    this._audioPlaying = true;

    const url = this._audioQueue.shift()!;
    try {
      const audio = new Audio(url);
      audio.onended = () => {
        this._audioPlaying = false;
        this._playAudioQueue();
      };
      audio.onerror = () => {
        this._audioPlaying = false;
        this._playAudioQueue();
      };
      audio.play().catch(() => {
        this._audioPlaying = false;
        this._playAudioQueue();
      });
    } catch {
      this._audioPlaying = false;
      this._playAudioQueue();
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
