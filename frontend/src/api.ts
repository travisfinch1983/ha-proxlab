import { useStore } from "./store";
import type {
  ProxLabConfig,
  Connection,
  ConnectionHealth,
  AgentInfo,
  ContextSettings,
  VectorDbSettings,
  MemorySettings,
  GeneralSettings,
  Subscription,
  Schedule,
  Chain,
  ChainRunResult,
} from "./types";

function getHass() {
  const hass = useStore.getState().hass;
  if (!hass) throw new Error("Not connected to Home Assistant");
  return hass;
}

function entryParam(): Record<string, string> {
  const id = useStore.getState().entryId;
  return id ? { entry_id: id } : {};
}

export async function callWS<T>(
  type: string,
  params?: Record<string, unknown>
): Promise<T> {
  const hass = getHass();
  return hass.callWS<T>({ type, ...entryParam(), ...params });
}

// --- Config ---

export async function fetchConfig(): Promise<ProxLabConfig> {
  return callWS<ProxLabConfig>("proxlab/config/get");
}

// --- Health ---

export async function fetchHealth(): Promise<Record<string, ConnectionHealth>> {
  return callWS("proxlab/health/get");
}

export async function refreshHealth(): Promise<
  Record<string, ConnectionHealth>
> {
  return callWS("proxlab/health/refresh");
}

// --- Connections ---

export async function listConnections(): Promise<
  Record<string, Connection & { health?: ConnectionHealth }>
> {
  return callWS("proxlab/connections/list");
}

export async function createConnection(
  conn: Omit<Connection, "id">
): Promise<{ connection_id: string }> {
  return callWS("proxlab/connections/create", conn as Record<string, unknown>);
}

export async function updateConnection(
  connectionId: string,
  fields: Partial<Connection>
): Promise<void> {
  return callWS("proxlab/connections/update", {
    connection_id: connectionId,
    ...fields,
  });
}

export async function deleteConnection(connectionId: string): Promise<void> {
  return callWS("proxlab/connections/delete", {
    connection_id: connectionId,
  });
}

export async function testConnection(
  params: Pick<Connection, "base_url" | "api_key" | "capabilities"> & {
    connection_type?: string;
  }
): Promise<ConnectionHealth> {
  return callWS("proxlab/connections/test", params as Record<string, unknown>);
}

// --- Agents ---

export async function listAgents(): Promise<AgentInfo[]> {
  return callWS("proxlab/agents/list");
}

export async function updateAgent(
  agentId: string,
  fields: Partial<{
    enabled: boolean;
    primary_connection: string | null;
    secondary_connection: string | null;
    system_prompt: string | null;
  }>
): Promise<void> {
  return callWS("proxlab/agents/update", { agent_id: agentId, ...fields });
}

export async function getDefaultPrompt(agentId: string): Promise<string> {
  const res = await callWS<{ prompt: string }>(
    "proxlab/agents/default_prompt",
    { agent_id: agentId }
  );
  return res.prompt;
}

// --- Context ---

export async function getContext(): Promise<ContextSettings> {
  return callWS("proxlab/context/get");
}

export async function updateContext(
  fields: Partial<ContextSettings>
): Promise<void> {
  return callWS("proxlab/context/update", fields);
}

// --- Vector DB ---

export async function getVectorDb(): Promise<VectorDbSettings | null> {
  return callWS("proxlab/vector_db/get");
}

export async function updateVectorDb(
  fields: Partial<VectorDbSettings>
): Promise<void> {
  return callWS("proxlab/vector_db/update", fields);
}

export async function deleteVectorDb(): Promise<void> {
  return callWS("proxlab/vector_db/delete");
}

// --- Memory ---

export async function getMemory(): Promise<MemorySettings> {
  return callWS("proxlab/memory/get");
}

export async function updateMemory(
  fields: Partial<MemorySettings>
): Promise<void> {
  return callWS("proxlab/memory/update", fields);
}

// --- Settings ---

export async function getSettings(): Promise<GeneralSettings> {
  return callWS("proxlab/settings/get");
}

export async function updateSettings(
  fields: Partial<GeneralSettings>
): Promise<void> {
  return callWS("proxlab/settings/update", fields);
}

// --- Discovery ---

export interface DiscoveredService {
  id: string;
  provider: string;
  port: number;
  node: string;
  container_ip: string;
  model: string;
  service_type: string;
  base_url: string;
  display_name: string;
}

