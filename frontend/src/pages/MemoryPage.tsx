import { useEffect, useState } from "react";
import NavBar from "../layout/NavBar";
import { useStore } from "../store";
import SaveButton from "../components/SaveButton";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  updateMemory,
  fetchConfig,
  reindexEntities,
  getEntityScanStatus,
  updateEntityScan,
  subscribeReindexProgress,
  discoverModels,
} from "../api";
import type { EntityScanStatus, ReindexResult, ReindexProgress } from "../api";
import type { DiscoveredModel } from "../types";
import { CAPABILITY_LABELS } from "../types";

export default function MemoryPage() {
  const config = useStore((s) => s.config)!;
  const mem = config.memory;

  const [enabled, setEnabled] = useState(mem.memory_enabled);
  const [universal, setUniversal] = useState(mem.memory_universal_access);
  const [maxMem, setMaxMem] = useState(mem.memory_max_memories);
  const [minImp, setMinImp] = useState(mem.memory_min_importance);
  const [minWords, setMinWords] = useState(mem.memory_min_words);
  const [topK, setTopK] = useState(mem.memory_context_top_k);
  const [collection, setCollection] = useState(mem.memory_collection_name);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Entity vectorization state
  const [scanStatus, setScanStatus] = useState<EntityScanStatus | null>(null);
  const [scanEnabled, setScanEnabled] = useState(false);
  const [scanInterval, setScanInterval] = useState<"hourly" | "daily" | "weekly">("daily");
  const [indexing, setIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState<ReindexResult | null>(null);
  const [indexProgress, setIndexProgress] = useState<ReindexProgress | null>(null);
  const [confirmIndex, setConfirmIndex] = useState(false);
  const [scanSaving, setScanSaving] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([]);

  useEffect(() => {
    getEntityScanStatus()
      .then((status) => {
        setScanStatus(status);
        setScanEnabled(status.entity_scan_enabled);
        setScanInterval(status.entity_scan_interval);
      })
      .catch(() => {});
    discoverModels().then(setDiscoveredModels).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMemory({
        memory_enabled: enabled,
        memory_universal_access: universal,
        memory_max_memories: maxMem,
        memory_min_importance: minImp,
        memory_min_words: minWords,
        memory_context_top_k: topK,
        memory_collection_name: collection,
      });
      const cfg = await fetchConfig();
      useStore.getState().setConfig(cfg);
      setToast("Saved");
      setTimeout(() => setToast(null), 2000);
    } catch (err: unknown) {
      setToast(`Error: ${(err as Error).message}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleReindex = async () => {
    setConfirmIndex(false);
    setIndexing(true);
    setIndexResult(null);
    setIndexProgress(null);

    const unsub = subscribeReindexProgress((progress) => {
      setIndexProgress(progress);
    });

    try {
      const result = await reindexEntities();
      setIndexResult(result);
    } catch (err: unknown) {
      setIndexResult({
        success: false,
        total: 0,
        indexed: 0,
        failed: 0,
        skipped: 0,
        error: (err as Error).message,
      });
    } finally {
      unsub();
      setIndexing(false);
      setIndexProgress(null);
    }
  };

  const handleScanSave = async () => {
    setScanSaving(true);
    try {
      await updateEntityScan({
        entity_scan_enabled: scanEnabled,
        entity_scan_interval: scanInterval,
      });
      const status = await getEntityScanStatus();
      setScanStatus(status);
      setToast("Scan settings saved");
      setTimeout(() => setToast(null), 2000);
    } catch (err: unknown) {
      setToast(`Error: ${(err as Error).message}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setScanSaving(false);
    }
  };

  const connected = scanStatus?.connected ?? false;
  const hasFingerprint = !!scanStatus?.fingerprint;

  return (
    <>
      <NavBar title="Memory Settings" />
      <div className="p-6 max-w-2xl space-y-4">
        {/* Memory Settings Card */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span className="label-text">Enable Memory System</span>
            </label>

            {enabled && (
              <>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="toggle toggle-sm toggle-primary"
                    checked={universal}
                    onChange={(e) => setUniversal(e.target.checked)}
                  />
                  <span className="label-text text-sm">Universal Memory Access</span>
                  <span className="text-xs text-base-content/50">
                    All users share memories
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text text-sm">Max Memories</span>
                    </div>
                    <input
                      type="number"
                      className="input input-bordered input-sm"
                      value={maxMem}
                      onChange={(e) => setMaxMem(parseInt(e.target.value))}
                    />
                  </label>
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text text-sm">Min Importance</span>
                    </div>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      className="input input-bordered input-sm"
                      value={minImp}
                      onChange={(e) => setMinImp(parseFloat(e.target.value))}
                    />
                  </label>
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text text-sm">Min Words</span>
                    </div>
                    <input
                      type="number"
                      className="input input-bordered input-sm"
                      value={minWords}
                      onChange={(e) => setMinWords(parseInt(e.target.value))}
                    />
                  </label>
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text text-sm">Context Top K</span>
                    </div>
                    <input
                      type="number"
                      className="input input-bordered input-sm"
                      value={topK}
                      onChange={(e) => setTopK(parseInt(e.target.value))}
                    />
                  </label>
                </div>

                <label className="form-control">
                  <div className="label">
                    <span className="label-text text-sm">Collection Name</span>
                  </div>
                  <input
                    type="text"
                    className="input input-bordered input-sm w-64"
                    value={collection}
                    onChange={(e) => setCollection(e.target.value)}
                  />
                </label>
              </>
            )}

            <div className="flex justify-end gap-2">
              {toast && (
                <span className="text-xs text-success self-center">
                  {toast}
                </span>
              )}
              <SaveButton saving={saving} onClick={handleSave} />
            </div>
          </div>
        </div>

        {/* Entity Vectorization Card */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body space-y-4">
            <h2 className="card-title text-base">Entity Vectorization</h2>

            {/* Model info */}
            {scanStatus && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-base-content/60">Status</span>
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      connected && hasFingerprint
                        ? "bg-success"
                        : connected
                          ? "bg-warning"
                          : "bg-error"
                    }`}
                  />
                  {connected && hasFingerprint
                    ? "Connected"
                    : connected
                      ? "No fingerprint"
                      : "Disconnected"}
                </span>

                <span className="text-base-content/60">Embedding Model</span>
                <span className="font-mono text-xs">
                  {scanStatus.embedding_model || "—"}
                </span>

                <span className="text-base-content/60">Dimension</span>
                <span className="font-mono text-xs">
                  {scanStatus.embedding_dim || "—"}
                </span>

                <span className="text-base-content/60">Fingerprint</span>
                <span className="font-mono text-xs">
                  {scanStatus.fingerprint || "—"}
                </span>

                <span className="text-base-content/60">Collection</span>
                <span className="font-mono text-xs break-all">
                  {scanStatus.collection_name || "—"}
                </span>

                {/* Capabilities row */}
                <span className="text-base-content/60">Capabilities</span>
                <span className="flex flex-wrap gap-1">
                  {/* User-assigned capabilities from embedding connection */}
                  {scanStatus.capabilities.map((cap) => (
                    <span key={cap} className="badge badge-xs badge-outline">
                      {CAPABILITY_LABELS[cap] || cap}
                    </span>
                  ))}
                  {/* Detected capabilities from model discovery */}
                  {(() => {
                    // Find embedding models by matching the embedding_model name
                    const embModel = scanStatus.embedding_model;
                    const matched = discoveredModels.filter(
                      (m) => m.supports_embeddings || m.id === embModel
                    );
                    const det = new Set<string>();
                    for (const m of matched) {
                      if (m.supports_vision) det.add("vision");
                      if (m.supports_embeddings) det.add("embeddings");
                    }
                    const extras = [...det].filter(
                      (d) => !scanStatus.capabilities.includes(d)
                    );
                    return extras.map((d) => (
                      <span
                        key={`det-${d}`}
                        className="badge badge-xs badge-accent badge-outline"
                        title="Auto-detected"
                      >
                        {d}
                      </span>
                    ));
                  })()}
                  {scanStatus.capabilities.length === 0 &&
                    discoveredModels.length === 0 && (
                      <span className="text-xs text-base-content/40">—</span>
                    )}
                </span>
              </div>
            )}

            {/* Index button */}
            <div className="flex items-center gap-3">
              <button
                className="btn btn-primary btn-sm"
                disabled={indexing || !hasFingerprint}
                onClick={() => setConfirmIndex(true)}
              >
                {indexing ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : null}
                Index All Entities
              </button>
              {!hasFingerprint && scanStatus && (
                <span className="text-xs text-warning">
                  {!connected
                    ? "Vector DB not connected"
                    : "Fingerprint not computed — restart HA to retry"}
                </span>
              )}
            </div>

            {/* Index progress */}
            {indexing && indexProgress && indexProgress.total > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-base-content/70">
                  <span>
                    {indexProgress.indexed} indexed
                    {indexProgress.failed > 0 && `, ${indexProgress.failed} failed`}
                    {indexProgress.skipped > 0 && `, ${indexProgress.skipped} skipped`}
                  </span>
                  <span>
                    {indexProgress.processed} / {indexProgress.total}
                    {" "}({Math.round((indexProgress.processed / indexProgress.total) * 100)}%)
                  </span>
                </div>
                <progress
                  className="progress progress-primary w-full"
                  value={indexProgress.processed}
                  max={indexProgress.total}
                />
              </div>
            )}

            {/* Index result */}
            {indexResult && (
              <div
                className={`alert ${
                  indexResult.success ? "alert-success" : "alert-error"
                } text-sm py-2`}
              >
                {indexResult.success ? (
                  <span>
                    Indexed <strong>{indexResult.indexed}</strong> entities
                    {indexResult.failed > 0 && (
                      <>, <strong>{indexResult.failed}</strong> failed</>
                    )}
                    {indexResult.skipped > 0 && (
                      <>, <strong>{indexResult.skipped}</strong> skipped</>
                    )}
                    {" "}(total: {indexResult.total})
                  </span>
                ) : (
                  <span>Reindex failed: {indexResult.error}</span>
                )}
              </div>
            )}

            <div className="divider my-1" />

            {/* Auto-scan settings */}
            <h3 className="text-sm font-semibold">Auto-Scan</h3>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={scanEnabled}
                onChange={(e) => setScanEnabled(e.target.checked)}
              />
              <span className="label-text text-sm">
                Enable automatic entity scanning
              </span>
            </label>

            {scanEnabled && (
              <label className="form-control w-48">
                <div className="label">
                  <span className="label-text text-sm">Scan Interval</span>
                </div>
                <select
                  className="select select-bordered select-sm"
                  value={scanInterval}
                  onChange={(e) =>
                    setScanInterval(
                      e.target.value as "hourly" | "daily" | "weekly"
                    )
                  }
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
            )}

            <div className="flex justify-end">
              <SaveButton saving={scanSaving} onClick={handleScanSave} />
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmIndex}
        title="Reindex All Entities"
        message="This will re-embed all HA entities into the vector store. This may take a few minutes depending on the number of entities."
        confirmLabel="Index"
        confirmVariant="primary"
        onConfirm={handleReindex}
        onCancel={() => setConfirmIndex(false)}
      />
    </>
  );
}
