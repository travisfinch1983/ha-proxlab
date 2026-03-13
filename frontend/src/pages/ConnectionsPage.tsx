import { useState, useEffect, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faVial, faArrowsRotate, faChevronDown, faChevronRight } from "@fortawesome/free-solid-svg-icons";
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
  discoverModels,
  fetchConfig,
  refreshHealth,
} from "../api";
import type { Connection, ConnectionHealth, DiscoveredModel } from "../types";
import {
  CAPABILITY_LABELS,
  CAPABILITY_COLORS,
  ALL_CAPABILITIES,
  HIDDEN_CAPABILITIES,
  computeEffectiveCaps,
} from "../types";

const EMPTY_CONN: Omit<Connection, "id"> = {
  name: "",
  base_url: "",
  api_key: "",
  model: "",
  capabilities: [],
  connection_type: "openai",
  embedding_provider: "openai",
  temperature: 0.7,
  max_tokens: 500,
  top_p: 1.0,
  keep_alive: "5m",
  thinking_enabled: false,
  is_universal: false,
  capability_overrides: {},
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
  const [probeStatus, setProbeStatus] = useState<'idle' | 'probing' | 'invalid' | 'single' | 'universal'>('idle');
  const [probeModels, setProbeModels] = useState<string[]>([]);
  const [allDiscovered, setAllDiscovered] = useState<DiscoveredModel[]>([]);
  const [capOverrideOpen, setCapOverrideOpen] = useState(false);

  // Load discovered models on mount (cached, fast)
  useEffect(() => {
    discoverModels().then(setAllDiscovered).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedId && connections[selectedId]) {
      const conn = connections[selectedId];
      setForm({ ...EMPTY_CONN, ...conn });
      setIsNew(false);
      setCapOverrideOpen(false);
      // Initialize probe state from stored connection
      const health = config.health[selectedId];
      if (health?.available_models && health.available_models.length > 0) {
        setProbeStatus('universal');
        setProbeModels(health.available_models);
      } else if (conn.is_universal) {
        setProbeStatus('universal');
        setProbeModels([]);
      } else if (health?.reachable) {
        setProbeStatus('single');
        setProbeModels([]);
      } else {
        setProbeStatus('idle');
        setProbeModels([]);
      }
    }
  }, [selectedId, connections]);

  // Compute detected capabilities for the selected connection
  // Includes stored capabilities as baseline + model discovery enrichment
  const detectedCapsForConn = useMemo(() => {
    const caps = new Set<string>();
    if (!selectedId) return caps;
    // Include stored capabilities as baseline (filter out hidden ones)
    for (const cap of form.capabilities) {
      if (!HIDDEN_CAPABILITIES.has(cap)) caps.add(cap);
    }
    // Enrich from model discovery
    for (const m of allDiscovered.filter((m) => m.connection_id === selectedId)) {
      if (m.supports_vision) caps.add("vision");
      if (m.supports_audio) caps.add("specialized");
      if (m.supports_embeddings) caps.add("embeddings");
      if (m.supports_tts) caps.add("tts");
      if (m.supports_tool_use) caps.add("tool_use");
    }
    return caps;
  }, [selectedId, allDiscovered, form.capabilities]);

  // Effective capabilities = detected + overrides
  const effectiveCaps = useMemo(
    () => computeEffectiveCaps(form.capability_overrides, detectedCapsForConn),
    [form.capability_overrides, detectedCapsForConn],
  );

  // Discovered models for the selected connection (for the model listbox)
  const connDiscoveredModels = useMemo(
    () => (selectedId ? allDiscovered.filter((m) => m.connection_id === selectedId) : []),
    [selectedId, allDiscovered],
  );

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
    setProbeStatus('idle');
    setProbeModels([]);
    setCapOverrideOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);

    // Compute effective capabilities from overrides + detected
    const effective = computeEffectiveCaps(form.capability_overrides, detectedCapsForConn);

    // Ensure embedding_provider is always saved when embedding caps are present
    const hasEmb = effective.includes("embeddings") || effective.includes("multimodal_embeddings");
    const formToSave = { ...form, capabilities: effective };
    if (hasEmb && !formToSave.embedding_provider) {
      formToSave.embedding_provider =
        formToSave.connection_type === "ollama" ? "ollama" : "openai";
    }

    try {
      if (isNew) {
        const { connection_id } = await createConnection(formToSave);
        await refreshHealth();
        await reload();
        setSelectedId(connection_id);
        setIsNew(false);
        showToast("Connection created");
      } else if (selectedId) {
        const { id: _dropped, ...cleanForm } = formToSave as Connection;
        void _dropped;
        await updateConnection(selectedId, cleanForm);
        await reload();
        showToast("Connection updated");
      }
      // Refresh model discovery (force) so detected badges update
      discoverModels(true).then(setAllDiscovered).catch(() => {});
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
        capabilities: effectiveCaps,
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

  const probeEndpoint = async () => {
    if (!form.base_url) return;
    setProbeStatus('probing');
    setProbeModels([]);
    try {
      const result = await testConnection({
        base_url: form.base_url,
        api_key: form.api_key,
        capabilities: effectiveCaps,
        connection_type: form.connection_type,
      });
      if (!result.reachable || !result.api_valid) {
        setProbeStatus('invalid');
        setForm(f => ({ ...f, is_universal: false }));
      } else if (result.available_models && result.available_models.length > 0) {
        setProbeStatus('universal');
        setProbeModels(result.available_models);
        setForm(f => ({ ...f, is_universal: true }));
      } else {
        setProbeStatus('single');
        setForm(f => ({ ...f, is_universal: false }));
      }
    } catch {
      setProbeStatus('invalid');
      setForm(f => ({ ...f, is_universal: false }));
    }
  };

  const updateOverride = (cap: string, mode: "default" | "force_enable" | "force_disable") => {
    setForm((f) => {
      const overrides = { ...(f.capability_overrides || {}) };
      if (mode === "default") {
        delete overrides[cap];
      } else {
        overrides[cap] = mode;
      }
      return { ...f, capability_overrides: overrides };
    });
  };

  const overrideCount = Object.keys(form.capability_overrides || {}).length;

  const hasLlmCaps =
    effectiveCaps.includes("conversation") ||
    effectiveCaps.includes("tool_use") ||
    effectiveCaps.includes("external_llm");
  const hasTtsCaps = effectiveCaps.includes("tts");
  const hasSttCaps = effectiveCaps.includes("stt");
  const hasEmbeddingCaps = effectiveCaps.includes("embeddings");
  const isClaude = form.connection_type === "claude_api" || form.connection_type === "claude_addon";
  const isOllama = form.connection_type === "ollama";

  // Per-model capability helper for the model listbox
  const getModelCaps = (m: DiscoveredModel): string[] => {
    const caps: string[] = [];
    if (m.supports_vision) caps.push("vision");
    if (m.supports_tool_use) caps.push("tool_use");
    if (m.supports_embeddings) caps.push("embeddings");
    if (m.supports_tts) caps.push("tts");
    if (m.supports_audio) caps.push("specialized");
    return caps;
  };

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
              discoveredModels={allDiscovered}
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
                    <div className="join w-full">
                      <input
                        type="url"
                        className="input input-bordered input-sm join-item flex-1"
                        value={form.base_url}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, base_url: e.target.value }))
                        }
                        onBlur={() => probeEndpoint()}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); probeEndpoint(); } }}
                        placeholder="http://10.0.0.232:8000/v1"
                      />
                      <button
                        className="btn btn-ghost btn-sm join-item"
                        type="button"
                        onClick={probeEndpoint}
                        disabled={probeStatus === 'probing' || !form.base_url}
                        title="Test endpoint"
                      >
                        {probeStatus === 'probing'
                          ? <span className="loading loading-spinner loading-xs" />
                          : <FontAwesomeIcon icon={faArrowsRotate} />}
                      </button>
                    </div>
                    {probeStatus === 'invalid' && (
                      <span className="text-xs text-error mt-1">Invalid Endpoint</span>
                    )}
                    {probeStatus === 'single' && (
                      <span className="text-xs text-warning mt-1">Single Model Endpoint Connected</span>
                    )}
                    {probeStatus === 'universal' && (
                      <span className="text-xs text-success mt-1">Model List Retrieved ({probeModels.length} models)</span>
                    )}
                    {probeStatus === 'probing' && (
                      <span className="text-xs text-base-content/50 mt-1">Testing endpoint...</span>
                    )}
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

                  {/* Model listbox — upgraded with per-model capability dots for universal endpoints */}
                  {probeStatus === 'universal' && (probeModels.length > 0 || connDiscoveredModels.length > 0) ? (
                    <div className="form-control md:col-span-2">
                      <div className="label">
                        <span className="label-text">Available Models</span>
                      </div>
                      <div className="border border-base-300 rounded-lg max-h-40 overflow-y-auto bg-base-200/30">
                        {connDiscoveredModels.length > 0
                          ? connDiscoveredModels.map((m) => {
                              const mCaps = getModelCaps(m);
                              return (
                                <div
                                  key={m.id}
                                  className="flex items-center justify-between px-3 py-1.5 border-b border-base-300/50 last:border-b-0 hover:bg-base-200/50"
                                >
                                  <span className="text-xs font-mono truncate flex-1">{m.id}</span>
                                  <div className="flex gap-1 items-center ml-2 shrink-0">
                                    {mCaps.map((cap) => {
                                      const color = CAPABILITY_COLORS[cap]?.dot || "bg-base-content";
                                      return (
                                        <span
                                          key={cap}
                                          className={`w-2 h-2 rounded-full ${color} inline-block`}
                                          title={CAPABILITY_LABELS[cap] || cap}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })
                          : probeModels.map((m) => (
                              <div
                                key={m}
                                className="px-3 py-1.5 border-b border-base-300/50 last:border-b-0"
                              >
                                <span className="text-xs font-mono">{m}</span>
                              </div>
                            ))
                        }
                      </div>
                      <div className="label pt-0.5">
                        <span className="label-text-alt text-base-content/40">
                          Universal endpoint — colored dots indicate per-model capabilities
                        </span>
                      </div>
                    </div>
                  ) : (
                    <label className="form-control">
                      <div className="label">
                        <span className="label-text">Model</span>
                      </div>
                      <input
                        type="text"
                        className="input input-bordered input-sm"
                        value={form.model}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, model: e.target.value }))
                        }
                        placeholder="gpt-4o-mini"
                      />
                    </label>
                  )}
                </div>

                {/* Effective Capabilities display */}
                <div className="form-control">
                  <div className="label">
                    <span className="label-text">Capabilities</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {effectiveCaps.length > 0
                      ? effectiveCaps.map((cap) => {
                          const color = CAPABILITY_COLORS[cap]?.badge || "badge-outline";
                          return (
                            <span key={cap} className={`badge badge-sm ${color}`}>
                              {CAPABILITY_LABELS[cap] || cap}
                            </span>
                          );
                        })
                      : <span className="text-xs text-base-content/40">No capabilities detected — use overrides below to assign</span>
                    }
                  </div>

                  {/* Collapsible Model Capability Override panel */}
                  <div className="mt-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-sm font-medium text-base-content/70 hover:text-base-content transition-colors"
                      onClick={() => setCapOverrideOpen(!capOverrideOpen)}
                    >
                      <FontAwesomeIcon
                        icon={capOverrideOpen ? faChevronDown : faChevronRight}
                        className="text-xs"
                      />
                      Model Capability Override
                      {overrideCount > 0 && (
                        <span className="badge badge-xs badge-accent">{overrideCount}</span>
                      )}
                    </button>

                    {capOverrideOpen && (
                      <div className="mt-2 border border-base-300 rounded-lg p-3 space-y-1.5 bg-base-200/20">
                        <p className="text-xs text-base-content/50 mb-2">
                          Override auto-detected capabilities. Default uses detected values.
                        </p>
                        {ALL_CAPABILITIES.map((cap) => {
                          const override = (form.capability_overrides || {})[cap];
                          const isDetected = detectedCapsForConn.has(cap);
                          const dotColor = CAPABILITY_COLORS[cap]?.dot || "bg-base-content";
                          return (
                            <div
                              key={cap}
                              className="flex items-center justify-between py-1"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${dotColor} inline-block shrink-0`} />
                                <span className="text-xs">{CAPABILITY_LABELS[cap] || cap}</span>
                                {isDetected && (
                                  <span className="badge badge-xs badge-success badge-outline">det</span>
                                )}
                              </div>
                              <div className="join">
                                <button
                                  type="button"
                                  className={`btn btn-xs join-item ${
                                    !override ? "btn-active" : "btn-ghost"
                                  }`}
                                  onClick={() => updateOverride(cap, "default")}
                                >
                                  Default
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-xs join-item ${
                                    override === "force_enable"
                                      ? "btn-success"
                                      : "btn-ghost"
                                  }`}
                                  onClick={() => updateOverride(cap, "force_enable")}
                                >
                                  On
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-xs join-item ${
                                    override === "force_disable"
                                      ? "btn-error"
                                      : "btn-ghost"
                                  }`}
                                  onClick={() => updateOverride(cap, "force_disable")}
                                >
                                  Off
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
                        value={form.embedding_provider ?? "openai"}
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
