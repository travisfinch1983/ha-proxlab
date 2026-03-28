import { useEffect, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlug,
  faPlugCircleXmark,
  faTrash,
  faRotateRight,
  faChevronDown,
  faChevronRight,
  faPlus,
  faToggleOn,
  faToggleOff,
} from "@fortawesome/free-solid-svg-icons";
import type { McpServer, McpToolDef } from "../types";
import {
  listMcpServers,
  updateMcpServer,
  deleteMcpServer,
  reconnectMcpServer,
  createMcpServer,
} from "../api";

function statusBadge(status: string) {
  switch (status) {
    case "connected":
      return "badge-success";
    case "error":
      return "badge-error";
    case "starting":
      return "badge-warning";
    default:
      return "badge-ghost";
  }
}

function transportBadge(transport: string) {
  switch (transport) {
    case "stdio":
      return "badge-info";
    case "sse":
      return "badge-accent";
    case "streamable_http":
      return "badge-secondary";
    default:
      return "badge-ghost";
  }
}

/** Group tools by server-name prefix (MCPJungle uses server__tool naming). */
function groupTools(tools: McpToolDef[]): Record<string, McpToolDef[]> {
  const groups: Record<string, McpToolDef[]> = {};
  for (const t of tools) {
    const sep = t.name.indexOf("__");
    const prefix = sep > 0 ? t.name.substring(0, sep) : "";
    const key = prefix || "(ungrouped)";
    (groups[key] ??= []).push(t);
  }
  return groups;
}

