import { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faPlus,
  faPen,
  faTrash,
  faClock,
} from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  listAgents,
} from "../api";
import type { Schedule, AgentInfo } from "../types";

function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function describeSchedule(s: Schedule): string {
  if (s.schedule_type === "interval") {
    const secs = s.schedule_config.seconds ?? 0;
    if (secs >= 3600) return `every ${Math.floor(secs / 3600)}h`;
    if (secs >= 60) return `every ${Math.floor(secs / 60)}min`;
    return `every ${secs}s`;
  }
  if (s.schedule_type === "time_of_day") {
    const h = String(s.schedule_config.hour ?? 0).padStart(2, "0");
    const m = String(s.schedule_config.minute ?? 0).padStart(2, "0");
    return `daily at ${h}:${m}`;
  }
  return s.schedule_type;
}

interface FormData {
  agent_id: string;
  schedule_type: "interval" | "time_of_day";
  interval_seconds: number;
  tod_hour: number;
  tod_minute: number;
  message_template: string;
  context_template: string;
  cooldown_seconds: number;
  enabled: boolean;
}

const EMPTY_FORM: FormData = {
  agent_id: "",
  schedule_type: "interval",
  interval_seconds: 1800,
  tod_hour: 8,
  tod_minute: 0,
  message_template: "",
  context_template: "",
  cooldown_seconds: 0,
  enabled: true,
};

export default function SchedulesPage() {
  const [items, setItems] = useState<Schedule[]>([]);
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
      const [scheds, agts] = await Promise.all([
        listSchedules(),
        listAgents(),
      ]);
      setItems(scheds);
      setAgents(agts);
    } catch (err) {
      console.error("Failed to load schedules:", err);
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

  const openEdit = (sched: Schedule) => {
    setEditingId(sched.id);
    setForm({
      agent_id: sched.agent_id,
      schedule_type: sched.schedule_type,
      interval_seconds:
        sched.schedule_type === "interval"
          ? sched.schedule_config.seconds ?? 1800
          : 1800,
      tod_hour:
        sched.schedule_type === "time_of_day"
          ? sched.schedule_config.hour ?? 8
          : 8,
      tod_minute:
        sched.schedule_type === "time_of_day"
          ? sched.schedule_config.minute ?? 0
          : 0,
      message_template: sched.message_template,
      context_template: sched.context_template ?? "",
      cooldown_seconds: sched.cooldown_seconds,
      enabled: sched.enabled,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const schedule_config: Record<string, number> =
        form.schedule_type === "interval"
          ? { seconds: form.interval_seconds }
          : { hour: form.tod_hour, minute: form.tod_minute, second: 0 };

      const payload = {
        agent_id: form.agent_id,
        schedule_type: form.schedule_type,
        schedule_config,
        message_template: form.message_template,
        context_template: form.context_template || null,
        cooldown_seconds: form.cooldown_seconds,
        enabled: form.enabled,
      };

      if (editingId) {
        const updated = await updateSchedule(editingId, payload);
        setItems((prev) =>
          prev.map((i) => (i.id === editingId ? updated : i))
        );
      } else {
        const created = await createSchedule(payload);
        setItems((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch (err) {
      console.error("Failed to save schedule:", err);
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
      await deleteSchedule(deleteTarget);
    } catch {
      load();
    }
  };

  const handleToggle = async (sched: Schedule) => {
    const newEnabled = !sched.enabled;
    setItems((prev) =>
      prev.map((i) =>
        i.id === sched.id ? { ...i, enabled: newEnabled } : i
      )
    );
    try {
      await updateSchedule(sched.id, { enabled: newEnabled });
    } catch {
      load();
    }
  };

  return (
    <>
      <NavBar
        title="Schedules"
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
              icon={faClock}
              className="text-4xl text-base-content/20 mb-4"
            />
            <p className="text-base-content/50 mb-4">No schedules yet</p>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <FontAwesomeIcon icon={faPlus} /> Create Schedule
            </button>
          </div>
        )}

        {items.map((sched) => (
          <div key={sched.id} className="card bg-base-100 shadow-sm">
            <div className="card-body p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">
                      {agentName(sched.agent_id)}
                    </span>
                    <span
                      className={`badge badge-sm ${
                        sched.schedule_type === "interval"
                          ? "badge-info"
                          : "badge-warning"
                      }`}
                    >
                      {sched.schedule_type === "interval"
                        ? "Interval"
                        : "Time of Day"}
                    </span>
                    <span className="text-sm text-base-content/60">
                      {describeSchedule(sched)}
                    </span>
                  </div>
                  {sched.message_template && (
                    <p className="text-sm text-base-content/60 mt-1 truncate">
                      {sched.message_template}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-base-content/40">
                    <span>Triggered {sched.trigger_count}x</span>
                    <span>Last: {timeAgo(sched.last_triggered)}</span>
                    {sched.cooldown_seconds > 0 && (
                      <span>Cooldown: {sched.cooldown_seconds}s</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary toggle-sm"
                    checked={sched.enabled}
                    onChange={() => handleToggle(sched)}
                  />
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => openEdit(sched)}
                    title="Edit"
                  >
                    <FontAwesomeIcon icon={faPen} />
                  </button>
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => setDeleteTarget(sched.id)}
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
              {editingId ? "Edit Schedule" : "New Schedule"}
            </h3>
            <div className="space-y-3 mt-4">
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
                  <span className="label-text">Schedule Type</span>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      className="radio radio-primary radio-sm"
                      checked={form.schedule_type === "interval"}
                      onChange={() =>
                        setForm({ ...form, schedule_type: "interval" })
                      }
                    />
                    <span className="label-text">Interval</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      className="radio radio-primary radio-sm"
                      checked={form.schedule_type === "time_of_day"}
                      onChange={() =>
                        setForm({ ...form, schedule_type: "time_of_day" })
                      }
                    />
                    <span className="label-text">Time of Day</span>
                  </label>
                </div>
              </label>

              {form.schedule_type === "interval" ? (
                <label className="form-control">
                  <div className="label">
                    <span className="label-text">Interval (seconds)</span>
                  </div>
                  <input
                    type="number"
                    className="input input-bordered input-sm w-40"
                    min={10}
                    value={form.interval_seconds}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        interval_seconds: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <div className="label">
                    <span className="label-text-alt text-base-content/40">
                      {form.interval_seconds >= 3600
                        ? `${(form.interval_seconds / 3600).toFixed(1)}h`
                        : form.interval_seconds >= 60
                          ? `${Math.floor(form.interval_seconds / 60)}min`
                          : `${form.interval_seconds}s`}
                    </span>
                  </div>
                </label>
              ) : (
                <div className="flex gap-3">
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Hour</span>
                    </div>
                    <input
                      type="number"
                      className="input input-bordered input-sm w-20"
                      min={0}
                      max={23}
                      value={form.tod_hour}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          tod_hour: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Minute</span>
                    </div>
                    <input
                      type="number"
                      className="input input-bordered input-sm w-20"
                      min={0}
                      max={59}
                      value={form.tod_minute}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          tod_minute: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </label>
                </div>
              )}

              <label className="form-control">
                <div className="label">
                  <span className="label-text">Message Template</span>
                </div>
                <textarea
                  className="textarea textarea-bordered textarea-sm"
                  rows={2}
                  placeholder="Jinja2 template for the agent message"
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
                disabled={saving || !form.agent_id}
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
        title="Delete Schedule"
        message="Are you sure you want to delete this schedule? This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
