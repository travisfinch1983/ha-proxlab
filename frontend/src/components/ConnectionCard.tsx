import type { Connection, ConnectionHealth, DiscoveredModel } from "../types";
import {
  CAPABILITY_LABELS,
  CAPABILITY_COLORS,
  HIDDEN_CAPABILITIES,
  computeEffectiveCaps,
  getHealthStatus,
  healthBadgeClass,
  healthLabel,
} from "../types";

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
  const detectedSet = new Set<string>();
  const models = (discoveredModels ?? []).filter((m) => m.connection_id === id);
  for (const m of models) {
    if (m.supports_vision) detectedSet.add("vision");
    if (m.supports_audio) detectedSet.add("specialized");
    if (m.supports_embeddings) detectedSet.add("embeddings");
    if (m.supports_tts) detectedSet.add("tts");
    if (m.supports_tool_use) detectedSet.add("tool_use");
  }

  // Merge user-assigned capabilities into detected set (filter out hidden ones)
  for (const cap of connection.capabilities) {
    if (!HIDDEN_CAPABILITIES.has(cap)) detectedSet.add(cap);
  }

  // Apply overrides to get effective capabilities
  const effectiveCaps = computeEffectiveCaps(connection.capability_overrides, detectedSet);

  // Provider tag from first model
  const provider = models[0]?.provider;

  // Use compact dots when >4 capabilities
  const useCompactDots = effectiveCaps.length > 4;

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
        <div className="flex flex-wrap gap-1 mt-1 items-center">
          {useCompactDots
            ? effectiveCaps.map((cap) => {
                const color = CAPABILITY_COLORS[cap]?.dot || "bg-base-content";
                return (
                  <span
                    key={cap}
                    className={`w-2.5 h-2.5 rounded-full ${color} inline-block`}
                    title={CAPABILITY_LABELS[cap] || cap}
                  />
                );
              })
            : effectiveCaps.map((cap) => {
                const color = CAPABILITY_COLORS[cap]?.badge || "badge-outline";
                return (
                  <span key={cap} className={`badge badge-xs ${color}`}>
                    {CAPABILITY_LABELS[cap] || cap}
                  </span>
                );
              })}
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
