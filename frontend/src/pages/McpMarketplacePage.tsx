import { useEffect, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrash,
  faRotateRight,
  faDownload,
  faCheck,
  faSearch,
  faGlobe,
} from "@fortawesome/free-solid-svg-icons";
import type { McpRepo, McpCatalogServer, McpParameter } from "../types";
import {
  listMcpRepos,
  addMcpRepo,
  removeMcpRepo,
  refreshMcpRepo,
  getMcpCatalog,
  createMcpServer,
} from "../api";

export default function McpMarketplacePage() {
  const [repos, setRepos] = useState<McpRepo[]>([]);
  const [catalog, setCatalog] = useState<McpCatalogServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [installModal, setInstallModal] = useState<McpCatalogServer | null>(
    null
  );
  const [installParams, setInstallParams] = useState<Record<string, string>>(
    {}
  );
  const [installing, setInstalling] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [r, c] = await Promise.all([listMcpRepos(), getMcpCatalog()]);
      setRepos(r);
      setCatalog(c);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAddRepo = async () => {
    if (!repoUrl.trim()) return;
    await addMcpRepo(repoUrl.trim());
    setRepoUrl("");
    setShowAddRepo(false);
    await refresh();
  };

  const handleRemoveRepo = async (id: string) => {
    if (!confirm("Remove this repository?")) return;
    await removeMcpRepo(id);
    await refresh();
  };

  const handleRefreshRepo = async (id: string) => {
    await refreshMcpRepo(id);
    await refresh();
  };

  const openInstall = (server: McpCatalogServer) => {
    const defaults: Record<string, string> = {};
    (server.parameters || []).forEach((p: McpParameter) => {
      defaults[p.key] = p.default || "";
    });
    setInstallParams(defaults);
    setInstallModal(server);
  };

  const handleInstall = async () => {
    if (!installModal) return;
    setInstalling(true);
    try {
      const data: Record<string, unknown> = {
        name: installModal.name,
        description: installModal.description,
        catalog_id: installModal.id,
        repo_id: installModal.repo_id || "",
        transport: installModal.transport,
        parameters: installParams,
      };
      if (installModal.command) data.command = installModal.command;
      if (installModal.args) data.args = installModal.args;
      if (
        installModal.transport === "sse" ||
        installModal.transport === "streamable_http"
      ) {
        data.url = (installModal as unknown as Record<string, unknown>).url || "";
      }
      await createMcpServer(data);
      setInstallModal(null);
      await refresh();
    } finally {
      setInstalling(false);
    }
  };

  const filtered = catalog.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      (s.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Repos Section */}
      <div className="card bg-base-100 shadow border border-base-300">
        <div className="card-body p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Repositories</h3>
            <button
              className="btn btn-xs btn-primary"
              onClick={() => setShowAddRepo(!showAddRepo)}
            >
              <FontAwesomeIcon icon={faPlus} className="mr-1" />
              Add Repo
            </button>
          </div>

          {showAddRepo && (
            <div className="flex gap-2 mt-2">
              <input
                className="input input-bordered input-sm flex-1"
                placeholder="https://github.com/user/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddRepo()}
              />
              <button
                className="btn btn-sm btn-primary"
                disabled={!repoUrl.trim()}
                onClick={handleAddRepo}
              >
                Add
              </button>
            </div>
          )}

          <div className="space-y-1 mt-2">
            {repos.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 text-sm bg-base-200 rounded px-3 py-2"
              >
                <FontAwesomeIcon
                  icon={faGlobe}
                  className="text-base-content/40"
                />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-base-content/50 ml-2 truncate">
                    {r.url}
                  </span>
                </div>
                <span className="badge badge-xs badge-outline">
                  {r.servers_available} server
                  {r.servers_available !== 1 && "s"}
                </span>
                <button
                  className="btn btn-ghost btn-xs"
                  title="Refresh"
                  onClick={() => handleRefreshRepo(r.id)}
                >
                  <FontAwesomeIcon icon={faRotateRight} />
                </button>
                <button
                  className="btn btn-ghost btn-xs text-error"
                  title="Remove"
                  onClick={() => handleRemoveRepo(r.id)}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            ))}
            {repos.length === 0 && (
              <p className="text-sm text-base-content/50 py-2">
                No repositories configured.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold flex-1">Available Servers</h2>
        <div className="relative">
          <FontAwesomeIcon
            icon={faSearch}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 w-3.5"
          />
          <input
            className="input input-bordered input-sm pl-9 w-64"
            placeholder="Search servers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Catalog Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-base-content/50">
          {search
            ? "No servers match your search."
            : "No servers available. Add a repository first."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((s) => (
            <div
              key={`${s.repo_id}-${s.id}`}
              className="card bg-base-100 shadow border border-base-300"
            >
              <div className="card-body p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{s.name}</h3>
                    <p className="text-xs text-base-content/60 mt-0.5">
                      {s.description}
                    </p>
                  </div>
                  {s.installed ? (
                    <span className="badge badge-success badge-sm gap-1">
                      <FontAwesomeIcon icon={faCheck} className="w-3 h-3" />
                      Installed
                    </span>
                  ) : (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => openInstall(s)}
                    >
                      <FontAwesomeIcon
                        icon={faDownload}
                        className="w-3 h-3 mr-1"
                      />
                      Install
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mt-2">
                  {s.repo_name && (
                    <span className="badge badge-xs badge-outline">
                      {s.repo_name}
                    </span>
                  )}
                  <span className="badge badge-xs badge-info">
                    {s.transport}
                  </span>
                  {s.version && (
                    <span className="badge badge-xs badge-ghost">
                      v{s.version}
                    </span>
                  )}
                  {(s.tags || []).map((t) => (
                    <span key={t} className="badge badge-xs">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Install Modal */}
      {installModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">
              Install: {installModal.name}
            </h3>
            <p className="text-sm text-base-content/60 mt-1">
              {installModal.description}
            </p>

            {installModal.command && (
              <div className="mt-3 bg-base-200 rounded p-2">
                <p className="text-xs font-mono text-base-content/70">
                  {installModal.command} {(installModal.args || []).join(" ")}
                </p>
              </div>
            )}

            {installModal.requirements &&
              installModal.requirements.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-base-content/60">
                    Requirements
                  </p>
                  <p className="text-xs text-base-content/50">
                    {installModal.requirements.join(", ")}
                  </p>
                </div>
              )}

            {installModal.parameters &&
              installModal.parameters.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold">Parameters</p>
                  {installModal.parameters.map((p: McpParameter) => (
                    <div key={p.key}>
                      <label className="label label-text text-xs">
                        {p.key}
                        {p.required && (
                          <span className="text-error ml-1">*</span>
                        )}
                        <span className="text-base-content/50 ml-2">
                          {p.description}
                        </span>
                      </label>
                      <input
                        className="input input-bordered input-sm w-full"
                        value={installParams[p.key] || ""}
                        placeholder={p.default || ""}
                        onChange={(e) =>
                          setInstallParams({
                            ...installParams,
                            [p.key]: e.target.value,
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setInstallModal(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={installing}
                onClick={handleInstall}
              >
                {installing ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Install & Connect"
                )}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setInstallModal(null)}
          />
        </div>
      )}
    </div>
  );
}
