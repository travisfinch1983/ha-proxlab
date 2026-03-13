import { useState, useEffect, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faMagnifyingGlass,
  faLayerGroup,
} from "@fortawesome/free-solid-svg-icons";
import {
  discoverModels,
  fetchHfEnrichment,
  fetchModelLogos,
  uploadModelLogo,
  deleteModelLogo,
} from "../api";
import type { DiscoveredModel, HfEnrichment, ModelLogoMap } from "../types";
import ModelCard from "../components/ModelCard";
import ModelDetailPanel from "../components/ModelDetailPanel";

type GroupBy = "none" | "connection" | "provider";

/** A deduplicated model merging instances from multiple connections. */
export interface MergedModel {
  /** The primary (best) instance used for display. */
  primary: DiscoveredModel;
  /** All connections this model is available through. */
  connections: { id: string; name: string }[];
  /** Unique key for this merged model (the model ID). */
  key: string;
}

/** Deduplicate models by ID across connections. */
function deduplicateModels(models: DiscoveredModel[]): MergedModel[] {
  const map = new Map<string, DiscoveredModel[]>();
  for (const m of models) {
    const existing = map.get(m.id);
    if (existing) {
      existing.push(m);
    } else {
      map.set(m.id, [m]);
    }
  }

  const result: MergedModel[] = [];
  for (const [modelId, instances] of map) {
    // Pick the best instance: prefer loaded, then most metadata
    const sorted = [...instances].sort((a, b) => {
      if (a.is_loaded !== b.is_loaded) return a.is_loaded ? -1 : 1;
      if ((a.parameter_count || "") !== (b.parameter_count || ""))
        return a.parameter_count ? -1 : 1;
      if ((a.context_length || 0) !== (b.context_length || 0))
        return (b.context_length || 0) - (a.context_length || 0);
      return 0;
    });

    const connections = instances.map((m) => ({
      id: m.connection_id,
      name: m.connection_name,
    }));
    // Deduplicate connection names
    const seen = new Set<string>();
    const uniqueConns = connections.filter((c) => {
      if (seen.has(c.name)) return false;
      seen.add(c.name);
      return true;
    });

    result.push({
      primary: sorted[0],
      connections: uniqueConns,
      key: modelId,
    });
  }

  return result;
}

