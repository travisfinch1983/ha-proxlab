import { useState } from "react";
import NavBar from "../layout/NavBar";
import { useStore } from "../store";
import SaveButton from "../components/SaveButton";
import { updateMemory, fetchConfig } from "../api";

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

  return (
    <>
      <NavBar title="Memory Settings" />
      <div className="p-6 max-w-2xl">
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
      </div>
    </>
  );
}
