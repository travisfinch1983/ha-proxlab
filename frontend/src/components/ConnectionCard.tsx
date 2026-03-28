import type { Connection, ConnectionHealth, DiscoveredModel } from "../types";
import {
  CAPABILITY_LABELS,
  CAPABILITY_COLORS,
  getConnectionEffectiveCaps,
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

  // Compute effective capabilities (detected + stored + overrides)
  const models = (discoveredModels ?? []).filter((m) => m.connection_id === id);
  const effectiveCaps = getConnectionEffectiveCaps(connection, id, discoveredModels ?? []);

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
