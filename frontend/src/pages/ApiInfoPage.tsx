import { useState, useEffect, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faTrash,
  faKey,
  faFloppyDisk,
  faChartColumn,
  faCoins,
  faEnvelope,
  faDollarSign,
  faCircleInfo,
  faEye,
  faEyeSlash,
} from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import {
  fetchApiUsage,
  resetApiUsage,
  fetchAdminReport,
  getApiConfig,
  saveApiConfig,
  type ApiUsageData,
} from "../api";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function StatCard({
  label,
  value,
  icon,
  color = "text-primary",
}: {
  label: string;
  value: string;
  icon: typeof faCoins;
  color?: string;
}) {
  return (
    <div className="bg-base-200 rounded-xl p-4 flex items-center gap-3">
      <div className={`text-lg ${color}`}>
        <FontAwesomeIcon icon={icon} />
      </div>
      <div>
        <div className="text-[11px] text-base-content/50">{label}</div>
        <div className="text-lg font-bold font-mono">{value}</div>
      </div>
    </div>
  );
}

export default function ApiInfoPage() {
  const [usage, setUsage] = useState<ApiUsageData | null>(null);
  const [adminKey, setAdminKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [adminReport, setAdminReport] = useState<{
    usage: Record<string, unknown>;
    cost: Record<string, unknown>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [keySaved, setKeySaved] = useState(false);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, cfg] = await Promise.all([
        fetchApiUsage(),
        getApiConfig(),
      ]);
      setUsage(u);
      setAdminKey(cfg.admin_key || "");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const handleReset = async () => {
    await resetApiUsage();
    await loadUsage();
  };

  const handleSaveKey = async () => {
    await saveApiConfig(adminKey);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  const handleFetchAdmin = async () => {
    if (!adminKey) {
      setAdminError("Enter an Admin API key first");
      return;
    }
    setAdminLoading(true);
    setAdminError(null);
    try {
      const report = await fetchAdminReport(adminKey);
      if (report.usage && "error" in report.usage) {
        setAdminError(
          `Usage: ${(report.usage as { error: string }).error}` +
            ((report.usage as { detail?: string }).detail
              ? ` — ${(report.usage as { detail: string }).detail}`
              : "")
        );
        setAdminReport(null);
      } else {
        setAdminReport(report);
      }
    } catch (err) {
      setAdminError((err as Error).message);
    } finally {
      setAdminLoading(false);
    }
  };

  const total = usage?.total;
  const models = usage?.models ? Object.entries(usage.models) : [];
  const agents = usage?.agents ? Object.entries(usage.agents) : [];

  return (
    <>
      <NavBar title="API Info" />
      <div className="p-6 max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FontAwesomeIcon icon={faChartColumn} className="text-primary" />
              API Info
            </h2>
            <p className="text-sm text-base-content/50">
              Claude API usage tracking and Anthropic admin reports
            </p>
          </div>
          <button
            className="btn btn-sm btn-outline"
            onClick={loadUsage}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faArrowsRotate} spin={loading} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="alert alert-error text-sm">
            <span>{error}</span>
          </div>
        )}

        {/* Admin API Key */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FontAwesomeIcon icon={faKey} className="text-warning" />
              Admin API Key
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  className="input input-sm input-bordered w-full pr-10 font-mono"
                  placeholder="sk-ant-admin01-..."
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                />
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs"
                  onClick={() => setShowKey(!showKey)}
                  type="button"
                >
                  <FontAwesomeIcon icon={showKey ? faEyeSlash : faEye} />
                </button>
              </div>
              <button
                className={`btn btn-sm ${keySaved ? "btn-success" : "btn-primary"}`}
                onClick={handleSaveKey}
              >
                <FontAwesomeIcon icon={faFloppyDisk} />
                {keySaved ? "Saved" : "Save"}
              </button>
            </div>
            <div className="flex items-start gap-2 text-xs text-base-content/50">
              <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5" />
              <span>
                Required for Anthropic usage/cost reports. Get one at{" "}
                <span className="font-mono">console.anthropic.com &gt; Settings &gt; Admin Keys</span>
              </span>
            </div>
          </div>
        </div>

        {/* Session Usage */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Session Usage (local tracking)</h3>
              <button
                className="btn btn-xs btn-outline btn-error"
                onClick={handleReset}
              >
                <FontAwesomeIcon icon={faTrash} />
                Reset
              </button>
            </div>

            {total && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard
                  label="Total Messages"
                  value={formatNumber(total.messages)}
                  icon={faEnvelope}
                  color="text-info"
                />
                <StatCard
                  label="Total Tokens"
                  value={formatNumber(total.input_tokens + total.output_tokens)}
                  icon={faCoins}
                  color="text-warning"
                />
                <StatCard
                  label="Est. Cost"
                  value={`$${total.cost_usd.toFixed(4)}`}
                  icon={faDollarSign}
                  color="text-[#D97757]"
                />
              </div>
            )}

            {/* Per-Model Breakdown */}
            {models.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-base-content/60 mb-2">
                  Per-Model Breakdown
                </h4>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th className="text-right">Messages</th>
                        <th className="text-right">Input Tokens</th>
                        <th className="text-right">Output Tokens</th>
                        <th className="text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {models.map(([model, data]) => (
                        <tr key={model}>
                          <td className="font-mono text-xs">{model}</td>
                          <td className="text-right">{data.messages}</td>
                          <td className="text-right font-mono">
                            {formatNumber(data.input_tokens)}
                          </td>
                          <td className="text-right font-mono">
                            {formatNumber(data.output_tokens)}
                          </td>
                          <td className="text-right font-mono text-[#D97757]">
                            ${data.cost_usd.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Per-Agent Breakdown */}
            {agents.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-base-content/60 mb-2">
                  Per-Agent Breakdown
                </h4>
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th>Model</th>
                        <th className="text-right">Messages</th>
                        <th className="text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map(([agentId, data]) => (
                        <tr key={agentId}>
                          <td className="font-semibold">{agentId}</td>
                          <td className="font-mono text-xs">{data.model}</td>
                          <td className="text-right">{data.messages}</td>
                          <td className="text-right font-mono text-[#D97757]">
                            ${data.cost_usd.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!total?.messages && (
              <div className="text-center text-sm text-base-content/50 py-4">
                No API usage recorded yet. Send messages through Claude API connections to see stats.
              </div>
            )}
          </div>
        </div>

        {/* Anthropic Admin Report */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Anthropic Usage Report (last 30 days)
              </h3>
              <button
                className="btn btn-sm btn-outline"
                onClick={handleFetchAdmin}
                disabled={adminLoading || !adminKey}
              >
                <FontAwesomeIcon
                  icon={faArrowsRotate}
                  spin={adminLoading}
                />
                Fetch Report
              </button>
            </div>

            {!adminKey && (
              <div className="text-center text-sm text-base-content/50 py-4">
                Enter and save an Admin API key above to fetch Anthropic usage reports.
              </div>
            )}

            {adminError && (
              <div className="alert alert-error text-sm">
                <span>{adminError}</span>
              </div>
            )}

            {adminReport && (
              <div className="space-y-3">
                {/* Usage data */}
                {adminReport.usage &&
                  !("error" in adminReport.usage) &&
                  Array.isArray((adminReport.usage as { data?: unknown[] }).data) && (
                    <div>
                      <h4 className="text-xs font-semibold text-base-content/60 mb-2">
                        Token Usage by Day
                      </h4>
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="table table-xs">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Model</th>
                              <th className="text-right">Input</th>
                              <th className="text-right">Output</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(
                              (adminReport.usage as { data: Array<Record<string, unknown>> })
                                .data || []
                            ).map((row, i) => (
                              <tr key={i}>
                                <td className="text-xs">
                                  {String(row.snapshot_at || row.date || "").slice(0, 10)}
                                </td>
                                <td className="font-mono text-xs">
                                  {String(row.model || "")}
                                </td>
                                <td className="text-right font-mono">
                                  {formatNumber(Number(row.input_tokens || 0))}
                                </td>
                                <td className="text-right font-mono">
                                  {formatNumber(Number(row.output_tokens || 0))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {/* Cost data */}
                {adminReport.cost &&
                  !("error" in adminReport.cost) &&
                  Array.isArray((adminReport.cost as { data?: unknown[] }).data) && (
                    <div>
                      <h4 className="text-xs font-semibold text-base-content/60 mb-2">
                        Cost by Day
                      </h4>
                      <div className="overflow-x-auto max-h-64 overflow-y-auto">
                        <table className="table table-xs">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th className="text-right">Cost (USD)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(
                              (adminReport.cost as { data: Array<Record<string, unknown>> })
                                .data || []
                            ).map((row, i) => (
                              <tr key={i}>
                                <td className="text-xs">
                                  {String(row.snapshot_at || row.date || "").slice(0, 10)}
                                </td>
                                <td className="text-right font-mono text-[#D97757]">
                                  ${Number(row.cost_usd || row.amount || 0).toFixed(4)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