export default function ModelsPage() {
  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [enrichment, setEnrichment] = useState<Record<string, HfEnrichment>>({});
  const [customLogos, setCustomLogos] = useState<ModelLogoMap>({});
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Load models
  const loadModels = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const m = await discoverModels(force);
      setModels(m);
    } catch (err) {
      console.error("Model discovery failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load enrichment (background)
  const loadEnrichment = useCallback(async () => {
    setEnriching(true);
    try {
      const e = await fetchHfEnrichment();
      setEnrichment(e);
    } catch (err) {
      console.error("HF enrichment failed:", err);
    } finally {
      setEnriching(false);
    }
  }, []);

  // Load custom logos
  const loadCustomLogos = useCallback(async () => {
    try {
      const logos = await fetchModelLogos();
      setCustomLogos(logos);
    } catch (err) {
      console.error("Custom logos load failed:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadModels();
    loadCustomLogos();
  }, [loadModels, loadCustomLogos]);

  // Background enrichment after models load
  useEffect(() => {
    if (models.length > 0) {
      loadEnrichment();
    }
  }, [models.length, loadEnrichment]);

  // Refresh handler
  const handleRefresh = () => {
    setSelectedKey(null);
    loadModels(true);
  };

  // Logo upload handler
  const handleLogoUpload = async (modelKey: string, data: string, filename: string) => {
    try {
      const res = await uploadModelLogo(modelKey, data, filename);
      setCustomLogos((prev) => ({ ...prev, [modelKey]: res.url }));
    } catch (err) {
      console.error("Logo upload failed:", err);
    }
  };

  // Logo delete handler
  const handleLogoDelete = async (modelKey: string) => {
    try {
      await deleteModelLogo(modelKey);
      setCustomLogos((prev) => {
        const next = { ...prev };
        delete next[modelKey];
        return next;
      });
    } catch (err) {
      console.error("Logo delete failed:", err);
    }
  };

  // Deduplicate models
  const merged = useMemo(() => deduplicateModels(models), [models]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return merged;
    const q = search.toLowerCase();
    return merged.filter((mm) => {
      const m = mm.primary;
      return (
        m.id.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        mm.connections.some((c) => c.name.toLowerCase().includes(q)) ||
        (m.architecture && m.architecture.toLowerCase().includes(q)) ||
        (m.family && m.family.toLowerCase().includes(q))
      );
    });
  }, [merged, search]);

  // Group models
  const groups = useMemo(() => {
    if (groupBy === "none") return [{ label: "", models: filtered }];

    const map = new Map<string, MergedModel[]>();
    for (const mm of filtered) {
      if (groupBy === "connection") {
        // Show under each connection it belongs to
        for (const conn of mm.connections) {
          if (!map.has(conn.name)) map.set(conn.name, []);
          map.get(conn.name)!.push(mm);
        }
      } else {
        const key = mm.primary.provider;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(mm);
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, models]) => ({ label, models }));
  }, [filtered, groupBy]);

  // Find enrichment for a merged model — check all connection keys
  const getEnrichment = (mm: MergedModel): HfEnrichment | undefined => {
    for (const conn of mm.connections) {
      const key = `${conn.id}:${mm.primary.id}`;
      if (enrichment[key]) return enrichment[key];
    }
    return undefined;
  };

  // Toggle selection
  const handleCardClick = (key: string) => {
    setSelectedKey((prev) => (prev === key ? null : key));
  };

  const selectedMerged = selectedKey
    ? filtered.find((mm) => mm.key === selectedKey) ?? merged.find((mm) => mm.key === selectedKey)
    : undefined;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Models</h1>
          <p className="text-sm text-base-content/50">
            {merged.length} unique model{merged.length !== 1 ? "s" : ""} across{" "}
            {models.length} instance{models.length !== 1 ? "s" : ""}
            {enriching && (
              <span className="ml-2 text-info">
                <span className="loading loading-spinner loading-xs mr-1" />
                enriching...
              </span>
            )}
          </p>
        </div>
        <button
          className="btn btn-sm btn-ghost gap-1"
          onClick={handleRefresh}
          disabled={loading}
        >
          <FontAwesomeIcon
            icon={faArrowsRotate}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="input input-sm input-bordered flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="text-base-content/40" />
          <input
            type="text"
            placeholder="Search models..."
            className="grow"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="flex items-center gap-1">
          <FontAwesomeIcon icon={faLayerGroup} className="text-base-content/40 text-sm" />
          <select
            className="select select-sm select-bordered"
            value={groupBy}
            onChange={(e) => {
              setGroupBy(e.target.value as GroupBy);
              setSelectedKey(null);
            }}
          >
            <option value="none">No grouping</option>
            <option value="connection">By Connection</option>
            <option value="provider">By Provider</option>
          </select>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card bg-base-100 border border-base-300">
              <div className="h-24 rounded-t-2xl bg-base-200 animate-pulse" />
              <div className="card-body p-3 gap-2">
                <div className="h-4 bg-base-200 rounded animate-pulse w-3/4" />
                <div className="flex gap-1">
                  <div className="h-4 w-10 bg-base-200 rounded animate-pulse" />
                  <div className="h-4 w-10 bg-base-200 rounded animate-pulse" />
                </div>
                <div className="h-8 bg-base-200 rounded animate-pulse" />
                <div className="h-3 bg-base-200 rounded animate-pulse w-1/2 mt-auto" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && models.length === 0 && (
        <div className="text-center py-12 text-base-content/50">
          <p className="text-lg">No models discovered</p>
          <p className="text-sm mt-1">
            Add connections in the Connections page, then refresh.
          </p>
        </div>
      )}

      {/* No search results */}
      {!loading && models.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8 text-base-content/50">
          No models match &ldquo;{search}&rdquo;
        </div>
      )}

      {/* Model grid (grouped) */}
      {!loading &&
        groups.map((group) => (
          <div key={group.label || "__flat"}>
            {group.label && (
              <h2 className="text-lg font-semibold mb-2 mt-4 text-base-content/80">
                {group.label}
                <span className="badge badge-sm badge-ghost ml-2">
                  {group.models.length}
                </span>
              </h2>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {group.models.map((mm) => {
                const isSelected = selectedKey === mm.key;
                const hfData = getEnrichment(mm);
                return [
                  <ModelCard
                    key={mm.key}
                    model={mm.primary}
                    enrichment={hfData}
                    connections={mm.connections}
                    selected={isSelected}
                    onClick={() => handleCardClick(mm.key)}
                    customLogo={customLogos[mm.key]}
                  />,
                  isSelected && selectedMerged && (
                    <ModelDetailPanel
                      key={`detail-${mm.key}`}
                      model={selectedMerged.primary}
                      enrichment={hfData}
                      connections={selectedMerged.connections}
                      onClose={() => setSelectedKey(null)}
                      customLogo={customLogos[mm.key]}
                      onLogoUpload={handleLogoUpload}
                      onLogoDelete={handleLogoDelete}
                    />
                  ),
                ];
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
