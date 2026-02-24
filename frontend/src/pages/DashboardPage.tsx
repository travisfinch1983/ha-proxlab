import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlug,
  faRobot,
  faDatabase,
  faBrain,
  faArrowsRotate,
} from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import { useStore } from "../store";
import ConnectionCard from "../components/ConnectionCard";
import { refreshHealth, fetchConfig } from "../api";

export default function DashboardPage() {
  const config = useStore((s) => s.config)!;
  const [refreshing, setRefreshing] = useState(false);

  const connections = config.connections;
  const connCount = Object.keys(connections).length;
  const agents = config.agents || [];
  const enabledAgents = agents.filter(
    (a) => a.mandatory || a.config?.enabled
  );

  const handleRefreshHealth = async () => {
    setRefreshing(true);
    try {
      const health = await refreshHealth();
      // Merge new health into config
      const cfg = await fetchConfig();
      useStore.getState().setConfig(cfg);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      <NavBar
        title="Dashboard"
        actions={
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleRefreshHealth}
            disabled={refreshing}
          >
            <FontAwesomeIcon
              icon={faArrowsRotate}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh Health
          </button>
        }
      />
      <div className="p-6 space-y-6">
        {/* Hero card */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-lg">ProxLab Overview</h2>
            {config.settings.proxlab_url && (
              <p className="text-sm text-base-content/60">
                ProxLab URL:{" "}
                <span className="font-mono">{config.settings.proxlab_url}</span>
              </p>
            )}
            <div className="stats stats-horizontal bg-base-200 mt-2">
              <div className="stat py-3 px-4">
                <div className="stat-figure text-primary">
                  <FontAwesomeIcon icon={faPlug} className="text-xl" />
                </div>
                <div className="stat-title text-xs">Connections</div>
                <div className="stat-value text-2xl">{connCount}</div>
              </div>
              <div className="stat py-3 px-4">
                <div className="stat-figure text-secondary">
                  <FontAwesomeIcon icon={faRobot} className="text-xl" />
                </div>
                <div className="stat-title text-xs">Active Agents</div>
                <div className="stat-value text-2xl">
                  {enabledAgents.length}
                </div>
              </div>
              <div className="stat py-3 px-4">
                <div className="stat-figure text-accent">
                  <FontAwesomeIcon icon={faDatabase} className="text-xl" />
                </div>
                <div className="stat-title text-xs">Context Mode</div>
                <div className="stat-value text-lg capitalize">
                  {config.context.context_mode.replace("_", " ")}
                </div>
              </div>
              <div className="stat py-3 px-4">
                <div className="stat-figure text-info">
                  <FontAwesomeIcon icon={faBrain} className="text-xl" />
                </div>
                <div className="stat-title text-xs">Memory</div>
                <div className="stat-value text-lg">
                  {config.memory.memory_enabled ? "Enabled" : "Disabled"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Connection health grid */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Connection Health</h2>
          {connCount === 0 ? (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body text-center text-base-content/50">
                No connections configured. Go to Connections to add one.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Object.entries(connections).map(([id, conn]) => (
                <ConnectionCard
                  key={id}
                  id={id}
                  connection={conn}
                  health={config.health[id]}
                />
              ))}
            </div>
          )}
        </div>

        {/* Agent status */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Agent Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((agent) => {
              const isActive = agent.mandatory || agent.config?.enabled;
              return (
                <div
                  key={agent.id}
                  className={`card bg-base-100 shadow-sm ${
                    !isActive ? "opacity-50" : ""
                  }`}
                >
                  <div className="card-body p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm">{agent.name}</h3>
                      <div className="flex gap-1">
                        <span
                          className={`badge badge-xs ${
                            agent.group === "primary"
                              ? "badge-primary"
                              : agent.group === "system"
                                ? "badge-info"
                                : "badge-secondary"
                          }`}
                        >
                          {agent.group}
                        </span>
                        {isActive ? (
                          <span className="badge badge-xs badge-success">
                            Active
                          </span>
                        ) : (
                          <span className="badge badge-xs badge-ghost">
                            Disabled
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-base-content/60">
                      {agent.description}
                    </p>
                    {agent.config?.primary_connection && (
                      <p className="text-xs text-base-content/50">
                        Connection:{" "}
                        {connections[agent.config.primary_connection]?.name ||
                          "Unknown"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
