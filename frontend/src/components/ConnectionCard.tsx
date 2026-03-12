import type { Connection, ConnectionHealth, DiscoveredModel } from "../types";
import {
  CAPABILITY_LABELS,
  getHealthStatus,
  healthBadgeClass,
  healthLabel,
} from "../types";

/** Short labels for detected capability badges */
const DETECTED_LABELS: Record<string, string> = {
  vision: "Vision",
  audio: "Audio",
  embeddings: "Embeddings",
  tts: "TTS",
  tool_use: "Tool Use",
};

interface Props {
  id: string;
  connection: Connection;
  health?: ConnectionHealth;
  selected?: boolean;
  onClick?: () => void;
  discoveredModels?: DiscoveredModel[];
}

export default function ConnectionCard({
  id,
  connection,
  health,
  selected,
  onClick,
  discoveredModels,
}: Props) {
  const status = getHealthStatus(health);
  const borderColor =
    status === "connected"
      ? "border-success"
      : status === "unreachable"
        ? "border-error"
        : "border-warning";

  // Aggregate detected capabilities from discovered models for this connection
  const detected = new Set<string>();
  const models = (discoveredModels ?? []).filter((m) => m.connection_id === id);
  for (const m of models) {
    if (m.supports_vision) detected.add("vision");
    if (m.supports_audio) detected.add("audio");
    if (m.supports_embeddings) detected.add("embeddings");
    if (m.supports_tts) detected.add("tts");
    if (m.supports_tool_use) detected.add("tool_use");
  }

  // Provider tag from first model
  const provider = models[0]?.provider;

  return (
    <div
      className={`card bg-base-100 border-2 ${borderColor} shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${
        selected ? "ring-2 ring-primary" : ""
      }`}
      onClick={onClick}
    >
      <div className="card-body p-4">
        <div className="flex items-start justify-between">
          <h3 className="card-title text-sm">{connection.name}</h3>
          <span className={`badge badge-sm ${healthBadgeClass(status)}`}>
            {healthLabel(status)}
          </span>
        </div>
        <p className="text-xs text-base-content/60 truncate">
          {connection.model || connection.base_url}
        </p>
        {health?.detail && health.detail !== "OK" && (
          <p className="text-xs text-warning">{health.detail}</p>
        )}
        <div className="flex flex-wrap gap-1 mt-1">
          {/* User-assigned capabilities */}
          {connection.capabilities.map((cap) => (
            <span key={cap} className="badge badge-xs badge-outline">
              {CAPABILITY_LABELS[cap] || cap}
            </span>
          ))}
          {/* Detected capabilities (only those not already in user-assigned) */}
          {[...detected]
            .filter((d) => !connection.capabilities.includes(d))
            .map((d) => (
              <span
                key={`det-${d}`}
                className="badge badge-xs badge-accent badge-outline"
                title="Auto-detected"
              >
                {DETECTED_LABELS[d] || d}
              </span>
            ))}
          {/* Provider badge */}
          {provider && (
            <span className="badge badge-xs badge-ghost">
              {provider}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
