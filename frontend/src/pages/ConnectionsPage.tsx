import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faVial } from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import { useStore } from "../store";
import ConnectionCard from "../components/ConnectionCard";
import SaveButton from "../components/SaveButton";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  createConnection,
  updateConnection,
  deleteConnection,
  testConnection,
  discoverClaudeAddon,
  fetchConfig,
  refreshHealth,
} from "../api";
import type { Connection, ConnectionHealth } from "../types";
import { CAPABILITY_LABELS } from "../types";

const ALL_CAPABILITIES = [
  "conversation",
  "tool_use",
  "tts",
  "stt",
  "embeddings",
  "reranker",
  "multimodal_embeddings",
  "external_llm",
  "specialized",
  "vision",
];

const EMPTY_CONN: Omit<Connection, "id"> = {
  name: "",
  base_url: "",
  api_key: "",
  model: "",
  capabilities: [],
  connection_type: "openai",
  temperature: 0.7,
  max_tokens: 500,
  top_p: 1.0,
  keep_alive: "5m",
  thinking_enabled: false,
  voice: "alloy",
  speed: 1.0,
  format: "mp3",
  language: "en",
};

export default function ConnectionsPage() {
  const config = useStore((s) => s.config)!;
  const connections = config.connections;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Omit<Connection, "id">>(EMPTY_CONN);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionHealth | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId && connections[selectedId]) {
      const conn = connections[selectedId];
      setForm({ ...EMPTY_CONN, ...conn });
      setIsNew(false);
    }
  }, [selectedId, connections]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const reload = async () => {
    const cfg = await fetchConfig();
    useStore.getState().setConfig(cfg);
  };

  const handleNew = () => {
    setSelectedId(null);
    setIsNew(true);
    setForm({ ...EMPTY_CONN });
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        const { connection_id } = await createConnection(form);
        // Refresh health so the new connection gets checked immediately
        await refreshHealth();
        await reload();
        setSelectedId(connection_id);
        setIsNew(false);
        showToast("Connection created");
      } else if (selectedId) {
        // Strip `id` to avoid polluting WS message payload
        const { id: _dropped, ...cleanForm } = form as Connection;
        void _dropped;
        await updateConnection(selectedId, cleanForm);
        await reload();
        showToast("Connection updated");
      }
    } catch (err: unknown) {
      showToast(`Error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await deleteConnection(selectedId);
      await reload();
      setSelectedId(null);
      setIsNew(false);
      setDeleteConfirm(false);
      showToast("Connection deleted");
    } catch (err: unknown) {
      showToast(`Error: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection({
        base_url: form.base_url,
        api_key: form.api_key,
        capabilities: form.capabilities,
        connection_type: form.connection_type,
      });
      setTestResult(result);
    } catch (err: unknown) {
      setTestResult({
        reachable: false,
        api_valid: false,
        detail: (err as Error).message,
        error: "Test failed",
        model_name: null,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDiscoverAddon = async () => {
    setDiscovering(true);
    try {
      const { connection_ids, base_url } = await discoverClaudeAddon();
      await refreshHealth();
      await reload();
      setSelectedId(connection_ids[0] ?? null);
      setIsNew(false);
      showToast(
        `Claude Code add-on discovered at ${base_url} — ${connection_ids.length} connections created`
      );
    } catch (err: unknown) {
      showToast(`Discovery failed: ${(err as Error).message}`);
    } finally {
      setDiscovering(false);
    }
  };

  const toggleCapability = (cap: string) => {
    setForm((f) => ({
      ...f,
      capabilities: f.capabilities.includes(cap)
        ? f.capabilities.filter((c) => c !== cap)
        : [...f.capabilities, cap],
    }));
  };

  const hasLlmCaps =
    form.capabilities.includes("conversation") ||
    form.capabilities.includes("tool_use") ||
    form.capabilities.includes("external_llm");
  const hasTtsCaps = form.capabilities.includes("tts");
  const hasSttCaps = form.capabilities.includes("stt");
  const hasEmbeddingCaps = form.capabilities.includes("embeddings");
  const isClaude = form.connection_type === "claude_api" || form.connection_type === "claude_addon";
  const isOllama = form.connection_type === "ollama";

  return (
    <>
      <NavBar title="Connections" />
      <div className="p-6 flex gap-6 h-[calc(100vh-4rem)]">
        {/* Left: connection list */}
        <div className="w-80 shrink-0 flex flex-col gap-3 overflow-y-auto">
          <button className="btn btn-primary btn-sm" onClick={handleNew}>
            <FontAwesomeIcon icon={faPlus} /> Add Connection
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleDiscoverAddon}
            disabled={discovering}
          >
            <FontAwesomeIcon icon={faVial} />{" "}
            {discovering ? "Discovering..." : "Discover Claude Code"}
          </button>
          {Object.entries(connections).map(([id, conn]) => (
            <ConnectionCard
              key={id}
              id={id}
              connection={conn}
              health={config.health[id]}
              selected={selectedId === id}
              onClick={() => {
                setSelectedId(id);
                setIsNew(false);
                setTestResult(null);
              }}
            />
          ))}
          {Object.keys(connections).length === 0 && (
            <p className="text-sm text-base-content/50 text-center py-4">
              No connections yet
            </p>
          )}
        </div>

        {/* Right: form */}
        <div className="flex-1 overflow-y-auto">
          {!selectedId && !isNew ? (
            <div className="flex items-center justify-center h-full text-base-content/40">
              Select a connection or add a new one
            </div>
          ) : (
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body space-y-4">
                <h2 className="card-title text-lg">
                  {isNew ? "New Connection" : `Edit: ${form.name}`}
                </h2>

                {/* Basic fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Name</span>
                    </div>
                    <input
                      type="text"
                      className="input input-bordered input-sm"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="My LLM Server"
                    />
                  </label>
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Connection Type</span>
                    </div>
                    <select
                      className="select select-bordered select-sm"
                      value={form.connection_type ?? "openai"}
                      onChange={(e) => {
                        const ct = e.target.value;
                        setForm((f) => ({
                          ...f,
                          connection_type: ct,
                          ...(ct === "claude_api"
                            ? { base_url: "https://api.anthropic.com" }
                            : {}),
                        }));
                      }}
                    >
                      <option value="openai">OpenAI Compatible</option>
                      <option value="ollama">Ollama</option>
                      <option value="claude_api">Claude API</option>
                      <option value="claude_addon">Claude Code Add-on</option>
                    </select>
                  </label>
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Base URL</span>
                    </div>
                    <input
                      type="url"
                      className="input input-bordered input-sm"
                      value={form.base_url}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, base_url: e.target.value }))
                      }
                      placeholder="http://10.0.0.232:8000/v1"
                    />
                  </label>
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">API Key</span>
                    </div>
                    <input
                      type="password"
                      className="input input-bordered input-sm"
                      value={form.api_key}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, api_key: e.target.value }))
                      }
                      placeholder="Optional"
                    />
                  </label>
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Model</span>
                    </div>
                    <input
                      type="text"
                      className="input input-bordered input-sm"
                      list={`model-list-${selectedId ?? "new"}`}
                      value={form.model}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, model: e.target.value }))
                      }
                      placeholder="gpt-4o-mini"
                    />
                    {(() => {
                      const models =
                        (selectedId && config.health[selectedId]?.available_models) ||
                        testResult?.available_models ||
                        [];
                      return models.length > 0 ? (
                        <datalist id={`model-list-${selectedId ?? "new"}`}>
                          {models.map((m) => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                      ) : null;
                    })()}
                  </label>
                </div>

                {/* Capabilities */}
                <div className="form-control">
                  <div className="label">
                    <span className="label-text">Capabilities</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ALL_CAPABILITIES.map((cap) => (
                      <label key={cap} className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs checkbox-primary"
                          checked={form.capabilities.includes(cap)}
                          onChange={() => toggleCapability(cap)}
                        />
                        <span className="text-xs">
                          {CAPABILITY_LABELS[cap] || cap}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* LLM detail fields */}
                {hasLlmCaps && (
                  <div className="border border-base-300 rounded-lg p-4 space-y-3">
                    <h3 className="font-medium text-sm">LLM Settings</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="form-control">
                        <div className="label">
                          <span className="label-text text-xs">
                            Temperature
                          </span>
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          className="input input-bordered input-xs"
                          value={form.temperature ?? 0.7}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              temperature: parseFloat(e.target.value),
                            }))
                          }
                        />
                      </label>
                      <label className="form-control">
                        <div className="label">
                          <span className="label-text text-xs">Max Tokens</span>
                        </div>
                        <input
                          type="number"
                          className="input input-bordered input-xs"
                          value={form.max_tokens ?? 500}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              max_tokens: parseInt(e.target.value),
                            }))
                          }
                        />
                      </label>
                      {!isClaude && (
                        <label className="form-control">
                          <div className="label">
                            <span className="label-text text-xs">Top P</span>
                          </div>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            className="input input-bordered input-xs"
                            value={form.top_p ?? 1.0}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                top_p: parseFloat(e.target.value),
                              }))
                            }
                          />
                        </label>
                      )}
                      {isOllama && (
                        <label className="form-control">
                          <div className="label">
                            <span className="label-text text-xs">Keep Alive</span>
                          </div>
                          <input
                            type="text"
                            className="input input-bordered input-xs"
                            value={form.keep_alive ?? "5m"}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                keep_alive: e.target.value,
                              }))
                            }
                          />
                        </label>
                      )}
                    </div>
                    {!isClaude && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="toggle toggle-xs toggle-primary"
                          checked={!(form.thinking_enabled ?? false)}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              thinking_enabled: !e.target.checked,
                            }))
                          }
                        />
                        <span className="text-xs">Disable Thinking</span>
                      </label>
                    )}
                  </div>
                )}

                {/* TTS detail fields */}
                {hasTtsCaps && (
                  <div className="border border-base-300 rounded-lg p-4 space-y-3">
                    <h3 className="font-medium text-sm">TTS Settings</h3>
                    <div className="grid grid-cols-3 gap-3">
                      <label className="form-control">
                        <div className="label">
                          <span className="label-text text-xs">Voice</span>
                        </div>
                        <input
                          type="text"
                          className="input input-bordered input-xs"
                          value={form.voice ?? "alloy"}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, voice: e.target.value }))
                          }
                        />
                      </label>
                      <label className="form-control">
                        <div className="label">
                          <span className="label-text text-xs">Speed</span>
                        </div>
                        <input
                          type="number"
                          step="0.1"
                          className="input input-bordered input-xs"
                          value={form.speed ?? 1.0}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              speed: parseFloat(e.target.value),
                            }))
                          }
                        />
                      </label>
                      <label className="form-control">
                        <div className="label">
                          <span className="label-text text-xs">Format</span>
                        </div>
                        <select
                          className="select select-bordered select-xs"
                          value={form.format ?? "mp3"}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, format: e.target.value }))
                          }
                        >
                          <option value="mp3">mp3</option>
                          <option value="opus">opus</option>
                          <option value="aac">aac</option>
                          <option value="flac">flac</option>
                          <option value="wav">wav</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                {/* STT detail fields */}
                {hasSttCaps && (
                  <div className="border border-base-300 rounded-lg p-4 space-y-3">
                    <h3 className="font-medium text-sm">STT Settings</h3>
                    <label className="form-control w-48">
                      <div className="label">
                        <span className="label-text text-xs">Language</span>
                      </div>
                      <input
                        type="text"
                        className="input input-bordered input-xs"
                        value={form.language ?? "en"}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, language: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                )}

                {/* Embeddings detail fields */}
                {hasEmbeddingCaps && (
                  <div className="border border-base-300 rounded-lg p-4 space-y-3">
                    <h3 className="font-medium text-sm">Embedding Settings</h3>
                    <label className="form-control w-48">
                      <div className="label">
                        <span className="label-text text-xs">Provider</span>
                      </div>
                      <select
                        className="select select-bordered select-xs"
                        value={
                          form.embedding_provider ??
                          (form.connection_type === "ollama"
                            ? "ollama"
                            : "openai")
                        }
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            embedding_provider: e.target.value,
                          }))
                        }
                      >
                        <option value="ollama">Ollama</option>
                        <option value="openai">OpenAI</option>
                      </select>
                    </label>
                  </div>
                )}

                {/* Test result */}
                {testResult && (
                  <div
                    className={`alert ${
                      testResult.reachable && testResult.api_valid
                        ? "alert-success"
                        : "alert-error"
                    }`}
                  >
                    <span>
                      {testResult.reachable && testResult.api_valid
                        ? "Connection successful!"
                        : `${testResult.error}: ${testResult.detail}`}
                    </span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 justify-end pt-2">
                  {!isNew && (
                    <button
                      className="btn btn-error btn-sm btn-outline"
                      onClick={() => setDeleteConfirm(true)}
                    >
                      <FontAwesomeIcon icon={faTrash} /> Delete
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleTest}
                    disabled={testing || !form.base_url}
                  >
                    {testing ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <FontAwesomeIcon icon={faVial} />
                    )}
                    Test
                  </button>
                  <SaveButton
                    saving={saving}
                    onClick={handleSave}
                    disabled={!form.name || !form.base_url}
                    label={isNew ? "Create" : "Save"}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete Connection"
        message={`Are you sure you want to delete "${form.name}"? Any agents or roles using this connection will be unassigned.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(false)}
      />

      {/* Toast */}
      {toast && (
        <div className="toast toast-end toast-bottom">
          <div className="alert alert-info">
            <span>{toast}</span>
          </div>
        </div>
      )}
    </>
  );
}
