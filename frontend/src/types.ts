/** Home Assistant hass object (subset we use). */
export interface Hass {
  callWS: <T>(msg: Record<string, unknown>) => Promise<T>;
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
  // External LLM fields
  tool_description?: string;
  auto_include_context?: boolean;
}

export interface ConnectionHealth {
  reachable: boolean;
  api_valid: boolean;
  detail: string;
  error: string | null;
  model_name: string | null;
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

export const CAPABILITY_LABELS: Record<string, string> = {
  conversation: "Conversational LLM",
  tool_use: "Tool Use (LLM)",
  tts: "Text-to-Speech",
  stt: "Speech-to-Text",
  embeddings: "Embeddings",
  reranker: "Reranker",
  multimodal_embeddings: "Multimodal Embeddings",
  external_llm: "External LLM",
  specialized: "Specialized",
  vision: "Vision Capable",
};
