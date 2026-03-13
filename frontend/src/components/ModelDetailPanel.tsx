import { useRef, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import type { DiscoveredModel, HfEnrichment } from "../types";

/** Format seconds to "2h 15m" / "5m 30s". */
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

interface Props {
  model: DiscoveredModel;
  enrichment?: HfEnrichment;
  onClose: () => void;
}

export default function ModelDetailPanel({ model, enrichment, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const hfOk = enrichment && enrichment.status === "ok";

  // Animate open on mount
  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
  }, []);

  // Capability tags
  const capTags: string[] = [];
  if (model.extras?.connection_capabilities) {
    const caps = model.extras.connection_capabilities as string[];
    const labels: Record<string, string> = {
      conversation: "Conversational LLM",
      tool_use: "Tool Use",
      vision: "Vision",
      embeddings: "Embeddings",
      tts: "Text-to-Speech",
      stt: "Speech-to-Text",
      reranker: "Reranker",
    };
    caps.forEach((c) => {
      if (labels[c]) capTags.push(labels[c]);
    });
  }
  if (model.supports_vision && !capTags.includes("Vision")) capTags.push("Vision");
  if (model.supports_tool_use && !capTags.includes("Tool Use")) capTags.push("Tool Use");
  if (model.supports_embeddings && !capTags.includes("Embeddings")) capTags.push("Embeddings");
  if (model.supports_audio) capTags.push("Audio");

  return (
    <div
      ref={ref}
      className="col-span-full overflow-hidden transition-all duration-300 ease-in-out"
      style={{ maxHeight: open ? "600px" : "0px" }}
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
                <p className="text-xs text-base-content/50">
                  {model.provider} &bull; {model.connection_name}
                  {model.is_loaded && (
                    <span className="badge badge-xs badge-success ml-2">loaded</span>
                  )}
                </p>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          {/* Two-column layout */}
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
                      <span key={tag} className="badge badge-sm badge-outline">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(model.generation_speed || model.prompt_speed || model.uptime_seconds || model.queue_depth !== null) && (
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

          {/* Description */}
          {hfOk && enrichment.description && (
            <div>
              <h4 className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mb-1">
                Description
              </h4>
              <p className="text-sm text-base-content/70">{enrichment.description}</p>
            </div>
          )}

          {/* HF link */}
          {hfOk && enrichment.hf_repo && (
            <div className="flex justify-end">
              <a
                href={`https://huggingface.co/${enrichment.hf_repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-outline gap-1"
              >
                View on HuggingFace
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-xs" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
