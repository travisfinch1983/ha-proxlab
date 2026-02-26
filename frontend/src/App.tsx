import { useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router";
import { useStore } from "./store";
import { fetchConfig } from "./api";
import AppLayout from "./layout/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import ConnectionsPage from "./pages/ConnectionsPage";
import AgentsPage from "./pages/AgentsPage";
import ContextPage from "./pages/ContextPage";
import MemoryPage from "./pages/MemoryPage";
import VectorDbPage from "./pages/VectorDbPage";
import SettingsPage from "./pages/SettingsPage";
import DebugPage from "./pages/DebugPage";
import ApiInfoPage from "./pages/ApiInfoPage";
import IssuesPage from "./pages/IssuesPage";
import RoadmapPage from "./pages/RoadmapPage";

export default function App() {
  const hass = useStore((s) => s.hass);
  const config = useStore((s) => s.config);
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);

  useEffect(() => {
    if (!hass) return;
    useStore.getState().setLoading(true);
    fetchConfig()
      .then((cfg) => useStore.getState().setConfig(cfg))
      .catch((err) =>
        useStore.getState().setError(err?.message || "Failed to load config")
      );
  }, [hass]);

  // Waiting for HA connection
  if (!hass) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="mt-4 text-base-content/70">
            Connecting to Home Assistant...
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="mt-4 text-base-content/70">Loading ProxLab...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-base-200">
        <div className="card bg-base-100 shadow-xl max-w-md">
          <div className="card-body">
            <h2 className="card-title text-error">Connection Error</h2>
            <p>{error}</p>
            <div className="card-actions justify-end">
              <button
                className="btn btn-primary"
                onClick={() => {
                  useStore.getState().setLoading(true);
                  fetchConfig()
                    .then((cfg) => useStore.getState().setConfig(cfg))
                    .catch((err) =>
                      useStore
                        .getState()
                        .setError(err?.message || "Failed to load config")
                    );
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!config) return null;

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="connections" element={<ConnectionsPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="context" element={<ContextPage />} />
          <Route path="memory" element={<MemoryPage />} />
          <Route path="vector-db" element={<VectorDbPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="debug" element={<DebugPage />} />
          <Route path="api-info" element={<ApiInfoPage />} />
          <Route path="issues" element={<IssuesPage />} />
          <Route path="roadmap" element={<RoadmapPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
