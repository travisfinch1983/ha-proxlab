import { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateLeft, faPlay, faWrench } from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import { useStore } from "../store";
import SaveButton from "../components/SaveButton";
import {
  updateAgent,
  getDefaultPrompt,
  fetchConfig,
  invokeAgent,
  fetchAvailableTools,
  type AgentInvokeResult,
  type ToolCatalogEntry,
  fetchModels,
} from "../api";
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
  const [modelOverride, setModelOverride] = useState(
    agent.config?.primary_model_override || ""
  );
  const [connModels, setConnModels] = useState<string[]>([]);
  const [prompt, setPrompt] = useState(agent.config?.system_prompt ?? "");
  const [showPrompt, setShowPrompt] = useState(false);

  // Load available models only for universal (multi-model) connections
  useEffect(() => {
    if (!primaryConn) {
      setConnModels([]);
      return;
    }
    const conn = connections[primaryConn];
    if (!conn?.is_universal) {
      setConnModels([]);
      return;
    }
    const healthModels = config.health[primaryConn]?.available_models;
    if (healthModels && healthModels.length > 0) {
      setConnModels(healthModels);
    } else {
      fetchModels(primaryConn)
        .then((models) => setConnModels(models))
        .catch(() => setConnModels([]));
    }
  }, [primaryConn, config.health, connections]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Tools config state
  const [toolsOpen, setToolsOpen] = useState(false);
  const [allTools, setAllTools] = useState<ToolCatalogEntry[]>([]);
  const [toolDefaults, setToolDefaults] = useState<Record<string, string[]>>({});
  const [enabledTools, setEnabledTools] = useState<string[]>(
    agent.config?.enabled_tools ?? []
  );
  const [toolsInitialized, setToolsInitialized] = useState(false);

  const loadTools = useCallback(async () => {
    try {
      const result = await fetchAvailableTools();
      setAllTools(result.tools);
      setToolDefaults(result.defaults);
      // If agent has no stored config, seed from defaults
      if (!agent.config?.enabled_tools) {
        const defaults = result.defaults[agent.id] ?? [];
        setEnabledTools(defaults);
      }
      setToolsInitialized(true);
    } catch {
      // ignore
    }
  }, [agent.id, agent.config?.enabled_tools]);

  const toggleTool = (toolName: string) => {
    setEnabledTools((prev) =>
      prev.includes(toolName)
        ? prev.filter((t) => t !== toolName)
        : [...prev, toolName]
    );
  };

  // Invoke test state
  const [invokeOpen, setInvokeOpen] = useState(false);
  const [invokeMsg, setInvokeMsg] = useState("");
  const [invoking, setInvoking] = useState(false);
  const [invokeResult, setInvokeResult] = useState<AgentInvokeResult | null>(
    null
  );

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
        primary_model_override: modelOverride || null,
        enabled_tools: toolsInitialized ? enabledTools : null,
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

  const handleInvoke = async () => {
    if (!invokeMsg.trim()) return;
    setInvoking(true);
    setInvokeResult(null);
    try {
      const result = await invokeAgent(agent.id, invokeMsg.trim());
      setInvokeResult(result);
    } catch (err) {
      setInvokeResult({
        agent_id: agent.id,
        agent_name: agent.name,
        response_text: `Error: ${(err as Error).message}`,
        tool_results: [],
        tokens: { prompt: 0, completion: 0, total: 0 },
        duration_ms: 0,
        model: "",
        success: false,
      });
    } finally {
      setInvoking(false);
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
            {primaryConn && connModels.length > 0 && (
              <label className="form-control">
                <div className="label">
                  <span className="label-text text-xs">Model Override</span>
                </div>
                <select
                  className="select select-bordered select-xs"
                  value={modelOverride}
                  onChange={(e) => setModelOverride(e.target.value)}
                >
                  <option value="">Connection default</option>
                  {connModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {/* Tools config */}
        {enabled && (
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => {
              if (!toolsInitialized) loadTools();
              setToolsOpen(true);
            }}
          >
            <FontAwesomeIcon icon={faWrench} /> Configure Tools
            {enabledTools.length > 0 && (
              <span className="badge badge-xs badge-primary ml-1">
                {enabledTools.length}
              </span>
            )}
          </button>
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

        {/* Save + Test */}
        <div className="flex justify-end gap-2">
          {toast && (
            <span className="text-xs text-success self-center">{toast}</span>
          )}
          {enabled && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setInvokeOpen(true);
                setInvokeResult(null);
                setInvokeMsg("");
              }}
            >
              <FontAwesomeIcon icon={faPlay} /> Test
            </button>
          )}
          <SaveButton saving={saving} onClick={handleSave} />
        </div>
      </div>

      {/* Invoke Test Modal */}
      {invokeOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg">Test: {agent.name}</h3>
            <div className="space-y-3 mt-4">
              <label className="form-control">
                <div className="label">
                  <span className="label-text">Message</span>
                </div>
                <textarea
                  className="textarea textarea-bordered textarea-sm"
                  rows={3}
                  placeholder="Type a message to send to this agent..."
                  value={invokeMsg}
                  onChange={(e) => setInvokeMsg(e.target.value)}
                  disabled={invoking}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.ctrlKey) handleInvoke();
                  }}
                />
                <div className="label">
                  <span className="label-text-alt text-base-content/40">
                    Ctrl+Enter to send
                  </span>
                </div>
              </label>

              {invoking && (
                <div className="flex items-center gap-2 py-2">
                  <span className="loading loading-spinner loading-sm text-primary" />
                  <span className="text-sm text-base-content/60">
                    Invoking agent...
                  </span>
                </div>
              )}

              {invokeResult && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge badge-sm ${invokeResult.success ? "badge-success" : "badge-error"}`}
                    >
                      {invokeResult.success ? "Success" : "Failed"}
                    </span>
                    {invokeResult.model && (
                      <span className="text-xs text-base-content/50">
                        {invokeResult.model}
                      </span>
                    )}
                    {invokeResult.duration_ms > 0 && (
                      <span className="text-xs text-base-content/50">
                        {(invokeResult.duration_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                    {invokeResult.tokens.total > 0 && (
                      <span className="text-xs text-base-content/50">
                        {invokeResult.tokens.total} tokens
                      </span>
                    )}
                  </div>
                  <div className="bg-base-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                    <p className="text-sm whitespace-pre-wrap">
                      {invokeResult.response_text}
                    </p>
                  </div>
                  {invokeResult.tool_results &&
                    invokeResult.tool_results.length > 0 && (
                      <details className="collapse collapse-arrow bg-base-200 rounded-lg">
                        <summary className="collapse-title text-xs font-medium py-2 min-h-0">
                          Tool Results ({invokeResult.tool_results.length})
                        </summary>
                        <div className="collapse-content">
                          <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(
                              invokeResult.tool_results,
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      </details>
                    )}
                </div>
              )}
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setInvokeOpen(false)}
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={handleInvoke}
                disabled={invoking || !invokeMsg.trim()}
              >
                {invoking ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <FontAwesomeIcon icon={faPlay} />
                )}
                Send
              </button>
            </div>
          </div>
          <form
            method="dialog"
            className="modal-backdrop"
            onClick={() => !invoking && setInvokeOpen(false)}
          >
            <button>close</button>
          </form>
        </dialog>
      )}

      {/* Tools Config Modal */}
      {toolsOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg">
              Tools: {agent.name}
            </h3>
            <p className="text-xs text-base-content/50 mt-1">
              Toggle which tools this agent can use during conversations.
            </p>

            {!toolsInitialized ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <span className="loading loading-spinner loading-sm" />
                <span className="text-sm text-base-content/60">Loading tools...</span>
              </div>
            ) : allTools.length === 0 ? (
              <p className="text-sm text-base-content/50 py-4">
                No tools registered. Install MCP servers from the Tools tab to add more.
              </p>
            ) : (
              <div className="mt-4 space-y-1 max-h-96 overflow-y-auto">
                {/* Built-in tools */}
                {allTools.filter((t) => t.category === "builtin").length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold text-base-content/40 uppercase tracking-wider mb-2">
                      Built-in Tools
                    </h4>
                    {allTools
                      .filter((t) => t.category === "builtin")
                      .map((tool) => (
                        <label
                          key={tool.name}
                          className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-base-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs checkbox-primary"
                            checked={enabledTools.includes(tool.name)}
                            onChange={() => toggleTool(tool.name)}
                          />
                          <div className="min-w-0">
                            <span className="text-sm font-medium">{tool.name}</span>
                            {tool.description && (
                              <p className="text-xs text-base-content/50 truncate">
                                {tool.description}
                              </p>
                            )}
                          </div>
                        </label>
                      ))}
                  </div>
                )}

                {/* MCP tools */}
                {allTools.filter((t) => t.category === "mcp").length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-base-content/40 uppercase tracking-wider mb-2">
                      MCP Server Tools
                    </h4>
                    {allTools
                      .filter((t) => t.category === "mcp")
                      .map((tool) => (
                        <label
                          key={tool.name}
                          className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-base-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs checkbox-primary"
                            checked={enabledTools.includes(tool.name)}
                            onChange={() => toggleTool(tool.name)}
                          />
                          <div className="min-w-0">
                            <span className="text-sm font-medium">{tool.name}</span>
                            {tool.server_name && (
                              <span className="badge badge-xs badge-ghost ml-1">
                                {tool.server_name}
                              </span>
                            )}
                            {tool.description && (
                              <p className="text-xs text-base-content/50 truncate">
                                {tool.description}
                              </p>
                            )}
                          </div>
                        </label>
                      ))}
                  </div>
                )}
              </div>
            )}

            <div className="modal-action">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  // Reset to defaults
                  setEnabledTools(toolDefaults[agent.id] ?? []);
                }}
              >
                <FontAwesomeIcon icon={faRotateLeft} /> Reset Defaults
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setToolsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
          <form
            method="dialog"
            className="modal-backdrop"
            onClick={() => setToolsOpen(false)}
          >
            <button>close</button>
          </form>
        </dialog>
      )}
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
