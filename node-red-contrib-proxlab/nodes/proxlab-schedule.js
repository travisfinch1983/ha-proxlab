/**
 * ProxLab Schedule node — manage scheduled agent invocations on Home Assistant.
 *
 * Actions: list, create, update, delete
 * Input:  msg.action (override), msg.payload (schedule data)
 * Output: msg.payload = result from HA
 */
module.exports = function (RED) {
  function ProxLabScheduleNode(config) {
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
            result = await server.callWS("proxlab/agent/schedules/list", {});
            break;

          case "create": {
            const data = msg.payload || {};
            if (!data.agent_id) {
              throw new Error("create requires payload.agent_id");
            }
            const params = { agent_id: data.agent_id };
            if (data.schedule_type) params.schedule_type = data.schedule_type;
            if (data.schedule_config) params.schedule_config = data.schedule_config;
            if (data.message_template) params.message_template = data.message_template;
            if (data.context_template) params.context_template = data.context_template;
            if (data.cooldown_seconds != null) params.cooldown_seconds = data.cooldown_seconds;
            if (data.enabled != null) params.enabled = data.enabled;
            result = await server.callWS("proxlab/agent/schedules/create", params);
            break;
          }

          case "update": {
            const data = msg.payload || {};
            const schedId = data.schedule_id || msg.schedule_id;
            if (!schedId) {
              throw new Error("update requires schedule_id");
            }
            const params = { schedule_id: schedId };
            if (data.agent_id) params.agent_id = data.agent_id;
            if (data.schedule_type) params.schedule_type = data.schedule_type;
            if (data.schedule_config) params.schedule_config = data.schedule_config;
            if (data.message_template != null) params.message_template = data.message_template;
            if (data.context_template !== undefined) params.context_template = data.context_template;
            if (data.cooldown_seconds != null) params.cooldown_seconds = data.cooldown_seconds;
            if (data.enabled != null) params.enabled = data.enabled;
            result = await server.callWS("proxlab/agent/schedules/update", params);
            break;
          }

          case "delete": {
            const schedId =
              (typeof msg.payload === "object" && msg.payload.schedule_id) ||
              msg.schedule_id ||
              (typeof msg.payload === "string" ? msg.payload : null);
            if (!schedId) {
              throw new Error("delete requires schedule_id");
            }
            result = await server.callWS("proxlab/agent/schedules/delete", {
              schedule_id: schedId,
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

  RED.nodes.registerType("proxlab-schedule", ProxLabScheduleNode);
};
