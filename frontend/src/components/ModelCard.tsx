import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircle,
  faCubes,
  faServer,
  faCloud,
  faMicrochip,
  faRobot,
} from "@fortawesome/free-solid-svg-icons";
import type { DiscoveredModel, HfEnrichment } from "../types";

/** Provider colour config. */
const PROVIDER_COLORS: Record<
  string,
  { gradient: string; icon: typeof faCubes; accent: string }
> = {
  ollama: {
    gradient: "from-blue-600/20 to-blue-800/30",
    icon: faCubes,
    accent: "text-blue-400",
  },
  vllm: {
    gradient: "from-emerald-600/20 to-emerald-800/30",
    icon: faServer,
    accent: "text-emerald-400",
  },
  koboldcpp: {
    gradient: "from-orange-600/20 to-orange-800/30",
    icon: faMicrochip,
    accent: "text-orange-400",
  },
  claude: {
    gradient: "from-purple-600/20 to-purple-800/30",
    icon: faCloud,
    accent: "text-purple-400",
  },
  openai: {
    gradient: "from-base-300/40 to-base-300/60",
    icon: faRobot,
    accent: "text-base-content/60",
  },
};

/** Provider-specific logo URLs for models without HF enrichment. */
const PROVIDER_LOGOS: Record<string, string> = {
  claude: "https://avatars.githubusercontent.com/u/76263028",  // Anthropic GitHub avatar
};

function providerConfig(provider: string) {
  return PROVIDER_COLORS[provider] ?? PROVIDER_COLORS["openai"];
}

/** Known HF uploader/org prefixes to strip from filenames. */
const KNOWN_UPLOADERS = new Set([
  "thedrummer", "bartowski", "unsloth", "quantfactory",
  "mradermacher", "lmstudio", "mmnga", "cjpais",
]);

/**
 * Parse a GGUF filename or model ID into a human-friendly display name.
 *
 * "TheDrummer_Behemoth-X-123B-v2-Q6_K-00001-of-00003" → "Behemoth X 123B v2"
 * "koboldcpp/Qwen3.5-0.8B-UD-Q6_K_XL" → "Qwen3.5 0.8B UD"
 */
export function parseModelName(raw: string): string {
  let name = raw;
  // Strip provider prefix (koboldcpp/, openai/, etc.)
  if (name.includes("/")) name = name.split("/").pop()!;
  // Strip .gguf extension
  name = name.replace(/\.gguf$/i, "");
  // Strip split indicators (-00001-of-00003)
  name = name.replace(/-\d{5}-of-\d{5}$/, "");
  // Strip quant suffixes (Q4_K_M, IQ3_M, F16, etc.)
  name = name.replace(/[-_](Q\d+_K(?:_[SMLX]+)?|IQ\d+_\w+|F(?:16|32)|BF16|FP16)(?:[-_].*)?$/i, "");
  // Strip trailing dashes/underscores from quant removal
  name = name.replace(/[-_]+$/, "");
  // Strip known uploader prefixes (TheDrummer_, bartowski_, etc.)
  const prefixMatch = name.match(/^([A-Za-z][A-Za-z0-9]*)[-_](.+)$/);
  if (prefixMatch) {
    const [, prefix, rest] = prefixMatch;
    if (KNOWN_UPLOADERS.has(prefix.toLowerCase())) {
      name = rest;
    }
  }
  // Replace underscores with hyphens for uniform splitting, then convert to spaces
  name = name.replace(/_/g, "-");
  // Split on hyphens but keep version-like tokens (v2, x2) attached
  name = name.replace(/-/g, " ");
  // Collapse multiple spaces
  name = name.replace(/\s+/g, " ").trim();
  return name;
}

/** Derive a human-readable model name from HF enrichment or model ID. */
export function modelDisplayName(m: DiscoveredModel, enrichment?: HfEnrichment): string {
  // Use extras.display_name (set by Claude discovery)
  const dn = m.extras?.display_name;
  if (typeof dn === "string" && dn) return dn;

  // Use HF repo name (e.g. "Qwen/Qwen3.5-32B-Instruct" → "Qwen3.5-32B-Instruct")
  const hfOk = enrichment && enrichment.status === "ok";
  if (hfOk && enrichment.hf_repo) {
    const slash = enrichment.hf_repo.lastIndexOf("/");
    return slash >= 0 ? enrichment.hf_repo.slice(slash + 1) : enrichment.hf_repo;
  }

  // Smart fallback: parse model ID into clean display name
  return parseModelName(m.id);
}

/** Check if the display name differs from the raw ID (warrants subtitle). */
function needsSubtitle(displayName: string, model: DiscoveredModel): boolean {
  const rawName = model.id;
  // Show subtitle if display name differs meaningfully from raw ID
  if (displayName === rawName) return false;
  // Don't show subtitle if it's just the org-stripped version
  if (rawName.endsWith(displayName)) return false;
  return true;
}

