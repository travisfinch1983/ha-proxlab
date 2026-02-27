import { LitElement, html, nothing } from "lit";
import { editorStyles } from "./styles";
import type {
  HomeAssistant,
  ProxLabChatCardYamlConfig,
  ProxLabChatCardConfig,
  AvailableAgent,
  TtsVoice,
} from "./types";
import { DEFAULT_CARD_CONFIG } from "./types";
import { parseCharacterCardPNG } from "./character-card-parser";

type EditorTab = "basic" | "personality" | "appearance" | "voice" | "advanced";

export class ProxLabChatCardEditor extends LitElement {
  static styles = editorStyles;

  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _cardConfig: { state: true },
    _tab: { state: true },
    _agents: { state: true },
    _voices: { state: true },
    _loaded: { state: true },
  };

  hass!: HomeAssistant;
  _config?: ProxLabChatCardYamlConfig;
  _cardConfig: ProxLabChatCardConfig = { ...DEFAULT_CARD_CONFIG };
  _tab: EditorTab = "basic";
  _agents: AvailableAgent[] = [];
  _voices: TtsVoice[] = [];
  _loaded = false;

  setConfig(config: ProxLabChatCardYamlConfig): void {
    this._config = config;
    this._loaded = false;
  }

  protected async willUpdate(): Promise<void> {
    if (this.hass && this._config?.card_id && !this._loaded) {
      this._loaded = true;
      await this._loadData();
    }
  }

  private async _loadData(): Promise<void> {
    try {
      const [config, agents, voices] = await Promise.all([
        this.hass.callWS<ProxLabChatCardConfig | null>({
          type: "proxlab/card/config/get",
          card_id: this._config!.card_id,
        }),
        this.hass.callWS<AvailableAgent[]>({ type: "proxlab/agent/available" }),
        this.hass.callWS<TtsVoice[]>({ type: "proxlab/card/voices" }),
      ]);

      if (config) {
        this._cardConfig = config;
      } else {
        this._cardConfig = { ...DEFAULT_CARD_CONFIG, card_id: this._config!.card_id };
      }
      this._agents = agents || [];
      this._voices = voices || [];
    } catch {
      // First run, use defaults
    }
  }

  protected render() {
    return html`
      <div class="editor">
        <div class="tabs">
          ${(["basic", "personality", "appearance", "voice", "advanced"] as EditorTab[]).map(
            (tab) => html`
              <button
                class="tab ${this._tab === tab ? "active" : ""}"
                @click=${() => { this._tab = tab; }}
              >
                ${tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            `
          )}
        </div>
        <div class="tab-content">
          ${this._tab === "basic" ? this._renderBasicTab() : nothing}
          ${this._tab === "personality" ? this._renderPersonalityTab() : nothing}
          ${this._tab === "appearance" ? this._renderAppearanceTab() : nothing}
          ${this._tab === "voice" ? this._renderVoiceTab() : nothing}
          ${this._tab === "advanced" ? this._renderAdvancedTab() : nothing}
        </div>
      </div>
    `;
  }

  // ---- Tabs ----

  private _renderBasicTab() {
    return html`
      <div class="field">
        <label>Agent</label>
        <select
          .value=${this._cardConfig.agent_id}
          @change=${(e: Event) => this._updateField("agent_id", (e.target as HTMLSelectElement).value)}
        >
          <option value="conversation">Default (Orchestrator)</option>
          ${this._agents.map(
            (a) => html`<option value=${a.agent_id} ?selected=${this._cardConfig.agent_id === a.agent_id}>
              ${a.name}
            </option>`
          )}
        </select>
      </div>
      <div class="field">
        <label>Custom Prompt</label>
        <textarea
          placeholder="Override the agent's default prompt..."
          .value=${this._cardConfig.prompt_override}
          @input=${(e: Event) => this._updateField("prompt_override", (e.target as HTMLTextAreaElement).value)}
        ></textarea>
      </div>
      <div class="field">
        <label>Card Height (px)</label>
        <input
          type="number"
          min="200"
          max="1200"
          .value=${String(this._cardConfig.card_height)}
          @input=${(e: Event) => this._updateField("card_height", parseInt((e.target as HTMLInputElement).value) || 500)}
        />
      </div>
    `;
  }

  private _renderPersonalityTab() {
    const p = this._cardConfig.personality;
    return html`
      <div class="toggle-row">
        <div>
          <label>Enable Personality</label>
          <div class="sublabel">Use Character Card V3 personality fields</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.personality_enabled}
            @change=${(e: Event) => this._updateField("personality_enabled", (e.target as HTMLInputElement).checked)}
          />
          <span class="slider"></span>
        </label>
      </div>

      ${this._cardConfig.personality_enabled
        ? html`
            <div class="field">
              <label>Import Character Card PNG</label>
              <input type="file" accept=".png" @change=${this._onPngUpload} />
            </div>
            <div class="field">
              <label>Character Name</label>
              <input
                type="text"
                .value=${p.name}
                @input=${(e: Event) => this._updatePersonality("name", (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="field">
              <label>Description</label>
              <textarea
                .value=${p.description}
                @input=${(e: Event) => this._updatePersonality("description", (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>
            <div class="field">
              <label>Personality</label>
              <textarea
                .value=${p.personality}
                @input=${(e: Event) => this._updatePersonality("personality", (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>
            <div class="field">
              <label>Scenario</label>
              <textarea
                .value=${p.scenario}
                @input=${(e: Event) => this._updatePersonality("scenario", (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>
            <div class="field">
              <label>System Prompt</label>
              <textarea
                .value=${p.system_prompt}
                @input=${(e: Event) => this._updatePersonality("system_prompt", (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>
            <div class="field">
              <label>First Message</label>
              <textarea
                .value=${p.first_mes}
                @input=${(e: Event) => this._updatePersonality("first_mes", (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>
            <div class="field">
              <label>Example Dialogue</label>
              <textarea
                .value=${p.mes_example}
                @input=${(e: Event) => this._updatePersonality("mes_example", (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>
            <div class="field">
              <label>Post-History Instructions</label>
              <textarea
                .value=${p.post_history_instructions}
                @input=${(e: Event) => this._updatePersonality("post_history_instructions", (e.target as HTMLTextAreaElement).value)}
              ></textarea>
            </div>
          `
        : nothing}
    `;
  }

  private _renderAppearanceTab() {
    return html`
      <div class="field">
        <label>Avatar</label>
        <div class="avatar-upload">
          ${this._cardConfig.avatar
            ? html`<img class="avatar-preview" src="${this._cardConfig.avatar}" />`
            : html`<div class="avatar-preview" style="display:flex;align-items:center;justify-content:center;background:var(--divider)">?</div>`}
          <input type="file" accept="image/*" @change=${this._onAvatarUpload} />
        </div>
      </div>
      <div class="toggle-row">
        <div>
          <label>Show Metadata</label>
          <div class="sublabel">Display model, tokens, and timing on messages</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.show_metadata}
            @change=${(e: Event) => this._updateField("show_metadata", (e.target as HTMLInputElement).checked)}
          />
          <span class="slider"></span>
        </label>
      </div>
    `;
  }

  private _renderVoiceTab() {
    return html`
      <div class="field">
        <label>TTS Voice</label>
        <select
          .value=${this._cardConfig.tts_voice}
          @change=${(e: Event) => this._updateField("tts_voice", (e.target as HTMLSelectElement).value)}
        >
          <option value="">Disabled</option>
          ${this._voices.map(
            (v) => html`<option value=${v.id} ?selected=${this._cardConfig.tts_voice === v.id}>
              ${v.name}
            </option>`
          )}
        </select>
      </div>
      <div class="toggle-row">
        <div>
          <label>Speech-to-Text</label>
          <div class="sublabel">Enable microphone input for voice messages</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.stt_enabled}
            @change=${(e: Event) => this._updateField("stt_enabled", (e.target as HTMLInputElement).checked)}
          />
          <span class="slider"></span>
        </label>
      </div>
    `;
  }

  private _renderAdvancedTab() {
    return html`
      <div class="toggle-row">
        <div>
          <label>Per-Card Memory</label>
          <div class="sublabel">Create a separate Milvus collection for this card's conversations</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.per_card_memory}
            @change=${(e: Event) => this._updateField("per_card_memory", (e.target as HTMLInputElement).checked)}
          />
          <span class="slider"></span>
        </label>
      </div>
      <div class="field">
        <label>Card ID</label>
        <input type="text" .value=${this._cardConfig.card_id} disabled />
      </div>
    `;
  }

  // ---- Actions ----

  private _updateField(field: string, value: unknown): void {
    this._cardConfig = { ...this._cardConfig, [field]: value };
    this._saveAndFireEvent();
  }

  private _updatePersonality(field: string, value: string): void {
    this._cardConfig = {
      ...this._cardConfig,
      personality: { ...this._cardConfig.personality, [field]: value },
    };
    this._saveAndFireEvent();
  }

  private async _saveAndFireEvent(): Promise<void> {
    // Save to HA Store
    if (this.hass && this._config?.card_id) {
      try {
        await this.hass.callWS({
          type: "proxlab/card/config/save",
          card_id: this._config.card_id,
          config: this._cardConfig,
        });
      } catch {
        // Save failed — will retry on next change
      }
    }

    // Fire config-changed for HA card editor
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  private async _onAvatarUpload(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !this.hass || !this._config?.card_id) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const result = await this.hass.callWS<{ url: string }>({
          type: "proxlab/card/avatar/upload",
          card_id: this._config!.card_id,
          data: base64,
          filename: file.name,
        });
        this._updateField("avatar", result.url);
      } catch {
        // Upload failed
      }
    };
    reader.readAsDataURL(file);
  }

  private async _onPngUpload(e: Event): Promise<void> {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const card = await parseCharacterCardPNG(file);
    if (card) {
      this._cardConfig = {
        ...this._cardConfig,
        personality: card,
        personality_enabled: true,
      };
      this._saveAndFireEvent();
    }

    // Also try to use the PNG as avatar
    if (this.hass && this._config?.card_id) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const result = await this.hass.callWS<{ url: string }>({
            type: "proxlab/card/avatar/upload",
            card_id: this._config!.card_id,
            data: base64,
            filename: file.name,
          });
          this._updateField("avatar", result.url);
        } catch {
          // Avatar upload from PNG failed
        }
      };
      reader.readAsDataURL(file);
    }
  }
}

// Manual custom element registration (no decorators)
customElements.define("proxlab-chat-card-editor", ProxLabChatCardEditor);
