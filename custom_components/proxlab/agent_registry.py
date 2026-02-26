"""Agent Registry — reactive layer for event-driven agent invocation.

Manages three primitives:
- Subscriptions: react to HA events and invoke agents
- Schedules: periodic agent invocations (interval or time-of-day)
- Chains: sequential agent pipelines where output feeds into the next step
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, cast

from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers.event import (
    async_track_time_change,
    async_track_time_interval,
)
from homeassistant.helpers.storage import Store

from .const import (
    AGENT_REGISTRY_STORAGE_KEY,
    AGENT_REGISTRY_STORAGE_VERSION,
    DEFAULT_CHAIN_STEP_TIMEOUT,
    DEFAULT_MAX_CONCURRENT_INVOCATIONS,
    DEFAULT_SCHEDULE_COOLDOWN,
    DEFAULT_SUBSCRIPTION_COOLDOWN,
    DOMAIN,
    EVENT_CHAIN_STEP,
    EVENT_SCHEDULE_TRIGGERED,
    EVENT_SUBSCRIPTION_TRIGGERED,
    SCHEDULE_TYPE_INTERVAL,
    SCHEDULE_TYPE_TIME_OF_DAY,
)

_LOGGER = logging.getLogger(__name__)


def _ulid() -> str:
    """Generate a ULID-like unique ID (timestamp + random)."""
    import os
    import struct

    ts = int(time.time() * 1000)
    rand = os.urandom(10)
    # Encode timestamp (6 bytes) + random (10 bytes) as hex
    return struct.pack(">Q", ts)[-6:].hex() + rand.hex()


class AgentRegistry:
    """Central registry for event subscriptions, schedules, and chains."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self.hass = hass
        self.entry_id = entry_id
        self._store = Store(
            hass,
            AGENT_REGISTRY_STORAGE_VERSION,
            AGENT_REGISTRY_STORAGE_KEY,
        )

        # Data
        self._subscriptions: dict[str, dict[str, Any]] = {}
        self._schedules: dict[str, dict[str, Any]] = {}
        self._chains: dict[str, dict[str, Any]] = {}

        # Active listeners / cancel handles
        self._sub_unsubs: dict[str, CALLBACK_TYPE] = {}
        self._sched_unsubs: dict[str, CALLBACK_TYPE] = {}

        # Rate limiting
        self._semaphore = asyncio.Semaphore(DEFAULT_MAX_CONCURRENT_INVOCATIONS)
        self._cooldowns: dict[str, float] = {}  # item_id -> last_triggered timestamp

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def async_load(self) -> None:
        """Load persisted data and activate all enabled items."""
        data = await self._store.async_load()
        if data:
            self._subscriptions = data.get("subscriptions", {})
            self._schedules = data.get("schedules", {})
            self._chains = data.get("chains", {})

        # Activate enabled subscriptions
        for sub_id, sub in self._subscriptions.items():
            if sub.get("enabled", True):
                self._activate_subscription(sub_id, sub)

        # Activate enabled schedules
        for sched_id, sched in self._schedules.items():
            if sched.get("enabled", True):
                self._activate_schedule(sched_id, sched)

        _LOGGER.info(
            "AgentRegistry loaded: %d subscriptions, %d schedules, %d chains",
            len(self._subscriptions),
            len(self._schedules),
            len(self._chains),
        )

    async def async_shutdown(self) -> None:
        """Unsubscribe all listeners and cancel all schedules."""
        for unsub in self._sub_unsubs.values():
            unsub()
        self._sub_unsubs.clear()

        for unsub in self._sched_unsubs.values():
            unsub()
        self._sched_unsubs.clear()

        _LOGGER.info("AgentRegistry shut down")

    async def _async_save(self) -> None:
        """Persist current state."""
        await self._store.async_save({
            "subscriptions": self._subscriptions,
            "schedules": self._schedules,
            "chains": self._chains,
        })

    # ------------------------------------------------------------------
    # Subscriptions CRUD
    # ------------------------------------------------------------------

    async def create_subscription(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new event subscription."""
        sub_id = _ulid()
        sub = {
            "id": sub_id,
            "event_type": data["event_type"],
            "event_filter": data.get("event_filter", {}),
            "agent_id": data["agent_id"],
            "message_template": data.get("message_template", ""),
            "context_template": data.get("context_template"),
            "cooldown_seconds": data.get(
                "cooldown_seconds", DEFAULT_SUBSCRIPTION_COOLDOWN
            ),
            "enabled": data.get("enabled", True),
            "created_at": time.time(),
            "last_triggered": None,
            "trigger_count": 0,
        }
        self._subscriptions[sub_id] = sub

        if sub["enabled"]:
            self._activate_subscription(sub_id, sub)

        await self._async_save()
        return sub

    async def update_subscription(
        self, sub_id: str, updates: dict[str, Any]
    ) -> dict[str, Any]:
        """Update an existing subscription."""
        if sub_id not in self._subscriptions:
            raise ValueError(f"Subscription {sub_id} not found")

        sub = self._subscriptions[sub_id]
        sub.update(updates)

        # Deactivate and reactivate if needed
        if sub_id in self._sub_unsubs:
            self._sub_unsubs.pop(sub_id)()

        if sub.get("enabled", True):
            self._activate_subscription(sub_id, sub)

        await self._async_save()
        return sub

    async def delete_subscription(self, sub_id: str) -> None:
        """Delete a subscription."""
        if sub_id not in self._subscriptions:
            raise ValueError(f"Subscription {sub_id} not found")

        # Deactivate
        if sub_id in self._sub_unsubs:
            self._sub_unsubs.pop(sub_id)()

        del self._subscriptions[sub_id]
        self._cooldowns.pop(sub_id, None)
        await self._async_save()

    def list_subscriptions(self) -> list[dict[str, Any]]:
        """Return all subscriptions."""
        return list(self._subscriptions.values())

    # ------------------------------------------------------------------
    # Schedules CRUD
    # ------------------------------------------------------------------

    async def create_schedule(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new schedule."""
        sched_id = _ulid()
        sched = {
            "id": sched_id,
            "agent_id": data["agent_id"],
            "schedule_type": data.get("schedule_type", SCHEDULE_TYPE_INTERVAL),
            "schedule_config": data.get("schedule_config", {}),
            "message_template": data.get("message_template", ""),
            "context_template": data.get("context_template"),
            "cooldown_seconds": data.get(
                "cooldown_seconds", DEFAULT_SCHEDULE_COOLDOWN
            ),
            "enabled": data.get("enabled", True),
            "created_at": time.time(),
            "last_triggered": None,
            "trigger_count": 0,
        }
        self._schedules[sched_id] = sched

        if sched["enabled"]:
            self._activate_schedule(sched_id, sched)

        await self._async_save()
        return sched

    async def update_schedule(
        self, sched_id: str, updates: dict[str, Any]
    ) -> dict[str, Any]:
        """Update an existing schedule."""
        if sched_id not in self._schedules:
            raise ValueError(f"Schedule {sched_id} not found")

        sched = self._schedules[sched_id]
        sched.update(updates)

        # Deactivate and reactivate
        if sched_id in self._sched_unsubs:
            self._sched_unsubs.pop(sched_id)()

        if sched.get("enabled", True):
            self._activate_schedule(sched_id, sched)

        await self._async_save()
        return sched

    async def delete_schedule(self, sched_id: str) -> None:
        """Delete a schedule."""
        if sched_id not in self._schedules:
            raise ValueError(f"Schedule {sched_id} not found")

        if sched_id in self._sched_unsubs:
            self._sched_unsubs.pop(sched_id)()

        del self._schedules[sched_id]
        self._cooldowns.pop(sched_id, None)
        await self._async_save()

    def list_schedules(self) -> list[dict[str, Any]]:
        """Return all schedules."""
        return list(self._schedules.values())

    # ------------------------------------------------------------------
    # Chains CRUD
    # ------------------------------------------------------------------

    async def create_chain(self, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new chain."""
        chain_id = _ulid()
        chain = {
            "id": chain_id,
            "name": data.get("name", f"Chain {chain_id[:8]}"),
            "steps": data["steps"],
            "enabled": data.get("enabled", True),
            "created_at": time.time(),
            "last_run": None,
            "run_count": 0,
        }
        self._chains[chain_id] = chain
        await self._async_save()
        return chain

    async def update_chain(
        self, chain_id: str, updates: dict[str, Any]
    ) -> dict[str, Any]:
        """Update an existing chain."""
        if chain_id not in self._chains:
            raise ValueError(f"Chain {chain_id} not found")

        chain = self._chains[chain_id]
        chain.update(updates)
        await self._async_save()
        return chain

    async def delete_chain(self, chain_id: str) -> None:
        """Delete a chain."""
        if chain_id not in self._chains:
            raise ValueError(f"Chain {chain_id} not found")

        del self._chains[chain_id]
        await self._async_save()

    def list_chains(self) -> list[dict[str, Any]]:
        """Return all chains."""
        return list(self._chains.values())

    async def run_chain(
        self,
        chain_id: str,
        initial_message: str,
        initial_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute a chain sequentially, passing output between steps."""
        if chain_id not in self._chains:
            raise ValueError(f"Chain {chain_id} not found")

        chain = self._chains[chain_id]
        if not chain.get("enabled", True):
            return {"error": "Chain is disabled", "chain_id": chain_id}

        steps = chain["steps"]
        if not steps:
            return {"error": "Chain has no steps", "chain_id": chain_id}

        results: list[dict[str, Any]] = []
        previous_response = ""
        previous_tool_results: list[Any] = []

        for step_idx, step in enumerate(steps):
            agent_id = step["agent_id"]

            # Build template variables
            template_vars = {
                "initial_message": initial_message,
                "previous_response": previous_response,
                "previous_tool_results": json.dumps(previous_tool_results),
                "step_index": step_idx,
                "chain_name": chain["name"],
            }
            if initial_context:
                template_vars.update(initial_context)

            # Render message
            message = self._render_template(
                step.get("message_template", "{{ initial_message }}"),
                template_vars,
            )

            # Render context if provided
            context = None
            context_tmpl = step.get("context_template")
            if context_tmpl:
                try:
                    rendered = self._render_template(context_tmpl, template_vars)
                    context = json.loads(rendered)
                except (json.JSONDecodeError, Exception) as err:
                    _LOGGER.warning(
                        "Chain %s step %d: context template failed: %s",
                        chain_id, step_idx, err,
                    )

            # Build context from context_includes
            if context is None:
                context = {}
            context_includes = step.get("context_includes", [])
            if "response_text" in context_includes and previous_response:
                context["previous_response"] = previous_response
            if "tool_results" in context_includes and previous_tool_results:
                context["previous_tool_results"] = previous_tool_results

            # Fire chain step event
            self.hass.bus.async_fire(EVENT_CHAIN_STEP, {
                "chain_id": chain_id,
                "chain_name": chain["name"],
                "step_index": step_idx,
                "agent_id": agent_id,
                "status": "started",
            })

            # Invoke agent with timeout
            try:
                step_result = await asyncio.wait_for(
                    self._invoke_agent_safe(
                        agent_id=agent_id,
                        message=message,
                        context=context if context else None,
                    ),
                    timeout=DEFAULT_CHAIN_STEP_TIMEOUT,
                )
            except asyncio.TimeoutError:
                step_result = {
                    "error": f"Step {step_idx} timed out after {DEFAULT_CHAIN_STEP_TIMEOUT}s",
                    "agent_id": agent_id,
                }
                _LOGGER.warning(
                    "Chain %s step %d timed out", chain_id, step_idx
                )

            results.append(step_result)

            # Extract output for next step
            previous_response = step_result.get("response_text", "")
            previous_tool_results = step_result.get("tool_results", [])

            # Fire completion event
            self.hass.bus.async_fire(EVENT_CHAIN_STEP, {
                "chain_id": chain_id,
                "chain_name": chain["name"],
                "step_index": step_idx,
                "agent_id": agent_id,
                "status": "error" if "error" in step_result else "completed",
            })

            # Bail on error
            if "error" in step_result:
                break

        # Update chain stats
        chain["last_run"] = time.time()
        chain["run_count"] = chain.get("run_count", 0) + 1
        await self._async_save()

        return {
            "chain_id": chain_id,
            "chain_name": chain["name"],
            "steps_completed": len(results),
            "steps_total": len(steps),
            "results": results,
            "final_response": previous_response,
        }

    # ------------------------------------------------------------------
    # Activation (internal)
    # ------------------------------------------------------------------

    @callback
    def _activate_subscription(
        self, sub_id: str, sub: dict[str, Any]
    ) -> None:
        """Register a hass.bus listener for a subscription."""
        event_type = sub["event_type"]
        event_filter = sub.get("event_filter", {})

        @callback
        def _event_listener(event: Event) -> None:
            """Fast sync filter, then schedule async work."""
            if not self._matches_filter(event, event_filter):
                return

            # Cooldown check
            cooldown = sub.get("cooldown_seconds", DEFAULT_SUBSCRIPTION_COOLDOWN)
            now = time.time()
            last = self._cooldowns.get(sub_id, 0.0)
            if (now - last) < cooldown:
                _LOGGER.debug(
                    "Subscription %s: cooldown active (%.1fs remaining)",
                    sub_id, cooldown - (now - last),
                )
                return

            self._cooldowns[sub_id] = now

            # Schedule async invocation
            self.hass.async_create_task(
                self._handle_subscription_trigger(sub_id, sub, event)
            )

        unsub = self.hass.bus.async_listen(event_type, _event_listener)
        self._sub_unsubs[sub_id] = unsub
        _LOGGER.debug(
            "Activated subscription %s on event_type=%s", sub_id, event_type
        )

    async def _handle_subscription_trigger(
        self, sub_id: str, sub: dict[str, Any], event: Event
    ) -> None:
        """Handle a triggered subscription (async part)."""
        agent_id = sub["agent_id"]

        # Build template variables from event
        template_vars: dict[str, Any] = {
            "trigger": {
                "event_type": event.event_type,
                "entity_id": event.data.get("entity_id", ""),
            },
        }

        # For state_changed events, include state info
        if event.event_type == "state_changed":
            old_state = event.data.get("old_state")
            new_state = event.data.get("new_state")
            template_vars["trigger"]["to_state"] = {
                "state": new_state.state if new_state else "",
                "entity_id": new_state.entity_id if new_state else "",
                "attributes": dict(new_state.attributes) if new_state else {},
            } if new_state else {"state": "", "entity_id": "", "attributes": {}}
            template_vars["trigger"]["from_state"] = {
                "state": old_state.state if old_state else "",
                "entity_id": old_state.entity_id if old_state else "",
                "attributes": dict(old_state.attributes) if old_state else {},
            } if old_state else {"state": "", "entity_id": "", "attributes": {}}
            template_vars["trigger"]["entity_id"] = (
                new_state.entity_id if new_state else
                event.data.get("entity_id", "")
            )
        else:
            # Generic event data
            template_vars["trigger"].update(event.data)

        # Render message
        message = self._render_template(
            sub.get("message_template", "Event triggered"),
            template_vars,
        )

        # Render context
        context = None
        context_tmpl = sub.get("context_template")
        if context_tmpl:
            try:
                rendered = self._render_template(context_tmpl, template_vars)
                context = json.loads(rendered)
            except (json.JSONDecodeError, Exception) as err:
                _LOGGER.warning(
                    "Subscription %s: context template error: %s", sub_id, err
                )

        # Fire event
        self.hass.bus.async_fire(EVENT_SUBSCRIPTION_TRIGGERED, {
            "subscription_id": sub_id,
            "event_type": event.event_type,
            "agent_id": agent_id,
        })

        # Invoke agent
        result = await self._invoke_agent_safe(
            agent_id=agent_id,
            message=message,
            context=context,
        )

        # Update stats
        sub["last_triggered"] = time.time()
        sub["trigger_count"] = sub.get("trigger_count", 0) + 1
        await self._async_save()

        _LOGGER.info(
            "Subscription %s triggered agent %s (count=%d)",
            sub_id, agent_id, sub["trigger_count"],
        )

    @callback
    def _activate_schedule(
        self, sched_id: str, sched: dict[str, Any]
    ) -> None:
        """Register a time-based listener for a schedule."""
        schedule_type = sched.get("schedule_type", SCHEDULE_TYPE_INTERVAL)
        config = sched.get("schedule_config", {})

        async def _schedule_callback(_now: Any) -> None:
            """Handle schedule trigger."""
            # Cooldown check
            cooldown = sched.get("cooldown_seconds", DEFAULT_SCHEDULE_COOLDOWN)
            now = time.time()
            last = self._cooldowns.get(sched_id, 0.0)
            if (now - last) < cooldown:
                return

            self._cooldowns[sched_id] = now

            # Render message
            from datetime import datetime
            template_vars = {
                "schedule_id": sched_id,
                "now": datetime.now().isoformat(),
            }
            message = self._render_template(
                sched.get("message_template", "Scheduled invocation"),
                template_vars,
            )

            # Render context
            context = None
            context_tmpl = sched.get("context_template")
            if context_tmpl:
                try:
                    rendered = self._render_template(context_tmpl, template_vars)
                    context = json.loads(rendered)
                except (json.JSONDecodeError, Exception) as err:
                    _LOGGER.warning(
                        "Schedule %s: context template error: %s",
                        sched_id, err,
                    )

            # Fire event
            self.hass.bus.async_fire(EVENT_SCHEDULE_TRIGGERED, {
                "schedule_id": sched_id,
                "agent_id": sched["agent_id"],
                "schedule_type": schedule_type,
            })

            # Invoke
            await self._invoke_agent_safe(
                agent_id=sched["agent_id"],
                message=message,
                context=context,
            )

            # Update stats
            sched["last_triggered"] = time.time()
            sched["trigger_count"] = sched.get("trigger_count", 0) + 1
            await self._async_save()

            _LOGGER.info(
                "Schedule %s triggered agent %s (count=%d)",
                sched_id, sched["agent_id"], sched["trigger_count"],
            )

        if schedule_type == SCHEDULE_TYPE_INTERVAL:
            seconds = config.get("seconds", 1800)
            from datetime import timedelta
            unsub = async_track_time_interval(
                self.hass, _schedule_callback, timedelta(seconds=seconds)
            )
        elif schedule_type == SCHEDULE_TYPE_TIME_OF_DAY:
            hour = config.get("hour", 0)
            minute = config.get("minute", 0)
            second = config.get("second", 0)
            unsub = async_track_time_change(
                self.hass, _schedule_callback,
                hour=hour, minute=minute, second=second,
            )
        else:
            _LOGGER.error("Unknown schedule type: %s", schedule_type)
            return

        self._sched_unsubs[sched_id] = unsub
        _LOGGER.debug(
            "Activated schedule %s (type=%s)", sched_id, schedule_type
        )

    # ------------------------------------------------------------------
    # Agent invocation (safe wrapper)
    # ------------------------------------------------------------------

    async def _invoke_agent_safe(
        self,
        agent_id: str,
        message: str,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Invoke an agent with concurrency limiting and error handling."""
        async with self._semaphore:
            try:
                entry_data = self.hass.data.get(DOMAIN, {}).get(
                    self.entry_id, {}
                )
                agent = entry_data.get("agent")
                if agent is None:
                    return {
                        "error": "Agent not available (LLM not configured)",
                        "agent_id": agent_id,
                    }

                return await agent.invoke_agent(
                    agent_id=agent_id,
                    message=message,
                    context=context,
                )
            except Exception as err:
                _LOGGER.error(
                    "Agent invocation failed (%s): %s",
                    agent_id, err, exc_info=True,
                )
                return {
                    "error": str(err),
                    "agent_id": agent_id,
                }

    # ------------------------------------------------------------------
    # Template rendering
    # ------------------------------------------------------------------

    def _render_template(
        self, template_str: str, variables: dict[str, Any]
    ) -> str:
        """Render a Jinja2 template with the given variables.

        Uses HA's template engine for access to now(), states, etc.
        Falls back to simple variable substitution if HA templates fail.
        """
        if not template_str:
            return ""

        try:
            from homeassistant.helpers.template import Template

            tmpl = Template(template_str, self.hass)
            return tmpl.async_render(variables)
        except Exception:
            # Fall back to simple Jinja2 rendering without HA context
            try:
                from jinja2 import BaseLoader, Environment

                env = Environment(loader=BaseLoader())
                tmpl = env.from_string(template_str)
                return tmpl.render(variables)
            except Exception as err:
                _LOGGER.warning("Template render failed: %s", err)
                return template_str

    # ------------------------------------------------------------------
    # Event filtering
    # ------------------------------------------------------------------

    @staticmethod
    def _matches_filter(event: Event, event_filter: dict[str, Any]) -> bool:
        """Check if an event matches the filter criteria.

        Supports:
        - entity_id: match event.data["entity_id"] or new_state.entity_id
        - to_state: match new_state.state
        - from_state: match old_state.state
        - Any other key: match against event.data[key]
        """
        if not event_filter:
            return True

        for key, expected in event_filter.items():
            if key == "entity_id":
                # Check event data directly
                actual = event.data.get("entity_id", "")
                # Also check new_state for state_changed events
                if not actual:
                    new_state = event.data.get("new_state")
                    if new_state:
                        actual = new_state.entity_id
                if actual != expected:
                    return False

            elif key == "to_state":
                new_state = event.data.get("new_state")
                if not new_state or new_state.state != expected:
                    return False

            elif key == "from_state":
                old_state = event.data.get("old_state")
                if not old_state or old_state.state != expected:
                    return False

            else:
                # Generic data match
                if event.data.get(key) != expected:
                    return False

        return True
