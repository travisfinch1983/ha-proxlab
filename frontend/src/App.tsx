import { useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router";
import { useStore } from "./store";
import { fetchConfig } from "./api";
import AppLayout from "./layout/AppLayout";
import AutomationsLayout from "./layout/AutomationsLayout";
import AgentsLayout from "./layout/AgentsLayout";
import KnowledgeLayout from "./layout/KnowledgeLayout";
import DeveloperLayout from "./layout/DeveloperLayout";
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
import SubscriptionsPage from "./pages/SubscriptionsPage";
import SchedulesPage from "./pages/SchedulesPage";
import ChainsPage from "./pages/ChainsPage";
import ChatPage from "./pages/ChatPage";
import ReportsPage from "./pages/ReportsPage";
import AgentBuilderPage from "./pages/AgentBuilderPage";
import ToolsLayout from "./layout/ToolsLayout";
import McpServersPage from "./pages/McpServersPage";
import McpMarketplacePage from "./pages/McpMarketplacePage";
import AgentProfilesPage from "./pages/AgentProfilesPage";
import ModelsPage from "./pages/ModelsPage";

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
    // Poll for config updates (health, models) every 60s
    const interval = setInterval(() => {
      fetchConfig()
        .then((cfg) => useStore.getState().setConfig(cfg))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
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
          <Route path="chat" element={<ChatPage />} />
          <Route path="connections" element={<ConnectionsPage />} />
          <Route path="models" element={<ModelsPage />} />
          {/* Agents group */}
          <Route path="agents" element={<AgentsLayout />}>
            <Route index element={<AgentsPage />} />
            <Route path="profiles" element={<AgentProfilesPage />} />
          </Route>
          <Route path="settings" element={<SettingsPage />} />

          {/* Automations group */}
          <Route path="automations" element={<AutomationsLayout />}>
            <Route index element={<SubscriptionsPage />} />
            <Route path="schedules" element={<SchedulesPage />} />
            <Route path="chains" element={<ChainsPage />} />
            <Route path="builder" element={<AgentBuilderPage />} />
          </Route>

          {/* Tools group (MCP) */}
          <Route path="tools" element={<ToolsLayout />}>
            <Route index element={<McpServersPage />} />
            <Route path="marketplace" element={<McpMarketplacePage />} />
          </Route>

          {/* Knowledge group */}
          <Route path="knowledge" element={<KnowledgeLayout />}>
            <Route index element={<ContextPage />} />
            <Route path="memory" element={<MemoryPage />} />
            <Route path="vector-db" element={<VectorDbPage />} />
          </Route>

          {/* Developer group */}
          <Route path="developer" element={<DeveloperLayout />}>
            <Route index element={<DebugPage />} />
            <Route path="api-info" element={<ApiInfoPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="issues" element={<IssuesPage />} />
            <Route path="roadmap" element={<RoadmapPage />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}
