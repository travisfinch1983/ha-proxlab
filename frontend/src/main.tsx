import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useStore } from "./store";
import type { Hass } from "./types";
import App from "./App";
import "./app.css";

/**
 * HA iframe panel connection bridge.
 *
 * Creates a DEDICATED WebSocket connection to HA rather than sharing
 * the parent frame's conn (which is congested by entity state
 * subscriptions). This keeps ProxLab's WS commands responsive.
 *
 * Reconnection silently replaces the callWS function without
 * triggering a React re-render cascade.
 */

function extractEntryId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("entry_id") || null;
}

interface HassAuth {
  data: { access_token: string; hassUrl: string };
}

interface HassConn {
  sendMessagePromise: (msg: Record<string, unknown>) => Promise<unknown>;
}

// Mutable reference to the current callWS — survives reconnects
let _callWS: ((msg: Record<string, unknown>) => Promise<unknown>) | null =
  null;
let _hassInitialized = false;

/** Create a dedicated WebSocket to HA and return a callWS function. */
function createDedicatedConnection(
  hassUrl: string,
  accessToken: string
): Promise<(msg: Record<string, unknown>) => Promise<unknown>> {
  return new Promise((resolve, reject) => {
    const wsUrl = hassUrl.replace(/^http/, "ws") + "/api/websocket";
    const ws = new WebSocket(wsUrl);

    let msgId = 1;
    const pending = new Map<
      number,
      { resolve: (v: unknown) => void; reject: (e: Error) => void }
    >();
    let authenticated = false;
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    ws.onmessage = (event) => {
      let data: {
        type: string;
        id?: number;
        result?: unknown;
        success?: boolean;
        error?: { message: string };
      };
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.type === "auth_required") {
        ws.send(JSON.stringify({ type: "auth", access_token: accessToken }));
        return;
      }

      if (data.type === "auth_ok") {
        authenticated = true;

        // Start keepalive pings every 30s to prevent idle disconnect
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const id = msgId++;
            ws.send(JSON.stringify({ type: "ping", id }));
          }
        }, 30000);

        const callWS = (msg: Record<string, unknown>): Promise<unknown> => {
          const id = msgId++;
          return new Promise((res, rej) => {
            pending.set(id, { resolve: res, reject: rej });
            ws.send(JSON.stringify({ ...msg, id }));
          });
        };
        resolve(callWS);
        return;
      }

      if (data.type === "auth_invalid") {
        reject(
          new Error(
            "HA auth failed: " +
              (data as { message?: string }).message
          )
        );
        return;
      }

      // Handle command responses (result + pong)
      if (
        (data.type === "result" || data.type === "pong") &&
        data.id != null
      ) {
        const p = pending.get(data.id);
        if (p) {
          pending.delete(data.id);
          if (data.type === "pong" || data.success) {
            p.resolve(data.result);
          } else {
            p.reject(
              new Error(data.error?.message || "WS command failed")
            );
          }
        }
      }
    };

    ws.onerror = () => {
      reject(new Error("WebSocket connection error"));
    };

    ws.onclose = () => {
      if (pingInterval) clearInterval(pingInterval);
      // Reject all pending promises
      for (const [, p] of pending) {
        p.reject(new Error("WebSocket closed"));
      }
      pending.clear();
      // Reconnect silently (don't re-trigger setHass)
      if (authenticated) {
        console.warn("ProxLab: WS closed, reconnecting in 2s...");
        setTimeout(() => reconnectWS(), 2000);
      }
    };
  });
}

/** Reconnect the dedicated WS without triggering a full React re-render. */
async function reconnectWS(): Promise<void> {
  try {
    const parent = window.parent as unknown as Record<string, unknown>;
    const hassConnectionPromise = parent.hassConnection as
      | Promise<{ auth: HassAuth; conn: HassConn }>
      | undefined;
    if (!hassConnectionPromise) return;

    const { auth } = await hassConnectionPromise;
    const hassUrl = auth.data.hassUrl || window.location.origin;
    const token = auth.data.access_token;

    _callWS = await createDedicatedConnection(hassUrl, token);
  } catch (err) {
    console.error("ProxLab: WS reconnect failed:", err);
    setTimeout(reconnectWS, 5000);
  }
}

async function connectToHA(): Promise<void> {
  const store = useStore.getState();

  const entryId = extractEntryId();
  if (entryId) {
    store.setEntryId(entryId);
  }

  try {
    const parent = window.parent as unknown as Record<string, unknown>;
    const hassConnectionPromise = parent.hassConnection as
      | Promise<{ auth: HassAuth; conn: HassConn }>
      | undefined;

    if (!hassConnectionPromise) {
      throw new Error("hassConnection not found on parent frame.");
    }

    const { auth } = await hassConnectionPromise;
    const hassUrl = auth.data.hassUrl || window.location.origin;
    const token = auth.data.access_token;

    _callWS = await createDedicatedConnection(hassUrl, token);

    // Proxy callWS through a stable reference so reconnections
    // seamlessly swap the underlying function.
    const proxyCallWS = (msg: Record<string, unknown>): Promise<unknown> => {
      if (!_callWS) return Promise.reject(new Error("Not connected"));
      return _callWS(msg);
    };

    if (!_hassInitialized) {
      _hassInitialized = true;
      store.setHass({
        callWS: proxyCallWS as Hass["callWS"],
        states: {},
        user: { id: "", name: "", is_admin: true },
        language: "en",
      });
    }
  } catch (err) {
    console.error("ProxLab: Failed to connect to HA:", err);
    setTimeout(connectToHA, 2000);
  }
}

connectToHA();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
