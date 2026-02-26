import { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faPlus,
  faPen,
  faTrash,
  faLink,
  faPlay,
  faArrowUp,
  faArrowDown,
} from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  listChains,
  createChain,
  updateChain,
  deleteChain,
  runChain,
  listAgents,
} from "../api";
import type { Chain, ChainStep, ChainRunResult, AgentInfo } from "../types";

function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const EMPTY_STEP: ChainStep = {
  agent_id: "",
  message_template: "",
  context_template: "",
  context_includes: [],
};

interface FormData {
  name: string;
  steps: ChainStep[];
  enabled: boolean;
}

const EMPTY_FORM: FormData = {
  name: "",
  steps: [{ ...EMPTY_STEP }],
  enabled: true,
};

const CONTEXT_INCLUDE_OPTIONS = [
  { value: "response_text", label: "Response Text" },
  { value: "tool_results", label: "Tool Results" },
];

export default function ChainsPage() {
  const [items, setItems] = useState<Chain[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Run modal state
  const [runTarget, setRunTarget] = useState<Chain | null>(null);
  const [runMessage, setRunMessage] = useState("");
  const [runContext, setRunContext] = useState("{}");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<ChainRunResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [chains, agts] = await Promise.all([listChains(), listAgents()]);
      setItems(chains);
      setAgents(agts);
    } catch (err) {
      console.error("Failed to load chains:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const agentName = (id: string) =>
    agents.find((a) => a.id === id)?.name ?? id;

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, steps: [{ ...EMPTY_STEP }] });
    setModalOpen(true);
  };

  const openEdit = (chain: Chain) => {
    setEditingId(chain.id);
    setForm({
      name: chain.name,
      steps: chain.steps.map((s) => ({ ...s })),
      enabled: chain.enabled,
    });
    setModalOpen(true);
  };

  const updateStep = (idx: number, patch: Partial<ChainStep>) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const addStep = () => {
    setForm((prev) => ({
      ...prev,
      steps: [...prev.steps, { ...EMPTY_STEP }],
    }));
  };

  const removeStep = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== idx),
    }));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= form.steps.length) return;
    setForm((prev) => {
      const steps = [...prev.steps];
      [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
      return { ...prev, steps };
    });
  };

  const toggleContextInclude = (idx: number, value: string) => {
    const step = form.steps[idx];
    const includes = step.context_includes ?? [];
    const next = includes.includes(value)
      ? includes.filter((v) => v !== value)
      : [...includes, value];
    updateStep(idx, { context_includes: next });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        steps: form.steps,
        enabled: form.enabled,
      };

      if (editingId) {
        const updated = await updateChain(editingId, payload);
        setItems((prev) =>
          prev.map((i) => (i.id === editingId ? updated : i))
        );
      } else {
        const created = await createChain(payload);
        setItems((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch (err) {
      console.error("Failed to save chain:", err);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget));
    setDeleteTarget(null);
    try {
      await deleteChain(deleteTarget);
    } catch {
      load();
    }
  };

  const handleToggle = async (chain: Chain) => {
    const newEnabled = !chain.enabled;
    setItems((prev) =>
      prev.map((i) =>
        i.id === chain.id ? { ...i, enabled: newEnabled } : i
      )
    );
    try {
      await updateChain(chain.id, { enabled: newEnabled });
    } catch {
      load();
    }
  };

  const openRun = (chain: Chain) => {
    setRunTarget(chain);
    setRunMessage("");
    setRunContext("{}");
    setRunning(false);
    setRunResult(null);
  };

  const handleRun = async () => {
    if (!runTarget) return;
    let ctxObj: Record<string, unknown> | undefined;
    try {
      const parsed = JSON.parse(runContext);
      if (Object.keys(parsed).length > 0) ctxObj = parsed;
    } catch {
      alert("Invalid JSON in context");
      return;
    }

    setRunning(true);
    setRunResult(null);
    try {
      const result = await runChain(
        runTarget.id,
        runMessage || undefined,
        ctxObj
      );
      setRunResult(result);
      load(); // refresh run_count
    } catch (err) {
      console.error("Chain run failed:", err);
      setRunResult(null);
      alert("Chain execution failed. Check logs for details.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <NavBar
        title="Chains"
        actions={
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <FontAwesomeIcon icon={faPlus} /> New
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={load}
              disabled={loading}
            >
              <FontAwesomeIcon icon={faArrowsRotate} spin={loading} />
            </button>
          </div>
        }
      />

      <div className="p-4 space-y-3 max-w-4xl">
        {loading && items.length === 0 && (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="text-center py-16">
            <FontAwesomeIcon
              icon={faLink}
              className="text-4xl text-base-content/20 mb-4"
            />
            <p className="text-base-content/50 mb-4">No chains yet</p>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <FontAwesomeIcon icon={faPlus} /> Create Chain
            </button>
          </div>
        )}

        {items.map((chain) => (
          <div key={chain.id} className="card bg-base-100 shadow-sm">
            <div className="card-body p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">
                      {chain.name || "Unnamed Chain"}
                    </span>
                    <span className="badge badge-sm badge-ghost">
                      {chain.steps.length} step
                      {chain.steps.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {chain.steps.map((step, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        {idx > 0 && (
                          <span className="text-base-content/30">&rarr;</span>
                        )}
                        <span className="badge badge-sm badge-outline">
                          {agentName(step.agent_id)}
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-base-content/40">
                    <span>Runs: {chain.run_count}</span>
                    <span>Last: {timeAgo(chain.last_run)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className="btn btn-success btn-xs"
                    onClick={() => openRun(chain)}
                    title="Run chain"
                  >
                    <FontAwesomeIcon icon={faPlay} />
                  </button>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={chain.enabled}
                    onChange={() => handleToggle(chain)}
                  />
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => openEdit(chain)}
                    title="Edit"
                  >
                    <FontAwesomeIcon icon={faPen} />
                  </button>
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => setDeleteTarget(chain.id)}
                    title="Delete"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg">
              {editingId ? "Edit Chain" : "New Chain"}
            </h3>
            <div className="space-y-4 mt-4">
              <label className="form-control">
                <div className="label">
                  <span className="label-text">Chain Name</span>
                </div>
                <input
                  type="text"
                  className="input input-bordered input-sm"
                  placeholder="e.g. Security Patrol"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="label-text font-medium">Steps</span>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={addStep}
                  >
                    <FontAwesomeIcon icon={faPlus} /> Add Step
                  </button>
                </div>
                <div className="space-y-3">
                  {form.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="border border-base-300 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-base-content/60">
                          Step {idx + 1}
                        </span>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => moveStep(idx, -1)}
                            disabled={idx === 0}
                            title="Move up"
                          >
                            <FontAwesomeIcon icon={faArrowUp} />
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => moveStep(idx, 1)}
                            disabled={idx === form.steps.length - 1}
                            title="Move down"
                          >
                            <FontAwesomeIcon icon={faArrowDown} />
                          </button>
                          {form.steps.length > 1 && (
                            <button
                              className="btn btn-ghost btn-xs text-error"
                              onClick={() => removeStep(idx)}
                              title="Remove step"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          )}
                        </div>
                      </div>

                      <select
                        className="select select-bordered select-sm w-full"
                        value={step.agent_id}
                        onChange={(e) =>
                          updateStep(idx, { agent_id: e.target.value })
                        }
                      >
                        <option value="">Select agent...</option>
                        {agents
                          .filter((a) => a.config.enabled)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </select>

                      <textarea
                        className="textarea textarea-bordered textarea-sm w-full"
                        rows={1}
                        placeholder="Message template (Jinja2)"
                        value={step.message_template ?? ""}
                        onChange={(e) =>
                          updateStep(idx, {
                            message_template: e.target.value,
                          })
                        }
                      />

                      <textarea
                        className="textarea textarea-bordered textarea-sm w-full"
                        rows={1}
                        placeholder="Context template (optional)"
                        value={step.context_template ?? ""}
                        onChange={(e) =>
                          updateStep(idx, {
                            context_template: e.target.value || null,
                          })
                        }
                      />

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-base-content/50">
                          Include from previous:
                        </span>
                        {CONTEXT_INCLUDE_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            className="flex items-center gap-1.5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="checkbox checkbox-xs checkbox-primary"
                              checked={
                                (step.context_includes ?? []).includes(
                                  opt.value
                                )
                              }
                              onChange={() =>
                                toggleContextInclude(idx, opt.value)
                              }
                            />
                            <span className="text-xs">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm"
                  checked={form.enabled}
                  onChange={(e) =>
                    setForm({ ...form, enabled: e.target.checked })
                  }
                />
                <span className="label-text">Enabled</span>
              </div>
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={
                  saving ||
                  !form.name ||
                  form.steps.some((s) => !s.agent_id)
                }
              >
                {saving && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                {editingId ? "Save" : "Create"}
              </button>
            </div>
          </div>
          <form
            method="dialog"
            className="modal-backdrop"
            onClick={() => setModalOpen(false)}
          >
            <button>close</button>
          </form>
        </dialog>
      )}

      {/* Run Modal */}
      {runTarget && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg">
              Run: {runTarget.name || "Chain"}
            </h3>
            <div className="space-y-3 mt-4">
              <label className="form-control">
                <div className="label">
                  <span className="label-text">Initial Message</span>
                </div>
                <textarea
                  className="textarea textarea-bordered textarea-sm"
                  rows={3}
                  placeholder="Message to send to the first agent in the chain"
                  value={runMessage}
                  onChange={(e) => setRunMessage(e.target.value)}
                  disabled={running}
                />
              </label>

              <label className="form-control">
                <div className="label">
                  <span className="label-text">Initial Context (JSON)</span>
                </div>
                <textarea
                  className="textarea textarea-bordered textarea-sm font-mono text-xs"
                  rows={3}
                  placeholder="{}"
                  value={runContext}
                  onChange={(e) => setRunContext(e.target.value)}
                  disabled={running}
                />
              </label>

              {running && (
                <div className="flex items-center gap-2 py-2">
                  <span className="loading loading-spinner loading-sm text-primary" />
                  <span className="text-sm text-base-content/60">
                    Executing chain...
                  </span>
                </div>
              )}

              {runResult && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge badge-success badge-sm">
                      Complete
                    </span>
                    <span className="text-xs text-base-content/50">
                      {runResult.steps_completed}/{runResult.steps_total} steps
                    </span>
                  </div>
                  <div className="bg-base-200 rounded-lg p-3 max-h-64 overflow-y-auto">
                    <p className="text-sm font-medium mb-1">Final Response:</p>
                    <p className="text-sm whitespace-pre-wrap">
                      {runResult.final_response}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setRunTarget(null)}
              >
                Close
              </button>
              {!runResult && (
                <button
                  className="btn btn-success"
                  onClick={handleRun}
                  disabled={running}
                >
                  {running ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <FontAwesomeIcon icon={faPlay} />
                  )}
                  Run
                </button>
              )}
            </div>
          </div>
          <form
            method="dialog"
            className="modal-backdrop"
            onClick={() => !running && setRunTarget(null)}
          >
            <button>close</button>
          </form>
        </dialog>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Chain"
        message="Are you sure you want to delete this chain? This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
