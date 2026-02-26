import { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faPlus,
  faRobot,
  faBell,
  faClock,
  faLink,
  faArrowRight,
  faToggleOn,
  faToggleOff,
  faPlay,
  faPen,
  faTrash,
  faCircleCheck,
  faCircleXmark,
} from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  listAgents,
  listAvailableAgents,
  listSubscriptions,
  listSchedules,
  listChains,
  createSubscription,
  createSchedule,
  createChain,
  updateSubscription,
  updateSchedule,
  updateChain,
  deleteSubscription,
  deleteSchedule,
  deleteChain,
  runChain,
  type AvailableAgent,
  type AgentInvokeResult,
} from "../api";
import type {
  AgentInfo,
  Subscription,
  Schedule,
  Chain,
  ChainStep,
  ChainRunResult,
} from "../types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Section Card                                                       */
/* ------------------------------------------------------------------ */

function SectionHeader({
  icon,
  title,
  count,
  onAdd,
}: {
  icon: typeof faBell;
  title: string;
  count: number;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-medium text-sm flex items-center gap-2">
        <FontAwesomeIcon icon={icon} className="text-primary" />
        {title}
        <span className="badge badge-ghost badge-xs">{count}</span>
      </h3>
      <button className="btn btn-ghost btn-xs" onClick={onAdd}>
        <FontAwesomeIcon icon={faPlus} /> Add
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AgentBuilderPage                                                   */
/* ------------------------------------------------------------------ */

export default function AgentBuilderPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [availableAgents, setAvailableAgents] = useState<AvailableAgent[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [loading, setLoading] = useState(true);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "subscription" | "schedule" | "chain";
    id: string;
    name: string;
  } | null>(null);

  // Quick-create modals
  const [createType, setCreateType] = useState<
    "subscription" | "schedule" | "chain" | null
  >(null);

  // Quick-create form state
  const [qAgent, setQAgent] = useState("");
  const [qName, setQName] = useState("");
  const [qEvent, setQEvent] = useState("state_changed");
  const [qMessage, setQMessage] = useState("");
  const [qScheduleType, setQScheduleType] = useState<"interval" | "time_of_day">(
    "interval"
  );
  const [qInterval, setQInterval] = useState(3600);
  const [qTimeHour, setQTimeHour] = useState(8);
  const [qTimeMinute, setQTimeMinute] = useState(0);
  const [qChainSteps, setQChainSteps] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  // Run chain
  const [runTarget, setRunTarget] = useState<Chain | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<ChainRunResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [agts, avail, subs, scheds, chs] = await Promise.all([
        listAgents(),
        listAvailableAgents(),
        listSubscriptions(),
        listSchedules(),
        listChains(),
      ]);
      setAgents(agts);
      setAvailableAgents(avail);
      setSubscriptions(subs);
      setSchedules(scheds);
      setChains(chs);
    } catch (err) {
      console.error("Failed to load agent builder data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const agentName = (id: string) =>
    agents.find((a) => a.id === id)?.name ??
    availableAgents.find((a) => a.id === id)?.name ??
    id;

  const enabledAgents = agents.filter((a) => a.config.enabled);

  /* -- Toggle helpers -- */
  const toggleSub = async (sub: Subscription) => {
    setSubscriptions((prev) =>
      prev.map((s) =>
        s.id === sub.id ? { ...s, enabled: !s.enabled } : s
      )
    );
    try {
      await updateSubscription(sub.id, { enabled: !sub.enabled });
    } catch {
      load();
    }
  };

  const toggleSched = async (sched: Schedule) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === sched.id ? { ...s, enabled: !s.enabled } : s
      )
    );
    try {
      await updateSchedule(sched.id, { enabled: !sched.enabled });
    } catch {
      load();
    }
  };

  const toggleChain = async (chain: Chain) => {
    setChains((prev) =>
      prev.map((c) =>
        c.id === chain.id ? { ...c, enabled: !c.enabled } : c
      )
    );
    try {
      await updateChain(chain.id, { enabled: !chain.enabled });
    } catch {
      load();
    }
  };

  /* -- Delete -- */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "subscription")
        await deleteSubscription(deleteTarget.id);
      else if (deleteTarget.type === "schedule")
        await deleteSchedule(deleteTarget.id);
      else await deleteChain(deleteTarget.id);
    } catch {
      /* ignore */
    }
    setDeleteTarget(null);
    load();
  };

  /* -- Quick Create -- */
  const resetCreateForm = () => {
    setQAgent("");
    setQName("");
    setQEvent("state_changed");
    setQMessage("");
    setQScheduleType("interval");
    setQInterval(3600);
    setQTimeHour(8);
    setQTimeMinute(0);
    setQChainSteps([""]);
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      if (createType === "subscription") {
        await createSubscription({
          event_type: qEvent,
          event_filter: {},
          agent_id: qAgent,
          message_template: qMessage || "Handle this event: {{ trigger.event }}",
          context_template: null,
          cooldown_seconds: 60,
          enabled: true,
        });
      } else if (createType === "schedule") {
        const config: Record<string, number> =
          qScheduleType === "interval"
            ? { seconds: qInterval }
            : { hour: qTimeHour, minute: qTimeMinute };
        await createSchedule({
          agent_id: qAgent,
          schedule_type: qScheduleType,
          schedule_config: config,
          message_template:
            qMessage || "Perform your scheduled task.",
          context_template: null,
          cooldown_seconds: 0,
          enabled: true,
        });
      } else if (createType === "chain") {
        const steps: ChainStep[] = qChainSteps
          .filter((id) => id)
          .map((id) => ({
            agent_id: id,
            message_template: "",
            context_template: null,
            context_includes: ["response_text"],
          }));
        if (steps.length > 0) {
          await createChain({
            name: qName || "New Chain",
            steps,
            enabled: true,
          });
        }
      }
      setCreateType(null);
      resetCreateForm();
      load();
    } catch (err) {
      console.error("Create failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRunChain = async () => {
    if (!runTarget) return;
    setRunning(true);
    setRunResult(null);
    try {
      const result = await runChain(runTarget.id);
      setRunResult(result);
      load();
    } catch (err) {
      console.error("Chain run failed:", err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <NavBar
        title="Agent Builder"
        actions={
          <button
            className="btn btn-ghost btn-sm"
            onClick={load}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faArrowsRotate} spin={loading} />
            Refresh
          </button>
        }
      />

      <div className="p-4 space-y-6 max-w-5xl">
        {loading && (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        )}

        {!loading && (
          <>
            {/* Available agents overview */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body p-4">
                <h3 className="font-medium text-sm mb-3">
                  <FontAwesomeIcon
                    icon={faRobot}
                    className="mr-2 text-primary"
                  />
                  Available Agents ({availableAgents.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {availableAgents.map((a) => (
                    <div
                      key={a.id}
                      className="badge badge-lg gap-2"
                      title={a.description}
                    >
                      <FontAwesomeIcon
                        icon={
                          a.has_connection ? faCircleCheck : faCircleXmark
                        }
                        className={
                          a.has_connection ? "text-success" : "text-error"
                        }
                      />
                      {a.name}
                      {a.tools.length > 0 && (
                        <span className="badge badge-xs badge-ghost">
                          {a.tools.length} tools
                        </span>
                      )}
                    </div>
                  ))}
                  {availableAgents.length === 0 && (
                    <p className="text-sm text-base-content/40 italic">
                      No agents available. Enable agents in the Agents tab and
                      assign connections.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Subscriptions */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body p-4">
                <SectionHeader
                  icon={faBell}
                  title="Event Subscriptions"
                  count={subscriptions.length}
                  onAdd={() => {
                    resetCreateForm();
                    setCreateType("subscription");
                  }}
                />
                {subscriptions.length === 0 && (
                  <p className="text-sm text-base-content/40 italic py-2">
                    No subscriptions. Create one to trigger agents on HA events.
                  </p>
                )}
                <div className="space-y-2">
                  {subscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-base-200/50"
                    >
                      <FontAwesomeIcon
                        icon={faBell}
                        className="text-warning shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">
                          <span className="badge badge-xs badge-warning mr-1">
                            {sub.event_type}
                          </span>
                          <FontAwesomeIcon
                            icon={faArrowRight}
                            className="mx-1 text-xs text-base-content/30"
                          />
                          <span className="badge badge-xs badge-primary">
                            {agentName(sub.agent_id)}
                          </span>
                        </div>
                        <div className="text-xs text-base-content/40 mt-0.5">
                          Triggered: {sub.trigger_count}x | Last:{" "}
                          {timeAgo(sub.last_triggered)} | Cooldown:{" "}
                          {sub.cooldown_seconds}s
                        </div>
                      </div>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => toggleSub(sub)}
                        title={sub.enabled ? "Disable" : "Enable"}
                      >
                        <FontAwesomeIcon
                          icon={sub.enabled ? faToggleOn : faToggleOff}
                          className={
                            sub.enabled ? "text-success" : "text-base-content/30"
                          }
                        />
                      </button>
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() =>
                          setDeleteTarget({
                            type: "subscription",
                            id: sub.id,
                            name: sub.event_type,
                          })
                        }
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Schedules */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body p-4">
                <SectionHeader
                  icon={faClock}
                  title="Scheduled Tasks"
                  count={schedules.length}
                  onAdd={() => {
                    resetCreateForm();
                    setCreateType("schedule");
                  }}
                />
                {schedules.length === 0 && (
                  <p className="text-sm text-base-content/40 italic py-2">
                    No schedules. Create one to run agents on a timer.
                  </p>
                )}
                <div className="space-y-2">
                  {schedules.map((sched) => (
                    <div
                      key={sched.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-base-200/50"
                    >
                      <FontAwesomeIcon
                        icon={faClock}
                        className="text-info shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">
                          <span className="badge badge-xs badge-info mr-1">
                            {sched.schedule_type === "interval"
                              ? `Every ${sched.schedule_config.seconds ?? "?"}s`
                              : `Daily at ${String(sched.schedule_config.hour ?? 0).padStart(2, "0")}:${String(sched.schedule_config.minute ?? 0).padStart(2, "0")}`}
                          </span>
                          <FontAwesomeIcon
                            icon={faArrowRight}
                            className="mx-1 text-xs text-base-content/30"
                          />
                          <span className="badge badge-xs badge-primary">
                            {agentName(sched.agent_id)}
                          </span>
                        </div>
                        <div className="text-xs text-base-content/40 mt-0.5">
                          Triggered: {sched.trigger_count}x | Last:{" "}
                          {timeAgo(sched.last_triggered)}
                        </div>
                      </div>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => toggleSched(sched)}
                        title={sched.enabled ? "Disable" : "Enable"}
                      >
                        <FontAwesomeIcon
                          icon={sched.enabled ? faToggleOn : faToggleOff}
                          className={
                            sched.enabled
                              ? "text-success"
                              : "text-base-content/30"
                          }
                        />
                      </button>
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() =>
                          setDeleteTarget({
                            type: "schedule",
                            id: sched.id,
                            name: `${sched.schedule_type} → ${agentName(sched.agent_id)}`,
                          })
                        }
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chains */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body p-4">
                <SectionHeader
                  icon={faLink}
                  title="Agent Chains"
                  count={chains.length}
                  onAdd={() => {
                    resetCreateForm();
                    setCreateType("chain");
                  }}
                />
                {chains.length === 0 && (
                  <p className="text-sm text-base-content/40 italic py-2">
                    No chains. Create one to run multi-step agent workflows.
                  </p>
                )}
                <div className="space-y-3">
                  {chains.map((chain) => (
                    <div
                      key={chain.id}
                      className="p-3 rounded-lg bg-base-200/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {chain.name || "Unnamed"}
                          </span>
                          <span className="badge badge-ghost badge-xs">
                            {chain.steps.length} steps
                          </span>
                          <span className="text-xs text-base-content/40">
                            Runs: {chain.run_count} | Last:{" "}
                            {timeAgo(chain.last_run)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            className="btn btn-success btn-xs"
                            onClick={() => {
                              setRunTarget(chain);
                              setRunResult(null);
                              setRunning(false);
                            }}
                            title="Run"
                          >
                            <FontAwesomeIcon icon={faPlay} />
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => toggleChain(chain)}
                          >
                            <FontAwesomeIcon
                              icon={
                                chain.enabled ? faToggleOn : faToggleOff
                              }
                              className={
                                chain.enabled
                                  ? "text-success"
                                  : "text-base-content/30"
                              }
                            />
                          </button>
                          <button
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() =>
                              setDeleteTarget({
                                type: "chain",
                                id: chain.id,
                                name: chain.name,
                              })
                            }
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>
                      {/* Visual chain flow */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {chain.steps.map((step, idx) => (
                          <span key={idx} className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                              <span className="badge badge-xs badge-primary">
                                {idx + 1}
                              </span>
                              {agentName(step.agent_id)}
                            </span>
                            {idx < chain.steps.length - 1 && (
                              <FontAwesomeIcon
                                icon={faArrowRight}
                                className="text-xs text-base-content/30"
                              />
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Create Modal */}
      {createType && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg">
              {createType === "subscription" && "New Event Subscription"}
              {createType === "schedule" && "New Schedule"}
              {createType === "chain" && "New Chain"}
            </h3>
            <div className="space-y-3 mt-4">
              {/* Subscription form */}
              {createType === "subscription" && (
                <>
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Event Type</span>
                    </div>
                    <select
                      className="select select-bordered select-sm"
                      value={qEvent}
                      onChange={(e) => setQEvent(e.target.value)}
                    >
                      <option value="state_changed">state_changed</option>
                      <option value="automation_triggered">
                        automation_triggered
                      </option>
                      <option value="call_service">call_service</option>
                      <option value="homeassistant_start">
                        homeassistant_start
                      </option>
                    </select>
                  </label>
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Agent</span>
                    </div>
                    <select
                      className="select select-bordered select-sm"
                      value={qAgent}
                      onChange={(e) => setQAgent(e.target.value)}
                    >
                      <option value="">Select agent...</option>
                      {enabledAgents.map((a) => (
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
                      placeholder="Handle this event: {{ trigger.event }}"
                      value={qMessage}
                      onChange={(e) => setQMessage(e.target.value)}
                    />
                  </label>
                </>
              )}

              {/* Schedule form */}
              {createType === "schedule" && (
                <>
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Schedule Type</span>
                    </div>
                    <select
                      className="select select-bordered select-sm"
                      value={qScheduleType}
                      onChange={(e) =>
                        setQScheduleType(
                          e.target.value as "interval" | "time_of_day"
                        )
                      }
                    >
                      <option value="interval">Interval</option>
                      <option value="time_of_day">Time of Day</option>
                    </select>
                  </label>
                  {qScheduleType === "interval" ? (
                    <label className="form-control">
                      <div className="label">
                        <span className="label-text">
                          Interval (seconds)
                        </span>
                      </div>
                      <input
                        type="number"
                        className="input input-bordered input-sm"
                        value={qInterval}
                        onChange={(e) =>
                          setQInterval(parseInt(e.target.value) || 60)
                        }
                        min={60}
                      />
                    </label>
                  ) : (
                    <div className="flex gap-2">
                      <label className="form-control flex-1">
                        <div className="label">
                          <span className="label-text">Hour</span>
                        </div>
                        <input
                          type="number"
                          className="input input-bordered input-sm"
                          value={qTimeHour}
                          onChange={(e) =>
                            setQTimeHour(parseInt(e.target.value) || 0)
                          }
                          min={0}
                          max={23}
                        />
                      </label>
                      <label className="form-control flex-1">
                        <div className="label">
                          <span className="label-text">Minute</span>
                        </div>
                        <input
                          type="number"
                          className="input input-bordered input-sm"
                          value={qTimeMinute}
                          onChange={(e) =>
                            setQTimeMinute(parseInt(e.target.value) || 0)
                          }
                          min={0}
                          max={59}
                        />
                      </label>
                    </div>
                  )}
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Agent</span>
                    </div>
                    <select
                      className="select select-bordered select-sm"
                      value={qAgent}
                      onChange={(e) => setQAgent(e.target.value)}
                    >
                      <option value="">Select agent...</option>
                      {enabledAgents.map((a) => (
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
                      placeholder="Perform your scheduled task."
                      value={qMessage}
                      onChange={(e) => setQMessage(e.target.value)}
                    />
                  </label>
                </>
              )}

              {/* Chain form */}
              {createType === "chain" && (
                <>
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Chain Name</span>
                    </div>
                    <input
                      type="text"
                      className="input input-bordered input-sm"
                      placeholder="e.g. Security Patrol"
                      value={qName}
                      onChange={(e) => setQName(e.target.value)}
                    />
                  </label>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="label-text text-sm">Steps</span>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() =>
                          setQChainSteps((prev) => [...prev, ""])
                        }
                      >
                        <FontAwesomeIcon icon={faPlus} /> Add Step
                      </button>
                    </div>
                    <div className="space-y-2">
                      {qChainSteps.map((stepId, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="badge badge-sm badge-primary shrink-0">
                            {idx + 1}
                          </span>
                          <select
                            className="select select-bordered select-sm flex-1"
                            value={stepId}
                            onChange={(e) =>
                              setQChainSteps((prev) =>
                                prev.map((s, i) =>
                                  i === idx ? e.target.value : s
                                )
                              )
                            }
                          >
                            <option value="">Select agent...</option>
                            {enabledAgents.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                          {qChainSteps.length > 1 && (
                            <button
                              className="btn btn-ghost btn-xs text-error"
                              onClick={() =>
                                setQChainSteps((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setCreateType(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={
                  saving ||
                  (createType === "subscription" && !qAgent) ||
                  (createType === "schedule" && !qAgent) ||
                  (createType === "chain" &&
                    (!qName || qChainSteps.every((s) => !s)))
                }
              >
                {saving && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                Create
              </button>
            </div>
          </div>
          <form
            method="dialog"
            className="modal-backdrop"
            onClick={() => setCreateType(null)}
          >
            <button>close</button>
          </form>
        </dialog>
      )}

      {/* Run Chain Modal */}
      {runTarget && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg">
              Run: {runTarget.name || "Chain"}
            </h3>
            <div className="mt-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-4">
                {runTarget.steps.map((step, idx) => (
                  <span key={idx} className="flex items-center gap-1.5">
                    <span className="badge badge-sm badge-primary">
                      {agentName(step.agent_id)}
                    </span>
                    {idx < runTarget.steps.length - 1 && (
                      <FontAwesomeIcon
                        icon={faArrowRight}
                        className="text-xs text-base-content/30"
                      />
                    )}
                  </span>
                ))}
              </div>

              {running && (
                <div className="flex items-center gap-2 py-3">
                  <span className="loading loading-spinner loading-sm text-primary" />
                  <span className="text-sm text-base-content/50">
                    Executing chain...
                  </span>
                </div>
              )}

              {runResult && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-success badge-sm">
                      Complete
                    </span>
                    <span className="text-xs text-base-content/40">
                      {runResult.steps_completed}/{runResult.steps_total} steps
                    </span>
                  </div>
                  <div className="bg-base-200 rounded-lg p-3 max-h-48 overflow-y-auto">
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
                  onClick={handleRunChain}
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
        title="Delete"
        message={`Delete ${deleteTarget?.type} "${deleteTarget?.name}"? This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
