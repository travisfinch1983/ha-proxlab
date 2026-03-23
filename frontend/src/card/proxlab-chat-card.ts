import { LitElement, html, nothing, PropertyValues } from "lit";
import { cardStyles } from "./styles";
import type {
  HomeAssistant,
  ProxLabChatCardYamlConfig,
  ProxLabChatCardConfig,
  CardChatMessage,
  CardInvokeResponse,
  AgentProfile,
  PermissionRequest,
} from "./types";
import { parseFormattedText } from "./format-parser";

// Import editor and group card so they're included in the bundle
import "./proxlab-chat-card-editor";
import "./proxlab-group-chat-card";

// SVG icons (inlined to avoid dependencies)
const sendIcon = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
const micIcon = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`;
const chatIcon = html`<svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.4"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`;
const editIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
const regenerateIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
const checkIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
const cancelIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`;
const deleteIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
const speakerIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;

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
    _speakingIndex: { state: true },
    _streaming: { state: true },
    _modelUnavailable: { state: true },
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
  _speakingIndex = -1;
  _streaming = false;
  _modelUnavailable: string | null = null;

  private _mediaRecorder?: MediaRecorder;
  private _audioChunks: Blob[] = [];
  private _lastAvatarUrl = "";
  private _audioQueue: string[] = [];
  private _audioPlaying = false;
  private _ttsBuffer = "";
  private _ttsTextQueue: string[] = [];
  private _ttsProcessing = false;

  // Voice activity detection state
  private _audioContext?: AudioContext;
  private _analyserNode?: AnalyserNode;
  private _vadInterval?: ReturnType<typeof setInterval>;
  private _speechDetected = false;
  private _silenceStart = 0;
  private static readonly VAD_SPEECH_THRESHOLD = 15;   // RMS level to count as speech
  private static readonly VAD_SILENCE_DURATION = 1500;  // ms of silence before auto-stop
  private static readonly VAD_MAX_DURATION = 30000;     // max recording time (30s)
  private _recordingStart = 0;

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

      if (!config) {
        this._cardConfig = undefined;
        return;
      }

      // If linked to a profile, merge profile display fields into config
      if (config.use_profile && config.profile_id) {
        try {
          const profile = await this.hass.callWS<AgentProfile | null>({
            type: "proxlab/profile/get",
            profile_id: config.profile_id,
          });
          if (profile) {
            config.avatar = profile.avatar || config.avatar;
            config.personality_enabled = profile.personality_enabled;
            config.personality = profile.personality;
            config.prompt_override = profile.prompt_override;
            config.agent_id = profile.agent_id;
            config.tts_voices = profile.tts_voices;
            config.portrait_width = profile.portrait_width;
            // Use personality name as title if no title override set
            if (!config.title_override && profile.personality?.name) {
              config.title_override = profile.personality.name;
            } else if (!config.title_override && profile.name) {
              config.title_override = profile.name;
            }

            // Check model availability
            if (profile.model_override && profile.connection_id) {
              try {
                const conns = await this.hass.callWS<Record<string, any>>({
                  type: "proxlab/connections/list",
                });
                const conn = conns?.[profile.connection_id];
                const models: string[] = conn?.health?.available_models || [];
                this._modelUnavailable =
                  models.length > 0 && !models.includes(profile.model_override)
                    ? profile.model_override
                    : null;
              } catch {
                this._modelUnavailable = null;
              }
            } else {
              this._modelUnavailable = null;
            }
          }
        } catch {
          // Profile not found — fall back to card config
        }
      }

      this._cardConfig = config;

      // Measure avatar for portrait panel sizing
      if (config.avatar && config.avatar !== this._lastAvatarUrl) {
        this._lastAvatarUrl = config.avatar;
        this._measureAvatar(config.avatar, config.card_height ?? 500);
      }

      // Show first_mes if personality is enabled and no messages yet
      if (
        this._messages.length === 0 &&
        config.personality_enabled &&
        config.personality?.first_mes
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

  private _resolveAgentLabel(): string {
    const id = this._cardConfig?.agent_id;
    if (!id) return "";
    if (id === "orchestrator") return "Orchestrator";
    if (id === "conversation_agent") return "Conversation Agent";
    // Title-case the agent_id: "security_guard" → "Security Guard"
    return id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
    const agentLabel = this._resolveAgentLabel();
    return html`
      <div class="portrait-panel" style="${widthStyle}">
        <img class="${imgClass}" src="${avatar}" alt="${name}" />
        <div class="portrait-name">${name}</div>
        <div class="portrait-status">${status}</div>
        ${agentLabel ? html`<div class="portrait-agent">${agentLabel}</div>` : nothing}
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
          (msg, idx) => {
            // Permission request card
            if (msg.role === "permission" && msg.permissionRequest) {
              const pr = msg.permissionRequest;
              const decided = msg.permissionDecision !== "pending";
              return html`
                <div class="message permission">
                  <div class="permission-card ${decided ? "decided" : ""}">
                    <div class="permission-header">Permission Required</div>
                    <div class="permission-tool">${pr.display_name || pr.tool_name}</div>
                    ${pr.description ? html`<div class="permission-description">${pr.description}</div>` : nothing}
                    ${pr.input_summary ? html`<code class="permission-input">${pr.input_summary}</code>` : nothing}
                    ${!decided
                      ? html`
                          <div class="permission-actions">
                            <button class="btn-allow" @click=${() => this._handlePermissionResponse(pr.request_id, pr.run_id, "allow")}>Allow</button>
                            <button class="btn-deny" @click=${() => this._handlePermissionResponse(pr.request_id, pr.run_id, "deny")}>Deny</button>
                          </div>
                        `
                      : html`
                          <div class="permission-decided ${msg.permissionDecision}">
                            ${msg.permissionDecision === "allow" ? "Allowed" : "Denied"}
                          </div>
                        `}
                  </div>
                </div>
              `;
            }

            const isStreamingMsg = this._streaming && msg.role === "assistant" && idx === this._messages.length - 1;
            return html`
            <div class="message ${msg.role} ${this._editingIndex === idx ? "editing" : ""}">
              ${this._editingIndex === idx
                ? this._renderEditBubble(idx)
                : html`
                    <div class="bubble ${isStreamingMsg ? "streaming-cursor" : ""}">${this._formatContent(msg.content)}</div>
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
                            ${msg.role === "assistant"
                              ? html`<button
                                  class="msg-btn speak ${this._speakingIndex === idx ? "speaking" : ""}"
                                  title="Speak"
                                  @click=${() => this._speakMessage(idx)}
                                >
                                  ${speakerIcon}
                                </button>`
                              : nothing}
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
          `}
        )}
        ${this._loading && !this._streaming
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
    const blocked = !!this._modelUnavailable;
    return html`
      ${blocked ? html`
        <div class="model-warning">
          Model "${this._modelUnavailable}" is not currently loaded. Load the model or change the profile to chat.
        </div>
      ` : nothing}
      <div class="input-bar">
        <button
          class="btn-icon btn-mic ${this._recording ? "recording" : ""}"
          @click=${this._toggleRecording}
          title="Voice input"
          ?disabled=${blocked}
        >
          ${micIcon}
        </button>
        <input
          type="text"
          placeholder=${blocked ? "Model unavailable..." : "Type a message..."}
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
          ?disabled=${this._loading || blocked}
        />
        <button
          class="btn-icon btn-send"
          @click=${this._sendMessage}
          ?disabled=${this._loading || blocked || !this._inputValue.trim()}
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

    // Update text in place — regeneration is manual via the regenerate button
    const updated = [...this._messages];
    updated[idx] = { ...this._messages[idx], content: newContent };
    this._messages = updated;
    this._editingIndex = -1;
    this._editValue = "";
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

    if (this._cardConfig?.streaming_enabled) {
      await this._doSendStreaming(text);
    } else {
      await this._doSendSync(text);
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

    if (this._cardConfig?.streaming_enabled) {
      await this._doSendStreaming(text);
    } else {
      await this._doSendSync(text);
    }
  }

  private async _doSendSync(text: string): Promise<void> {
    this._loading = true;
    this._scrollToBottom();

    try {
      const result = await this.hass.callWS<CardInvokeResponse>({
        type: "proxlab/card/invoke",
        card_id: this._config!.card_id,
        message: text,
        conversation_id: `card_${this._config!.card_id}`,
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

      // Auto TTS playback — per-segment voices (assistant only)
      if (this._cardConfig?.auto_tts) {
        this._speakSegments(result.response_text || "");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message
        : (err && typeof err === "object" && "message" in err) ? String((err as any).message)
        : String(err);
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

  private async _doSendStreaming(text: string): Promise<void> {
    // Route to agent streaming if use_agent_tools is enabled
    if (this._cardConfig?.use_agent_tools) {
      return this._doSendStreamingAgent(text);
    }

    this._loading = true;
    this._streaming = true;
    this._ttsBuffer = "";
    this._scrollToBottom();

    // Add placeholder assistant message
    const msgIdx = this._messages.length;
    this._messages = [
      ...this._messages,
      { role: "assistant", content: "", timestamp: Date.now() },
    ];

    try {
      const unsub = await (this.hass as any).connection.subscribeMessage(
        (event: any) => {
          if (event.type === "delta") {
            const updated = [...this._messages];
            updated[msgIdx] = {
              ...updated[msgIdx],
              content: (updated[msgIdx].content || "") + event.text,
            };
            this._messages = updated;
            this._scrollToBottom();

            // TTS chunking
            this._ttsBuffer += event.text;
            this._checkTtsChunk();
          } else if (event.type === "done") {
            this._streaming = false;
            this._loading = false;
            const updated = [...this._messages];
            updated[msgIdx] = {
              ...updated[msgIdx],
              content: event.response_text || updated[msgIdx].content,
              metadata: {
                agent_name: event.agent_name,
                tokens: event.tokens,
                duration_ms: event.duration_ms,
                model: event.model,
              },
            };
            this._messages = updated;
            this._flushTtsBuffer();
            this._scrollToBottom();
            unsub();
          } else if (event.type === "error") {
            this._streaming = false;
            this._loading = false;
            const updated = [...this._messages];
            updated[msgIdx] = {
              ...updated[msgIdx],
              content: `Error: ${event.error}`,
            };
            this._messages = updated;
            this._scrollToBottom();
            unsub();
          }
        },
        {
          type: "proxlab/card/invoke_stream",
          card_id: this._config!.card_id,
          message: text,
          conversation_id: `card_${this._config!.card_id}`,
        },
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message
        : (err && typeof err === "object" && "message" in err) ? String((err as any).message)
        : String(err);
      this._streaming = false;
      this._loading = false;
      const updated = [...this._messages];
      updated[msgIdx] = {
        ...updated[msgIdx],
        content: `Error: ${errMsg}`,
      };
      this._messages = updated;
      this._scrollToBottom();
    }
  }

  /**
   * Agent-mode streaming: uses Claude Code addon's SDK-based agent endpoint.
   * Supports interactive permission prompts for MCP/unknown tools.
   */
  private async _doSendStreamingAgent(text: string): Promise<void> {
    this._loading = true;
    this._streaming = true;
    this._ttsBuffer = "";
    this._scrollToBottom();

    // Add placeholder assistant message
    const msgIdx = this._messages.length;
    this._messages = [
      ...this._messages,
      { role: "assistant" as const, content: "", timestamp: Date.now() },
    ];

    try {
      const unsub = await (this.hass as any).connection.subscribeMessage(
        (event: any) => {
          if (event.type === "delta") {
            // Streaming text delta
            const updated = [...this._messages];
            updated[msgIdx] = {
              ...updated[msgIdx],
              content: (updated[msgIdx].content || "") + event.text,
            };
            this._messages = updated;
            this._scrollToBottom();

            this._ttsBuffer += event.text;
            this._checkTtsChunk();

          } else if (event.type === "permission_request") {
            // Insert permission card into chat
            this._messages = [
              ...this._messages,
              {
                role: "permission" as const,
                content: "",
                timestamp: Date.now(),
                permissionRequest: {
                  request_id: event.request_id,
                  run_id: event.run_id,
                  tool_name: event.tool_name,
                  input_summary: event.input_summary,
                  title: event.title,
                  display_name: event.display_name,
                  description: event.description,
                },
                permissionDecision: "pending",
              },
            ];
            this._scrollToBottom();

          } else if (event.type === "text") {
            // Full text block (after streaming is done) — ignore if we already have content from deltas

          } else if (event.type === "tool_use") {
            // Tool being used — show as system info
            const toolInfo = `Using tool: ${event.tool_name}`;
            const updated = [...this._messages];
            const current = updated[msgIdx].content || "";
            if (!current.includes(toolInfo)) {
              updated[msgIdx] = {
                ...updated[msgIdx],
                content: current + (current ? "\n" : "") + toolInfo + "...\n",
              };
              this._messages = updated;
              this._scrollToBottom();
            }

          } else if (event.type === "tool_result") {
            // Tool result received — can optionally show

          } else if (event.type === "done") {
            this._streaming = false;
            this._loading = false;
            const updated = [...this._messages];
            updated[msgIdx] = {
              ...updated[msgIdx],
              content: event.response_text || updated[msgIdx].content,
              metadata: {
                agent_name: "Claude Code",
                tokens: event.usage?.input_tokens
                  ? (event.usage.input_tokens + (event.usage.output_tokens || 0))
                  : undefined,
                model: event.usage?.model,
              },
            };
            this._messages = updated;
            this._flushTtsBuffer();
            this._scrollToBottom();
            unsub();

          } else if (event.type === "error") {
            this._streaming = false;
            this._loading = false;
            const updated = [...this._messages];
            updated[msgIdx] = {
              ...updated[msgIdx],
              content: updated[msgIdx].content
                ? updated[msgIdx].content + `\n\nError: ${event.error || event.message}`
                : `Error: ${event.error || event.message}`,
            };
            this._messages = updated;
            this._scrollToBottom();
            unsub();
          }
          // Ignore: run_start, system
        },
        {
          type: "proxlab/card/invoke_stream_agent",
          card_id: this._config!.card_id,
          message: text,
          conversation_id: `card_${this._config!.card_id}`,
        },
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message
        : (err && typeof err === "object" && "message" in err) ? String((err as any).message)
        : String(err);
      this._streaming = false;
      this._loading = false;
      const updated = [...this._messages];
      updated[msgIdx] = {
        ...updated[msgIdx],
        content: `Error: ${errMsg}`,
      };
      this._messages = updated;
      this._scrollToBottom();
    }
  }

  /**
   * Handle Allow/Deny button clicks on permission request cards.
   */
  private async _handlePermissionResponse(
    requestId: string,
    runId: string,
    decision: "allow" | "deny",
  ): Promise<void> {
    try {
      await this.hass!.callWS({
        type: "proxlab/card/permission_response",
        run_id: runId,
        request_id: requestId,
        decision,
      });
    } catch (err) {
      console.error("Permission response failed:", err);
    }

    // Update the permission message to show the decision
    this._messages = this._messages.map((m) =>
      m.permissionRequest?.request_id === requestId
        ? { ...m, permissionDecision: decision }
        : m,
    );
  }

  // ---- TTS Chunking (Streaming) ----
  // Text chunks are queued and processed sequentially to avoid overwhelming
  // the TTS backend with concurrent requests (which causes dropped audio).

  private _checkTtsChunk(): void {
    if (!this._cardConfig?.auto_tts) return;

    const breakIdx = this._findChunkBreak(this._ttsBuffer);
    if (breakIdx > 0) {
      const chunk = this._ttsBuffer.substring(0, breakIdx);
      this._ttsBuffer = this._ttsBuffer.substring(breakIdx);
      this._enqueueTtsChunk(chunk);
    }
  }

  private _flushTtsBuffer(): void {
    if (this._ttsBuffer.trim() && this._cardConfig?.auto_tts) {
      this._enqueueTtsChunk(this._ttsBuffer);
    }
    this._ttsBuffer = "";
  }

  private _enqueueTtsChunk(text: string): void {
    this._ttsTextQueue.push(text);
    this._processTtsQueue();
  }

  private async _processTtsQueue(): Promise<void> {
    if (this._ttsProcessing) return;
    this._ttsProcessing = true;

    while (this._ttsTextQueue.length > 0) {
      const chunk = this._ttsTextQueue.shift()!;
      await this._speakSegments(chunk);
    }

    this._ttsProcessing = false;
  }

  private _findChunkBreak(text: string): number {
    // Prefer paragraph breaks at any length
    const paraIdx = text.indexOf("\n\n");
    if (paraIdx > 0) return paraIdx + 2;

    // Only break on sentences after accumulating 200+ chars
    if (text.length < 200) return -1;

    const sentenceEnds = [". ", "! ", "? ", ".\n", "!\n", "?\n"];
    for (let i = 200; i < text.length; i++) {
      for (const end of sentenceEnds) {
        if (text.substring(i, i + end.length) === end) {
          return i + end.length;
        }
      }
    }
    return -1;
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

  private async _speakMessage(idx: number): Promise<void> {
    const msg = this._messages[idx];
    if (!msg || msg.role !== "assistant") return;
    this._speakingIndex = idx;
    await this._speakSegments(msg.content, () => { this._speakingIndex = -1; });
  }

  private async _speakSegments(responseText: string, onDone?: () => void): Promise<void> {
    const voices = this._cardConfig?.tts_voices;
    if (!voices) { onDone?.(); return; }

    // Check if any voice is configured
    const hasAnyVoice = voices.normal || voices.narration || voices.speech || voices.thoughts;
    if (!hasAnyVoice || !this.hass || !this._config?.card_id) { onDone?.(); return; }

    const segments = parseFormattedText(responseText);

    // Build request segments: pair text with the configured voice for its type
    const reqSegments = segments
      .filter((s) => s.text.trim())
      .map((s) => ({ text: s.text, voice: voices[s.type] || "" }))
      .filter((s) => s.voice);

    if (reqSegments.length === 0) { onDone?.(); return; }

    try {
      const result = await this.hass.callWS<{ audio_segments: { url?: string; data_url?: string }[] }>({
        type: "proxlab/card/tts/speak",
        card_id: this._config.card_id,
        segments: reqSegments,
      });

      if (result?.audio_segments?.length) {
        for (const seg of result.audio_segments) {
          const audioUrl = seg.url || seg.data_url;
          if (audioUrl) this._audioQueue.push(audioUrl);
        }
        this._onAudioQueueDone = onDone ?? null;
        this._playAudioQueue();
      } else {
        onDone?.();
      }
    } catch {
      onDone?.();
    }
  }

  private _onAudioQueueDone: (() => void) | null = null;

  private _playAudioQueue(): void {
    if (this._audioPlaying || this._audioQueue.length === 0) {
      if (!this._audioPlaying && this._audioQueue.length === 0 && this._onAudioQueueDone) {
        const cb = this._onAudioQueueDone;
        this._onAudioQueueDone = null;
        cb();
      }
      return;
    }
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
      this._stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._audioChunks = [];
      this._speechDetected = false;
      this._silenceStart = 0;
      this._recordingStart = Date.now();

      this._mediaRecorder = new MediaRecorder(stream);

      this._mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) this._audioChunks.push(e.data);
      };

      this._mediaRecorder.onstop = async () => {
        this._stopVAD();
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(this._audioChunks, { type: "audio/webm" });
        await this._transcribeAudio(blob);
      };

      // Set up voice activity detection
      this._startVAD(stream);

      this._mediaRecorder.start();
      this._recording = true;
    } catch {
      // Mic access denied or unavailable
    }
  }

  private _stopRecording(): void {
    this._stopVAD();
    this._mediaRecorder?.stop();
    this._recording = false;
  }

  private _startVAD(stream: MediaStream): void {
    try {
      this._audioContext = new AudioContext();
      const source = this._audioContext.createMediaStreamSource(stream);
      this._analyserNode = this._audioContext.createAnalyser();
      this._analyserNode.fftSize = 512;
      source.connect(this._analyserNode);

      const dataArray = new Uint8Array(this._analyserNode.fftSize);

      this._vadInterval = setInterval(() => {
        if (!this._analyserNode || !this._recording) return;

        this._analyserNode.getByteTimeDomainData(dataArray);

        // Calculate RMS level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        const rms = Math.sqrt(sum / dataArray.length) * 100;

        const now = Date.now();

        if (rms > ProxLabChatCard.VAD_SPEECH_THRESHOLD) {
          // Speech detected
          this._speechDetected = true;
          this._silenceStart = 0;
        } else if (this._speechDetected) {
          // Silence after speech
          if (this._silenceStart === 0) {
            this._silenceStart = now;
          } else if (now - this._silenceStart > ProxLabChatCard.VAD_SILENCE_DURATION) {
            // Silence long enough — auto-stop
            this._stopRecording();
            return;
          }
        }

        // Max duration safety
        if (now - this._recordingStart > ProxLabChatCard.VAD_MAX_DURATION) {
          this._stopRecording();
        }
      }, 100);
    } catch {
      // AudioContext not supported — fall back to manual stop
    }
  }

  private _stopVAD(): void {
    if (this._vadInterval) {
      clearInterval(this._vadInterval);
      this._vadInterval = undefined;
    }
    if (this._audioContext) {
      this._audioContext.close().catch(() => {});
      this._audioContext = undefined;
    }
    this._analyserNode = undefined;
  }

  private async _transcribeAudio(blob: Blob): Promise<void> {
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || "");
        };
        reader.readAsDataURL(blob);
      });

      const result = await this.hass.callWS<{ text: string }>({
        type: "proxlab/card/stt/transcribe",
        audio_data: base64,
      });
      if (result?.text) {
        this._inputValue = result.text;
        // Auto-send: behave like HA's voice pipeline
        await this._sendMessage();
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
