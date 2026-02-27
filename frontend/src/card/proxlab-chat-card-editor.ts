import { LitElement, html, nothing } from "lit";
import { editorStyles } from "./styles";
import type {
  HomeAssistant,
  ProxLabChatCardYamlConfig,
  ProxLabChatCardConfig,
  AvailableAgent,
  TtsVoice,
  TtsVoices,
  AgentProfile,
} from "./types";
import { DEFAULT_CARD_CONFIG } from "./types";
import { parseCharacterCardPNG } from "./character-card-parser";

type EditorTab = "general" | "voice" | "advanced";

export class ProxLabChatCardEditor extends LitElement {
  static styles = editorStyles;

  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _cardConfig: { state: true },
    _tab: { state: true },
    _agents: { state: true },
    _voices: { state: true },
    _profiles: { state: true },
    _loaded: { state: true },
    _defaultPrompt: { state: true },
  };

  hass!: HomeAssistant;
  _config?: ProxLabChatCardYamlConfig;
  _cardConfig: ProxLabChatCardConfig = { ...DEFAULT_CARD_CONFIG };
  _tab: EditorTab = "general";
  _agents: AvailableAgent[] = [];
  _voices: TtsVoice[] = [];
  _profiles: AgentProfile[] = [];
  _loaded = false;
  _defaultPrompt = "";

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
      const [config, agents, voices, profiles] = await Promise.all([
        this.hass.callWS<ProxLabChatCardConfig | null>({
          type: "proxlab/card/config/get",
          card_id: this._config!.card_id,
        }),
        this.hass.callWS<AvailableAgent[]>({ type: "proxlab/agent/available" }),
        this.hass.callWS<TtsVoice[]>({ type: "proxlab/card/voices" }),
        this.hass.callWS<AgentProfile[]>({ type: "proxlab/profile/list" }),
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
        if (!config.tts_voices) {
          config.tts_voices = { normal: "", narration: "", speech: "", thoughts: "" };
        }
        // Ensure new fields have defaults
        if (config.use_profile === undefined) config.use_profile = false;
        if (!config.profile_id) config.profile_id = "";
        this._cardConfig = config;
      } else {
        this._cardConfig = { ...DEFAULT_CARD_CONFIG, card_id: this._config!.card_id };
      }
      this._agents = agents || [];
      this._voices = voices || [];
      this._profiles = profiles || [];

      // Load the agent's default prompt
      if (!this._cardConfig.use_profile) {
        this._loadAgentPrompt(this._cardConfig.agent_id);
      }
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
    const tabs: { id: EditorTab; label: string }[] = [
      { id: "general", label: "General" },
      { id: "voice", label: "Voice" },
      { id: "advanced", label: "Advanced" },
    ];

    return html`
      <div class="editor">
        <div class="tabs">
          ${tabs.map(
            (t) => html`
              <button
                class="tab ${this._tab === t.id ? "active" : ""}"
                @click=${() => { this._tab = t.id; }}
              >
                ${t.label}
              </button>
            `
          )}
        </div>
        <div class="tab-content">
          ${this._tab === "general" ? this._renderGeneralTab() : nothing}
          ${this._tab === "voice" ? this._renderVoiceTab() : nothing}
          ${this._tab === "advanced" ? this._renderAdvancedTab() : nothing}
        </div>
      </div>
    `;
  }

  // ---- Tabs ----

  private _renderGeneralTab() {
    const useProfile = this._cardConfig.use_profile;

    return html`
      <!-- Mode toggle -->
      <div class="toggle-row" style="margin-bottom: 8px;">
        <div>
          <label>Use Agent Profile</label>
          <div class="sublabel">Link this card to a saved agent profile from the Profiles tab</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${useProfile}
            @change=${(e: Event) => {
              this._updateField("use_profile", (e.target as HTMLInputElement).checked);
            }}
          />
          <span class="slider"></span>
        </label>
      </div>

      ${useProfile ? this._renderProfileMode() : this._renderDefaultMode()}
    `;
  }

  private _renderProfileMode() {
    const selectedProfile = this._profiles.find(
      (p) => p.profile_id === this._cardConfig.profile_id
    );

    return html`
      <!-- Profile selector -->
      <div class="field">
        <label>Agent Profile</label>
        <select
          .value=${this._cardConfig.profile_id}
          @change=${(e: Event) => {
            this._updateField("profile_id", (e.target as HTMLSelectElement).value);
          }}
        >
          <option value="">Select a profile...</option>
          ${this._profiles.map(
            (p) => html`<option value=${p.profile_id} ?selected=${this._cardConfig.profile_id === p.profile_id}>
              ${p.name}${p.personality_enabled && p.personality?.name ? ` (${p.personality.name})` : ""}
            </option>`
          )}
        </select>
      </div>

      ${selectedProfile
        ? html`
            <!-- Profile preview -->
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; background: var(--secondary-background-color, #f5f5f5); margin-top: 4px;">
              ${selectedProfile.avatar
                ? html`<img src="${selectedProfile.avatar}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;" />`
                : html`<div style="width: 48px; height: 48px; border-radius: 50%; background: var(--divider-color, #e5e7eb); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 18px;">${selectedProfile.name.charAt(0).toUpperCase()}</div>`}
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 14px;">${selectedProfile.name}</div>
                <div style="font-size: 12px; opacity: 0.6;">${selectedProfile.connection_id ? `Connection: ${selectedProfile.connection_id}` : `Agent: ${selectedProfile.agent_id}`}</div>
                ${selectedProfile.personality_enabled
                  ? html`<div style="font-size: 11px; opacity: 0.5; margin-top: 2px;">Character: ${selectedProfile.personality?.name || "Unnamed"}</div>`
                  : nothing}
              </div>
            </div>
            <div style="font-size: 11px; opacity: 0.5; margin-top: 8px; padding: 0 2px;">
              All agent settings are managed in the ProxLab panel under Agents → Profiles.
              Changes made there will be reflected on all cards using this profile.
            </div>
          `
        : nothing}

      ${this._profiles.length === 0
        ? html`
            <div style="text-align: center; padding: 16px; opacity: 0.5; font-size: 13px;">
              <p>No profiles found.</p>
              <p style="margin-top: 4px;">Create profiles in the ProxLab panel under Agents → Profiles.</p>
            </div>
          `
        : nothing}

      <!-- Card-level display overrides (not profile fields) -->
      <div style="border-top: 1px solid var(--divider-color, #e5e7eb); margin-top: 12px; padding-top: 12px;">
        <div class="field">
          <label>Title Override</label>
          <input
            type="text"
            placeholder="Default: profile/character name"
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
        <div class="toggle-row">
          <div>
            <label>Hide Header</label>
            <div class="sublabel">Hide the title bar</div>
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
      </div>
    `;
  }

  private _renderDefaultMode() {
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
    `;
  }

  private _renderVoiceTab() {
    // In profile mode, voice is managed by the profile — show read-only info
    if (this._cardConfig.use_profile) {
      const profile = this._profiles.find(
        (p) => p.profile_id === this._cardConfig.profile_id
      );
      if (profile) {
        const v = profile.tts_voices || { normal: "", narration: "", speech: "", thoughts: "" };
        const voiceName = (id: string) => this._voices.find((vo) => vo.id === id)?.name ?? id ?? "None";
        return html`
          <div style="padding: 4px 0; opacity: 0.7; font-size: 13px;">
            Voice settings are managed by the linked profile. Edit in Agents → Profiles.
          </div>
          <div class="field">
            <label>Normal: <strong>${voiceName(v.normal)}</strong></label>
          </div>
          <div class="field">
            <label>Narration: <strong>${voiceName(v.narration)}</strong></label>
          </div>
          <div class="field">
            <label>Speech: <strong>${voiceName(v.speech)}</strong></label>
          </div>
          <div class="field">
            <label>Thoughts: <strong>${voiceName(v.thoughts)}</strong></label>
          </div>
          <div class="field">
            <label>Auto TTS: <strong>${profile.auto_tts ? "On" : "Off"}</strong></label>
          </div>
        `;
      }
      return html`<div style="opacity: 0.5; padding: 12px;">Select an agent profile first.</div>`;
    }

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
    `;
  }

  // ---- Actions ----

  private _updateField(field: string, value: unknown): void {
    this._cardConfig = { ...this._cardConfig, [field]: value };
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
        // Append timestamp to bust browser cache when replacing an existing avatar
        const bustUrl = result.url.split("?")[0] + "?v=" + Date.now();
        this._updateField("avatar", bustUrl);
      } catch {
        // Upload failed
      }
    };
    reader.readAsDataURL(file);
  }
}

// Manual custom element registration (no decorators)
customElements.define("proxlab-chat-card-editor", ProxLabChatCardEditor);