function ToolToggleList({
  server,
  onUpdate,
}: {
  server: McpServer;
  onUpdate: () => void;
}) {
  const disabled = new Set(server.disabled_tools ?? []);
  const [saving, setSaving] = useState(false);

  const toggle = async (toolName: string) => {
    const next = new Set(disabled);
    if (next.has(toolName)) next.delete(toolName);
    else next.add(toolName);
    setSaving(true);
    try {
      await updateMcpServer(server.id, { disabled_tools: [...next] });
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const toggleAll = async (enable: boolean) => {
    const next = enable ? [] : server.tools.map((t) => t.name);
    setSaving(true);
    try {
      await updateMcpServer(server.id, { disabled_tools: next });
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const groups = groupTools(server.tools);
  const groupKeys = Object.keys(groups).sort();
  const hasGroups = groupKeys.length > 1 || (groupKeys.length === 1 && groupKeys[0] !== "(ungrouped)");
  const enabledCount = server.tools.length - disabled.size;

  return (
    <div className="mt-3 border-t border-base-300 pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-base-content/60">
          Tools ({enabledCount}/{server.tools.length} enabled)
        </p>
        <div className="flex gap-1">
          <button
            className="btn btn-ghost btn-xs"
            disabled={saving}
            onClick={() => toggleAll(true)}
            title="Enable all"
          >
            <FontAwesomeIcon icon={faToggleOn} className="text-success" /> All
          </button>
          <button
            className="btn btn-ghost btn-xs"
            disabled={saving}
            onClick={() => toggleAll(false)}
            title="Disable all"
          >
            <FontAwesomeIcon icon={faToggleOff} className="text-base-content/30" /> None
          </button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto space-y-3">
        {groupKeys.map((group) => (
          <div key={group}>
            {hasGroups && (
              <h4 className="text-xs font-semibold text-base-content/40 uppercase tracking-wider mb-1 sticky top-0 bg-base-100 py-0.5">
                {group}
              </h4>
            )}
            <div className="grid gap-1">
              {groups[group].map((t) => {
                const isDisabled = disabled.has(t.name);
                return (
                  <label
                    key={t.name}
                    className={`flex items-start gap-2 text-xs rounded px-2 py-1.5 cursor-pointer hover:bg-base-200 ${
                      isDisabled ? "opacity-50" : "bg-base-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs checkbox-primary mt-0.5 shrink-0"
                      checked={!isDisabled}
                      disabled={saving}
                      onChange={() => toggle(t.name)}
                    />
                    <div className="min-w-0">
                      <code className="font-mono text-primary text-xs">
                        {hasGroups && t.name.includes("__")
                          ? t.name.substring(t.name.indexOf("__") + 2)
                          : t.name}
                      </code>
                      {t.description && (
                        <p className="text-base-content/60 truncate">
                          {t.description}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function McpServersPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<{
    name: string;
    transport: "stdio" | "sse" | "streamable_http";
    command: string;
    args: string;
    url: string;
  }>({
    name: "",
    transport: "stdio",
    command: "",
    args: "",
    url: "",
  });

  const refresh = useCallback(async () => {
    try {
      const data = await listMcpServers();
      setServers(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleEnabled = async (s: McpServer) => {
    await updateMcpServer(s.id, { enabled: !s.enabled });
    await refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this MCP server?")) return;
    await deleteMcpServer(id);
    await refresh();
  };

  const handleReconnect = async (id: string) => {
    await reconnectMcpServer(id);
    await refresh();
  };

  const handleAdd = async () => {
    const data: Record<string, unknown> = {
      name: addForm.name,
      transport: addForm.transport,
    };
    if (addForm.transport === "stdio") {
      data.command = addForm.command;
      data.args = addForm.args
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);
    } else {
      data.url = addForm.url;
    }
    await createMcpServer(data);
    setShowAdd(false);
    setAddForm({ name: "", transport: "stdio", command: "", args: "", url: "" });
    await refresh();
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Installed MCP Servers</h2>
        <div className="flex gap-2">
          <button className="btn btn-sm btn-ghost" onClick={refresh}>
            <FontAwesomeIcon icon={faRotateRight} />
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowAdd(!showAdd)}
          >
            <FontAwesomeIcon icon={faPlus} className="mr-1" />
            Add Manually
          </button>
        </div>
      </div>

      {/* Add Manual Server */}
      {showAdd && (
        <div className="card bg-base-100 shadow border border-base-300">
          <div className="card-body space-y-3">
            <h3 className="font-semibold">Add Manual MCP Server</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input input-bordered input-sm"
                placeholder="Server name"
                value={addForm.name}
                onChange={(e) =>
                  setAddForm({ ...addForm, name: e.target.value })
                }
              />
              <select
                className="select select-bordered select-sm"
                value={addForm.transport}
                onChange={(e) =>
                  setAddForm({
                    ...addForm,
                    transport: e.target.value as "stdio" | "sse" | "streamable_http",
                  })
                }
              >
                <option value="stdio">stdio</option>
                <option value="sse">SSE</option>
                <option value="streamable_http">Streamable HTTP</option>
              </select>
            </div>
            {addForm.transport === "stdio" ? (
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="input input-bordered input-sm"
                  placeholder="Command (e.g. python3)"
                  value={addForm.command}
                  onChange={(e) =>
                    setAddForm({ ...addForm, command: e.target.value })
                  }
                />
                <input
                  className="input input-bordered input-sm"
                  placeholder="Args (comma-separated)"
                  value={addForm.args}
                  onChange={(e) =>
                    setAddForm({ ...addForm, args: e.target.value })
                  }
                />
              </div>
            ) : (
              <input
                className="input input-bordered input-sm w-full"
                placeholder="URL"
                value={addForm.url}
                onChange={(e) =>
                  setAddForm({ ...addForm, url: e.target.value })
                }
              />
            )}
            <div className="flex gap-2 justify-end">
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setShowAdd(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm btn-primary"
                disabled={!addForm.name}
                onClick={handleAdd}
              >
                Add & Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {servers.length === 0 ? (
        <div className="text-center py-12 text-base-content/50">
          <p className="text-lg">No MCP servers installed</p>
          <p className="text-sm mt-1">
            Browse the Marketplace tab to install servers, or add one manually.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((s) => (
            <div
              key={s.id}
              className="card bg-base-100 shadow border border-base-300"
            >
              <div className="card-body p-4">
                <div className="flex items-center gap-3">
                  {/* Expand toggle */}
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() =>
                      setExpanded((e) => ({ ...e, [s.id]: !e[s.id] }))
                    }
                  >
                    <FontAwesomeIcon
                      icon={expanded[s.id] ? faChevronDown : faChevronRight}
                    />
                  </button>

                  {/* Name + badges */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{s.name}</span>
                      <span
                        className={`badge badge-xs ${transportBadge(s.transport)}`}
                      >
                        {s.transport}
                      </span>
                      <span
                        className={`badge badge-xs ${statusBadge(s.status)}`}
                      >
                        {s.status}
                      </span>
                      {s.tools.length > 0 && (
                        <span className="badge badge-xs badge-outline">
                          {s.tools.length} tool{s.tools.length !== 1 && "s"}
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-xs text-base-content/60 truncate mt-0.5">
                        {s.description}
                      </p>
                    )}
                    {s.error && (
                      <p className="text-xs text-error mt-0.5">{s.error}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      className="btn btn-ghost btn-xs"
                      title={s.enabled ? "Disable" : "Enable"}
                      onClick={() => toggleEnabled(s)}
                    >
                      <FontAwesomeIcon
                        icon={s.enabled ? faPlug : faPlugCircleXmark}
                        className={s.enabled ? "text-success" : "text-base-content/30"}
                      />
                    </button>
                    <button
                      className="btn btn-ghost btn-xs"
                      title="Reconnect"
                      onClick={() => handleReconnect(s.id)}
                    >
                      <FontAwesomeIcon icon={faRotateRight} />
                    </button>
                    <button
                      className="btn btn-ghost btn-xs text-error"
                      title="Delete"
                      onClick={() => handleDelete(s.id)}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>

                {/* Expanded: tool list with toggles */}
                {expanded[s.id] && s.tools.length > 0 && (
                  <ToolToggleList server={s} onUpdate={refresh} />
                )}

                {/* Expanded: config details */}
                {expanded[s.id] && (
                  <div className="mt-2 text-xs text-base-content/50 flex flex-wrap gap-x-4">
                    {s.command && (
                      <span>
                        Command:{" "}
                        <code>
                          {s.command} {s.args.join(" ")}
                        </code>
                      </span>
                    )}
                    {s.url && (
                      <span>
                        URL: <code>{s.url}</code>
                      </span>
                    )}
                    {s.last_connected && (
                      <span>
                        Last connected:{" "}
                        {new Date(s.last_connected * 1000).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
