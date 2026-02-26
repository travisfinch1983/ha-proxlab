import { useState, useEffect, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faChartPie,
  faClock,
  faCoins,
  faComments,
  faGaugeHigh,
  faRobot,
  faWrench,
  faChevronDown,
  faChevronRight,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import {
  fetchDebugTraces,
  fetchApiUsage,
  deleteOlderTraces,
  type ConversationTrace,
  type ApiUsageData,
} from "../api";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtDur(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function timeAgo(ts: number): string {
  const sec = Date.now() / 1000 - ts;
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  icon,
  label,
  value,
  sub,
  color = "text-primary",
}: {
  icon: typeof faComments;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body p-4 flex-row items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${color} bg-primary/10`}
        >
          <FontAwesomeIcon icon={icon} />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-base-content/50">{label}</div>
          {sub && (
            <div className="text-xs text-base-content/40 mt-0.5">{sub}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Bar (simple CSS bar chart)                                         */
/* ------------------------------------------------------------------ */

function HBar({
  label,
  value,
  max,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 truncate text-right text-base-content/60">
        {label}
      </span>
      <div className="flex-1 bg-base-300 rounded-full h-2.5">
        <div
          className="bg-primary rounded-full h-2.5 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 text-base-content/60">
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix ?? ""}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ReportsPage                                                        */
/* ------------------------------------------------------------------ */

export default function ReportsPage() {
  const [traces, setTraces] = useState<ConversationTrace[]>([]);
  const [usage, setUsage] = useState<ApiUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cleanupDays, setCleanupDays] = useState(30);

  const [traceTotal, setTraceTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Only fetch last 50 traces for the table — API usage has the aggregate stats
      const [tRes, u] = await Promise.all([
        fetchDebugTraces(50),
        fetchApiUsage(),
      ]);
      setTraces(tRes.traces);
      setTraceTotal(tRes.total);
      setUsage(u);
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Memoize computed stats — use API usage for totals, traces only for recent table
  const {
    totalConversations,
    totalTokens,
    totalCost,
    avgDuration,
    successRate,
    modelBreakdown,
    maxModelTokens,
    agentBreakdown,
    maxAgentCount,
    toolBreakdown,
    maxToolCount,
    avgTps,
  } = useMemo(() => {
    // Use API usage for aggregate stats (covers ALL history, not just last 50)
    const totalConversations = usage?.total?.messages ?? traceTotal;
    const totalTokens =
      (usage?.total?.input_tokens ?? 0) + (usage?.total?.output_tokens ?? 0);
    const totalCost = usage?.total?.cost_usd ?? 0;

    // These still come from traces (last 50)
    const avgDuration =
      traces.length > 0
        ? traces.reduce((s, t) => s + (t.duration_ms ?? 0), 0) / traces.length
        : 0;
    const successCount = traces.filter(
      (t) => !t.steps || t.steps.every((s) => !s.routing_decision)
    ).length;
    const successRate =
      traces.length > 0
        ? ((successCount / traces.length) * 100).toFixed(0)
        : "0";

    // Model breakdown — from API usage if available
    const modelBreakdown: [string, { count: number; tokens: number }][] =
      usage?.models
        ? Object.entries(usage.models)
            .map(([m, v]) => [
              m,
              { count: v.messages, tokens: v.input_tokens + v.output_tokens },
            ] as [string, { count: number; tokens: number }])
            .sort((a, b) => b[1].tokens - a[1].tokens)
            .slice(0, 8)
        : [];
    const maxModelTokens = Math.max(
      1,
      ...modelBreakdown.map(([, v]) => v.tokens)
    );

    // Agent breakdown — from API usage if available
    const agentBreakdown: [
      string,
      { count: number; tokens: number; duration: number },
    ][] = usage?.agents
      ? Object.entries(usage.agents)
          .map(
            ([a, v]) =>
              [
                a,
                {
                  count: v.messages,
                  tokens: v.input_tokens + v.output_tokens,
                  duration: 0,
                },
              ] as [
                string,
                { count: number; tokens: number; duration: number },
              ]
          )
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 10)
      : [];
    const maxAgentCount = Math.max(
      1,
      ...agentBreakdown.map(([, v]) => v.count)
    );

    // Tool breakdown — from traces (last 50 is representative enough)
    const toolMap = new Map<string, number>();
    for (const t of traces) {
      if (t.tool_breakdown) {
        for (const [tool, count] of Object.entries(t.tool_breakdown)) {
          toolMap.set(tool, (toolMap.get(tool) ?? 0) + count);
        }
      }
    }
    const toolBreakdown = [...toolMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const maxToolCount = Math.max(1, ...toolBreakdown.map(([, v]) => v));

    // Performance stats
    const tpsTraces = traces.filter((t) => t.tokens_per_sec);
    const avgTps =
      tpsTraces.length > 0
        ? tpsTraces.reduce((s, t) => s + (t.tokens_per_sec ?? 0), 0) /
          tpsTraces.length
        : 0;

    return {
      totalConversations,
      totalTokens,
      totalCost,
      avgDuration,
      successRate,
      modelBreakdown,
      maxModelTokens,
      agentBreakdown,
      maxAgentCount,
      toolBreakdown,
      maxToolCount,
      avgTps,
    };
  }, [traces, usage, traceTotal]);

  const handleCleanup = async () => {
    try {
      const { deleted } = await deleteOlderTraces(cleanupDays);
      if (deleted > 0) load();
    } catch (err) {
      console.error("Cleanup failed:", err);
    }
  };

  return (
    <>
      <NavBar
        title="Reports"
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

      <div className="p-4 space-y-6 max-w-6xl">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            icon={faComments}
            label="Conversations"
            value={String(totalConversations)}
          />
          <StatCard
            icon={faChartPie}
            label="Total Tokens"
            value={fmtTokens(totalTokens)}
            sub={`${fmtTokens(usage?.total?.input_tokens ?? 0)} in / ${fmtTokens(usage?.total?.output_tokens ?? 0)} out`}
          />
          <StatCard
            icon={faCoins}
            label="Total Cost"
            value={fmtCost(totalCost || usage?.total?.cost_usd || 0)}
          />
          <StatCard
            icon={faClock}
            label="Avg Duration"
            value={fmtDur(avgDuration)}
          />
          <StatCard
            icon={faGaugeHigh}
            label="Avg Speed"
            value={avgTps > 0 ? `${avgTps.toFixed(1)} t/s` : "—"}
          />
          <StatCard
            icon={faRobot}
            label="Success Rate"
            value={`${successRate}%`}
            sub={`${totalConversations} total`}
          />
        </div>

        {/* Breakdowns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Model breakdown */}
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body p-4">
              <h3 className="font-medium text-sm mb-3">
                <FontAwesomeIcon icon={faChartPie} className="mr-2 text-primary" />
                Token Usage by Model
              </h3>
              <div className="space-y-2">
                {modelBreakdown.length === 0 && (
                  <p className="text-xs text-base-content/40 italic">
                    No data yet
                  </p>
                )}
                {modelBreakdown.map(([model, data]) => (
                  <HBar
                    key={model}
                    label={model}
                    value={data.tokens}
                    max={maxModelTokens}
                    suffix=" tok"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Agent breakdown */}
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body p-4">
              <h3 className="font-medium text-sm mb-3">
                <FontAwesomeIcon icon={faRobot} className="mr-2 text-primary" />
                Invocations by Agent
              </h3>
              <div className="space-y-2">
                {agentBreakdown.length === 0 && (
                  <p className="text-xs text-base-content/40 italic">
                    No data yet
                  </p>
                )}
                {agentBreakdown.map(([agent, data]) => (
                  <HBar
                    key={agent}
                    label={agent}
                    value={data.count}
                    max={maxAgentCount}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Tool breakdown */}
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body p-4">
              <h3 className="font-medium text-sm mb-3">
                <FontAwesomeIcon
                  icon={faWrench}
                  className="mr-2 text-primary"
                />
                Tool Call Frequency
              </h3>
              <div className="space-y-2">
                {toolBreakdown.length === 0 && (
                  <p className="text-xs text-base-content/40 italic">
                    No tool calls yet
                  </p>
                )}
                {toolBreakdown.map(([tool, count]) => (
                  <HBar
                    key={tool}
                    label={tool}
                    value={count}
                    max={maxToolCount}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Agent performance table */}
        {agentBreakdown.length > 0 && (
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body p-4">
              <h3 className="font-medium text-sm mb-3">Agent Performance</h3>
              <div className="overflow-x-auto">
                <table className="table table-xs">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th className="text-right">Invocations</th>
                      <th className="text-right">Total Tokens</th>
                      <th className="text-right">Avg Tokens</th>
                      <th className="text-right">Avg Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentBreakdown.map(([agent, data]) => (
                      <tr key={agent}>
                        <td className="font-medium">{agent}</td>
                        <td className="text-right">{data.count}</td>
                        <td className="text-right">
                          {fmtTokens(data.tokens)}
                        </td>
                        <td className="text-right">
                          {fmtTokens(
                            data.count > 0
                              ? Math.round(data.tokens / data.count)
                              : 0
                          )}
                        </td>
                        <td className="text-right">
                          {fmtDur(
                            data.count > 0 ? data.duration / data.count : 0
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Recent traces */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">
                Recent Conversations (last {traces.length} of {traceTotal})
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-base-content/50">
                  Delete older than
                </span>
                <input
                  type="number"
                  className="input input-bordered input-xs w-16"
                  value={cleanupDays}
                  onChange={(e) => setCleanupDays(parseInt(e.target.value) || 7)}
                  min={1}
                />
                <span className="text-xs text-base-content/50">days</span>
                <button
                  className="btn btn-ghost btn-xs text-error"
                  onClick={handleCleanup}
                  title="Delete old traces"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table table-xs">
                <thead>
                  <tr>
                    <th></th>
                    <th>Time</th>
                    <th>Message</th>
                    <th>Agent</th>
                    <th>Model</th>
                    <th className="text-right">Duration</th>
                    <th className="text-right">Tokens</th>
                    <th className="text-right">Tools</th>
                  </tr>
                </thead>
                <tbody>
                  {traces.slice(0, 50).map((t, idx) => {
                    const key = t.conversation_id || String(idx);
                    const isExpanded = expanded === key;
                    return (
                      <>
                        <tr
                          key={key}
                          className="cursor-pointer hover:bg-base-200"
                          onClick={() =>
                            setExpanded(isExpanded ? null : key)
                          }
                        >
                          <td>
                            <FontAwesomeIcon
                              icon={
                                isExpanded ? faChevronDown : faChevronRight
                              }
                              className="text-xs text-base-content/40"
                            />
                          </td>
                          <td className="text-xs whitespace-nowrap">
                            {t.timestamp ? timeAgo(t.timestamp) : "—"}
                          </td>
                          <td className="max-w-[200px] truncate text-xs">
                            {t.user_message || "—"}
                          </td>
                          <td className="text-xs">
                            {t.routed_agent || "default"}
                          </td>
                          <td className="text-xs">{t.model || "—"}</td>
                          <td className="text-right text-xs">
                            {fmtDur(t.duration_ms ?? 0)}
                          </td>
                          <td className="text-right text-xs">
                            {fmtTokens(t.tokens?.total ?? 0)}
                          </td>
                          <td className="text-right text-xs">
                            {t.tool_calls ?? 0}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${key}-detail`}>
                            <td colSpan={8} className="bg-base-200 p-3">
                              <div className="space-y-2 text-xs">
                                <div>
                                  <span className="font-medium">User:</span>{" "}
                                  {t.user_message}
                                </div>
                                <div>
                                  <span className="font-medium">
                                    Response:
                                  </span>{" "}
                                  <span className="whitespace-pre-wrap">
                                    {t.response_text?.slice(0, 500)}
                                    {(t.response_text?.length ?? 0) > 500 &&
                                      "..."}
                                  </span>
                                </div>
                                {t.routing_reason && (
                                  <div>
                                    <span className="font-medium">
                                      Routing:
                                    </span>{" "}
                                    {t.routing_reason}
                                  </div>
                                )}
                                <div className="flex gap-4 text-base-content/50">
                                  <span>
                                    Prompt: {t.tokens?.prompt ?? 0} tok
                                  </span>
                                  <span>
                                    Completion: {t.tokens?.completion ?? 0} tok
                                  </span>
                                  {t.tokens_per_sec && (
                                    <span>
                                      {t.tokens_per_sec.toFixed(1)} tok/s
                                    </span>
                                  )}
                                  {t.total_cost != null && (
                                    <span>{fmtCost(t.total_cost)}</span>
                                  )}
                                </div>
                                {t.performance && (
                                  <div className="flex gap-4 text-base-content/50">
                                    <span>
                                      LLM: {fmtDur(t.performance.llm_latency_ms)}
                                    </span>
                                    <span>
                                      Tools:{" "}
                                      {fmtDur(t.performance.tool_latency_ms)}
                                    </span>
                                    <span>
                                      Context:{" "}
                                      {fmtDur(t.performance.context_latency_ms)}
                                    </span>
                                    <span>
                                      TTFT: {fmtDur(t.performance.ttft_ms)}
                                    </span>
                                  </div>
                                )}
                                {t.tool_breakdown &&
                                  Object.keys(t.tool_breakdown).length > 0 && (
                                    <div>
                                      <span className="font-medium">
                                        Tools:
                                      </span>{" "}
                                      {Object.entries(t.tool_breakdown)
                                        .map(
                                          ([tool, count]) =>
                                            `${tool} (${count})`
                                        )
                                        .join(", ")}
                                    </div>
                                  )}
                                {t.steps && t.steps.length > 0 && (
                                  <div>
                                    <span className="font-medium">
                                      Chain ({t.steps.length} steps):
                                    </span>
                                    <div className="ml-3 mt-1 space-y-1">
                                      {t.steps.map((step, si) => (
                                        <div
                                          key={si}
                                          className="flex gap-3"
                                        >
                                          <span className="badge badge-xs badge-primary">
                                            {si + 1}
                                          </span>
                                          <span>{step.agent_name}</span>
                                          <span className="text-base-content/40">
                                            {step.model} |{" "}
                                            {fmtDur(step.duration_ms)} |{" "}
                                            {fmtTokens(step.tokens.total)} tok
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
              {traces.length === 0 && (
                <p className="text-center text-sm text-base-content/40 py-6">
                  No conversation traces yet. Start chatting to generate data.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
