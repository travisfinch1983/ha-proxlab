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

function providerConfig(provider: string) {
  return PROVIDER_COLORS[provider] ?? PROVIDER_COLORS["openai"];
}

/** Strip org prefix from model name for display. */
function displayName(m: DiscoveredModel): string {
  const dn = m.extras?.display_name;
  if (typeof dn === "string" && dn) return dn;
  const id = m.id;
  const slash = id.lastIndexOf("/");
  return slash >= 0 ? id.slice(slash + 1) : id;
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
  selected: boolean;
  onClick: () => void;
}

export default function ModelCard({ model, enrichment, selected, onClick }: Props) {
  const prov = providerConfig(model.provider);
  const name = displayName(model);
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
  const hasLogo = hfOk && enrichment.logo_url;

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
            src={enrichment.logo_url}
            alt={enrichment.author}
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
        {/* Model name */}
        <h3 className="font-semibold text-sm leading-tight line-clamp-2" title={model.id}>
          {name}
        </h3>

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

        {/* Footer: capability dots + provider + status */}
        <div className="flex items-center justify-between mt-auto pt-1 border-t border-base-200">
          <div className="flex items-center gap-0.5">
            {caps.map(([, label]) => (
              <span key={label} className="tooltip tooltip-top" data-tip={label}>
                <FontAwesomeIcon icon={faCircle} className="text-primary text-[6px]" />
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-base-content/50">
            <span>{model.provider}</span>
            {model.is_loaded && (
              <span className="badge badge-xs badge-success gap-0.5">loaded</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
