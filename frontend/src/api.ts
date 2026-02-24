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
