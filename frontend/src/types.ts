/** Home Assistant hass object (subset we use). */
export interface Hass {
  callWS: <T>(msg: Record<string, unknown>) => Promise<T>;
  connection: {
    subscribeEvents: (
      callback: (event: unknown) => void,
      eventType: string
    ) => Promise<() => void>;
  };
  states: Record<string, unknown>;
  user: { id: string; name: string; is_admin: boolean };
  language: string;
}

export interface Connection {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  capabilities: string[];
  connection_type?: string;
  // LLM fields
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  keep_alive?: string;
  proxy_headers?: Record<string, string>;
  thinking_enabled?: boolean;
  // TTS fields
  voice?: string;
  speed?: number;
  format?: string;
  // STT fields
  language?: string;
  // Embeddings fields
  embedding_provider?: string;
  // Per-connection tool config
  tool_description?: string;
  auto_include_context?: boolean;
  // Endpoint detection
  is_universal?: boolean;
  // Capability overrides (3-state: force_enable / force_disable)
  capability_overrides?: Record<string, "force_enable" | "force_disable">;
}

export interface ConnectionHealth {
  reachable: boolean;
  api_valid: boolean;
  detail: string;
  error: string | null;
  model_name: string | null;
  available_models?: string[] | null;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  mandatory: boolean;
  required_capabilities: string[][];
  has_prompt: boolean;
  gates: string[];
}

export interface AgentConfig {
  enabled: boolean;
  primary_connection: string | null;
  secondary_connection: string | null;
  system_prompt: string | null;
  primary_model_override?: string | null;
  enabled_tools?: string[] | null;
}

export interface AgentInfo extends AgentDefinition {
  config: AgentConfig;
  default_prompt: string;
  group: "primary" | "optional" | "system";
}

export interface ContextSettings {
  context_mode: string;
  context_format: string;
  direct_entities: string;
  max_context_tokens: number;
}

export interface VectorDbSettings {
  vector_db_backend: string;
  // ChromaDB
  vector_db_host: string;
  vector_db_port: number;
  vector_db_collection: string;
  vector_db_top_k: number;
  vector_db_similarity_threshold: number;
  // Milvus
  milvus_host?: string;
  milvus_port?: number;
  milvus_collection?: string;
  // Weaviate
  weaviate_url?: string;
  weaviate_api_key?: string;
  weaviate_collection?: string;
}

export interface MemorySettings {
  memory_enabled: boolean;
  memory_universal_access: boolean;
  memory_max_memories: number;
  memory_min_importance: number;
  memory_min_words: number;
  memory_context_top_k: number;
  memory_collection_name: string;
}

export interface GeneralSettings {
  proxlab_url: string;
  history_enabled: boolean;
  history_max_messages: number;
  history_max_tokens: number;
  session_persistence_enabled: boolean;
  session_timeout: number;
  tools_max_calls_per_turn: number;
  tools_timeout: number;
  debug_logging: boolean;
  streaming_enabled: boolean;
}

export interface ProxLabConfig {
  entry_id: string;
  connections: Record<string, Connection>;
  roles: Record<string, string | null>;
  agents: AgentInfo[];
  health: Record<string, ConnectionHealth>;
  context: ContextSettings;
  vector_db: VectorDbSettings | null;
  memory: MemorySettings;
  settings: GeneralSettings;
}

export type HealthStatus = "connected" | "unreachable" | "api_mismatch";

export function getHealthStatus(h: ConnectionHealth | undefined): HealthStatus {
  if (!h || !h.reachable) return "unreachable";
  if (!h.api_valid) return "api_mismatch";
  return "connected";
}

export function healthBadgeClass(status: HealthStatus): string {
  switch (status) {
    case "connected":
      return "badge-success";
    case "unreachable":
      return "badge-error";
    case "api_mismatch":
      return "badge-warning";
  }
}

export function healthLabel(status: HealthStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "unreachable":
      return "Unreachable";
    case "api_mismatch":
      return "API Mismatch";
  }
}

// --- Agent Registry: Subscriptions, Schedules, Chains ---

export interface Subscription {
  id: string;
  event_type: string;
  event_filter: Record<string, unknown>;
  agent_id: string;
  message_template: string;
  context_template: string | null;
  cooldown_seconds: number;
  enabled: boolean;
  created_at: number;
  last_triggered: number | null;
  trigger_count: number;
}

export interface Schedule {
  id: string;
  agent_id: string;
  schedule_type: "interval" | "time_of_day";
  schedule_config: Record<string, number>;
  message_template: string;
  context_template: string | null;
  cooldown_seconds: number;
  enabled: boolean;
  created_at: number;
  last_triggered: number | null;
  trigger_count: number;
}

export interface ChainStep {
  agent_id: string;
  message_template?: string;
  context_template?: string | null;
  context_includes?: string[];
}

export interface Chain {
  id: string;
  name: string;
  steps: ChainStep[];
  enabled: boolean;
  created_at: number;
  last_run: number | null;
  run_count: number;
}

export interface ChainRunResult {
  chain_id: string;
  chain_name: string;
  steps_completed: number;
  steps_total: number;
  results: unknown[];
  final_response: string;
}

// --- MCP Marketplace ---

export interface McpRepo {
  id: string;
  url: string;
  name: string;
  added_at: number;
  last_fetched: number;
  servers_available: number;
}

