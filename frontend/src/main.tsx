import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useStore } from "./store";
import App from "./App";
import "./app.css";

/**
 * HA iframe panel connection bridge.
 *
 * We're loaded as a built-in "iframe" panel from the same origin as HA,
 * so we can access window.parent.hassConnection directly. This is a
 * Promise<{ auth, conn }> set by the HA frontend.
 *
 * conn.sendMessagePromise(msg) sends a WS command and returns the result.
 */

function extractEntryId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("entry_id") || null;
}

interface HassConn {
  sendMessagePromise: (
    msg: Record<string, unknown>
  ) => Promise<unknown>;
}

interface HassAuth {
  data: { access_token: string; hassUrl: string };
}

async function connectToHA(): Promise<void> {
  const store = useStore.getState();

  // Set entry ID from URL params
  const entryId = extractEntryId();
  if (entryId) {
    store.setEntryId(entryId);
  }

  try {
    // Access parent frame's hassConnection (same-origin)
    const parent = window.parent as unknown as Record<string, unknown>;
    const hassConnectionPromise = parent.hassConnection as
      | Promise<{ auth: HassAuth; conn: HassConn }>
      | undefined;

    if (!hassConnectionPromise) {
      throw new Error(
        "hassConnection not found on parent frame. " +
          "Make sure the panel is loaded within Home Assistant."
      );
    }

    const { conn } = await hassConnectionPromise;

    // Build a hass-like object with callWS for our api.ts
    const hass = {
      callWS: async <T,>(msg: Record<string, unknown>): Promise<T> => {
        return conn.sendMessagePromise(msg) as Promise<T>;
      },
      // Minimal stubs for the Hass interface
      states: {},
      user: { id: "", name: "", is_admin: true },
      language: "en",
    };

    store.setHass(hass);
  } catch (err) {
    console.error("ProxLab: Failed to connect to HA:", err);
    // Retry after a short delay (HA might still be initializing)
    setTimeout(connectToHA, 1000);
  }
}

connectToHA();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
