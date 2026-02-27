import { LitElement, html, nothing } from "lit";
import { editorStyles } from "./styles";
import type {
  HomeAssistant,
  ProxLabChatCardYamlConfig,
  ProxLabChatCardConfig,
  AvailableAgent,
  TtsVoice,
  TtsVoices,
} from "./types";
import { DEFAULT_CARD_CONFIG } from "./types";
import { parseCharacterCardPNG } from "./character-card-parser";

type EditorTab = "general" | "voice" | "personality" | "prompt" | "advanced";

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
    _defaultPrompt: { state: true },
    _profileName: { state: true },
    _profileSaved: { state: true },
  };

  hass!: HomeAssistant;
  _config?: ProxLabChatCardYamlConfig;
  _cardConfig: ProxLabChatCardConfig = { ...DEFAULT_CARD_CONFIG };
  _tab: EditorTab = "general";
  _agents: AvailableAgent[] = [];
  _voices: TtsVoice[] = [];
  _loaded = false;
  _defaultPrompt = "";
  _profileName = "";
  _profileSaved = false;

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
        // Migrate old tts_voice → tts_voices if needed
        const raw = config as Record<string, unknown>;
        if (typeof raw.tts_voice === "string" && !raw.tts_voices) {
          (config as any).tts_voices = {
            normal: raw.tts_voice as string,
            narration: "",
            speech: "",
            thoughts: "",
          };
          delete (config as any).tts_voice;
        }
        // Ensure tts_voices exists even on older configs
        if (!config.tts_voices) {
          config.tts_voices = { normal: "", narration: "", speech: "", thoughts: "" };
        }
        this._cardConfig = config;
      } else {
        this._cardConfig = { ...DEFAULT_CARD_CONFIG, card_id: this._config!.card_id };
      }
      this._agents = agents || [];
      this._voices = voices || [];

      // Load the agent's default prompt
      this._loadAgentPrompt(this._cardConfig.agent_id);
    } catch {
      // First run, use defaults
    }
  }

  private async _loadAgentPrompt(agentId: string): Promise<void> {
    try {
      const result = await this.hass.callWS<{ prompt: string }>({
        type: "proxlab/card/agent_prompt",
        agent_id: agentId,
      });
      this._defaultPrompt = result?.prompt ?? "";
    } catch {
      this._defaultPrompt = "";
    }
  }

  protected render() {
    const customizeOn = this._cardConfig.customize_enabled;
    const tabs: { id: EditorTab; label: string; disabled: boolean }[] = [
      { id: "general", label: "General", disabled: false },
      { id: "voice", label: "Voice", disabled: false },
      { id: "personality", label: "Personality", disabled: !customizeOn },
      { id: "prompt", label: "Prompt", disabled: !customizeOn },
      { id: "advanced", label: "Advanced", disabled: false },
    ];

    return html`
      <div class="editor">
        <div class="tabs">
          ${tabs.map(
            (t) => html`
              <button
                class="tab ${this._tab === t.id ? "active" : ""} ${t.disabled ? "disabled" : ""}"
                @click=${() => { if (!t.disabled) this._tab = t.id; }}
              >
                ${t.label}
              </button>
            `
          )}
        </div>
        <div class="tab-content">
          ${this._tab === "general" ? this._renderGeneralTab() : nothing}
          ${this._tab === "voice" ? this._renderVoiceTab() : nothing}
          ${this._tab === "personality" ? this._renderPersonalityTab() : nothing}
          ${this._tab === "prompt" ? this._renderPromptTab() : nothing}
          ${this._tab === "advanced" ? this._renderAdvancedTab() : nothing}
        </div>
      </div>
    `;
  }

  // ---- Tabs ----

  private _renderGeneralTab() {
    return html`
      <div class="field">
        <label>Agent</label>
        <select
          .value=${this._cardConfig.agent_id}
          @change=${(e: Event) => {
            const val = (e.target as HTMLSelectElement).value;
            this._updateField("agent_id", val);
            this._loadAgentPrompt(val);
          }}
        >
          <option value="orchestrator" ?selected=${this._cardConfig.agent_id === "orchestrator"}>
            Orchestrator (Default Pipeline)
          </option>
          <option value="conversation_agent" ?selected=${this._cardConfig.agent_id === "conversation_agent"}>
            Conversation Agent
          </option>
          ${this._agents.map(
            (a) => html`<option value=${a.agent_id} ?selected=${this._cardConfig.agent_id === a.agent_id}>
              ${a.name}
            </option>`
          )}
        </select>
      </div>
      <div class="field">
        <label>Avatar</label>
        <div class="avatar-upload">
          ${this._cardConfig.avatar
            ? html`<img class="avatar-preview" src="${this._cardConfig.avatar}" />`
            : html`<div class="avatar-preview" style="display:flex;align-items:center;justify-content:center;background:var(--divider)">?</div>`}
          <input type="file" accept="image/*" @change=${this._onAvatarUpload} />
        </div>
      </div>
      <div class="field">
        <label>Title Override</label>
        <input
          type="text"
          placeholder="Default: agent/personality name"
          .value=${this._cardConfig.title_override}
          @input=${(e: Event) => this._updateField("title_override", (e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="field">
        <label>Status Override</label>
        <input
          type="text"
          placeholder="Default: Online"
          .value=${this._cardConfig.status_override}
          @input=${(e: Event) => this._updateField("status_override", (e.target as HTMLInputElement).value)}
        />
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
      <div class="field">
        <label>Portrait Width</label>
        <select
          .value=${String(this._cardConfig.portrait_width ?? "auto")}
          @change=${(e: Event) => {
            const val = (e.target as HTMLSelectElement).value;
            this._updateField("portrait_width", val === "auto" ? "auto" : parseInt(val));
          }}
        >
          <option value="auto" ?selected=${this._cardConfig.portrait_width === "auto"}>Auto (fit to card height)</option>
          <option value="150" ?selected=${this._cardConfig.portrait_width === 150}>150px</option>
          <option value="200" ?selected=${this._cardConfig.portrait_width === 200}>200px</option>
          <option value="250" ?selected=${this._cardConfig.portrait_width === 250}>250px</option>
          <option value="300" ?selected=${this._cardConfig.portrait_width === 300}>300px</option>
          <option value="350" ?selected=${this._cardConfig.portrait_width === 350}>350px</option>
          <option value="400" ?selected=${this._cardConfig.portrait_width === 400}>400px</option>
        </select>
        <div class="sublabel" style="font-size:11px;color:var(--card-secondary);margin-top:2px">
          Auto: full image visible. Manual: fills width, crops bottom (focuses on face).
        </div>
      </div>
      <div class="toggle-row">
        <div>
          <label>Hide Header</label>
          <div class="sublabel">Hide the title bar (portrait panel still shows if avatar set)</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.hide_header}
            @change=${(e: Event) => this._updateField("hide_header", (e.target as HTMLInputElement).checked)}
          />
          <span class="slider"></span>
        </label>
      </div>
      <div class="toggle-row">
        <div>
          <label>Customize</label>
          <div class="sublabel">Unlock Personality and Prompt tabs</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.customize_enabled}
            @change=${(e: Event) => {
              this._updateField("customize_enabled", (e.target as HTMLInputElement).checked);
            }}
          />
          <span class="slider"></span>
        </label>
      </div>
    `;
  }

  private _renderVoiceTab() {
    const voices = this._cardConfig.tts_voices ?? { normal: "", narration: "", speech: "", thoughts: "" };
    const voiceDropdown = (label: string, sublabel: string, field: keyof TtsVoices) => html`
      <div class="field">
        <label>${label}</label>
        <div class="sublabel" style="font-size:11px;color:var(--card-secondary);margin-bottom:2px">${sublabel}</div>
        <select
          .value=${voices[field]}
          @change=${(e: Event) => {
            const val = (e.target as HTMLSelectElement).value;
            this._updateField("tts_voices", { ...voices, [field]: val });
          }}
        >
          <option value="">Disabled</option>
          ${this._voices.map(
            (v) => html`<option value=${v.id} ?selected=${voices[field] === v.id}>
              ${v.name}
            </option>`
          )}
        </select>
      </div>
    `;

    return html`
      <div class="toggle-row">
        <div>
          <label>Auto TTS</label>
          <div class="sublabel">Automatically voice all agent responses</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.auto_tts ?? false}
            @change=${(e: Event) => this._updateField("auto_tts", (e.target as HTMLInputElement).checked)}
          />
          <span class="slider"></span>
        </label>
      </div>
      ${voiceDropdown("Normal Text", "Voice for unformatted text", "normal")}
      ${voiceDropdown("Narration", "Voice for *narration* text", "narration")}
      ${voiceDropdown("Speech", 'Voice for "speech" text', "speech")}
      ${voiceDropdown("Thoughts", "Voice for \`\`\`thoughts\`\`\` text", "thoughts")}
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

  private _renderPromptTab() {
    // Show the card's custom prompt, pre-populated from the agent's default if empty
    const currentPrompt = this._cardConfig.prompt_override;
    return html`
      <div class="field">
        <label>System Prompt</label>
        <div class="sublabel" style="margin-bottom:4px;font-size:12px;color:var(--card-secondary)">
          Override the agent's default prompt. Leave empty to use the agent's built-in prompt.
        </div>
        <textarea
          style="min-height:200px"
          placeholder="${this._defaultPrompt || 'Loading agent default prompt...'}"
          .value=${currentPrompt}
          @input=${(e: Event) => this._updateField("prompt_override", (e.target as HTMLTextAreaElement).value)}
        ></textarea>
      </div>
      ${this._defaultPrompt
        ? html`
            <button
              class="tab"
              style="align-self:flex-start;padding:6px 12px;border:1px solid var(--divider);border-radius:6px;cursor:pointer"
              @click=${() => this._updateField("prompt_override", this._defaultPrompt)}
            >
              Copy Agent Default
            </button>
          `
        : nothing}
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
      <div class="field">
        <label>Card ID</label>
        <input type="text" .value=${this._cardConfig.card_id} disabled />
      </div>

      <div style="border-top: 1px solid var(--divider, #e5e7eb); margin-top: 12px; padding-top: 12px;">
        <label style="font-weight: 600; font-size: 13px;">Save as Profile</label>
        <div class="sublabel" style="margin-bottom: 8px;">Create a reusable agent profile from this card's config</div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <input
            type="text"
            placeholder="Profile name"
            .value=${this._profileName}
            @input=${(e: Event) => { this._profileName = (e.target as HTMLInputElement).value; this._profileSaved = false; }}
            style="flex: 1; padding: 6px 10px; border: 1px solid var(--divider, #ccc); border-radius: 6px; font-size: 13px;"
          />
          <button
            style="padding: 6px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; border: none; background: var(--primary-color, #7c3aed); color: white;"
            @click=${this._saveAsProfile}
            ?disabled=${!this._profileName.trim()}
          >
            ${this._profileSaved ? "Saved!" : "Save"}
          </button>
        </div>
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

  private async _saveAsProfile(): Promise<void> {
    if (!this.hass || !this._profileName.trim()) return;
    const profileId = Math.random().toString(36).substring(2, 10);
    const profile = {
      name: this._profileName.trim(),
      agent_id: this._cardConfig.agent_id,
      avatar: this._cardConfig.avatar,
      prompt_override: this._cardConfig.prompt_override,
      personality_enabled: this._cardConfig.personality_enabled,
      personality: { ...this._cardConfig.personality },
      tts_voices: { ...this._cardConfig.tts_voices },
      auto_tts: this._cardConfig.auto_tts,
      portrait_width: this._cardConfig.portrait_width,
    };
    try {
      await this.hass.callWS({
        type: "proxlab/profile/save",
        profile_id: profileId,
        profile,
      });
      this._profileSaved = true;
      setTimeout(() => { this._profileSaved = false; }, 2000);
    } catch (err) {
      console.error("Failed to save profile:", err);
    }
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
        // Append timestamp to bust browser cache when replacing an existing avatar
        const bustUrl = result.url.split("?")[0] + "?v=" + Date.now();
        this._updateField("avatar", bustUrl);
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
          const bustUrl = result.url.split("?")[0] + "?v=" + Date.now();
          this._updateField("avatar", bustUrl);
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
