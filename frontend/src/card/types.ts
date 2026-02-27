/** Minimal HA hass object available to Lovelace cards */
export interface HomeAssistant {
  callWS: <T>(msg: Record<string, unknown>) => Promise<T>;
  states: Record<string, { state: string; attributes: Record<string, unknown> }>;
  user: { id: string; name: string; is_admin: boolean };
  language: string;
  themes: { theme: string; darkMode: boolean };
  config: { components: string[] };
}

/** Lovelace card config — stored in dashboard YAML (minimal) */
export interface ProxLabChatCardYamlConfig {
  type: "custom:proxlab-chat-card";
  card_id: string;
}

/** Full card config — stored in HA Store (proxlab.chat_cards) */
export interface ProxLabChatCardConfig {
  card_id: string;
  agent_id: string;
  prompt_override: string;
  avatar: string;
  tts_voice: string;
  stt_enabled: boolean;
  personality_enabled: boolean;
  personality: CharacterCardV3;
  per_card_memory: boolean;
  allowed_users: string[];
  show_metadata: boolean;
  card_height: number;
  customize_enabled: boolean;
  title_override: string;
  status_override: string;
  hide_header: boolean;
}

/** Character Card V3 personality fields (SillyTavern-compatible) */
export interface CharacterCardV3 {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  tags: string[];
  creator_notes: string;
}

/** A single chat message */
export interface CardChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: {
    agent_name?: string;
    tokens?: number;
    duration_ms?: number;
    model?: string;
    tool_results?: unknown[];
  };
}

/** Response from proxlab/card/invoke */
export interface CardInvokeResponse {
  success: boolean;
  response_text: string;
  agent_name: string;
  tokens: number;
  duration_ms: number;
  model: string;
  tool_results: unknown[];
  tts_audio_url?: string;
}

/** Available agent info */
export interface AvailableAgent {
  agent_id: string;
  name: string;
  description: string;
}

/** TTS voice option */
export interface TtsVoice {
  id: string;
  name: string;
  language: string;
}

/** Default config for new cards */
export const DEFAULT_CARD_CONFIG: ProxLabChatCardConfig = {
  card_id: "",
  agent_id: "conversation",
  prompt_override: "",
  avatar: "",
  tts_voice: "",
  stt_enabled: false,
  personality_enabled: false,
  personality: {
    name: "",
    description: "",
    personality: "",
    scenario: "",
    first_mes: "",
    mes_example: "",
    system_prompt: "",
    post_history_instructions: "",
    alternate_greetings: [],
    tags: [],
    creator_notes: "",
  },
  per_card_memory: false,
  allowed_users: [],
  show_metadata: true,
  card_height: 500,
  customize_enabled: false,
  title_override: "",
  status_override: "",
  hide_header: false,
};
