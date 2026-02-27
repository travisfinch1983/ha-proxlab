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
  tts_voices: TtsVoices;
  auto_tts: boolean;
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
  portrait_width: "auto" | number;
  /** When true, card loads all settings from the linked profile instead of local config */
  use_profile: boolean;
  /** ID of the linked agent profile (only used when use_profile=true) */
  profile_id: string;
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

/** Per-text-type TTS voice configuration */
export interface TtsVoices {
  normal: string;
  narration: string;
  speech: string;
  thoughts: string;
}

/** Agent Profile — reusable personality config for group chat */
export interface AgentProfile {
  profile_id: string;
  name: string;
  avatar: string;
  agent_id: string;
  connection_id: string;
  prompt_override: string;
  personality_enabled: boolean;
  personality: CharacterCardV3;
  tts_voices: TtsVoices;
  auto_tts: boolean;
  portrait_width: "auto" | number;
  per_card_memory: boolean;
  memory_universal_access: boolean;
}

/** Group chat turn mode */
export type GroupTurnMode = "round_robin" | "at_mention" | "all_respond";

/** Lovelace YAML config for group chat card (minimal) */
export interface GroupChatCardYamlConfig {
  type: "custom:proxlab-group-chat-card";
  card_id: string;
}

/** Full group chat card config — stored in HA Store */
export interface GroupChatCardConfig {
  card_id: string;
  profile_ids: string[];
  turn_mode: GroupTurnMode;
  card_height: number;
  show_metadata: boolean;
  allowed_users: string[];
}

/** A single message in group chat */
export interface GroupChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  profile_id?: string;
  profile_name?: string;
  avatar?: string;
  metadata?: { tokens?: number; duration_ms?: number; model?: string };
}

/** Single agent response from group invoke */
export interface GroupAgentResponse {
  profile_id: string;
  profile_name: string;
  avatar: string;
  success: boolean;
  response_text: string;
  agent_name: string;
  tokens: number;
  duration_ms: number;
  model: string;
}

/** Response from proxlab/group/invoke */
export interface GroupInvokeResponse {
  success: boolean;
  responses: GroupAgentResponse[];
  turn_mode: GroupTurnMode;
}

/** Default config for new group chat cards */
export const DEFAULT_GROUP_CARD_CONFIG: GroupChatCardConfig = {
  card_id: "",
  profile_ids: [],
  turn_mode: "round_robin",
  card_height: 600,
  show_metadata: false,
  allowed_users: [],
};

/** Default config for new cards */
export const DEFAULT_CARD_CONFIG: ProxLabChatCardConfig = {
  card_id: "",
  agent_id: "conversation_agent",
  prompt_override: "",
  avatar: "",
  tts_voices: { normal: "", narration: "", speech: "", thoughts: "" },
  auto_tts: false,
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
  portrait_width: "auto",
  use_profile: false,
  profile_id: "",
};
