import { create } from "zustand";
import type { Hass, ProxLabConfig } from "./types";

interface Store {
  hass: Hass | null;
  entryId: string | null;
  config: ProxLabConfig | null;
  loading: boolean;
  error: string | null;
  sidebarCollapsed: boolean;

  setHass: (hass: Hass) => void;
  setEntryId: (id: string) => void;
  setConfig: (cfg: ProxLabConfig) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  toggleSidebar: () => void;
}

export const useStore = create<Store>((set) => ({
  hass: null,
  entryId: null,
  config: null,
  loading: true,
  error: null,
  sidebarCollapsed: localStorage.getItem("proxlab_sidebar") === "collapsed",

  setHass: (hass) => set({ hass }),
  setEntryId: (id) => set({ entryId: id }),
  setConfig: (cfg) => set({ config: cfg, loading: false, error: null }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e, loading: false }),
  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      localStorage.setItem("proxlab_sidebar", next ? "collapsed" : "expanded");
      return { sidebarCollapsed: next };
    }),
}));
