import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faXmark,
  faArrowUpRightFromSquare,
  faSpinner,
  faBook,
  faBoxesStacked,
} from "@fortawesome/free-solid-svg-icons";
import { fetchHfReadme } from "../api";
import type { DiscoveredModel, HfEnrichment, HfReadmeResult } from "../types";

/** Format seconds to "2h 15m". */
function fmtUptime(sec: number | null): string {
  if (!sec) return "-";
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtCtxFull(n: number | null): string {
  if (!n) return "-";
  return n.toLocaleString();
}

type Tab = "base" | "quant";

interface Props {
  model: DiscoveredModel;
  enrichment?: HfEnrichment;
  connections: { id: string; name: string }[];
  onClose: () => void;
}

export default function ModelDetailPanel({ model, enrichment, connections, onClose }: Props) {
  const [open, setOpen] = useState(false);
  const [readmeData, setReadmeData] = useState<HfReadmeResult | null>(null);
  const [readmeLoading, setReadmeLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("base");
  const hfOk = enrichment && enrichment.status === "ok";

  // Animate open on mount
  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
  }, []);

  // Fetch README on mount
  useEffect(() => {
    if (model.provider === "claude") return;
    let cancelled = false;
    setReadmeLoading(true);
    fetchHfReadme(model)
      .then((data) => {
        if (!cancelled) {
          setReadmeData(data);
          // Default to quant tab if no base readme but quant exists
          if (!data.base_readme && data.quant_readme) {
            setActiveTab("quant");
          }
        }
      })
      .catch((err) => console.error("README fetch failed:", err))
      .finally(() => {
        if (!cancelled) setReadmeLoading(false);
      });
    return () => { cancelled = true; };
  }, [model]);

  // Capability tags
  const capTags: string[] = [];
  if (model.supports_vision) capTags.push("Vision");
  if (model.supports_tool_use) capTags.push("Tool Use");
  if (model.supports_embeddings) capTags.push("Embeddings");
  if (model.supports_audio) capTags.push("Audio");
  if (model.supports_tts) capTags.push("TTS");

  const hasBaseReadme = readmeData?.base_readme;
  const hasQuantReadme = readmeData?.quant_readme;
  const hasAnyReadme = hasBaseReadme || hasQuantReadme;

  return (
    <div
      className="col-span-full overflow-hidden transition-all duration-300 ease-in-out"
      style={{ maxHeight: open ? "1200px" : "0px" }}
    >
      <div className="card bg-base-100 border border-primary/30 shadow-lg m-1">
        <div className="card-body p-4 gap-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {hfOk && enrichment.logo_url && (
                <img
                  src={enrichment.logo_url}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              )}
              <div>
                <h3 className="font-bold text-base">{model.id}</h3>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  <span className="text-xs text-base-content/50">{model.provider}</span>
                  {connections.map((c) => (
                    <span key={c.id} className="badge badge-xs badge-ghost">{c.name}</span>
                  ))}
                  {model.is_loaded && (
                    <span className="badge badge-xs badge-success">loaded</span>
                  )}
                </div>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          {/* Two-column: specs + capabilities/performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Specs */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">
                Specs
              </h4>
              <table className="table table-xs">
                <tbody>
                  {model.parameter_count && (
                    <tr>
                      <td className="text-base-content/50 w-28">Parameters</td>
                      <td>{model.parameter_count}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="text-base-content/50">Context</td>
                    <td>{fmtCtxFull(model.context_length)}</td>
                  </tr>
                  {model.quantization && (
                    <tr>
                      <td className="text-base-content/50">Quant</td>
                      <td>{model.quantization}</td>
                    </tr>
                  )}
                  {model.architecture && (
                    <tr>
                      <td className="text-base-content/50">Arch</td>
                      <td>{model.architecture}</td>
                    </tr>
                  )}
                  {hfOk && enrichment.model_type && (
                    <tr>
                      <td className="text-base-content/50">Type</td>
                      <td>{enrichment.model_type}</td>
                    </tr>
                  )}
                  {hfOk && enrichment.license && (
                    <tr>
                      <td className="text-base-content/50">License</td>
                      <td>{enrichment.license}</td>
                    </tr>
                  )}
                  {hfOk && enrichment.author && (
                    <tr>
                      <td className="text-base-content/50">Author</td>
                      <td>{enrichment.author}</td>
                    </tr>
                  )}
                  {hfOk && enrichment.downloads > 0 && (
                    <tr>
                      <td className="text-base-content/50">Downloads</td>
                      <td>{fmtNumber(enrichment.downloads)}</td>
                    </tr>
                  )}
                  {hfOk && enrichment.likes > 0 && (
                    <tr>
                      <td className="text-base-content/50">Likes</td>
                      <td>{fmtNumber(enrichment.likes)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Right: Capabilities + Performance */}
            <div className="space-y-3">
              {capTags.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-1">
                    Capabilities
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {capTags.map((tag) => (
                      <span key={tag} className="badge badge-sm badge-outline">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {(model.generation_speed != null || model.prompt_speed != null ||
                model.uptime_seconds != null || model.queue_depth != null) && (
                <div>
                  <h4 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-1">
                    Performance
                  </h4>
                  <table className="table table-xs">
                    <tbody>
                      {model.generation_speed != null && (
                        <tr>
                          <td className="text-base-content/50 w-28">Gen Speed</td>
                          <td>{model.generation_speed.toFixed(1)} tok/s</td>
                        </tr>
                      )}
                      {model.prompt_speed != null && (
                        <tr>
                          <td className="text-base-content/50">Prompt Speed</td>
                          <td>{model.prompt_speed.toFixed(1)} tok/s</td>
                        </tr>
                      )}
                      {model.uptime_seconds != null && (
                        <tr>
                          <td className="text-base-content/50">Uptime</td>
                          <td>{fmtUptime(model.uptime_seconds)}</td>
                        </tr>
                      )}
                      {model.queue_depth != null && (
                        <tr>
                          <td className="text-base-content/50">Queue</td>
                          <td>{model.queue_depth}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* HF Description (brief) */}
          {hfOk && enrichment.description && (
            <div>
              <h4 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-1">
                Summary
              </h4>
              <p className="text-sm text-base-content/70">{enrichment.description}</p>
            </div>
          )}

          {/* README tabs */}
          {readmeLoading && (
            <div className="flex items-center gap-2 text-sm text-base-content/50 py-4">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              Loading README...
            </div>
          )}

          {!readmeLoading && hasAnyReadme && (
            <div>
              {/* Tab bar */}
              <div className="tabs tabs-bordered mb-2">
                {hasBaseReadme && (
                  <button
                    className={`tab gap-1 ${activeTab === "base" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("base")}
                  >
                    <FontAwesomeIcon icon={faBook} className="text-xs" />
                    Base Model
                    {readmeData?.base_repo && (
                      <span className="text-xs text-base-content/40 ml-1">
                        {readmeData.base_repo}
                      </span>
                    )}
                  </button>
                )}
                {hasQuantReadme && (
                  <button
                    className={`tab gap-1 ${activeTab === "quant" ? "tab-active" : ""}`}
                    onClick={() => setActiveTab("quant")}
                  >
                    <FontAwesomeIcon icon={faBoxesStacked} className="text-xs" />
                    GGUF Repo
                    {readmeData?.quant_repo && (
                      <span className="text-xs text-base-content/40 ml-1">
                        {readmeData.quant_repo}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* README content */}
              <div className="bg-base-200/50 rounded-lg p-4 max-h-[500px] overflow-y-auto prose prose-sm prose-invert max-w-none">
                <Markdown>
                  {activeTab === "base"
                    ? readmeData?.base_readme || ""
                    : readmeData?.quant_readme || ""}
                </Markdown>
              </div>
            </div>
          )}

          {/* HF links */}
          <div className="flex flex-wrap gap-2 justify-end">
            {hfOk && enrichment.hf_repo && (
              <a
                href={`https://huggingface.co/${enrichment.hf_repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-outline gap-1"
              >
                Base Model
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-xs" />
              </a>
            )}
            {readmeData?.quant_repo && (
              <a
                href={`https://huggingface.co/${readmeData.quant_repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-outline gap-1"
              >
                GGUF Repo
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-xs" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
