/**
 * ProxLab Chain node — manage and run agent chains on Home Assistant.
 *
 * Actions: list, create, update, delete, run
 * Input:  msg.action (override), msg.payload (chain data or run params)
 * Output: msg.payload = result from HA
 */
module.exports = function (RED) {
  function ProxLabChainNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const server = RED.nodes.getNode(config.server);

    node.action = config.action || "run";
    node.chainId = config.chainId || "";

    if (!server) {
      node.status({ fill: "red", shape: "ring", text: "no server" });
      return;
    }

    node.status({ fill: "green", shape: "dot", text: "ready" });

    node.on("input", async function (msg, send, done) {
      const action = msg.action || node.action;

      node.status({ fill: "blue", shape: "dot", text: `${action}...` });

      try {
        let result;

        switch (action) {
          case "list":
            result = await server.callWS("proxlab/agent/chains/list", {});
            break;

          case "create": {
            const data = msg.payload || {};
            if (!data.steps || !Array.isArray(data.steps)) {
              throw new Error("create requires payload.steps (array)");
            }
            const params = { steps: data.steps };
            if (data.name) params.name = data.name;
            if (data.enabled != null) params.enabled = data.enabled;
            result = await server.callWS("proxlab/agent/chains/create", params);
            break;
          }

          case "update": {
            const data = msg.payload || {};
            const chainId = data.chain_id || msg.chain_id;
            if (!chainId) {
              throw new Error("update requires chain_id");
            }
            const params = { chain_id: chainId };
            if (data.name) params.name = data.name;
            if (data.steps) params.steps = data.steps;
            if (data.enabled != null) params.enabled = data.enabled;
            result = await server.callWS("proxlab/agent/chains/update", params);
            break;
          }

          case "delete": {
            const chainId =
              (typeof msg.payload === "object" && msg.payload.chain_id) ||
              msg.chain_id ||
              (typeof msg.payload === "string" ? msg.payload : null);
            if (!chainId) {
              throw new Error("delete requires chain_id");
            }
            result = await server.callWS("proxlab/agent/chains/delete", {
              chain_id: chainId,
            });
            break;
          }

          case "run": {
            const chainId =
              msg.chain_id ||
              (typeof msg.payload === "object" && msg.payload.chain_id) ||
              node.chainId;
            if (!chainId) {
              throw new Error("run requires chain_id (config, msg.chain_id, or msg.payload.chain_id)");
            }
            const params = { chain_id: chainId };
            // Message can come from payload string, payload.initial_message, or payload.message
            if (typeof msg.payload === "string") {
              params.initial_message = msg.payload;
            } else if (msg.payload && typeof msg.payload === "object") {
              if (msg.payload.initial_message) params.initial_message = msg.payload.initial_message;
              else if (msg.payload.message) params.initial_message = msg.payload.message;
              if (msg.payload.initial_context) params.initial_context = msg.payload.initial_context;
              else if (msg.context && typeof msg.context === "object") params.initial_context = msg.context;
            }
            result = await server.callWS("proxlab/agent/chains/run", params);

            // Enhance output for run results
            msg.chain_id = chainId;
            msg.proxlab = result;
            // Set payload to final step response for easy chaining
            if (result && Array.isArray(result.steps)) {
              const lastStep = result.steps[result.steps.length - 1];
              msg.payload = lastStep ? lastStep.response_text || "" : "";
            } else {
              msg.payload = result;
            }

            node.status({
              fill: result && result.success ? "green" : "yellow",
              shape: "dot",
              text: `run OK (${new Date().toLocaleTimeString()})`,
            });
            send(msg);
            done();
            return;
          }

          default:
            throw new Error(`Unknown action: ${action}`);
        }

        msg.payload = result;
        node.status({
          fill: "green",
          shape: "dot",
          text: `${action} OK (${new Date().toLocaleTimeString()})`,
        });
        send(msg);
        done();
      } catch (err) {
        node.status({ fill: "red", shape: "dot", text: err.message });
        done(err);
      }
    });
  }

  RED.nodes.registerType("proxlab-chain", ProxLabChainNode);
};
