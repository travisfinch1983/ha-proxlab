import type { ConnectionHealth } from "../types";
import { getHealthStatus, healthBadgeClass, healthLabel } from "../types";

interface Props {
  health: ConnectionHealth | undefined;
}

export default function HealthBadge({ health }: Props) {
  const status = getHealthStatus(health);
  return (
    <span className={`badge badge-sm ${healthBadgeClass(status)}`}>
      {healthLabel(status)}
    </span>
  );
}