export async function discoverServices(): Promise<DiscoveredService[]> {
  const res = await callWS<{ services: DiscoveredService[] }>(
    "proxlab/discovery/services"
  );
  return res.services;
}

// --- Debug ---

export interface TraceStep {
  agent_id: string;
  agent_name: string;
  model: string;
  duration_ms: number;
  tokens: { prompt: number; completion: number; total: number };
  tokens_per_sec: number;
  performance: {
    llm_latency_ms: number;
    tool_latency_ms: number;
    context_latency_ms: number;
    ttft_ms: number;
  };
  routing_decision?: { target_agent: string; reason: string };
  response_text?: string;
  tool_calls: number;
  tool_breakdown: Record<string, number>;
  user_input?: string;
  connection_type?: string;
  cost_estimate?: number;
  context_messages?: Array<{ role: string; content: string }>;
  tools?: Array<Record<string, unknown>>;
}

export interface ConversationTrace {
  conversation_id: string;
  user_id: string;
  user_message: string;
  response_text: string;
  model: string;
  duration_ms: number;
  tokens: { prompt: number; completion: number; total: number };
  performance: {
    llm_latency_ms: number;
    tool_latency_ms: number;
    context_latency_ms: number;
    ttft_ms: number;
  };
  context: Record<string, unknown>;
  tool_calls: number;
  tool_breakdown: Record<string, number>;
  used_external_llm: boolean;
  tokens_per_sec?: number;
  routed_agent?: string;
  routing_reason?: string;
  steps?: TraceStep[];
  timestamp?: number;
  total_cost?: number;
}

export async function fetchDebugTraces(): Promise<ConversationTrace[]> {
  const res = await callWS<{ traces: ConversationTrace[] }>(
    "proxlab/debug/traces"
  );
  return res.traces;
}

export async function clearDebugTraces(): Promise<void> {
  await callWS("proxlab/debug/clear");
}

export async function getDebugConfig(): Promise<{ max_entries: number }> {
  return callWS("proxlab/debug/config");
}

export async function setDebugConfig(maxEntries: number): Promise<void> {
  await callWS("proxlab/debug/config", { max_entries: maxEntries });
}

export async function deleteOlderTraces(
  days: number
): Promise<{ deleted: number }> {
  return callWS("proxlab/debug/delete_older", { days });
}

// --- API Usage ---

export interface ApiModelUsage {
  input_tokens: number;
  output_tokens: number;
  messages: number;
  cost_usd: number;
}

export interface ApiUsageData {
  models: Record<string, ApiModelUsage>;
  agents: Record<string, ApiModelUsage & { model: string }>;
  total: ApiModelUsage;
  last_updated: number;
}

export async function fetchApiUsage(): Promise<ApiUsageData> {
  return callWS("proxlab/api/usage");
}

export async function resetApiUsage(): Promise<void> {
  await callWS("proxlab/api/usage/reset");
}

export async function fetchAdminReport(
  adminKey: string,
  days?: number
): Promise<{ usage: Record<string, unknown>; cost: Record<string, unknown> }> {
  return callWS("proxlab/api/admin_report", {
    admin_key: adminKey,
    ...(days ? { days } : {}),
  });
}

export async function getApiConfig(): Promise<{ admin_key: string; budget: number | null }> {
  return callWS("proxlab/api/config");
}

export async function saveApiConfig(adminKey: string): Promise<void> {
  await callWS("proxlab/api/config", { admin_key: adminKey });
}

export async function saveApiBudget(budget: number | null): Promise<void> {
  await callWS("proxlab/api/config", { budget });
}

// --- Issues ---

export interface IssueItem {
  id: string;
  category: "bug" | "feature";
  text: string;
  completed: boolean;
  created_at: number;
  completed_at: number | null;
}

export async function listIssues(): Promise<IssueItem[]> {
  const res = await callWS<{ items: IssueItem[] }>("proxlab/issues/list");
  return res.items;
}

export async function createIssue(
  category: "bug" | "feature",
  text: string
): Promise<{ id: string }> {
  return callWS("proxlab/issues/create", { category, text });
}

export async function updateIssue(
  issueId: string,
  fields: Partial<Pick<IssueItem, "completed" | "text">>
): Promise<void> {
  return callWS("proxlab/issues/update", { issue_id: issueId, ...fields });
}

export async function deleteIssue(issueId: string): Promise<void> {
  return callWS("proxlab/issues/delete", { issue_id: issueId });
}

// --- Roadmap ---

export interface RoadmapItem {
  id: string;
  text: string;
  completed: boolean;
  created_at: number;
  completed_at: number | null;
}

