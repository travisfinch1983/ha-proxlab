"""Orchestrator routing mixin for ProxLabAgent.

Provides intent classification via the orchestrator agent's LLM, which uses a
``route_to_agent`` function-call tool to select the best specialized agent for
each user request.  The result is an ``AgentContext`` that carries the target
agent's LLM config, system prompt, and allowed tools through the pipeline.

If the orchestrator is not configured (no connection assigned) or classification
fails, the caller falls back to the default conversation agent behaviour.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from ..agent_prompts import get_default_prompt
from ..connection_manager import resolve_agent_to_flat_config
from ..const import (
    AGENT_CONVERSATION,
    AGENT_DEFINITIONS,
    AGENT_ORCHESTRATOR,
    AGENT_TOOL_MAP,
    CONF_AGENTS,
    CONF_LLM_MODEL,
    EVENT_ORCHESTRATOR_ROUTED,
    ROUTABLE_AGENTS,
    TOOL_ROUTE_TO_AGENT,
)

_LOGGER = logging.getLogger(__name__)


@dataclass
class AgentContext:
    """Carries resolved agent configuration through the processing pipeline."""

    agent_id: str
    flat_config: dict[str, Any]
    system_prompt: str
    tool_names: list[str] | None  # None=all registered, []=none
    routing_reason: str = ""
    orchestrator_model: str = ""
    orchestrator_duration_ms: int = 0
    orchestrator_tokens: dict[str, int] = field(
        default_factory=lambda: {"prompt": 0, "completion": 0, "total": 0}
    )


class OrchestratorMixin:
    """Mixin that adds orchestrator-based intent routing.

    Expected host-class attributes (provided by ProxLabAgent):
        config, hass, tool_handler, _call_llm
    """

    config: dict[str, Any]
    hass: Any

    # -- public helpers -------------------------------------------------------

    def _is_orchestrator_enabled(self) -> bool:
        """Return True if the orchestrator agent has a connection assigned."""
        return resolve_agent_to_flat_config(self.config, AGENT_ORCHESTRATOR) is not None

    # -- internal helpers -----------------------------------------------------

    def _get_routable_agents(self) -> list[dict[str, str]]:
        """Return list of agents that the orchestrator can route to.

        Only includes agents whose definition exists AND that are either
        mandatory or explicitly enabled in the agent config.
        """
        agents_cfg = self.config.get(CONF_AGENTS, {})
        result: list[dict[str, str]] = []
        for agent_id in ROUTABLE_AGENTS:
            defn = AGENT_DEFINITIONS.get(agent_id)
            if defn is None:
                continue
            # Mandatory agents are always available; optional ones need enabled=True
            if not defn.mandatory:
                acfg = agents_cfg.get(agent_id, {})
                if not acfg.get("enabled", False):
                    continue
            result.append(
                {
                    "id": agent_id,
                    "name": defn.name,
                    "description": defn.description,
                }
            )
        return result

    def _build_route_to_agent_tool(
        self, routable: list[dict[str, str]]
    ) -> dict[str, Any]:
        """Build the ``route_to_agent`` function-call tool definition.

        The ``agent_id`` parameter uses an ``enum`` populated with the IDs of
        currently routable agents so the LLM can only pick valid targets.
        """
        agent_enum = [a["id"] for a in routable]
        agent_descriptions = "\n".join(
            f"- {a['id']}: {a['name']} — {a['description']}" for a in routable
        )
        return {
            "type": "function",
            "function": {
                "name": TOOL_ROUTE_TO_AGENT,
                "description": (
                    "Route the user's request to the most appropriate specialized agent.\n\n"
                    "Available agents:\n" + agent_descriptions
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "agent_id": {
                            "type": "string",
                            "enum": agent_enum,
                            "description": "The ID of the agent to route to.",
                        },
                        "reason": {
                            "type": "string",
                            "description": "Brief explanation of why this agent was chosen.",
                        },
                    },
                    "required": ["agent_id", "reason"],
                },
            },
        }

    def _get_agent_system_prompt(self, agent_id: str) -> str:
        """Return the system prompt for *agent_id*.

        Prefers a user-configured custom prompt; falls back to the default
        prompt from ``agent_prompts.py``.
        """
        agents_cfg = self.config.get(CONF_AGENTS, {})
        custom = agents_cfg.get(agent_id, {}).get("system_prompt")
        if custom:
            return custom
        return get_default_prompt(agent_id)

    def _build_agent_context(
        self, agent_id: str, reason: str = ""
    ) -> AgentContext:
        """Build an ``AgentContext`` for *agent_id*.

        Falls back to the conversation agent's LLM config when the target agent
        has no connection of its own.
        """
        flat = resolve_agent_to_flat_config(self.config, agent_id)
        if flat is None:
            # Use conversation agent's config as fallback
            flat = resolve_agent_to_flat_config(self.config, AGENT_CONVERSATION)
        if flat is None:
            # Ultimate fallback: use whatever is in self.config already
            flat = {}

        prompt = self._get_agent_system_prompt(agent_id)
        tool_names = AGENT_TOOL_MAP.get(agent_id)

        return AgentContext(
            agent_id=agent_id,
            flat_config=flat,
            system_prompt=prompt,
            tool_names=tool_names,
            routing_reason=reason,
        )

    # -- main entry point -----------------------------------------------------

    async def _orchestrator_classify(
        self, user_message: str
    ) -> AgentContext | None:
        """Classify user intent via the orchestrator's LLM.

        Returns an ``AgentContext`` for the target agent, or ``None`` on any
        failure (caller should fall back to default behaviour).
        """
        # 1. Resolve orchestrator's own LLM config
        orch_config = resolve_agent_to_flat_config(
            self.config, AGENT_ORCHESTRATOR
        )
        if orch_config is None:
            _LOGGER.debug("Orchestrator has no connection — skipping routing")
            return None

        # 2. Build routable agent list & tool
        routable = self._get_routable_agents()
        if not routable:
            _LOGGER.warning("No routable agents available — skipping routing")
            return None

        route_tool = self._build_route_to_agent_tool(routable)

        # 3. Build messages
        system_prompt = self._get_agent_system_prompt(AGENT_ORCHESTRATOR)
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        # 4. Call orchestrator LLM (non-streaming, with route_to_agent tool)
        #    Use tool_choice="required" to force the model to always produce
        #    a route_to_agent call rather than answering directly.
        orch_start = time.time()
        try:
            response = await self._call_llm(  # type: ignore[attr-defined]
                messages,
                tools=[route_tool],
                config_override=orch_config,
                tool_choice="required",
            )
        except Exception:
            _LOGGER.warning(
                "Orchestrator LLM call failed", exc_info=True
            )
            return None
        orch_duration_ms = int((time.time() - orch_start) * 1000)

        # Extract token usage from orchestrator response
        orch_usage = response.get("usage", {})
        orch_tokens = {
            "prompt": orch_usage.get("prompt_tokens", 0),
            "completion": orch_usage.get("completion_tokens", 0),
            "total": orch_usage.get("total_tokens", 0),
        }

        # 5. Parse the tool call from the response
        choices = response.get("choices")
        if not choices:
            _LOGGER.warning("Orchestrator response has no choices")
            return None
        message = choices[0].get("message") if choices[0] else None
        if message is None:
            message = {}
        tool_calls = message.get("tool_calls") or []

        if not tool_calls:
            _LOGGER.warning(
                "Orchestrator did not return a tool call — content: %s",
                str(message.get("content", ""))[:200],
            )
            return None

        # Use the first route_to_agent call
        for tc in tool_calls:
            fn = tc.get("function", {})
            if fn.get("name") != TOOL_ROUTE_TO_AGENT:
                continue
            try:
                args_raw = fn.get("arguments", "{}")
                args = json.loads(args_raw) if isinstance(args_raw, str) else args_raw
            except (json.JSONDecodeError, TypeError):
                _LOGGER.warning("Failed to parse route_to_agent arguments")
                return None

            target_id = args.get("agent_id", "")
            reason = args.get("reason", "")

            # Validate target
            valid_ids = {a["id"] for a in routable}
            if target_id not in valid_ids:
                _LOGGER.warning(
                    "Orchestrator routed to unknown agent '%s' — falling back",
                    target_id,
                )
                return None

            _LOGGER.info(
                "Orchestrator routed to '%s': %s", target_id, reason
            )

            # Fire event for debug panel
            self.hass.bus.async_fire(  # type: ignore[attr-defined]
                EVENT_ORCHESTRATOR_ROUTED,
                {
                    "target_agent": target_id,
                    "reason": reason,
                    "user_message": user_message[:200],
                },
            )

            ctx = self._build_agent_context(target_id, reason)
            ctx.orchestrator_model = orch_config.get(CONF_LLM_MODEL, "unknown")
            ctx.orchestrator_duration_ms = orch_duration_ms
            ctx.orchestrator_tokens = orch_tokens
            return ctx

        _LOGGER.warning("No route_to_agent tool call found in orchestrator response")
        return None
