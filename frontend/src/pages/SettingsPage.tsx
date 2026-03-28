import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSatelliteDish } from "@fortawesome/free-solid-svg-icons";
import NavBar from "../layout/NavBar";
import { useStore } from "../store";
import SaveButton from "../components/SaveButton";
import { updateSettings, discoverServices, fetchConfig } from "../api";
import type { DiscoveredService } from "../api";

export default function SettingsPage() {
  const config = useStore((s) => s.config)!;
  const s = config.settings;

  const [proxlabUrl, setProxlabUrl] = useState(s.proxlab_url);
  const [historyEnabled, setHistoryEnabled] = useState(s.history_enabled);
  const [historyMaxMsg, setHistoryMaxMsg] = useState(s.history_max_messages);
  const [historyMaxTok, setHistoryMaxTok] = useState(s.history_max_tokens);
  const [sessionPersist, setSessionPersist] = useState(
    s.session_persistence_enabled
  );
  const [sessionTimeout, setSessionTimeout] = useState(s.session_timeout);
  const [toolsMaxCalls, setToolsMaxCalls] = useState(
    s.tools_max_calls_per_turn
  );
  const [toolsTimeout, setToolsTimeout] = useState(s.tools_timeout);
  const [debugLog, setDebugLog] = useState(s.debug_logging);
  const [streaming, setStreaming] = useState(s.streaming_enabled);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Discovery
  const [discovering, setDiscovering] = useState(false);
  const [services, setServices] = useState<DiscoveredService[]>([]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        proxlab_url: proxlabUrl,
        history_enabled: historyEnabled,
        history_max_messages: historyMaxMsg,
        history_max_tokens: historyMaxTok,
        session_persistence_enabled: sessionPersist,
        session_timeout: sessionTimeout,
        tools_max_calls_per_turn: toolsMaxCalls,
        tools_timeout: toolsTimeout,
        debug_logging: debugLog,
        streaming_enabled: streaming,
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

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const svc = await discoverServices();
      setServices(svc);
    } catch (err: unknown) {
      setToast(`Discovery failed: ${(err as Error).message}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <>
      <NavBar title="Settings" />
      <div className="p-6 max-w-3xl space-y-6">
        {/* ProxLab Discovery */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body space-y-3">
            <h2 className="card-title text-base">ProxLab Discovery</h2>
            <div className="flex gap-3 items-end">
              <label className="form-control flex-1">
                <div className="label">
                  <span className="label-text text-sm">ProxLab URL</span>
                </div>
                <input
                  type="url"
                  className="input input-bordered input-sm"
                  value={proxlabUrl}
                  onChange={(e) => setProxlabUrl(e.target.value)}
                  placeholder="http://10.0.0.140:7777"
                />
              </label>
              <button
                className="btn btn-sm btn-outline"
                onClick={handleDiscover}
                disabled={discovering || !proxlabUrl}
              >
                {discovering ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <FontAwesomeIcon icon={faSatelliteDish} />
                )}
                Discover
              </button>
            </div>
            {services.length > 0 && (
              <div className="overflow-x-auto">
                <table className="table table-xs">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Model</th>
                      <th>Type</th>
                      <th>URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((svc) => (
                      <tr key={svc.id}>
                        <td className="font-medium">{svc.display_name}</td>
                        <td>{svc.model}</td>
                        <td>
                          <span className="badge badge-xs badge-outline">
                            {svc.service_type}
                          </span>
                        </td>
                        <td className="font-mono text-xs">{svc.base_url}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* History */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body space-y-3">
            <h2 className="card-title text-base">Conversation History</h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={historyEnabled}
                onChange={(e) => setHistoryEnabled(e.target.checked)}
              />
              <span className="label-text text-sm">Enable History</span>
            </label>
            {historyEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <label className="form-control">
                  <div className="label">
                    <span className="label-text text-sm">Max Messages</span>
                  </div>
                  <input
                    type="number"
                    className="input input-bordered input-sm"
                    value={historyMaxMsg}
                    onChange={(e) => setHistoryMaxMsg(parseInt(e.target.value))}
                  />
                </label>
                <label className="form-control">
                  <div className="label">
                    <span className="label-text text-sm">Max Tokens</span>
                  </div>
                  <input
                    type="number"
                    className="input input-bordered input-sm"
                    value={historyMaxTok}
                    onChange={(e) => setHistoryMaxTok(parseInt(e.target.value))}
                  />
                </label>
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={sessionPersist}
                onChange={(e) => setSessionPersist(e.target.checked)}
              />
              <span className="label-text text-sm">
                Session Persistence
              </span>
            </label>
            {sessionPersist && (
              <label className="form-control w-48">
                <div className="label">
                  <span className="label-text text-sm">
                    Session Timeout (min)
                  </span>
                </div>
                <input
                  type="number"
                  className="input input-bordered input-sm"
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(parseInt(e.target.value))}
                />
              </label>
            )}
          </div>
        </div>

        {/* Tools */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body space-y-3">
            <h2 className="card-title text-base">Tool Configuration</h2>
            <div className="grid grid-cols-2 gap-4">
              <label className="form-control">
                <div className="label">
                  <span className="label-text text-sm">
                    Max Calls Per Turn
                  </span>
                </div>
                <input
                  type="number"
                  className="input input-bordered input-sm"
                  value={toolsMaxCalls}
                  onChange={(e) => setToolsMaxCalls(parseInt(e.target.value))}
                />
              </label>
              <label className="form-control">
                <div className="label">
                  <span className="label-text text-sm">Timeout (sec)</span>
                </div>
                <input
                  type="number"
                  className="input input-bordered input-sm"
                  value={toolsTimeout}
                  onChange={(e) => setToolsTimeout(parseInt(e.target.value))}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Debug */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body space-y-3">
            <h2 className="card-title text-base">Debug Settings</h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={debugLog}
                onChange={(e) => setDebugLog(e.target.checked)}
              />
              <span className="label-text text-sm">Debug Logging</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={streaming}
                onChange={(e) => setStreaming(e.target.checked)}
              />
              <span className="label-text text-sm">Streaming Responses</span>
            </label>
          </div>
        </div>

        {/* Global save */}
        <div className="flex justify-end gap-2">
          {toast && (
            <span className="text-xs text-success self-center">{toast}</span>
          )}
          <SaveButton saving={saving} onClick={handleSave} label="Save All" />
        </div>
      </div>
    </>
  );
}
