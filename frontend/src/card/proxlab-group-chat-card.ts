import { LitElement, html, nothing, PropertyValues } from "lit";
import { groupCardStyles } from "./styles";
import type {
  HomeAssistant,
  GroupChatCardYamlConfig,
  GroupChatCardConfig,
  GroupChatMessage,
  GroupInvokeResponse,
  AgentProfile,
} from "./types";
import { parseFormattedText } from "./format-parser";

// Import editor so it's included in the bundle
import "./proxlab-group-chat-card-editor";

const sendIcon = html`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
const editIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
const deleteIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
const speakerIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
const regenerateIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
const checkIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`;
const cancelIcon = html`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`;

// Agent bubble hue colors (cycle for participant index)
const AGENT_HUES = [250, 160, 30, 340, 200, 80, 290, 120];

export class ProxLabGroupChatCard extends LitElement {
  static styles = groupCardStyles;

  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _cardConfig: { state: true },
    _profiles: { state: true },
    _messages: { state: true },
    _loading: { state: true },
    _inputValue: { state: true },
    _configLoaded: { state: true },
    _mentionOpen: { state: true },
    _mentionFilter: { state: true },
    _editingIndex: { state: true },
    _editValue: { state: true },
    _speakingIndex: { state: true },
    _streaming: { state: true },
  };

  hass!: HomeAssistant;
  _config?: GroupChatCardYamlConfig;
  _cardConfig?: GroupChatCardConfig;
  _profiles: AgentProfile[] = [];
  _messages: GroupChatMessage[] = [];
  _loading = false;
  _inputValue = "";
  _configLoaded = false;
  _mentionOpen = false;
  _mentionFilter = "";
  _editingIndex = -1;
  _editValue = "";
  _speakingIndex = -1;
  _streaming = false;

  private _audioQueue: string[] = [];
  private _audioPlaying = false;
  private _onAudioQueueDone: (() => void) | null = null;
  private _ttsBuffer = "";
  private _streamingProfileId = "";

  setConfig(config: GroupChatCardYamlConfig): void {
    if (!config.card_id) {
      throw new Error("Please set a card_id in the card configuration");
    }
    this._config = config;
    this._configLoaded = false;
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("proxlab-group-chat-card-editor");
  }

  static getStubConfig(): Record<string, unknown> {
    const id = Math.random().toString(36).substring(2, 10);
    return {
      type: "custom:proxlab-group-chat-card",
      card_id: id,
    };
  }

  getCardSize(): number {
    return Math.max(3, Math.ceil((this._cardConfig?.card_height ?? 600) / 50));
  }

  getLayoutOptions() {
    return {
      grid_columns: 4,
      grid_min_columns: 3,
      grid_rows: "auto",
      grid_min_rows: 3,
    };
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has("hass") && this.hass && this._config?.card_id && !this._configLoaded) {
      this._configLoaded = true;
      this._loadConfig();
    }
  }

  private async _loadConfig(): Promise<void> {
    try {
      const [config, profiles] = await Promise.all([
        this.hass.callWS<GroupChatCardConfig | null>({
          type: "proxlab/group/config/get",
          card_id: this._config!.card_id,
        }),
        this.hass.callWS<AgentProfile[]>({
          type: "proxlab/profile/list",
        }),
      ]);

      if (config) {
        this._cardConfig = config;
        // Filter profiles to only those in config
        this._profiles = config.profile_ids
          .map((id) => profiles.find((p) => p.profile_id === id))
          .filter((p): p is AgentProfile => !!p);
      } else {
        this._cardConfig = {
          card_id: this._config!.card_id,
          profile_ids: [],
          turn_mode: "round_robin",
          card_height: 600,
          show_metadata: false,
          allowed_users: [],
          streaming_enabled: false,
        };
        this._profiles = [];
      }
    } catch {
      // First load — use defaults
    }
  }

  protected render() {
    if (!this._cardConfig) {
      return html`<ha-card>
        <div style="padding: 24px; text-align: center;">
          <span style="opacity: 0.5;">Loading group chat...</span>
        </div>
      </ha-card>`;
    }

    const height = this._cardConfig.card_height ?? 600;

    return html`
      <ha-card>
        <div class="card-container" style="height: ${height}px;">
          ${this._renderParticipantStrip()}
          <div class="messages" id="messages">
            ${this._messages.length === 0
              ? html`<div class="empty-state">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                  <span>Start a group conversation</span>
                </div>`
              : this._messages.map((msg, idx) => this._renderMessage(msg, idx))}
            ${this._loading
              ? html`<div class="loading-row">
                  <div class="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>`
              : nothing}
          </div>
          <div class="input-bar">
            <div class="input-wrapper">
              <input
                type="text"
                placeholder="${this._cardConfig.turn_mode === "at_mention"
                  ? "Type @name to mention an agent..."
                  : "Type a message..."}"
                .value=${this._inputValue}
                @input=${this._onInput}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    this._sendMessage();
                  }
                }}
                ?disabled=${this._loading}
              />
              ${this._renderMentionDropdown()}
            </div>
            <button
              class="send-btn"
              @click=${this._sendMessage}
              ?disabled=${this._loading || !this._inputValue.trim()}
            >
              ${sendIcon}
            </button>
          </div>
        </div>
      </ha-card>
    `;
  }

  private _renderParticipantStrip() {
    if (this._profiles.length === 0) {
      return html`<div class="participant-strip">
        <span style="opacity: 0.5; font-size: 12px;">No participants — configure profiles in card editor</span>
      </div>`;
    }

    return html`
      <div class="participant-strip">
        ${this._profiles.map(
          (p) => html`
            <div class="participant">
              ${p.avatar
                ? html`<img class="participant-avatar" src="${p.avatar}" alt="${p.name}" />`
                : html`<div class="participant-avatar placeholder">${p.name.charAt(0).toUpperCase()}</div>`}
              <span class="participant-name">${p.name}</span>
            </div>
          `
        )}
        <div class="participant-mode">
          <span class="mode-badge">${this._turnModeLabel()}</span>
        </div>
      </div>
    `;
  }

  private _turnModeLabel(): string {
    switch (this._cardConfig?.turn_mode) {
      case "round_robin": return "Round Robin";
      case "all_respond": return "All Respond";
      case "at_mention": return "@Mention";
      default: return "";
    }
  }

  private _renderMessage(msg: GroupChatMessage, idx: number) {
    if (msg.role === "user") {
      return html`
        <div class="msg msg-user ${this._editingIndex === idx ? "editing" : ""}">
          ${this._editingIndex === idx
            ? this._renderEditBubble(idx)
            : html`
                <div class="bubble user-bubble">${this._formatContent(msg.content)}</div>
                <div class="msg-actions">
                  ${!this._loading
                    ? html`
                        <button class="msg-btn" title="Edit" @click=${() => this._startEdit(idx)}>
                          ${editIcon}
                        </button>
                        <button class="msg-btn delete" title="Delete" @click=${() => this._deleteMessage(idx)}>
                          ${deleteIcon}
                        </button>
                      `
                    : nothing}
                </div>
              `}
        </div>
      `;
    }

    // Agent message
    const profileIdx = this._profiles.findIndex(
      (p) => p.profile_id === msg.profile_id
    );
    const hue = AGENT_HUES[profileIdx >= 0 ? profileIdx % AGENT_HUES.length : 0];
    const isLastAgent = idx === this._findLastAgentIndex();
    const isStreaming = this._streaming && this._streamingProfileId === msg.profile_id && idx === this._messages.length - 1;

    return html`
      <div class="agent-msg ${this._editingIndex === idx ? "editing" : ""}">
        ${msg.avatar
          ? html`<img class="msg-avatar" src="${msg.avatar}" alt="${msg.profile_name}" />`
          : html`<div class="msg-avatar placeholder">${(msg.profile_name ?? "?").charAt(0).toUpperCase()}</div>`}
        <div class="agent-body">
          <span class="msg-name" style="color: hsl(${hue}, 60%, 55%);">${msg.profile_name}</span>
          ${this._editingIndex === idx
            ? this._renderEditBubble(idx)
            : html`
                <div class="bubble agent-bubble ${isStreaming ? "streaming-cursor" : ""}" style="border-left: 3px solid hsl(${hue}, 60%, 55%);">
                  ${this._formatContent(msg.content)}
                </div>
                <div class="msg-actions">
                  ${this._cardConfig?.show_metadata && msg.metadata
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
                        <button
                          class="msg-btn speak ${this._speakingIndex === idx ? "speaking" : ""}"
                          title="Speak"
                          @click=${() => this._speakGroupMessage(idx)}
                        >
                          ${speakerIcon}
                        </button>
                        ${isLastAgent
                          ? html`<button class="msg-btn" title="Regenerate" @click=${() => this._regenerate()}>
                              ${regenerateIcon}
                            </button>`
                          : nothing}
                      `
                    : nothing}
                </div>
              `}
        </div>
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

  private _findLastAgentIndex(): number {
    for (let i = this._messages.length - 1; i >= 0; i--) {
      if (this._messages[i].role === "assistant") return i;
    }
    return -1;
  }

  private _formatContent(content: string) {
    const segments = parseFormattedText(content);
    return segments.map((seg) => {
      if (seg.type === "normal") return html`<span>${seg.text}</span>`;
      return html`<span class="text-${seg.type}">${seg.text}</span>`;
    });
  }

  // ---- Input & Mention ----

  private _onInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this._inputValue = input.value;

    // @mention autocomplete
    const lastAt = input.value.lastIndexOf("@");
    if (lastAt >= 0 && this._cardConfig?.turn_mode === "at_mention") {
      const afterAt = input.value.slice(lastAt + 1);
      // Only show if there's no space after the @ (still typing the name)
      if (!afterAt.includes(" ")) {
        this._mentionOpen = true;
        this._mentionFilter = afterAt.toLowerCase();
        return;
      }
    }
    this._mentionOpen = false;
  }

  private _renderMentionDropdown() {
    if (!this._mentionOpen || this._profiles.length === 0) return nothing;

    const filtered = this._profiles.filter((p) =>
      p.name.toLowerCase().includes(this._mentionFilter)
    );
    if (filtered.length === 0) return nothing;

    return html`
      <div class="mention-dropdown">
        ${filtered.map(
          (p) => html`
            <div
              class="mention-item"
              @click=${() => this._completeMention(p.name)}
            >
              ${p.avatar
                ? html`<img src="${p.avatar}" class="mention-avatar" />`
                : html`<span class="mention-avatar placeholder">${p.name.charAt(0)}</span>`}
              <span>${p.name}</span>
            </div>
          `
        )}
      </div>
    `;
  }

  private _completeMention(name: string): void {
    const lastAt = this._inputValue.lastIndexOf("@");
    if (lastAt >= 0) {
      this._inputValue = this._inputValue.slice(0, lastAt) + "@" + name + " ";
    }
    this._mentionOpen = false;
    // Focus back on input
    const input = this.shadowRoot?.querySelector("input");
    input?.focus();
  }

  // ---- Edit / Delete / Regenerate ----

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

    const updated = [...this._messages];
    updated[idx] = { ...this._messages[idx], content: newContent };
    this._messages = updated;
    this._editingIndex = -1;
    this._editValue = "";
  }

  private _deleteMessage(idx: number): void {
    const updated = [...this._messages];
    updated.splice(idx, 1);
    this._messages = updated;
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

    // Remove messages after the last user message
    this._messages = this._messages.slice(0, lastUserIdx + 1);
    const text = this._messages[lastUserIdx].content;
    await this._doSendMessage(text);
  }

  // ---- Send Message ----

  private async _sendMessage(): Promise<void> {
    const text = this._inputValue.trim();
    if (!text || !this._config?.card_id || this._loading) return;

    // Add user message
    this._messages = [
      ...this._messages,
      { role: "user", content: text, timestamp: Date.now() },
    ];
    this._inputValue = "";
    await this._doSendMessage(text);
  }

  private async _doSendMessage(text: string): Promise<void> {
    if (!this._config?.card_id || this._loading) return;

    if (this._cardConfig?.streaming_enabled) {
      await this._sendMessageStreaming(text);
    } else {
      await this._sendMessageSync(text);
    }
  }

  private async _sendMessageSync(text: string): Promise<void> {
    this._loading = true;
    this._scrollToBottom();

    try {
      const result = await this.hass.callWS<GroupInvokeResponse>({
        type: "proxlab/group/invoke",
        card_id: this._config!.card_id,
        message: text,
      });

      if (result.responses) {
        const newMessages: GroupChatMessage[] = result.responses.map((r) => ({
          role: "assistant" as const,
          content: r.response_text,
          timestamp: Date.now(),
          profile_id: r.profile_id,
          profile_name: r.profile_name,
          avatar: r.avatar,
          metadata: {
            tokens: r.tokens,
            duration_ms: r.duration_ms,
            model: r.model,
          },
        }));
        this._messages = [...this._messages, ...newMessages];

        // Auto-TTS for profiles that have it enabled
        for (const r of result.responses) {
          if (!r.success) continue;
          const profile = this._profiles.find(
            (p) => p.profile_id === r.profile_id
          );
          if (profile?.auto_tts && profile.tts_voices?.normal) {
            this._speakSegmentsForProfile(r.response_text, profile);
          }
        }
      }
    } catch (err) {
      this._messages = [
        ...this._messages,
        {
          role: "assistant",
          content: `Error: ${err}`,
          timestamp: Date.now(),
          profile_name: "System",
        },
      ];
    } finally {
      this._loading = false;
      this._scrollToBottom();
    }
  }

  private async _sendMessageStreaming(text: string): Promise<void> {
    this._loading = true;
    this._streaming = true;
    this._ttsBuffer = "";
    this._scrollToBottom();

    try {
      const unsub = await (this.hass as any).connection.subscribeMessage(
        (event: any) => {
          if (event.type === "profile_start") {
            // New agent is about to stream — add placeholder message
            this._streamingProfileId = event.profile_id;
            this._messages = [
              ...this._messages,
              {
                role: "assistant",
                content: "",
                timestamp: Date.now(),
                profile_id: event.profile_id,
                profile_name: event.profile_name,
                avatar: event.avatar,
              },
            ];
            this._ttsBuffer = "";
            this._scrollToBottom();
          } else if (event.type === "delta") {
            // Progressive text
            const msgIdx = this._messages.length - 1;
            if (msgIdx >= 0) {
              const updated = [...this._messages];
              updated[msgIdx] = {
                ...updated[msgIdx],
                content: (updated[msgIdx].content || "") + event.text,
              };
              this._messages = updated;
              this._scrollToBottom();

              // TTS chunking
              this._ttsBuffer += event.text;
              this._checkTtsChunk(event.profile_id);
            }
          } else if (event.type === "profile_done") {
            // Profile finished streaming
            const msgIdx = this._messages.length - 1;
            if (msgIdx >= 0) {
              const updated = [...this._messages];
              updated[msgIdx] = {
                ...updated[msgIdx],
                content: event.response_text || updated[msgIdx].content,
                metadata: {
                  tokens: event.tokens,
                  duration_ms: event.duration_ms,
                  model: event.model,
                },
              };
              this._messages = updated;
            }
            // Flush remaining TTS buffer
            this._flushTtsBuffer(event.profile_id);
            this._streamingProfileId = "";
          } else if (event.type === "done") {
            // All profiles done
            this._streaming = false;
            this._loading = false;
            this._streamingProfileId = "";
            this._scrollToBottom();
            unsub();
          } else if (event.type === "error") {
            this._messages = [
              ...this._messages,
              {
                role: "assistant",
                content: `Error: ${event.error}`,
                timestamp: Date.now(),
                profile_name: "System",
              },
            ];
            this._streaming = false;
            this._loading = false;
            this._scrollToBottom();
            unsub();
          }
        },
        {
          type: "proxlab/group/invoke_stream",
          card_id: this._config!.card_id,
          message: text,
        },
      );
    } catch (err) {
      this._messages = [
        ...this._messages,
        {
          role: "assistant",
          content: `Error: ${err}`,
          timestamp: Date.now(),
          profile_name: "System",
        },
      ];
      this._streaming = false;
      this._loading = false;
      this._scrollToBottom();
    }
  }

  // ---- TTS ----

  private async _speakGroupMessage(idx: number): Promise<void> {
    const msg = this._messages[idx];
    if (!msg || msg.role !== "assistant") return;

    // Find the profile for this message
    const profile = this._profiles.find((p) => p.profile_id === msg.profile_id);
    if (!profile) return;

    this._speakingIndex = idx;
    await this._speakSegmentsForProfile(msg.content, profile, () => {
      this._speakingIndex = -1;
    });
  }

  private async _speakSegmentsForProfile(
    responseText: string,
    profile: AgentProfile,
    onDone?: () => void,
  ): Promise<void> {
    const voices = profile.tts_voices;
    if (!voices) { onDone?.(); return; }

    const hasAnyVoice = voices.normal || voices.narration || voices.speech || voices.thoughts;
    if (!hasAnyVoice || !this.hass || !this._config?.card_id) { onDone?.(); return; }

    const segments = parseFormattedText(responseText);
    const reqSegments = segments
      .filter((s) => s.text.trim())
      .map((s) => ({ text: s.text, voice: voices[s.type as keyof typeof voices] || "" }))
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

  // ---- TTS Chunking (Streaming) ----

  private _checkTtsChunk(profileId: string): void {
    const profile = this._profiles.find((p) => p.profile_id === profileId);
    if (!profile?.auto_tts) return;

    const breakIdx = this._findChunkBreak(this._ttsBuffer);
    if (breakIdx > 0) {
      const chunk = this._ttsBuffer.substring(0, breakIdx);
      this._ttsBuffer = this._ttsBuffer.substring(breakIdx);
      this._speakSegmentsForProfile(chunk, profile);
    }
  }

  private _flushTtsBuffer(profileId: string): void {
    if (!this._ttsBuffer.trim()) return;
    const profile = this._profiles.find((p) => p.profile_id === profileId);
    if (profile?.auto_tts) {
      this._speakSegmentsForProfile(this._ttsBuffer, profile);
    }
    this._ttsBuffer = "";
  }

  private _findChunkBreak(text: string): number {
    if (text.length < 80) return -1;

    // Prefer paragraph breaks
    const paraIdx = text.indexOf("\n\n");
    if (paraIdx > 0) return paraIdx + 2;

    // Sentence endings after 80+ chars
    const sentenceEnds = [". ", "! ", "? ", ".\n", "!\n", "?\n"];
    for (let i = 80; i < text.length; i++) {
      for (const end of sentenceEnds) {
        if (text.substring(i, i + end.length) === end) {
          return i + end.length;
        }
      }
    }
    return -1;
  }

  // ---- Scroll ----

  private _scrollToBottom(): void {
    requestAnimationFrame(() => {
      const container = this.shadowRoot?.getElementById("messages");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }
}

customElements.define("proxlab-group-chat-card", ProxLabGroupChatCard);

// Register with HA card picker
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "proxlab-group-chat-card",
  name: "ProxLab Group Chat",
  description: "Multi-agent group chat card",
  preview: false,
});
