/**
 * ProxLab Invoke node — invokes a ProxLab agent via the HA WebSocket API.
 *
 * Input:  msg.payload (string) = message to send to the agent
 *         msg.context (object, optional) = additional context
 *         msg.agent_id (string, optional) = override configured agent
 * Output: msg.payload = agent response text
 *         msg.proxlab = full invocation result
 */
module.exports = function (RED) {
  function ProxLabInvokeNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const server = RED.nodes.getNode(config.server);

    node.agentId = config.agentId || "";
    node.messageTemplate = config.messageTemplate || "";
    node.includeHistory = config.includeHistory || false;

    if (!server) {
      node.status({ fill: "red", shape: "ring", text: "no server" });
      return;
    }

    node.status({ fill: "green", shape: "dot", text: "ready" });

    node.on("input", async function (msg, send, done) {
      const agentId = msg.agent_id || node.agentId;
      if (!agentId) {
        node.status({ fill: "red", shape: "dot", text: "no agent" });
        done(new Error("No agent_id specified"));
        return;
      }

      // Build message: use msg.payload, or template, or fallback
      let message = "";
      if (typeof msg.payload === "string" && msg.payload.trim()) {
        message = msg.payload;
      } else if (node.messageTemplate) {
        message = node.messageTemplate;
      } else {
        message = JSON.stringify(msg.payload);
      }

      const params = {
        agent_id: agentId,
        message: message,
      };

      if (msg.context && typeof msg.context === "object") {
        params.context = msg.context;
      }
      if (msg.conversation_id) {
        params.conversation_id = msg.conversation_id;
      }
      if (node.includeHistory) {
        params.include_history = true;
      }

      node.status({ fill: "blue", shape: "dot", text: "invoking..." });

      try {
        const result = await server.callWS("proxlab/agent/invoke", params);

        msg.payload = result.response_text || "";
        msg.proxlab = {
          agent_id: result.agent_id,
          agent_name: result.agent_name,
          model: result.model,
          tokens: result.tokens,
          duration_ms: result.duration_ms,
          tool_results: result.tool_results,
          success: result.success,
        };

        node.status({
          fill: result.success ? "green" : "yellow",
          shape: "dot",
          text: `${result.agent_name} (${result.duration_ms}ms)`,
        });

        send(msg);
        done();
      } catch (err) {
        node.status({ fill: "red", shape: "dot", text: err.message });
        done(err);
      }
    });
  }

  RED.nodes.registerType("proxlab-invoke", ProxLabInvokeNode);
};
