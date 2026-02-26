import { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faPlus,
  faPen,
  faTrash,
  faBell,
} from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  listSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  listAgents,
} from "../api";
import type { Subscription, AgentInfo } from "../types";

function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface FormData {
  event_type: string;
  event_filter: string;
  agent_id: string;
  message_template: string;
  context_template: string;
  cooldown_seconds: number;
  enabled: boolean;
}

const EMPTY_FORM: FormData = {
  event_type: "",
  event_filter: "{}",
  agent_id: "",
  message_template: "",
  context_template: "",
  cooldown_seconds: 0,
  enabled: true,
};

export default function SubscriptionsPage() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subs, agts] = await Promise.all([
        listSubscriptions(),
        listAgents(),
      ]);
      setItems(subs);
      setAgents(agts);
    } catch (err) {
      console.error("Failed to load subscriptions:", err);
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
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (sub: Subscription) => {
    setEditingId(sub.id);
    setForm({
      event_type: sub.event_type,
      event_filter: JSON.stringify(sub.event_filter, null, 2),
      agent_id: sub.agent_id,
      message_template: sub.message_template,
      context_template: sub.context_template ?? "",
      cooldown_seconds: sub.cooldown_seconds,
      enabled: sub.enabled,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    let filterObj: Record<string, unknown> = {};
    try {
      filterObj = JSON.parse(form.event_filter);
    } catch {
      alert("Invalid JSON in event filter");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        event_type: form.event_type,
        event_filter: filterObj,
        agent_id: form.agent_id,
        message_template: form.message_template,
        context_template: form.context_template || null,
        cooldown_seconds: form.cooldown_seconds,
        enabled: form.enabled,
      };

      if (editingId) {
        const updated = await updateSubscription(editingId, payload);
        setItems((prev) =>
          prev.map((i) => (i.id === editingId ? updated : i))
        );
      } else {
        const created = await createSubscription(payload);
        setItems((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch (err) {
      console.error("Failed to save subscription:", err);
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
      await deleteSubscription(deleteTarget);
    } catch {
      load();
    }
  };

  const handleToggle = async (sub: Subscription) => {
    const newEnabled = !sub.enabled;
    setItems((prev) =>
      prev.map((i) =>
        i.id === sub.id ? { ...i, enabled: newEnabled } : i
      )
    );
    try {
      await updateSubscription(sub.id, { enabled: newEnabled });
    } catch {
      load();
    }
  };

  return (
    <>
      <NavBar
        title="Subscriptions"
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
              icon={faBell}
              className="text-4xl text-base-content/20 mb-4"
            />
            <p className="text-base-content/50 mb-4">No subscriptions yet</p>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <FontAwesomeIcon icon={faPlus} /> Create Subscription
            </button>
          </div>
        )}

        {items.map((sub) => (
          <div key={sub.id} className="card bg-base-100 shadow-sm">
            <div className="card-body p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{sub.event_type}</span>
                    <span className="badge badge-sm badge-ghost">
                      {agentName(sub.agent_id)}
                    </span>
                    {Object.keys(sub.event_filter).length > 0 && (
                      <span className="badge badge-sm badge-outline">
                        {Object.keys(sub.event_filter).length} filter{Object.keys(sub.event_filter).length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {sub.message_template && (
                    <p className="text-sm text-base-content/60 mt-1 truncate">
                      {sub.message_template}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-base-content/40">
                    <span>Triggered {sub.trigger_count}x</span>
                    <span>Last: {timeAgo(sub.last_triggered)}</span>
                    {sub.cooldown_seconds > 0 && (
                      <span>Cooldown: {sub.cooldown_seconds}s</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={sub.enabled}
                    onChange={() => handleToggle(sub)}
                  />
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => openEdit(sub)}
                    title="Edit"
                  >
                    <FontAwesomeIcon icon={faPen} />
                  </button>
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => setDeleteTarget(sub.id)}
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
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg">
              {editingId ? "Edit Subscription" : "New Subscription"}
            </h3>
            <div className="space-y-3 mt-4">
              <label className="form-control">
                <div className="label">
                  <span className="label-text">Event Type</span>
                </div>
                <input
                  type="text"
                  className="input input-bordered input-sm"
                  placeholder="state_changed, automation_triggered, etc."
                  value={form.event_type}
                  onChange={(e) =>
                    setForm({ ...form, event_type: e.target.value })
                  }
                />
              </label>

              <label className="form-control">
                <div className="label">
                  <span className="label-text">Event Filter (JSON)</span>
                </div>
                <textarea
                  className="textarea textarea-bordered textarea-sm font-mono text-xs"
                  rows={3}
                  placeholder='{"entity_id": "binary_sensor.motion"}'
                  value={form.event_filter}
                  onChange={(e) =>
                    setForm({ ...form, event_filter: e.target.value })
                  }
                />
              </label>

              <label className="form-control">
                <div className="label">
                  <span className="label-text">Agent</span>
                </div>
                <select
                  className="select select-bordered select-sm"
                  value={form.agent_id}
                  onChange={(e) =>
                    setForm({ ...form, agent_id: e.target.value })
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
              </label>

              <label className="form-control">
                <div className="label">
                  <span className="label-text">Message Template</span>
                </div>
                <textarea
                  className="textarea textarea-bordered textarea-sm"
                  rows={2}
                  placeholder="Jinja2 template, e.g. Motion detected at {{ trigger.entity_id }}"
                  value={form.message_template}
                  onChange={(e) =>
                    setForm({ ...form, message_template: e.target.value })
                  }
                />
              </label>

              <label className="form-control">
                <div className="label">
                  <span className="label-text">Context Template (optional)</span>
                </div>
                <textarea
                  className="textarea textarea-bordered textarea-sm"
                  rows={2}
                  placeholder="Optional Jinja2 context template"
                  value={form.context_template}
                  onChange={(e) =>
                    setForm({ ...form, context_template: e.target.value })
                  }
                />
              </label>

              <label className="form-control">
                <div className="label">
                  <span className="label-text">Cooldown (seconds)</span>
                </div>
                <input
                  type="number"
                  className="input input-bordered input-sm w-32"
                  min={0}
                  value={form.cooldown_seconds}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cooldown_seconds: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </label>

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
                disabled={saving || !form.event_type || !form.agent_id}
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Subscription"
        message="Are you sure you want to delete this subscription? This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
