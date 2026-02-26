/**
 * ProxLab Listen node — subscribes to ProxLab agent invocation events
 * from Home Assistant via the WebSocket API.
 *
 * Output: msg.payload = event data (agent_id, response_text, tokens, etc.)
 *         msg.topic = event type
 */
module.exports = function (RED) {
  function ProxLabListenNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const server = RED.nodes.getNode(config.server);

    node.eventType = config.eventType || "proxlab_agent_invoked";
    node.filterAgent = config.filterAgent || "";

    if (!server) {
      node.status({ fill: "red", shape: "ring", text: "no server" });
      return;
    }

    let unsubscribe = null;

    function startListening() {
      node.status({ fill: "yellow", shape: "dot", text: "subscribing..." });

      // Wait for authentication
      const checkAuth = setInterval(() => {
        if (server._authenticated) {
          clearInterval(checkAuth);
          doSubscribe();
        }
      }, 500);

      // Timeout after 30s
      setTimeout(() => clearInterval(checkAuth), 30000);
    }

    function doSubscribe() {
      unsubscribe = server.subscribeEvents(node.eventType, (event) => {
        const data = event.data || {};

        // Apply agent filter if configured
        if (node.filterAgent && data.agent_id !== node.filterAgent) {
          return;
        }

        const msg = {
          payload: data,
          topic: node.eventType,
          event_type: event.event_type,
          time_fired: event.time_fired,
        };

        node.status({
          fill: "green",
          shape: "dot",
          text: `${data.agent_name || data.agent_id || "agent"} (${new Date().toLocaleTimeString()})`,
        });

        node.send(msg);
      });

      node.status({
        fill: "green",
        shape: "dot",
        text: `listening: ${node.eventType}`,
      });
    }

    startListening();

    node.on("close", function (done) {
      if (unsubscribe) unsubscribe();
      done();
    });
  }

  RED.nodes.registerType("proxlab-listen", ProxLabListenNode);
};