/** Format context length as "32K", "128K", "1M". */
function fmtCtx(n: number | null): string | null {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** Capability dots. */
const CAP_MAP: [string, string][] = [
  ["supports_vision", "Vision"],
  ["supports_tool_use", "Tools"],
  ["supports_embeddings", "Embed"],
  ["supports_audio", "Audio"],
  ["supports_tts", "TTS"],
];

interface Props {
  model: DiscoveredModel;
  enrichment?: HfEnrichment;
  connections: { id: string; name: string }[];
  selected: boolean;
  onClick: () => void;
  customLogo?: string;
}

export default function ModelCard({ model, enrichment, connections, selected, onClick, customLogo }: Props) {
  const prov = providerConfig(model.provider);
  const name = modelDisplayName(model, enrichment);
  const showSub = needsSubtitle(name, model);
  const ctx = fmtCtx(model.context_length);
  const capFlags: Record<string, boolean> = {
    supports_vision: model.supports_vision,
    supports_tool_use: model.supports_tool_use,
    supports_embeddings: model.supports_embeddings,
    supports_audio: model.supports_audio,
    supports_tts: model.supports_tts,
  };
  const caps = CAP_MAP.filter(([key]) => capFlags[key]);
  const hfOk = enrichment && enrichment.status === "ok";
  const hfLogo = hfOk && enrichment.logo_url;
  const providerLogo = PROVIDER_LOGOS[model.provider];

  // Logo priority: custom → HF enrichment → provider-specific → icon fallback
  const logoUrl = customLogo || (hfLogo ? enrichment.logo_url : providerLogo) || null;
  const hasLogo = !!logoUrl;

  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={onClick}
      className={`card bg-base-100 border cursor-pointer transition-all duration-200
        hover:-translate-y-1 hover:shadow-md
        ${selected ? "ring-2 ring-primary shadow-lg" : "border-base-300"}`}
    >
      {/* Top gradient area with logo */}
      <div
        className={`flex items-center justify-center h-24 rounded-t-2xl bg-gradient-to-br ${prov.gradient}`}
      >
        {hasLogo && !imgError ? (
          <img
            src={logoUrl}
            alt={hfOk ? enrichment.author : model.provider}
            className="w-14 h-14 rounded-full object-cover bg-base-200"
            onError={() => setImgError(true)}
          />
        ) : (
          <FontAwesomeIcon
            icon={prov.icon}
            className={`${prov.accent} text-3xl`}
          />
        )}
      </div>

      <div className="card-body p-3 gap-1.5">
        {/* Model name + subtitle */}
        <div>
          <h3 className="font-semibold text-sm leading-tight line-clamp-2" title={model.id}>
            {name}
          </h3>
          {showSub && (
            <p className="text-[10px] text-base-content/40 font-mono truncate" title={model.id}>
              {model.id}
            </p>
          )}
        </div>

        {/* Spec badges */}
        <div className="flex flex-wrap gap-1">
          {model.parameter_count && (
            <span className="badge badge-sm badge-primary badge-outline">
              {model.parameter_count}
            </span>
          )}
          {ctx && (
            <span className="badge badge-sm badge-secondary badge-outline">{ctx}</span>
          )}
          {model.quantization && (
            <span className="badge badge-sm badge-accent badge-outline">
              {model.quantization}
            </span>
          )}
          {hfOk && enrichment.model_type === "MoE" && (
            <span className="badge badge-sm badge-warning badge-outline">MoE</span>
          )}
        </div>

        {/* Description */}
        {hfOk && enrichment.description ? (
          <p className="text-xs text-base-content/60 line-clamp-2 min-h-[2rem]">
            {enrichment.description}
          </p>
        ) : (
          <p className="text-xs text-base-content/40 min-h-[2rem] italic">
            {model.architecture || model.family || model.provider}
          </p>
        )}

        {/* Footer: capability dots + connections + status */}
        <div className="flex items-center justify-between mt-auto pt-1 border-t border-base-200">
          <div className="flex items-center gap-0.5">
            {caps.map(([, label]) => (
              <span key={label} className="tooltip tooltip-top" data-tip={label}>
                <FontAwesomeIcon icon={faCircle} className="text-primary text-[6px]" />
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-base-content/50 flex-wrap justify-end">
            {connections.length > 1 ? (
              <span className="tooltip tooltip-top" data-tip={connections.map(c => c.name).join(", ")}>
                {model.provider} &times;{connections.length}
              </span>
            ) : (
              <span>{connections[0]?.name || model.provider}</span>
            )}
            {model.is_loaded && (
              <span className="badge badge-xs badge-success gap-0.5">loaded</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
