/**
 * ProxLab Subscribe node — manage event subscriptions on Home Assistant.
 *
 * Actions: list, create, update, delete
 * Input:  msg.action (override), msg.payload (subscription data)
 * Output: msg.payload = result from HA
 */
module.exports = function (RED) {
  function ProxLabSubscribeNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    const server = RED.nodes.getNode(config.server);

    node.action = config.action || "list";

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
            result = await server.callWS("proxlab/agent/subscriptions/list", {});
            break;

          case "create": {
            const data = msg.payload || {};
            if (!data.event_type || !data.agent_id) {
              throw new Error("create requires payload.event_type and payload.agent_id");
            }
            const params = {
              event_type: data.event_type,
              agent_id: data.agent_id,
            };
            if (data.event_filter) params.event_filter = data.event_filter;
            if (data.message_template) params.message_template = data.message_template;
            if (data.context_template) params.context_template = data.context_template;
            if (data.cooldown_seconds != null) params.cooldown_seconds = data.cooldown_seconds;
            if (data.enabled != null) params.enabled = data.enabled;
            result = await server.callWS("proxlab/agent/subscriptions/create", params);
            break;
          }

          case "update": {
            const data = msg.payload || {};
            const subId = data.subscription_id || msg.subscription_id;
            if (!subId) {
              throw new Error("update requires subscription_id");
            }
            const params = { subscription_id: subId };
            if (data.event_type) params.event_type = data.event_type;
            if (data.agent_id) params.agent_id = data.agent_id;
            if (data.event_filter) params.event_filter = data.event_filter;
            if (data.message_template != null) params.message_template = data.message_template;
            if (data.context_template !== undefined) params.context_template = data.context_template;
            if (data.cooldown_seconds != null) params.cooldown_seconds = data.cooldown_seconds;
            if (data.enabled != null) params.enabled = data.enabled;
            result = await server.callWS("proxlab/agent/subscriptions/update", params);
            break;
          }

          case "delete": {
            const subId =
              (typeof msg.payload === "object" && msg.payload.subscription_id) ||
              msg.subscription_id ||
              (typeof msg.payload === "string" ? msg.payload : null);
            if (!subId) {
              throw new Error("delete requires subscription_id");
            }
            result = await server.callWS("proxlab/agent/subscriptions/delete", {
              subscription_id: subId,
            });
            break;
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

  RED.nodes.registerType("proxlab-subscribe", ProxLabSubscribeNode);
};
