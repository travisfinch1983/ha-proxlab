/**
 * ProxLab Server config node — manages a persistent WebSocket connection
 * to a Home Assistant instance for all ProxLab nodes.
 */
const WebSocket = require("ws");

module.exports = function (RED) {
  function ProxLabServerNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    node.url = config.url; // e.g. ws://10.0.0.2:8123/api/websocket
    node.token = node.credentials.token || "";
    node._ws = null;
    node._msgId = 1;
    node._pending = new Map(); // msgId -> { resolve, reject, timeout }
    node._subscribers = new Map(); // event subscription callbacks
    node._authenticated = false;
    node._reconnectTimer = null;
    node._closing = false;

    /**
     * Send a WS message and return a promise for the result.
     */
    node.callWS = function (type, params) {
      return new Promise((resolve, reject) => {
        if (!node._ws || node._ws.readyState !== WebSocket.OPEN || !node._authenticated) {
          return reject(new Error("Not connected to Home Assistant"));
        }
        const id = node._msgId++;
        const msg = { id, type, ...params };
        const timeout = setTimeout(() => {
          node._pending.delete(id);
          reject(new Error(`WS call ${type} timed out after 30s`));
        }, 30000);
        node._pending.set(id, { resolve, reject, timeout });
        node._ws.send(JSON.stringify(msg));
      });
    };

    /**
     * Subscribe to HA events and call handler for each.
     */
    node.subscribeEvents = function (eventType, handler) {
      const key = `event_${node._msgId}`;
      const id = node._msgId++;

      if (node._ws && node._ws.readyState === WebSocket.OPEN && node._authenticated) {
        node._ws.send(
          JSON.stringify({
            id,
            type: "subscribe_events",
            event_type: eventType,
          })
        );
      }

      node._subscribers.set(id, handler);
      return function unsubscribe() {
        node._subscribers.delete(id);
      };
    };

    function connect() {
      if (node._closing) return;
      if (node._ws) {
        try { node._ws.close(); } catch { /* ignore */ }
      }

      node.log(`Connecting to ${node.url}`);
      const ws = new WebSocket(node.url);
      node._ws = ws;

      ws.on("open", () => {
        node.log("WebSocket connected");
      });

      ws.on("message", (data) => {
        let msg;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          return;
        }

        // Auth flow
        if (msg.type === "auth_required") {
          ws.send(JSON.stringify({ type: "auth", access_token: node.token }));
          return;
        }
        if (msg.type === "auth_ok") {
          node._authenticated = true;
          node.log("Authenticated with Home Assistant");
          return;
        }
        if (msg.type === "auth_invalid") {
          node.error("Authentication failed: " + (msg.message || "invalid token"));
          node._authenticated = false;
          return;
        }

        // Result for a pending callWS
        if (msg.id && node._pending.has(msg.id)) {
          const { resolve, reject, timeout } = node._pending.get(msg.id);
          clearTimeout(timeout);
          node._pending.delete(msg.id);
          if (msg.type === "result") {
            if (msg.success) {
              resolve(msg.result);
            } else {
              reject(new Error(msg.error?.message || "WS call failed"));
            }
          }
          return;
        }

        // Event subscription callback
        if (msg.type === "event" && msg.id && node._subscribers.has(msg.id)) {
          const handler = node._subscribers.get(msg.id);
          if (handler) handler(msg.event);
          return;
        }
      });

      ws.on("close", () => {
        node._authenticated = false;
        node.log("WebSocket closed");
        if (!node._closing) {
          node._reconnectTimer = setTimeout(connect, 5000);
        }
      });

      ws.on("error", (err) => {
        node.error("WebSocket error: " + err.message);
      });
    }

    connect();

    node.on("close", (done) => {
      node._closing = true;
      clearTimeout(node._reconnectTimer);
      // Clean up pending
      for (const [, { reject, timeout }] of node._pending) {
        clearTimeout(timeout);
        reject(new Error("Node closing"));
      }
      node._pending.clear();
      node._subscribers.clear();
      if (node._ws) {
        node._ws.close();
        node._ws = null;
      }
      done();
    });
  }

  RED.nodes.registerType("proxlab-server", ProxLabServerNode, {
    credentials: {
      token: { type: "password" },
    },
  });
};