export interface McpParameter {
  key: string;
  description: string;
  required: boolean;
  default?: string;
}

export interface McpCatalogServer {
  id: string;
  name: string;
  description: string;
  version: string;
  transport: "stdio" | "sse" | "streamable_http";
  command?: string;
  args?: string[];
  requirements?: string[];
  parameters?: McpParameter[];
  tags?: string[];
  icon?: string;
  installed?: boolean;
  repo_id?: string;
  repo_name?: string;
}

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpServer {
  id: string;
  name: string;
  description: string;
  repo_id: string;
  catalog_id: string;
  transport: "stdio" | "sse" | "streamable_http";
  enabled: boolean;
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  headers: Record<string, string>;
  parameters: Record<string, string>;
  tools: McpToolDef[];
  created_at: number;
  last_connected: number | null;
  status: "connected" | "disconnected" | "error" | "starting";
  error: string | null;
}

// --- Agent Profiles ---

export interface AgentProfile {
  profile_id: string;
  name: string;
  avatar: string;
  agent_id: string;
  connection_id: string;
  model_override?: string;
  tool_set?: string;
  enabled_tools?: string[];
  prompt_override: string;
  personality_enabled: boolean;
  personality: {
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
  };
  tts_voices: { normal: string; narration: string; speech: string; thoughts: string };
  portrait_width: "auto" | number;
  per_card_memory: boolean;
  memory_universal_access: boolean;
}

// --- Group Chat Cards ---

export interface GroupChatCardConfig {
  card_id: string;
  profile_ids: string[];
  turn_mode: "round_robin" | "at_mention" | "all_respond";
  card_height: number;
  show_metadata: boolean;
  allowed_users: string[];
}

export interface DiscoveredModel {
  id: string;
  connection_id: string;
  connection_name: string;
  provider: string;
  context_length: number | null;
  parameter_count: string | null;
  quantization: string | null;
  architecture: string | null;
  family: string | null;
  format: string | null;
  supports_vision: boolean;
  supports_audio: boolean;
  supports_embeddings: boolean;
  supports_tts: boolean;
  supports_stt: boolean;
  supports_tool_use: boolean;
  supports_reranker: boolean;
  size_bytes: number | null;
  size_vram_bytes: number | null;
  is_loaded: boolean;
  generation_speed: number | null;
  prompt_speed: number | null;
  uptime_seconds: number | null;
  queue_depth: number | null;
  extras: Record<string, unknown>;
  status: string;
  error: string | null;
}

export interface HfEnrichment {
  hf_repo: string;
  description: string;
  pipeline_tag: string;
  model_type: string;
  tags: string[];
  license: string;
  author: string;
  last_modified: string;
  downloads: number;
  likes: number;
  logo_url: string;
  card_data: Record<string, unknown>;
  fetched_at: number;
  status: "ok" | "not_found" | "error" | "unmapped";
}

export type ModelLogoMap = Record<string, string>;

export interface HfReadmeResult {
  base_repo: string | null;
  base_readme: string;
  quant_repo: string | null;
  quant_readme: string;
}

export const CAPABILITY_LABELS: Record<string, string> = {
  conversation: "Conversational LLM",
  tool_use: "Tool Use (LLM)",
  tts: "Text-to-Speech",
  stt: "Speech-to-Text",
  embeddings: "Embeddings",
  reranker: "Reranker",
  multimodal_embeddings: "Multimodal Embeddings",
  specialized: "Specialized",
  vision: "Vision Capable",
};

export const CAPABILITY_COLORS: Record<string, { badge: string; dot: string }> = {
  conversation:          { badge: "badge-primary",   dot: "bg-primary" },
  tool_use:              { badge: "badge-secondary", dot: "bg-secondary" },
  tts:                   { badge: "badge-accent",    dot: "bg-accent" },
  stt:                   { badge: "badge-info",      dot: "bg-info" },
  embeddings:            { badge: "badge-success",   dot: "bg-success" },
  reranker:              { badge: "badge-warning",   dot: "bg-warning" },
  multimodal_embeddings: { badge: "badge-error",     dot: "bg-error" },
  specialized:           { badge: "badge-neutral",   dot: "bg-neutral" },
  vision:                { badge: "badge-ghost border-purple-400 text-purple-400", dot: "bg-purple-500" },
};

export const ALL_CAPABILITIES = [
  "conversation",
  "tool_use",
  "tts",
  "stt",
  "embeddings",
  "reranker",
  "multimodal_embeddings",
  "specialized",
  "vision",
] as const;

/** Deprecated capabilities stripped from storage — no longer valid in the UI. */
const RETIRED_CAPABILITIES = new Set(["external_llm"]);

export function computeEffectiveCaps(
  overrides: Record<string, "force_enable" | "force_disable"> | undefined,
  detected: Set<string>,
): string[] {
  const eff = new Set(detected);
  if (overrides) {
    for (const [cap, mode] of Object.entries(overrides)) {
      if (mode === "force_enable") eff.add(cap);
      else if (mode === "force_disable") eff.delete(cap);
    }
  }
  // Strip retired capabilities
  for (const cap of RETIRED_CAPABILITIES) eff.delete(cap);
  return [...eff].sort();
}

/** Strip retired capabilities from a stored capabilities array. */
export function cleanStoredCaps(caps: string[]): string[] {
  return caps.filter((c) => !RETIRED_CAPABILITIES.has(c));
}
