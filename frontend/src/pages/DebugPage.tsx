import { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faArrowsRotate,
  faChevronDown,
  faChevronRight,
  faScrewdriverWrench,
  faRobot,
  faUser,
  faClock,
  faCoins,
  faRoute,
  faBolt,
} from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import {
  fetchDebugTraces,
  clearDebugTraces,
  type ConversationTrace,
  type TraceStep,
} from "../api";

function msToReadable(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ------------------------------------------------------------------ */
/*  StepCard — renders one step in the routing chain                  */
/* ------------------------------------------------------------------ */

function StepCard({
  step,
  stepNumber,
  isLast,
}: {
  step: TraceStep;
  stepNumber: number;
  isLast: boolean;
}) {
  const isOrchestrator = step.agent_id === "orchestrator";
  const toolNames = Object.entries(step.tool_breakdown || {});
  const hasTools = toolNames.length > 0;

  return (
    <div className="flex gap-3">
      {/* Timeline connector */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
            isOrchestrator
              ? "bg-warning/20 text-warning"
              : "bg-primary/20 text-primary"
          }`}
        >
          {stepNumber}
        </div>
        {!isLast && <div className="w-px flex-1 bg-base-300 my-1" />}
      </div>

      {/* Step content */}
      <div className="flex-1 min-w-0 pb-3">
        {/* Step header */}
        <div className="flex items-center gap-2 mb-2">
          <FontAwesomeIcon
            icon={isOrchestrator ? faRoute : faRobot}
            className={`text-xs ${
              isOrchestrator ? "text-warning" : "text-primary"
            }`}
          />
          <span className="text-sm font-semibold">{step.agent_name}</span>
          <span className="badge badge-xs badge-outline font-mono">
            {step.model}
          </span>
          <span className="text-xs text-base-content/50">
            {msToReadable(step.duration_ms)}
          </span>
          {step.tokens_per_sec > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-base-content/50">
              <FontAwesomeIcon icon={faBolt} className="text-warning text-[10px]" />
              {step.tokens_per_sec} t/s
            </span>
          )}
        </div>

        {/* Routing decision (orchestrator only) */}
        {step.routing_decision && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 mb-2 text-sm">
            <span className="text-base-content/60">Routed to </span>
            <span className="font-semibold">{step.routing_decision.target_agent}</span>
            {step.routing_decision.reason && (
              <>
                <span className="text-base-content/60"> — </span>
                <span className="text-base-content/70 italic">
                  {step.routing_decision.reason}
                </span>
              </>
            )}
          </div>
        )}

        {/* Performance grid */}
        {!isOrchestrator && step.performance && (
          <div className="mb-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <MiniStat
                label="LLM"
                value={msToReadable(step.performance.llm_latency_ms ?? 0)}
              />
              <MiniStat
                label="Tools"
                value={msToReadable(step.performance.tool_latency_ms ?? 0)}
              />
              <MiniStat
                label="Context"
                value={msToReadable(step.performance.context_latency_ms ?? 0)}
              />
              <MiniStat
                label="TTFT"
                value={msToReadable(step.performance.ttft_ms ?? 0)}
              />
            </div>
          </div>
        )}

        {/* Token grid */}
        <div className="mb-2">
          <div className="grid grid-cols-3 gap-1.5">
            <MiniStat label="Prompt" value={String(step.tokens?.prompt ?? 0)} />
            <MiniStat
              label="Completion"
              value={String(step.tokens?.completion ?? 0)}
            />
            <MiniStat label="Total" value={String(step.tokens?.total ?? 0)} />
          </div>
        </div>

        {/* Tool breakdown badges */}
        {hasTools && (
          <div className="flex flex-wrap gap-1 mb-2">
            {toolNames.map(([name, count]) => (
              <span key={name} className="badge badge-xs badge-outline gap-1">
                {name}
                {count > 1 && (
                  <span className="badge badge-xs badge-primary">x{count}</span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Response text (target agent only) */}
        {!isOrchestrator && step.response_text && (
          <div className="bg-base-200 rounded-lg p-2 text-xs whitespace-pre-wrap max-h-32 overflow-y-auto text-base-content/70">
            {step.response_text}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-base-200 rounded px-1.5 py-0.5">
      <div className="text-[9px] text-base-content/40">{label}</div>
      <div className="text-xs font-mono">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TraceCard — one conversation trace                                */
/* ------------------------------------------------------------------ */

function TraceCard({
  trace,
  index,
}: {
  trace: ConversationTrace;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const toolNames = Object.entries(trace.tool_breakdown || {});
  const hasTools = toolNames.length > 0;
  const hasSteps = (trace.steps?.length ?? 0) > 0;

  return (
    <div className="card bg-base-100 shadow-sm">
      <div
        className="card-body p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="text-base-content/40 font-mono text-xs pt-1">
            #{index + 1}
          </div>
          <div className="flex-1 min-w-0">
            {/* User message */}
            <div className="flex items-center gap-2 mb-1">
              <FontAwesomeIcon
                icon={faUser}
                className="text-primary text-xs"
              />
              <span className="text-sm font-medium truncate">
                {trace.user_message || "(empty)"}
              </span>
            </div>
            {/* Response preview */}
            <div className="flex items-start gap-2">
              <FontAwesomeIcon
                icon={faRobot}
                className="text-secondary text-xs mt-0.5"
              />
              <span className="text-sm text-base-content/70 line-clamp-2">
                {trace.response_text || "(no response)"}
              </span>
            </div>
          </div>
          {/* Right side badges */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="badge badge-sm badge-outline font-mono">
              {trace.model}
            </span>
            <div className="flex items-center gap-1 text-xs text-base-content/50">
              <FontAwesomeIcon icon={faClock} />
              {msToReadable(trace.duration_ms)}
            </div>
            <FontAwesomeIcon
              icon={expanded ? faChevronDown : faChevronRight}
              className="text-base-content/30 text-xs"
            />
          </div>
        </div>

        {/* Quick stats row */}
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-base-content/50">
          <span className="flex items-center gap-1">
            <FontAwesomeIcon icon={faCoins} />
            {trace.tokens?.total ?? 0} tokens
          </span>
          {(trace.tokens_per_sec ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <FontAwesomeIcon icon={faBolt} className="text-warning" />
              {trace.tokens_per_sec} t/s
            </span>
          )}
          {hasTools && (
            <span className="flex items-center gap-1">
              <FontAwesomeIcon icon={faScrewdriverWrench} />
              {trace.tool_calls} tool call{trace.tool_calls !== 1 && "s"}
            </span>
          )}
          {trace.routed_agent && (
            <span className="flex items-center gap-1">
              <FontAwesomeIcon icon={faRoute} className="text-warning" />
              {trace.routed_agent}
            </span>
          )}
          {trace.used_external_llm && (
            <span className="badge badge-xs badge-warning">External LLM</span>
          )}
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-base-300 space-y-3">
            {/* Routing Chain (if steps available) */}
            {hasSteps ? (
              <div>
                <h4 className="text-xs font-semibold text-base-content/60 mb-2">
                  Routing Chain
                </h4>
                <div>
                  {trace.steps!.map((step, si) => (
                    <StepCard
                      key={step.agent_id + "-" + si}
                      step={step}
                      stepNumber={si + 1}
                      isLast={si === trace.steps!.length - 1}
                    />
                  ))}
                </div>
              </div>
            ) : (
              /* Legacy flat layout for old traces */
              <>
                {/* Performance */}
                <div>
                  <h4 className="text-xs font-semibold text-base-content/60 mb-1">
                    Performance
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Stat
                      label="Total"
                      value={msToReadable(trace.duration_ms)}
                    />
                    <Stat
                      label="LLM"
                      value={msToReadable(
                        trace.performance?.llm_latency_ms ?? 0
                      )}
                    />
                    <Stat
                      label="Tools"
                      value={msToReadable(
                        trace.performance?.tool_latency_ms ?? 0
                      )}
                    />
                    <Stat
                      label="Context"
                      value={msToReadable(
                        trace.performance?.context_latency_ms ?? 0
                      )}
                    />
                  </div>
                </div>

                {/* Tokens */}
                <div>
                  <h4 className="text-xs font-semibold text-base-content/60 mb-1">
                    Tokens
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <Stat
                      label="Prompt"
                      value={String(trace.tokens?.prompt ?? 0)}
                    />
                    <Stat
                      label="Completion"
                      value={String(trace.tokens?.completion ?? 0)}
                    />
                    <Stat
                      label="Total"
                      value={String(trace.tokens?.total ?? 0)}
                    />
                  </div>
                </div>

                {/* Tool breakdown */}
                {hasTools && (
                  <div>
                    <h4 className="text-xs font-semibold text-base-content/60 mb-1">
                      Tool Calls
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {toolNames.map(([name, count]) => (
                        <span
                          key={name}
                          className="badge badge-sm badge-outline gap-1"
                        >
                          {name}
                          {count > 1 && (
                            <span className="badge badge-xs badge-primary">
                              x{count}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full response */}
                {trace.response_text && (
                  <div>
                    <h4 className="text-xs font-semibold text-base-content/60 mb-1">
                      Full Response
                    </h4>
                    <div className="bg-base-200 rounded-lg p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {trace.response_text}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* IDs — always shown */}
            <div>
              <h4 className="text-xs font-semibold text-base-content/60 mb-1">
                Identifiers
              </h4>
              <div className="text-xs font-mono text-base-content/40 space-y-0.5">
                <div>conversation: {trace.conversation_id}</div>
                <div>user: {trace.user_id || "unknown"}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-base-200 rounded px-2 py-1">
      <div className="text-[10px] text-base-content/40">{label}</div>
      <div className="text-sm font-mono">{value}</div>
    </div>
  );
}

export default function DebugPage() {
  const [traces, setTraces] = useState<ConversationTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await fetchDebugTraces();
      setTraces(t.reverse()); // newest first
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleClear = async () => {
    await clearDebugTraces();
    setTraces([]);
  };

  return (
    <>
      <NavBar title="Debug" />
      <div className="p-6 max-w-4xl space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Conversation Traces</h2>
            <p className="text-sm text-base-content/50">
              Recent conversations processed by ProxLab (last 50)
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-outline"
              onClick={load}
              disabled={loading}
            >
              <FontAwesomeIcon icon={faArrowsRotate} spin={loading} />
              Refresh
            </button>
            <button
              className="btn btn-sm btn-outline btn-error"
              onClick={handleClear}
              disabled={traces.length === 0}
            >
              <FontAwesomeIcon icon={faTrash} />
              Clear
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error text-sm">
            <span>{error}</span>
          </div>
        )}

        {/* Traces */}
        {!loading && traces.length === 0 && (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body text-center text-base-content/50">
              <p>No conversation traces yet.</p>
              <p className="text-sm">
                Talk to your assistant and traces will appear here.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {traces.map((trace, i) => (
            <TraceCard
              key={trace.conversation_id + "-" + i}
              trace={trace}
              index={traces.length - i - 1}
            />
          ))}
        </div>
      </div>
    </>
  );
}
