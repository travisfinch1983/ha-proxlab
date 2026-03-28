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
  faServer,
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
function groupTools(tools: McpToolDef[]): { name: string; tools: McpToolDef[] }[] {
  const map: Record<string, McpToolDef[]> = {};
  for (const t of tools) {
    const sep = t.name.indexOf("__");
    const key = sep > 0 ? t.name.substring(0, sep) : "(ungrouped)";
    (map[key] ??= []).push(t);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, tools]) => ({ name, tools }));
}

/** Short tool name — strip the server__ prefix when grouped. */
function shortToolName(fullName: string): string {
  const sep = fullName.indexOf("__");
  return sep > 0 ? fullName.substring(sep + 2) : fullName;
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const groups = groupTools(server.tools);
  const hasGroups = groups.length > 1 || (groups.length === 1 && groups[0].name !== "(ungrouped)");
  const enabledCount = server.tools.length - disabled.size;

  const save = async (next: Set<string>) => {
    setSaving(true);
    try {
      await updateMcpServer(server.id, { disabled_tools: [...next] });
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const toggleTool = (toolName: string) => {
    const next = new Set(disabled);
    if (next.has(toolName)) next.delete(toolName);
    else next.add(toolName);
    save(next);
  };

  const toggleAllGlobal = (enable: boolean) => {
    save(new Set(enable ? [] : server.tools.map((t) => t.name)));
  };

  const toggleSubServer = (group: { name: string; tools: McpToolDef[] }) => {
    const groupToolNames = group.tools.map((t) => t.name);
    const allEnabled = groupToolNames.every((n) => !disabled.has(n));
    const next = new Set(disabled);
    if (allEnabled) {
      // Disable all in this sub-server
      for (const n of groupToolNames) next.add(n);
    } else {
      // Enable all in this sub-server
      for (const n of groupToolNames) next.delete(n);
    }
    save(next);
  };

  const toggleGroupExpand = (name: string) => {
    setExpandedGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="mt-3 border-t border-base-300 pt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-base-content/60">
          {hasGroups
            ? `${groups.length} servers, ${enabledCount}/${server.tools.length} tools enabled`
            : `${enabledCount}/${server.tools.length} tools enabled`}
        </p>
        <div className="flex gap-1">
          <button
            className="btn btn-ghost btn-xs"
            disabled={saving}
            onClick={() => toggleAllGlobal(true)}
            title="Enable all tools"
          >
            <FontAwesomeIcon icon={faToggleOn} className="text-success" /> All
          </button>
          <button
            className="btn btn-ghost btn-xs"
            disabled={saving}
            onClick={() => toggleAllGlobal(false)}
            title="Disable all tools"
          >
            <FontAwesomeIcon icon={faToggleOff} className="text-base-content/30" /> None
          </button>
        </div>
      </div>

      {/* Sub-server list */}
      <div className="max-h-[32rem] overflow-y-auto space-y-1">
        {groups.map((group) => {
          const groupEnabled = group.tools.filter((t) => !disabled.has(t.name)).length;
          const allEnabled = groupEnabled === group.tools.length;
          const noneEnabled = groupEnabled === 0;
          const isExpanded = expandedGroups[group.name] ?? false;

          return (
            <div key={group.name} className="border border-base-300 rounded-lg overflow-hidden">
              {/* Sub-server header row */}
              {hasGroups && (
                <div
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer select-none ${
                    noneEnabled ? "bg-base-200/50 opacity-60" : "bg-base-200"
                  }`}
                  onClick={() => toggleGroupExpand(group.name)}
                >
                  <FontAwesomeIcon
                    icon={isExpanded ? faChevronDown : faChevronRight}
                    className="text-xs text-base-content/40 w-3"
                  />
                  <FontAwesomeIcon
                    icon={faServer}
                    className={`text-xs ${noneEnabled ? "text-base-content/30" : "text-primary"}`}
                  />
                  <span className="text-sm font-medium flex-1">{group.name}</span>
                  <span className="text-xs text-base-content/50">
                    {groupEnabled}/{group.tools.length}
                  </span>
                  <input
                    type="checkbox"
                    className="toggle toggle-xs toggle-primary"
                    checked={allEnabled}
                    ref={(el) => {
                      if (el) el.indeterminate = !allEnabled && !noneEnabled;
                    }}
                    disabled={saving}
                    onChange={(e) => { e.stopPropagation(); toggleSubServer(group); }}
                    onClick={(e) => e.stopPropagation()}
                    title={allEnabled ? "Disable all tools in this server" : "Enable all tools in this server"}
                  />
                </div>
              )}

              {/* Tool list (expanded) */}
              {(isExpanded || !hasGroups) && (
                <div className={`divide-y divide-base-300 ${hasGroups ? "border-t border-base-300" : ""}`}>
                  {group.tools.map((t) => {
                    const isOff = disabled.has(t.name);
                    return (
                      <label
                        key={t.name}
                        className={`flex items-start gap-2 px-3 py-1.5 cursor-pointer hover:bg-base-200/70 text-xs ${
                          isOff ? "opacity-40" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs checkbox-primary mt-0.5 shrink-0"
                          checked={!isOff}
                          disabled={saving}
                          onChange={() => toggleTool(t.name)}
                        />
                        <div className="min-w-0 flex-1">
                          <code className="font-mono text-primary">
                            {hasGroups ? shortToolName(t.name) : t.name}
                          </code>
                          {t.description && (
                            <p className="text-base-content/50 truncate">{t.description}</p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
              <label className="form-control">
                <div className="label">
                  <span className="label-text text-xs">Server Name</span>
                  <span className="label-text-alt text-xs text-base-content/40" title="A display name to identify this server in the list">Required</span>
                </div>
                <input
                  className="input input-bordered input-sm"
                  placeholder="e.g. MCPJungle"
                  value={addForm.name}
                  onChange={(e) =>
                    setAddForm({ ...addForm, name: e.target.value })
                  }
                />
              </label>
              <label className="form-control">
                <div className="label">
                  <span className="label-text text-xs">Transport</span>
                  <span className="label-text-alt text-xs text-base-content/40" title="stdio: launch a local process. SSE: connect to a remote server via Server-Sent Events. Streamable HTTP: newer HTTP-based MCP transport.">Protocol</span>
                </div>
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
              </label>
            </div>
            {addForm.transport === "stdio" ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="form-control">
                  <div className="label">
                    <span className="label-text text-xs">Command</span>
                    <span className="label-text-alt text-xs text-base-content/40" title="The executable to run, e.g. python3, node, or a path to a binary">Executable</span>
                  </div>
                  <input
                    className="input input-bordered input-sm"
                    placeholder="e.g. python3"
                    value={addForm.command}
                    onChange={(e) =>
                      setAddForm({ ...addForm, command: e.target.value })
                    }
                  />
                </label>
                <label className="form-control">
                  <div className="label">
                    <span className="label-text text-xs">Arguments</span>
                    <span className="label-text-alt text-xs text-base-content/40" title="Comma-separated arguments passed to the command">Optional</span>
                  </div>
                  <input
                    className="input input-bordered input-sm"
                    placeholder="e.g. -m, mcp_server"
                    value={addForm.args}
                    onChange={(e) =>
                      setAddForm({ ...addForm, args: e.target.value })
                    }
                  />
                </label>
              </div>
            ) : (
              <label className="form-control">
                <div className="label">
                  <span className="label-text text-xs">Server URL</span>
                  <span className="label-text-alt text-xs text-base-content/40" title="The full URL of the MCP server endpoint, including /sse for SSE transport">Endpoint</span>
                </div>
                <input
                  className="input input-bordered input-sm w-full"
                  placeholder={addForm.transport === "sse" ? "e.g. http://10.0.0.52:8080/sse" : "e.g. http://10.0.0.52:8080/mcp"}
                  value={addForm.url}
                  onChange={(e) =>
                    setAddForm({ ...addForm, url: e.target.value })
                  }
                />
              </label>
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
                          {s.tools.length - (s.disabled_tools?.length ?? 0)}/{s.tools.length} tools
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