export interface RoadmapHeader {
  id: string;
  title: string;
  position: number;
  collapsed: boolean;
  created_at: number;
  items: RoadmapItem[];
}

export async function listRoadmap(): Promise<RoadmapHeader[]> {
  const res = await callWS<{ headers: RoadmapHeader[] }>(
    "proxlab/roadmap/list"
  );
  return res.headers;
}

export async function updateRoadmap(
  action: string,
  params: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  return callWS("proxlab/roadmap/update", { action, ...params });
}

// --- Agent Invoke ---

export interface AgentInvokeResult {
  agent_id: string;
  agent_name: string;
  response_text: string;
  tool_results: unknown[];
  tokens: { prompt: number; completion: number; total: number };
  duration_ms: number;
  model: string;
  success: boolean;
}

export async function invokeAgent(
  agentId: string,
  message: string,
  context?: Record<string, unknown>,
  opts?: { conversation_id?: string; include_history?: boolean }
): Promise<AgentInvokeResult> {
  return callWS("proxlab/agent/invoke", {
    agent_id: agentId,
    message,
    ...(context ? { context } : {}),
    ...(opts?.conversation_id
      ? { conversation_id: opts.conversation_id }
      : {}),
    ...(opts?.include_history ? { include_history: true } : {}),
  });
}

export interface AvailableAgent {
  id: string;
  name: string;
  description: string;
  group: string;
  has_connection: boolean;
  tools: string[];
}

export async function listAvailableAgents(): Promise<AvailableAgent[]> {
  return callWS("proxlab/agent/available");
}

// --- Subscriptions ---

export async function listSubscriptions(): Promise<Subscription[]> {
  return callWS("proxlab/agent/subscriptions/list");
}

export async function createSubscription(
  fields: Omit<Subscription, "id" | "created_at" | "last_triggered" | "trigger_count">
): Promise<Subscription> {
  return callWS("proxlab/agent/subscriptions/create", fields as Record<string, unknown>);
}

export async function updateSubscription(
  subscriptionId: string,
  fields: Partial<Omit<Subscription, "id" | "created_at" | "last_triggered" | "trigger_count">>
): Promise<Subscription> {
  return callWS("proxlab/agent/subscriptions/update", {
    subscription_id: subscriptionId,
    ...fields,
  });
}

export async function deleteSubscription(subscriptionId: string): Promise<void> {
  return callWS("proxlab/agent/subscriptions/delete", {
    subscription_id: subscriptionId,
  });
}

// --- Schedules ---

export async function listSchedules(): Promise<Schedule[]> {
  return callWS("proxlab/agent/schedules/list");
}

export async function createSchedule(
  fields: Omit<Schedule, "id" | "created_at" | "last_triggered" | "trigger_count">
): Promise<Schedule> {
  return callWS("proxlab/agent/schedules/create", fields as Record<string, unknown>);
}

export async function updateSchedule(
  scheduleId: string,
  fields: Partial<Omit<Schedule, "id" | "created_at" | "last_triggered" | "trigger_count">>
): Promise<Schedule> {
  return callWS("proxlab/agent/schedules/update", {
    schedule_id: scheduleId,
    ...fields,
  });
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  return callWS("proxlab/agent/schedules/delete", {
    schedule_id: scheduleId,
  });
}

// --- Chains ---

export async function listChains(): Promise<Chain[]> {
  return callWS("proxlab/agent/chains/list");
}

export async function createChain(
  fields: Omit<Chain, "id" | "created_at" | "last_run" | "run_count">
): Promise<Chain> {
  return callWS("proxlab/agent/chains/create", fields as Record<string, unknown>);
}

export async function updateChain(
  chainId: string,
  fields: Partial<Omit<Chain, "id" | "created_at" | "last_run" | "run_count">>
): Promise<Chain> {
  return callWS("proxlab/agent/chains/update", {
    chain_id: chainId,
    ...fields,
  });
}

export async function deleteChain(chainId: string): Promise<void> {
  return callWS("proxlab/agent/chains/delete", { chain_id: chainId });
}

export async function runChain(
  chainId: string,
  initialMessage?: string,
  initialContext?: Record<string, unknown>
): Promise<ChainRunResult> {
  return callWS("proxlab/agent/chains/run", {
    chain_id: chainId,
    ...(initialMessage ? { initial_message: initialMessage } : {}),
    ...(initialContext ? { initial_context: initialContext } : {}),
  });
}
