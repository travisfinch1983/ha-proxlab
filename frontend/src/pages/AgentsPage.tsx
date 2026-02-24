import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateLeft } from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import { useStore } from "../store";
import SaveButton from "../components/SaveButton";
import { updateAgent, getDefaultPrompt, fetchConfig } from "../api";
import type { AgentInfo } from "../types";

function AgentCard({ agent }: { agent: AgentInfo }) {
  const config = useStore((s) => s.config)!;
  const connections = config.connections;

  const [enabled, setEnabled] = useState(
    agent.mandatory || agent.config?.enabled
  );
  const [primaryConn, setPrimaryConn] = useState(
    agent.config?.primary_connection || ""
  );
  const [secondaryConn, setSecondaryConn] = useState(
    agent.config?.secondary_connection || ""
  );
  const [prompt, setPrompt] = useState(agent.config?.system_prompt ?? "");
  const [showPrompt, setShowPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Filter eligible connections based on agent's required capabilities
  const eligibleConnections = Object.entries(connections).filter(
    ([, conn]) => {
      for (const capGroup of agent.required_capabilities) {
        if (capGroup.every((cap) => conn.capabilities.includes(cap))) {
          return true;
        }
      }
      return false;
    }
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAgent(agent.id, {
        enabled,
        primary_connection: primaryConn || null,
        secondary_connection: secondaryConn || null,
        system_prompt: prompt || null,
      });
      const cfg = await fetchConfig();
      useStore.getState().setConfig(cfg);
      setToast("Saved");
      setTimeout(() => setToast(null), 2000);
    } catch (err: unknown) {
      setToast(`Error: ${(err as Error).message}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleRestorePrompt = async () => {
    try {
      const defaultPrompt = await getDefaultPrompt(agent.id);
      setPrompt(defaultPrompt);
    } catch {
      // ignore
    }
  };

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">{agent.name}</h3>
            <p className="text-xs text-base-content/60">{agent.description}</p>
          </div>
          <div className="flex items-center gap-2">
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
            {!agent.mandatory && (
              <input
                type="checkbox"
                className="toggle toggle-xs toggle-primary"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
            )}
          </div>
        </div>

        {/* Connection selectors */}
        {enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="form-control">
              <div className="label">
                <span className="label-text text-xs">Primary Connection</span>
              </div>
              <select
                className="select select-bordered select-xs"
                value={primaryConn}
                onChange={(e) => setPrimaryConn(e.target.value)}
              >
                <option value="">None</option>
                {eligibleConnections.map(([id, conn]) => (
                  <option key={id} value={id}>
                    {conn.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <div className="label">
                <span className="label-text text-xs">
                  Secondary Connection
                </span>
              </div>
              <select
                className="select select-bordered select-xs"
                value={secondaryConn}
                onChange={(e) => setSecondaryConn(e.target.value)}
              >
                <option value="">None</option>
                {eligibleConnections.map(([id, conn]) => (
                  <option key={id} value={id}>
                    {conn.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* Prompt editor */}
        {enabled && agent.has_prompt && (
          <div>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => setShowPrompt(!showPrompt)}
            >
              {showPrompt ? "Hide" : "Edit"} System Prompt
            </button>
            {showPrompt && (
              <div className="mt-2 space-y-2">
                <textarea
                  className="textarea textarea-bordered w-full text-xs font-mono"
                  rows={8}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={agent.default_prompt || "System prompt..."}
                />
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={handleRestorePrompt}
                >
                  <FontAwesomeIcon icon={faRotateLeft} /> Restore Default
                </button>
              </div>
            )}
          </div>
        )}

        {/* Save */}
        <div className="flex justify-end gap-2">
          {toast && (
            <span className="text-xs text-success self-center">{toast}</span>
          )}
          <SaveButton saving={saving} onClick={handleSave} />
        </div>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const config = useStore((s) => s.config)!;
  const agents = config.agents || [];

  const primary = agents.filter((a) => a.group === "primary");
  const optional = agents.filter((a) => a.group === "optional");
  const system = agents.filter((a) => a.group === "system");

  return (
    <>
      <NavBar title="Agents" />
      <div className="p-6 space-y-6">
        {/* Primary */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Primary Agents</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {primary.map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        </section>

        {/* Optional */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Optional Agents</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {optional.map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        </section>

        {/* System */}
        <section>
          <h2 className="text-lg font-semibold mb-3">System Agents</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {system.map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
