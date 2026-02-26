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
} from "@fortawesome/free-solid-svg-icons";
import type { McpServer } from "../types";
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

                {/* Expanded: tool list */}
                {expanded[s.id] && s.tools.length > 0 && (
                  <div className="mt-3 border-t border-base-300 pt-3">
                    <p className="text-xs font-semibold text-base-content/60 mb-2">
                      Available Tools
                    </p>
                    <div className="grid gap-1.5">
                      {s.tools.map((t) => (
                        <div
                          key={t.name}
                          className="flex items-start gap-2 text-xs bg-base-200 rounded px-2 py-1.5"
                        >
                          <code className="font-mono text-primary shrink-0">
                            {t.name}
                          </code>
                          <span className="text-base-content/60">
                            {t.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
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
