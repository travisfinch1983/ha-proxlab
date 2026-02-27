import { LitElement, html, nothing, PropertyValues } from "lit";
import { editorStyles } from "./styles";
import type {
  HomeAssistant,
  GroupChatCardYamlConfig,
  GroupChatCardConfig,
  AgentProfile,
} from "./types";

export class ProxLabGroupChatCardEditor extends LitElement {
  static styles = editorStyles;

  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _cardConfig: { state: true },
    _profiles: { state: true },
    _loaded: { state: true },
    _tab: { state: true },
  };

  hass!: HomeAssistant;
  _config?: GroupChatCardYamlConfig;
  _cardConfig: GroupChatCardConfig = {
    card_id: "",
    profile_ids: [],
    turn_mode: "round_robin",
    card_height: 600,
    show_metadata: false,
    allowed_users: [],
  };
  _profiles: AgentProfile[] = [];
  _loaded = false;
  _tab: "participants" | "settings" = "participants";

  setConfig(config: GroupChatCardYamlConfig): void {
    this._config = config;
    this._loaded = false;
  }

  protected async willUpdate(changed: PropertyValues): Promise<void> {
    if (this.hass && this._config?.card_id && !this._loaded) {
      this._loaded = true;
      await this._loadData();
    }
  }

  private async _loadData(): Promise<void> {
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

      this._profiles = profiles || [];

      if (config) {
        this._cardConfig = config;
      } else {
        this._cardConfig = {
          ...this._cardConfig,
          card_id: this._config!.card_id,
        };
      }
    } catch {
      // First run
    }
  }

  protected render() {
    return html`
      <div class="editor">
        <div class="tabs">
          ${(
            [
              ["participants", "Participants"],
              ["settings", "Settings"],
            ] as const
          ).map(
            ([id, label]) => html`
              <button
                class="tab ${this._tab === id ? "active" : ""}"
                @click=${() => { this._tab = id; }}
              >
                ${label}
              </button>
            `
          )}
        </div>
        <div class="tab-content">
          ${this._tab === "participants"
            ? this._renderParticipantsTab()
            : nothing}
          ${this._tab === "settings"
            ? this._renderSettingsTab()
            : nothing}
        </div>
      </div>
    `;
  }

  private _renderParticipantsTab() {
    if (this._profiles.length === 0) {
      return html`
        <div style="padding: 16px; text-align: center; opacity: 0.6;">
          <p>No agent profiles found.</p>
          <p style="font-size: 12px; margin-top: 8px;">
            Create profiles in the ProxLab panel under Agents → Profiles,
            or use "Save as Profile" in a chat card's Advanced tab.
          </p>
        </div>
      `;
    }

    const selected = new Set(this._cardConfig.profile_ids);

    return html`
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div class="sublabel" style="margin-bottom: 4px;">
          Select agent profiles to participate in this group chat.
          Order determines turn sequence for Round Robin mode.
        </div>
        ${this._profiles.map(
          (p) => html`
            <label
              class="profile-row"
              style="display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; border: 1px solid ${selected.has(p.profile_id)
                ? "var(--primary-color, #7c3aed)"
                : "var(--divider, #e5e7eb)"}; background: ${selected.has(p.profile_id)
                ? "var(--primary-color, #7c3aed)11"
                : "transparent"};"
            >
              <input
                type="checkbox"
                .checked=${selected.has(p.profile_id)}
                @change=${(e: Event) =>
                  this._toggleProfile(
                    p.profile_id,
                    (e.target as HTMLInputElement).checked
                  )}
                style="accent-color: var(--primary-color, #7c3aed);"
              />
              ${p.avatar
                ? html`<img
                    src="${p.avatar}"
                    style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;"
                  />`
                : html`<div
                    style="width: 32px; height: 32px; border-radius: 50%; background: var(--divider, #e5e7eb); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px;"
                  >
                    ${p.name.charAt(0).toUpperCase()}
                  </div>`}
              <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 500; font-size: 13px;">${p.name}</div>
                <div style="font-size: 11px; opacity: 0.6;">${p.agent_id}</div>
              </div>
            </label>
          `
        )}
      </div>
    `;
  }

  private _renderSettingsTab() {
    return html`
      <div class="field">
        <label>Turn Mode</label>
        <select
          .value=${this._cardConfig.turn_mode}
          @change=${(e: Event) =>
            this._updateField(
              "turn_mode",
              (e.target as HTMLSelectElement).value
            )}
        >
          <option value="round_robin">Round Robin — each agent responds in order</option>
          <option value="all_respond">All Respond — agents respond in parallel</option>
          <option value="at_mention">@Mention — only mentioned agents respond</option>
        </select>
      </div>

      <div class="field">
        <label>Card Height (px)</label>
        <input
          type="number"
          min="300"
          max="1200"
          .value=${String(this._cardConfig.card_height)}
          @change=${(e: Event) =>
            this._updateField(
              "card_height",
              parseInt((e.target as HTMLInputElement).value) || 600
            )}
        />
      </div>

      <div class="toggle-row">
        <div>
          <label>Show Metadata</label>
          <div class="sublabel">Display model, tokens, and timing on agent messages</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.show_metadata}
            @change=${(e: Event) =>
              this._updateField(
                "show_metadata",
                (e.target as HTMLInputElement).checked
              )}
          />
          <span class="slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <div>
          <label>Auto TTS</label>
          <div class="sublabel">Automatically voice all agent responses using profile TTS voices</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.auto_tts ?? false}
            @change=${(e: Event) =>
              this._updateField(
                "auto_tts",
                (e.target as HTMLInputElement).checked
              )}
          />
          <span class="slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <div>
          <label>Text Streaming</label>
          <div class="sublabel">Show text progressively as agents generate responses</div>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${this._cardConfig.streaming_enabled ?? false}
            @change=${(e: Event) =>
              this._updateField(
                "streaming_enabled",
                (e.target as HTMLInputElement).checked
              )}
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

  private _toggleProfile(profileId: string, checked: boolean): void {
    let ids = [...this._cardConfig.profile_ids];
    if (checked) {
      if (!ids.includes(profileId)) ids.push(profileId);
    } else {
      ids = ids.filter((id) => id !== profileId);
    }
    this._updateField("profile_ids", ids);
  }

  private _updateField(field: string, value: unknown): void {
    this._cardConfig = { ...this._cardConfig, [field]: value };
    this._saveAndFireEvent();
  }

  private async _saveAndFireEvent(): Promise<void> {
    if (this.hass && this._config?.card_id) {
      try {
        await this.hass.callWS({
          type: "proxlab/group/config/save",
          card_id: this._config.card_id,
          config: this._cardConfig,
        });
      } catch {
        // Save failed — will retry on next change
      }
    }

    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }
}

customElements.define(
  "proxlab-group-chat-card-editor",
  ProxLabGroupChatCardEditor
);
