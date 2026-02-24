import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useStore } from "./store";
import App from "./App";
import "./app.css";

// HA panel_custom iframe bridge: HA sets `panel` property on the
// <ha-panel-custom> element, which includes `hass` and `config`.
// For embed_iframe panels, HA posts messages to the iframe.

function extractEntryId(): string | null {
  // HA encodes the config entry ID in the panel config
  const params = new URLSearchParams(window.location.search);
  return params.get("entry_id") || null;
}

// Listen for hass updates from parent HA frame
window.addEventListener("message", (event) => {
  if (event.data?.type === "config/panel") {
    const panel = event.data.panel;
    if (panel?.config?.entry_id) {
      useStore.getState().setEntryId(panel.config.entry_id);
    }
  }
});

// Poll for hass object on window (HA injects it for iframe panels)
function pollForHass() {
  const w = window as unknown as Record<string, unknown>;
  if (w.hassConnection) {
    // hassConnection is a promise that resolves to { conn, auth }
    (w.hassConnection as Promise<{ conn: unknown }>).then(({ conn }) => {
      // conn has subscribeEvents, sendMessagePromise, etc.
      // We wrap it to provide callWS
      const hass = buildHassProxy(conn);
      useStore.getState().setHass(hass);
    });
    return;
  }

  // For embed_iframe, HA sends hass via the parent
  if (window.parent !== window) {
    // Request hass from parent
    window.parent.postMessage({ type: "config/get" }, "*");
  }

  // Also check if __hass is already set (some HA versions)
  if (w.__hass) {
    useStore.getState().setHass(w.__hass as never);
    return;
  }

  setTimeout(pollForHass, 100);
}

function buildHassProxy(conn: unknown): never {
  // The conn object from hassConnection provides sendMessagePromise
  return new Proxy({} as never, {
    get(_target, prop) {
      if (prop === "callWS") {
        return async (msg: Record<string, unknown>) => {
          return (conn as { sendMessagePromise: (msg: Record<string, unknown>) => Promise<unknown> }).sendMessagePromise(msg);
        };
      }
      return undefined;
    },
  });
}

// For development: allow setting hass from console
(window as unknown as Record<string, unknown>).__setHass = (hass: unknown) => {
  useStore.getState().setHass(hass as never);
};

// HA embed_iframe panels receive messages like:
// { id: N, type: "result", result: { hass, panel } }
window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;

  // Direct hass object injection
  if (data.hass) {
    useStore.getState().setHass(data.hass);
    if (data.panel?.config?.entry_id) {
      useStore.getState().setEntryId(data.panel.config.entry_id);
    }
  }
});

pollForHass();

const entryId = extractEntryId();
if (entryId) {
  useStore.getState().setEntryId(entryId);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
