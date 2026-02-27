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
              : this._messages.map((msg) => this._renderMessage(msg))}
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

  private _renderMessage(msg: GroupChatMessage) {
    if (msg.role === "user") {
      return html`
        <div class="msg msg-user">
          <div class="bubble user-bubble">${this._formatContent(msg.content)}</div>
        </div>
      `;
    }

    // Agent message
    const profileIdx = this._profiles.findIndex(
      (p) => p.profile_id === msg.profile_id
    );
    const hue = AGENT_HUES[profileIdx >= 0 ? profileIdx % AGENT_HUES.length : 0];

    return html`
      <div class="msg agent-msg">
        ${msg.avatar
          ? html`<img class="msg-avatar" src="${msg.avatar}" alt="${msg.profile_name}" />`
          : html`<div class="msg-avatar placeholder">${(msg.profile_name ?? "?").charAt(0).toUpperCase()}</div>`}
        <div class="agent-body">
          <span class="msg-name" style="color: hsl(${hue}, 60%, 55%);">${msg.profile_name}</span>
          <div class="bubble agent-bubble" style="border-left: 3px solid hsl(${hue}, 60%, 55%);">
            ${this._formatContent(msg.content)}
          </div>
          ${this._cardConfig?.show_metadata && msg.metadata
            ? html`<div class="msg-meta">
                ${msg.metadata.model ? html`<span>${msg.metadata.model}</span>` : nothing}
                ${msg.metadata.tokens ? html`<span>${msg.metadata.tokens} tok</span>` : nothing}
                ${msg.metadata.duration_ms ? html`<span>${(msg.metadata.duration_ms / 1000).toFixed(1)}s</span>` : nothing}
              </div>`
            : nothing}
        </div>
      </div>
    `;
  }

  private _formatContent(content: string) {
    const segments = parseFormattedText(content);
    return segments.map((seg) => {
      if (seg.type === "normal") return html`<span>${seg.text}</span>`;
      return html`<span class="text-${seg.type}">${seg.text}</span>`;
    });
  }

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

  private async _sendMessage(): Promise<void> {
    const text = this._inputValue.trim();
    if (!text || !this._config?.card_id || this._loading) return;

    // Add user message
    this._messages = [
      ...this._messages,
      { role: "user", content: text, timestamp: Date.now() },
    ];
    this._inputValue = "";
    this._loading = true;
    this._scrollToBottom();

    try {
      const result = await this.hass.callWS<GroupInvokeResponse>({
        type: "proxlab/group/invoke",
        card_id: this._config.card_id,
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
            this._speakForProfile(r.response_text, profile);
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

  private async _speakForProfile(
    text: string,
    profile: AgentProfile
  ): Promise<void> {
    const voice = profile.tts_voices?.normal;
    if (!voice) return;
    try {
      await this.hass.callWS({
        type: "proxlab/card/tts/speak",
        text,
        voice,
      });
    } catch {
      // TTS failed — non-critical
    }
  }

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
