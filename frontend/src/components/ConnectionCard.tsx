import type { Connection, ConnectionHealth } from "../types";
import {
  CAPABILITY_LABELS,
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
}

export default function ConnectionCard({
  connection,
  health,
  selected,
  onClick,
}: Props) {
  const status = getHealthStatus(health);
  const borderColor =
    status === "connected"
      ? "border-success"
      : status === "unreachable"
        ? "border-error"
        : "border-warning";

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
          {connection.capabilities.map((cap) => (
            <span key={cap} className="badge badge-xs badge-outline">
              {CAPABILITY_LABELS[cap] || cap}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
