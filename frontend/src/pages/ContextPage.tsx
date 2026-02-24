import { useState } from "react";
import NavBar from "../layout/NavBar";
import { useStore } from "../store";
import SaveButton from "../components/SaveButton";
import { updateContext, fetchConfig } from "../api";

export default function ContextPage() {
  const config = useStore((s) => s.config)!;
  const ctx = config.context;

  const [mode, setMode] = useState(ctx.context_mode);
  const [format, setFormat] = useState(ctx.context_format);
  const [entities, setEntities] = useState(ctx.direct_entities);
  const [maxTokens, setMaxTokens] = useState(ctx.max_context_tokens);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateContext({
        context_mode: mode,
        context_format: format,
        direct_entities: entities,
        max_context_tokens: maxTokens,
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
      <NavBar title="Context Settings" />
      <div className="p-6 max-w-2xl">
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body space-y-4">
            <label className="form-control">
              <div className="label">
                <span className="label-text">Context Mode</span>
              </div>
              <select
                className="select select-bordered select-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="direct">Direct (selected entities)</option>
                <option value="vector_db">Vector DB (semantic search)</option>
              </select>
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text">Context Format</span>
              </div>
              <select
                className="select select-bordered select-sm"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="json">JSON</option>
                <option value="natural_language">Natural Language</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>

            {mode === "direct" && (
              <label className="form-control">
                <div className="label">
                  <span className="label-text">Direct Entities</span>
                  <span className="label-text-alt">Comma-separated entity IDs</span>
                </div>
                <textarea
                  className="textarea textarea-bordered text-sm"
                  rows={3}
                  value={entities}
                  onChange={(e) => setEntities(e.target.value)}
                  placeholder="light.living_room, sensor.temperature"
                />
              </label>
            )}

            <label className="form-control">
              <div className="label">
                <span className="label-text">Max Context Tokens</span>
              </div>
              <input
                type="number"
                className="input input-bordered input-sm w-48"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              />
            </label>

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
