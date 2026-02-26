"""Core conversation agent implementation for ProxLab.

This module implements the ProxLabAgent class, which serves as the central orchestrator
for all conversation-related functionality in the ProxLab integration. It brings
together LLM communication, tool execution, context management, and conversation
history to provide an intelligent conversational AI assistant for Home Assistant.

Architecture:
    The ProxLabAgent class uses a mixin-based architecture to separate concerns:

    - Inherits from LLMMixin for LLM API communication
    - Inherits from StreamingMixin for real-time streaming responses
    - Inherits from MemoryExtractionMixin for automatic memory extraction
    - Inherits from AbstractConversationAgent to integrate with Home Assistant

Key Classes:
    ProxLabAgent: Main conversation agent that integrates with Home Assistant's
        conversation platform. Manages the complete lifecycle of a conversation
        from user input to assistant response, including:

        - Entity context injection
        - Conversation history management
        - Tool calling and execution
        - Streaming and synchronous response modes
        - Memory extraction and storage
        - Event emission for observability

Core Responsibilities:
    - Process user inputs through Home Assistant's conversation platform
    - Build and manage conversation context (system prompts, entity states)
    - Execute multi-turn conversations with tool calling support
    - Coordinate between LLM, tools, and Home Assistant services
    - Track conversation history and metrics
    - Support both streaming and synchronous response modes

Usage Example:
    Basic conversation processing:
        agent = ProxLabAgent(hass, config, session_manager)
        result = await agent.async_process(user_input)

    Direct message processing:
        response = await agent.process_message(
            text="Turn on the kitchen lights",
            conversation_id="conv_123",
            user_id="user_456"
        )

    Tool execution for debugging:
        result = await agent.execute_tool_debug(
            tool_name="ha_control",
            parameters={"action": "turn_on", "entity_id": "light.kitchen"}
        )

Integration Points:
    - AbstractConversationAgent: Base class for Home Assistant conversation agents
    - ContextManager: Provides entity and memory context for conversations
    - ConversationHistoryManager: Manages multi-turn conversation history
    - ToolHandler: Executes tools (Home Assistant actions, external services)
    - MemoryManager: Stores and retrieves long-term memories
    - ConversationSessionManager: Manages persistent voice conversation sessions

Tool Calling Flow:
    1. User message received via async_process() or process_message()
    2. Context manager assembles relevant entity states and memories
    3. System prompt built with context and conversation history
    4. LLM called with messages and tool definitions
    5. If LLM requests tools, execute them via ToolHandler
    6. Results fed back to LLM for final response
    7. Response saved to conversation history
    8. Memories extracted asynchronously for future context

Configuration:
    The agent is configured through the config dictionary passed during
    initialization. Key configuration options include:

    - LLM settings (model, temperature, API credentials)
    - Context mode (entity filtering and injection)
    - History settings (max messages, token limits)
    - Tool settings (max calls per turn, timeouts)
    - Streaming and memory extraction toggles

Events:
    The agent emits events for observability:

    - conversation_started: When a conversation begins
    - conversation_finished: When a conversation completes with metrics
    - error: When errors occur during processing
    - streaming_error: When streaming fails (with fallback)
    - memory_extracted: When memories are extracted and stored
"""

from __future__ import annotations

import json
import logging
import time
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ..conversation_session import ConversationSessionManager

import aiohttp
from homeassistant.components import conversation as ha_conversation
from homeassistant.components.conversation.models import AbstractConversationAgent
from homeassistant.components.homeassistant.exposed_entities import async_should_expose
from homeassistant.const import MATCH_ALL
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import TemplateError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import intent, template

from ..const import (
    AGENT_CONVERSATION,
    AGENT_DEFINITIONS,
    AGENT_TOOL_MAP,
    CONF_AGENTS,
    CONF_CONTEXT_ENTITIES,
    CONF_CONTEXT_MODE,
    CONF_DEBUG_LOGGING,
    CONF_EMIT_EVENTS,
    CONF_EXTERNAL_LLM_ENABLED,
    CONF_HISTORY_ENABLED,
    CONF_HISTORY_MAX_MESSAGES,
    CONF_HISTORY_MAX_TOKENS,
    CONF_HISTORY_PERSIST,
    CONF_LLM_MODEL,
    CONF_MEMORY_ENABLED,
    CONF_PROMPT_CUSTOM_ADDITIONS,
    CONF_PROMPT_INCLUDE_LABELS,
    CONF_PROMPT_USE_DEFAULT,
    CONF_STREAMING_ENABLED,
    CONF_THINKING_ENABLED,
    CONF_TOOLS_CUSTOM,
    CONF_TOOLS_MAX_CALLS_PER_TURN,
    CONF_TOOLS_TIMEOUT,
    DEFAULT_HISTORY_MAX_MESSAGES,
    DEFAULT_HISTORY_MAX_TOKENS,
    DEFAULT_MEMORY_ENABLED,
    DEFAULT_PROMPT_INCLUDE_LABELS,
    DEFAULT_STREAMING_ENABLED,
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_THINKING_ENABLED,
    DEFAULT_TOOLS_MAX_CALLS_PER_TURN,
    DOMAIN,
    EVENT_AGENT_INVOKED,
    EVENT_CONVERSATION_FINISHED,
    EVENT_CONVERSATION_STARTED,
    EVENT_ERROR,
    EVENT_STREAMING_ERROR,
    TOOL_QUERY_EXTERNAL_LLM,
)
from ..exceptions import (
    ProxLabAgentError,
    AuthenticationError,
    TokenLimitExceeded,
    RateLimitExceeded,
    PermissionDenied,
    EntityNotFoundError,
    ServiceUnavailableError,
    ContextInjectionError,
)
from ..context_manager import ContextManager
from ..conversation import ConversationHistoryManager
from ..helpers import strip_thinking_blocks
from ..tool_handler import ToolHandler
from ..tools import HomeAssistantControlTool, HomeAssistantQueryTool
from ..tools.custom import CustomToolHandler
from ..tools.external_llm import ExternalLLMTool

from .llm import LLMMixin
from .orchestrator import AgentContext, OrchestratorMixin
from .streaming import StreamingMixin
from .memory_extraction import MemoryExtractionMixin

_LOGGER = logging.getLogger(__name__)


class ProxLabAgent(
    OrchestratorMixin,
    LLMMixin,
    StreamingMixin,
    MemoryExtractionMixin,
    AbstractConversationAgent,
):
    """Main conversation agent that orchestrates all ProxLab components.

    This class integrates with Home Assistant's conversation platform and provides
    intelligent conversational AI capabilities with tool calling, context injection,
    and conversation history management.
    """

    def __init__(
        self,
        hass: HomeAssistant,
        config: dict[str, Any],
        session_manager: "ConversationSessionManager",
    ) -> None:
        """Initialize the ProxLab.

        Args:
            hass: Home Assistant instance
            config: Configuration dictionary containing LLM settings, context config, etc.
            session_manager: Conversation session manager for persistent voice conversations
        """
        self.hass = hass
        self.config = config
        self.session_manager = session_manager

        # Initialize components
        self.context_manager = ContextManager(hass, config)
        self.conversation_manager = ConversationHistoryManager(
            max_messages=config.get(CONF_HISTORY_MAX_MESSAGES, DEFAULT_HISTORY_MAX_MESSAGES),
            max_tokens=config.get(CONF_HISTORY_MAX_TOKENS, DEFAULT_HISTORY_MAX_TOKENS),
            hass=hass,
            persist=config.get(CONF_HISTORY_PERSIST, True),
        )
        self.tool_handler = ToolHandler(
            hass,
            {
                "max_calls_per_turn": config.get(CONF_TOOLS_MAX_CALLS_PER_TURN),
                "timeout": config.get(CONF_TOOLS_TIMEOUT),
                "emit_events": config.get(CONF_EMIT_EVENTS, True),
            },
        )

        # Tools will be registered lazily on first use
        # This ensures the exposure system is fully initialized
        self._tools_registered = False

        # HTTP session for LLM API calls
        self._session: aiohttp.ClientSession | None = None

        # Memory manager reference (will be populated from hass.data if available)
        self._memory_manager = None

        _LOGGER.info("ProxLab initialized with model %s", config.get(CONF_LLM_MODEL))

    @property
    def supported_languages(self) -> str:
        """Return supported languages.

        Returns MATCH_ALL ("*") to indicate that all languages are supported.
        Since this agent delegates to an LLM for natural language understanding,
        it can handle any language the underlying model supports without
        restriction.

        The agent preserves the language throughout the conversation pipeline,
        using it in ConversationInput and IntentResponse objects.
        """
        return MATCH_ALL

    @property
    def memory_manager(self) -> Any:
        """Get memory manager from hass.data if available."""
        if self._memory_manager is None:
            # Try to get memory manager from hass.data
            domain_data = self.hass.data.get(DOMAIN, {})
            for entry_data in domain_data.values():
                if isinstance(entry_data, dict) and "memory_manager" in entry_data:
                    self._memory_manager = entry_data["memory_manager"]
                    break
        return self._memory_manager

    def _ensure_tools_registered(self) -> None:
        """Ensure tools are registered (lazy registration).

        This method is called before the first message is processed to ensure
        the exposure system has been fully initialized by Home Assistant.
        """
        if self._tools_registered:
            return

        self._register_tools()
        self._tools_registered = True

        # Set memory provider in context manager if memory manager is available
        if self.memory_manager is not None:
            self.context_manager.set_memory_provider(self.memory_manager)
            _LOGGER.debug("Memory context provider enabled")

    async def async_process(
        self, user_input: ha_conversation.ConversationInput
    ) -> ha_conversation.ConversationResult:
        """Process a conversation turn with optional streaming support.

        This method is required by AbstractConversationAgent. It processes user input
        and returns a conversation result. It automatically detects if streaming is
        available and uses the appropriate processing path.

        Args:
            user_input: Conversation input from Home Assistant

        Returns:
            ConversationResult with the agent's response
        """
        try:
            # Ensure tools are registered (lazy initialization)
            self._ensure_tools_registered()

            # --- Orchestrator routing ---
            agent_context: AgentContext | None = None
            if self._is_orchestrator_enabled():
                try:
                    agent_context = await self._orchestrator_classify(
                        user_input.text
                    )
                except Exception as err:
                    _LOGGER.warning(
                        "Orchestrator classification failed, using default: %s",
                        err,
                    )

            # Check if we can stream
            if self._can_stream():
                try:
                    return await self._async_process_streaming(
                        user_input, agent_context=agent_context
                    )
                except Exception as err:
                    # Fallback to synchronous on streaming errors
                    _LOGGER.warning(
                        "Streaming failed, falling back to synchronous mode: %s",
                        err,
                        exc_info=True,
                    )
                    self.hass.bus.async_fire(
                        EVENT_STREAMING_ERROR,
                        {
                            "error": str(err),
                            "error_type": type(err).__name__,
                            "fallback": True,
                        },
                    )
                    # Fall through to synchronous processing

            # Synchronous processing (existing code path)
            return await self._async_process_synchronous(
                user_input, agent_context=agent_context
            )

        except AuthenticationError as err:
            _LOGGER.error("Authentication error: %s", err, exc_info=True)
            message = "I'm having trouble connecting to the AI service. Please check your API key."

            intent_response = intent.IntentResponse(language=user_input.language)
            intent_response.async_set_error(
                intent.IntentResponseErrorCode.UNKNOWN,
                message,
            )

            return ha_conversation.ConversationResult(
                response=intent_response,
                conversation_id=user_input.conversation_id,
            )

        except ServiceUnavailableError as err:
            _LOGGER.error("Service unavailable: %s", err, exc_info=True)
            message = "The AI service is temporarily unavailable. Please try again later."

            intent_response = intent.IntentResponse(language=user_input.language)
            intent_response.async_set_error(
                intent.IntentResponseErrorCode.UNKNOWN,
                message,
            )

            return ha_conversation.ConversationResult(
                response=intent_response,
                conversation_id=user_input.conversation_id,
            )

        except TokenLimitExceeded as err:
            _LOGGER.error("Token limit exceeded: %s", err, exc_info=True)
            message = "Your request was too long. Please try a shorter message."

            intent_response = intent.IntentResponse(language=user_input.language)
            intent_response.async_set_error(
                intent.IntentResponseErrorCode.UNKNOWN,
                message,
            )

            return ha_conversation.ConversationResult(
                response=intent_response,
                conversation_id=user_input.conversation_id,
            )

        except RateLimitExceeded as err:
            _LOGGER.error("Rate limit exceeded: %s", err, exc_info=True)
            message = "Too many requests. Please wait a moment and try again."

            intent_response = intent.IntentResponse(language=user_input.language)
            intent_response.async_set_error(
                intent.IntentResponseErrorCode.UNKNOWN,
                message,
            )

            return ha_conversation.ConversationResult(
                response=intent_response,
                conversation_id=user_input.conversation_id,
            )

        except EntityNotFoundError as err:
            _LOGGER.error("Entity not found: %s", err, exc_info=True)
            message = "I couldn't find the device. Please check if it's available."

            intent_response = intent.IntentResponse(language=user_input.language)
            intent_response.async_set_error(
                intent.IntentResponseErrorCode.UNKNOWN,
                message,
            )

            return ha_conversation.ConversationResult(
                response=intent_response,
                conversation_id=user_input.conversation_id,
            )

        except PermissionDenied as err:
            _LOGGER.error("Permission denied: %s", err, exc_info=True)
            message = "I don't have permission to control that device."

            intent_response = intent.IntentResponse(language=user_input.language)
            intent_response.async_set_error(
                intent.IntentResponseErrorCode.UNKNOWN,
                message,
            )

            return ha_conversation.ConversationResult(
                response=intent_response,
                conversation_id=user_input.conversation_id,
            )

        except ContextInjectionError as err:
            _LOGGER.error("Context injection error: %s", err, exc_info=True)
            message = "I had trouble getting device information. Please try again."

            intent_response = intent.IntentResponse(language=user_input.language)
            intent_response.async_set_error(
                intent.IntentResponseErrorCode.UNKNOWN,
                message,
            )

            return ha_conversation.ConversationResult(
                response=intent_response,
                conversation_id=user_input.conversation_id,
            )

        except Exception as err:
            _LOGGER.error("Unexpected error: %s", err, exc_info=True)
            message = "Something unexpected went wrong. Please check the logs."

            intent_response = intent.IntentResponse(language=user_input.language)
            intent_response.async_set_error(
                intent.IntentResponseErrorCode.UNKNOWN,
                message,
            )

            return ha_conversation.ConversationResult(
                response=intent_response,
                conversation_id=user_input.conversation_id,
            )

    def _register_tools(self) -> None:
        """Register core Home Assistant tools."""
        # Get exposed entities from voice assistant settings
        # Use async_should_expose to respect Home Assistant's exposure settings
        from homeassistant.components import conversation as ha_conversation
        from homeassistant.components.homeassistant.exposed_entities import async_should_expose

        exposed_entity_ids = {
            state.entity_id
            for state in self.hass.states.async_all()
            if async_should_expose(self.hass, ha_conversation.DOMAIN, state.entity_id)
        }

        _LOGGER.debug(
            "Found %d exposed entities for tools: %s",
            len(exposed_entity_ids),
            sorted(exposed_entity_ids),
        )

        # Register ha_control tool
        ha_control = HomeAssistantControlTool(self.hass, exposed_entity_ids)
        self.tool_handler.register_tool(ha_control)

        # Register ha_query tool
        ha_query = HomeAssistantQueryTool(self.hass, exposed_entity_ids)
        self.tool_handler.register_tool(ha_query)

        # Register ha_system_log tool
        from ..tools.ha_system_log import HomeAssistantSystemLogTool
        ha_system_log = HomeAssistantSystemLogTool(self.hass)
        self.tool_handler.register_tool(ha_system_log)

        # Register camera vision tool
        from ..tools.camera_vision import CameraVisionTool
        camera_vision = CameraVisionTool(self.hass, self.config)
        self.tool_handler.register_tool(camera_vision)

        # Register image generation tool
        from ..tools.image_generation import ImageGenerationTool
        image_gen = ImageGenerationTool(self.hass, self.config)
        self.tool_handler.register_tool(image_gen)

        # Register SSH command tool
        from ..tools.ssh_command import SSHCommandTool
        ssh_cmd = SSHCommandTool(self.hass, self.config)
        self.tool_handler.register_tool(ssh_cmd)

        # Register external LLM tool if enabled
        if self.config.get(CONF_EXTERNAL_LLM_ENABLED, False):
            external_llm = ExternalLLMTool(self.hass, self.config)
            self.tool_handler.register_tool(external_llm)
            _LOGGER.info("External LLM tool registered")

        # Register custom tools from configuration
        custom_tools_config = self.config.get(CONF_TOOLS_CUSTOM, [])
        if custom_tools_config:
            self._register_custom_tools(custom_tools_config)

        # Register memory tools if memory manager is available
        if self.memory_manager is not None:
            from ..tools.memory_tools import RecallMemoryTool, StoreMemoryTool

            store_memory = StoreMemoryTool(
                self.hass,
                self.memory_manager,
                conversation_id=None,  # Will be set per-conversation
            )
            self.tool_handler.register_tool(store_memory)

            recall_memory = RecallMemoryTool(self.hass, self.memory_manager)
            self.tool_handler.register_tool(recall_memory)

            _LOGGER.info("Memory tools registered")

        # Register MCP bridge tools from connected MCP servers
        entry_data = self.hass.data.get(DOMAIN, {})
        for eid, edata in entry_data.items():
            if isinstance(edata, dict) and "mcp_manager" in edata:
                mcp_mgr = edata["mcp_manager"]
                from ..tools.mcp_bridge import McpBridgeTool

                for mcp_tool in mcp_mgr.get_all_tools():
                    bridge = McpBridgeTool(
                        hass=self.hass,
                        mcp_manager=mcp_mgr,
                        server_id=mcp_tool["server_id"],
                        server_name=mcp_tool["server_name"],
                        tool_name=mcp_tool["name"],
                        tool_description=mcp_tool.get("description", ""),
                        tool_input_schema=mcp_tool.get("inputSchema", {}),
                    )
                    try:
                        self.tool_handler.register_tool(bridge)
                    except Exception:
                        pass  # Skip duplicates on re-register
                _LOGGER.info(
                    "Registered %d MCP bridge tools",
                    len(mcp_mgr.get_all_tools()),
                )
                break  # Only need one mcp_manager

        _LOGGER.debug("Registered %d tools", len(self.tool_handler.get_registered_tools()))

    def _register_custom_tools(self, custom_tools_config: list[dict[str, Any]]) -> None:
        """Register custom tools from configuration.

        Args:
            custom_tools_config: List of custom tool configuration dictionaries
        """
        from ..exceptions import ValidationError

        registered_count = 0
        failed_count = 0

        for tool_config in custom_tools_config:
            try:
                # Create tool from configuration
                custom_tool = CustomToolHandler.create_tool_from_config(
                    self.hass,
                    tool_config,
                )

                # Register with tool handler
                self.tool_handler.register_tool(custom_tool)
                registered_count += 1

                _LOGGER.info(
                    "Registered custom tool '%s' (type: %s)",
                    custom_tool.name,
                    tool_config.get("handler", {}).get("type"),
                )

            except ValidationError as err:
                failed_count += 1
                _LOGGER.error(
                    "Failed to register custom tool (validation error): %s. "
                    "Integration will continue without this tool.",
                    err,
                )
            except Exception as err:
                failed_count += 1
                _LOGGER.error(
                    "Failed to register custom tool (unexpected error): %s. "
                    "Integration will continue without this tool.",
                    err,
                    exc_info=True,
                )

        if registered_count > 0:
            _LOGGER.info(
                "Successfully registered %d custom tool(s)",
                registered_count,
            )

        if failed_count > 0:
            _LOGGER.warning(
                "Failed to register %d custom tool(s). Check logs for details.",
                failed_count,
            )

    def _get_exposed_entities(self) -> list[str]:
        """Get list of entities exposed to the agent.

        Returns:
            List of entity IDs that the agent can access
        """
        # Get entities from context configuration
        context_entities = self.config.get(CONF_CONTEXT_ENTITIES, [])

        exposed = set()
        for entity_config in context_entities:
            if isinstance(entity_config, dict):
                entity_id = entity_config.get("entity_id", "")
            else:
                entity_id = str(entity_config)

            # Handle wildcards by expanding them
            if "*" in entity_id:
                # Get all matching entities
                import fnmatch

                all_entities = self.hass.states.async_entity_ids()
                matching = [e for e in all_entities if fnmatch.fnmatch(e, entity_id)]
                exposed.update(matching)
            else:
                exposed.add(entity_id)

        return list(exposed)

    def get_exposed_entities(self) -> list[dict[str, Any]]:
        """Get exposed entities as structured dictionaries for template rendering.

        Returns:
            List of entity dictionaries with entity_id, name, state, aliases, and optionally labels
        """
        # Get all states that should be exposed to conversation
        states = [
            state
            for state in self.hass.states.async_all()
            if async_should_expose(self.hass, ha_conversation.DOMAIN, state.entity_id)
        ]

        entity_registry = er.async_get(self.hass)
        exposed_entities = []

        # Check if labels should be included
        include_labels = self.config.get(CONF_PROMPT_INCLUDE_LABELS, DEFAULT_PROMPT_INCLUDE_LABELS)

        for state in states:
            entity_id = state.entity_id
            entity = entity_registry.async_get(entity_id)

            aliases = []
            labels = []
            if entity:
                if entity.aliases:
                    aliases = list(entity.aliases)
                if include_labels and entity.labels:
                    labels = list(entity.labels)

            entity_dict = {
                "entity_id": entity_id,
                "name": state.name,
                "state": state.state,
                "aliases": aliases,
            }

            if include_labels:
                entity_dict["labels"] = labels

            exposed_entities.append(entity_dict)

        return exposed_entities

    async def close(self) -> None:
        """Clean up resources."""
        if self._session and not self._session.closed:
            await self._session.close()
        if hasattr(self, "context_manager"):
            await self.context_manager.async_close()

    def _preprocess_user_message(self, text: str) -> str:
        """Preprocess user message before sending to LLM.

        Appends /no_think if thinking mode is disabled and not already present.
        """
        if not self.config.get(CONF_THINKING_ENABLED, DEFAULT_THINKING_ENABLED):
            # Only append /no_think if it's not already there (avoid duplicates)
            if "/no_think" not in text:
                return text.strip() + "\n/no_think"
        return text

    def _build_trace_steps(
        self,
        agent_context: AgentContext | None,
        metrics: dict[str, Any],
        duration_ms: int,
        tool_breakdown: dict[str, int],
        response_text: str,
        user_input: str = "",
        context_messages: list[dict[str, Any]] | None = None,
        tools: list[dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        """Build a multi-step trace array for the debug panel.

        Returns a list of step dicts. If an orchestrator was used, step 1 is
        the orchestrator classification and step 2 is the target agent. If no
        orchestrator, returns a single step for the conversation agent.
        """
        from ..helpers import estimate_claude_cost

        steps: list[dict[str, Any]] = []

        if agent_context and agent_context.orchestrator_model:
            # Step 1: Orchestrator classification
            orch_dur = agent_context.orchestrator_duration_ms
            orch_comp = agent_context.orchestrator_tokens.get("completion", 0)
            orch_prompt = agent_context.orchestrator_tokens.get("prompt", 0)
            orch_tps = (
                round(orch_comp / (orch_dur / 1000), 1)
                if orch_dur > 0
                else 0
            )
            orch_conn_type = agent_context.orchestrator_connection_type
            orch_cost = estimate_claude_cost(
                agent_context.orchestrator_model, orch_prompt, orch_comp
            ) if orch_conn_type == "claude_api" else None

            orch_step: dict[str, Any] = {
                "agent_id": "orchestrator",
                "agent_name": "Orchestrator",
                "model": agent_context.orchestrator_model,
                "duration_ms": orch_dur,
                "tokens": dict(agent_context.orchestrator_tokens),
                "tokens_per_sec": orch_tps,
                "performance": {
                    "llm_latency_ms": orch_dur,
                    "tool_latency_ms": 0,
                    "context_latency_ms": 0,
                    "ttft_ms": 0,
                },
                "routing_decision": {
                    "target_agent": agent_context.agent_id,
                    "reason": agent_context.routing_reason,
                },
                "tool_calls": 0,
                "tool_breakdown": {},
                "user_input": user_input,
                "connection_type": orch_conn_type,
                "context_messages": agent_context.orchestrator_context_messages or [],
                "tools": agent_context.orchestrator_tools or [],
            }
            if orch_cost is not None:
                orch_step["cost_estimate"] = round(orch_cost, 6)
            steps.append(orch_step)

            # Step 2: Target agent
            defn = AGENT_DEFINITIONS.get(agent_context.agent_id)
            agent_name = defn.name if defn else agent_context.agent_id
            agent_model = (
                agent_context.flat_config.get(CONF_LLM_MODEL)
                if agent_context.flat_config
                else None
            ) or self.config.get(CONF_LLM_MODEL, "unknown")
            agent_dur = max(0, duration_ms - orch_dur)

            llm_lat = metrics.get("performance", {}).get("llm_latency_ms", 0)
            comp_tokens = metrics.get("tokens", {}).get("completion", 0)
            prompt_tokens = metrics.get("tokens", {}).get("prompt", 0)
            agent_tps = (
                round(comp_tokens / (llm_lat / 1000), 1)
                if llm_lat > 0
                else 0
            )
            agent_conn_type = (
                agent_context.flat_config.get("connection_type", "local")
                if agent_context.flat_config
                else "local"
            )
            agent_cost = estimate_claude_cost(
                agent_model, prompt_tokens, comp_tokens
            ) if agent_conn_type == "claude_api" else None

            agent_step: dict[str, Any] = {
                "agent_id": agent_context.agent_id,
                "agent_name": agent_name,
                "model": agent_model,
                "duration_ms": agent_dur,
                "tokens": dict(metrics.get("tokens", {})),
                "tokens_per_sec": agent_tps,
                "performance": dict(metrics.get("performance", {})),
                "response_text": response_text,
                "tool_calls": metrics.get("tool_calls", 0),
                "tool_breakdown": dict(tool_breakdown),
                "user_input": user_input,
                "connection_type": agent_conn_type,
                "context_messages": context_messages or [],
                "tools": tools or [],
            }
            if agent_cost is not None:
                agent_step["cost_estimate"] = round(agent_cost, 6)
            steps.append(agent_step)
        else:
            # Single step: no orchestrator
            llm_lat = metrics.get("performance", {}).get("llm_latency_ms", 0)
            comp_tokens = metrics.get("tokens", {}).get("completion", 0)
            prompt_tokens = metrics.get("tokens", {}).get("prompt", 0)
            tps = (
                round(comp_tokens / (llm_lat / 1000), 1)
                if llm_lat > 0
                else 0
            )
            single_model = self.config.get(CONF_LLM_MODEL, "unknown")
            single_conn_type = self.config.get("connection_type", "local")
            single_cost = estimate_claude_cost(
                single_model, prompt_tokens, comp_tokens
            ) if single_conn_type == "claude_api" else None

            single_step: dict[str, Any] = {
                "agent_id": "conversation_agent",
                "agent_name": "Conversation",
                "model": single_model,
                "duration_ms": duration_ms,
                "tokens": dict(metrics.get("tokens", {})),
                "tokens_per_sec": tps,
                "performance": dict(metrics.get("performance", {})),
                "response_text": response_text,
                "tool_calls": metrics.get("tool_calls", 0),
                "tool_breakdown": dict(tool_breakdown),
                "user_input": user_input,
                "connection_type": single_conn_type,
                "context_messages": context_messages or [],
                "tools": tools or [],
            }
            if single_cost is not None:
                single_step["cost_estimate"] = round(single_cost, 6)
            steps.append(single_step)

        return steps

    def _build_system_prompt(
        self,
        entity_context: str = "",
        conversation_id: str | None = None,
        device_id: str | None = None,
        user_message: str | None = None,
    ) -> str:
        """Build the system prompt for the LLM.

        Args:
            entity_context: Formatted entity context to inject into template
            conversation_id: Current conversation ID
            device_id: Device that triggered the conversation
            user_message: User's current message

        Returns:
            Complete system prompt string
        """
        # Template variables available to custom prompts
        template_vars = {
            "entity_context": entity_context,
            "exposed_entities": self.get_exposed_entities(),
            "ha_name": self.hass.config.location_name,
            "current_device_id": device_id,
            "conversation_id": conversation_id,
            "user_message": user_message,
        }

        if not self.config.get(CONF_PROMPT_USE_DEFAULT, True):
            # Use only custom prompt if default is disabled
            custom_prompt = self.config.get(CONF_PROMPT_CUSTOM_ADDITIONS, "")
            return self._render_template(custom_prompt, template_vars)

        # Start with default prompt and render with entity_context
        prompt = self._render_template(DEFAULT_SYSTEM_PROMPT, template_vars)

        # Add custom additions if provided
        custom_additions = self.config.get(CONF_PROMPT_CUSTOM_ADDITIONS, "")
        if custom_additions:
            rendered_additions = self._render_template(custom_additions, template_vars)
            prompt += f"\n\n## Additional Context\n\n{rendered_additions}"

        return prompt

    def _render_template(self, template_str: str, variables: dict[str, Any] | None = None) -> str:
        """Render a Jinja2 template string.

        Args:
            template_str: Template string to render
            variables: Optional variables to pass to template

        Returns:
            Rendered template string

        Note:
            Templates have access to Home Assistant state via the template context.
            Available variables: states, state_attr, is_state, etc.
            Plus any custom variables passed via the variables parameter.
        """
        if not template_str:
            return ""

        try:
            tpl = template.Template(template_str, self.hass)
            result = tpl.async_render(variables or {})
            # Template.async_render can return Any, so we need to ensure it's a string
            return str(result) if result is not None else ""
        except TemplateError as err:
            _LOGGER.warning("Template rendering failed: %s. Using raw template.", err)
            return template_str

    async def process_message(
        self,
        text: str,
        conversation_id: str | None = None,
        user_id: str | None = None,
        device_id: str | None = None,
        agent_context: AgentContext | None = None,
    ) -> str:
        """Process a user message and return the agent's response.

        This is the main entry point for conversation processing.

        Args:
            text: User's message text
            conversation_id: Optional conversation ID for history tracking
            user_id: Optional user ID for the conversation
            device_id: Optional device ID that triggered the conversation
            agent_context: Optional orchestrator-resolved agent context

        Returns:
            Agent's response text

        Raises:
            ProxLabAgentError: If processing fails
        """
        # Ensure tools are registered (lazy initialization)
        self._ensure_tools_registered()

        start_time = time.time()

        # Get or create persistent conversation ID for voice interactions
        if conversation_id is None:
            # Try to get existing conversation for this user/device
            conversation_id = self.session_manager.get_conversation_id(
                user_id=user_id,
                device_id=device_id,
            )

            if conversation_id:
                _LOGGER.debug(
                    "Reusing conversation %s for user=%s device=%s",
                    conversation_id,
                    user_id,
                    device_id,
                )
            else:
                # Generate new conversation ID using Home Assistant's ULID format
                from homeassistant.util.ulid import ulid_now

                conversation_id = ulid_now()

                _LOGGER.info(
                    "Created new conversation %s for user=%s device=%s",
                    conversation_id,
                    user_id,
                    device_id,
                )

                # Store the mapping
                await self.session_manager.set_conversation_id(
                    conversation_id,
                    user_id=user_id,
                    device_id=device_id,
                )
        else:
            # Update activity for explicitly provided conversation_id
            await self.session_manager.update_activity(
                user_id=user_id,
                device_id=device_id,
            )

        # Initialize metrics tracking
        metrics = {
            "tokens": {
                "prompt": 0,
                "completion": 0,
                "total": 0,
            },
            "performance": {
                "llm_latency_ms": 0,
                "tool_latency_ms": 0,
                "context_latency_ms": 0,
                "ttft_ms": 0,
            },
            "context": {},
            "tool_calls": 0,
        }

        # Fire conversation started event
        if self.config.get(CONF_EMIT_EVENTS, True):
            self.hass.bus.async_fire(
                EVENT_CONVERSATION_STARTED,
                {
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "device_id": device_id,
                    "user_message": text,
                    "model": self.config.get(CONF_LLM_MODEL, "unknown"),
                    "timestamp": time.time(),
                    "context_mode": self.config.get(CONF_CONTEXT_MODE),
                },
            )

        try:
            # Preprocess user message (e.g., append /no_think if thinking mode disabled)
            preprocessed_text = self._preprocess_user_message(text)
            response = await self._process_conversation(
                preprocessed_text,
                conversation_id,
                device_id,
                metrics,
                user_id=user_id,
                agent_context=agent_context,
            )

            # Calculate total duration
            duration_ms = int((time.time() - start_time) * 1000)

            # Get tool metrics
            tool_metrics = self.tool_handler.get_metrics()
            tool_breakdown = {}
            for tool_name in self.tool_handler.get_registered_tools():
                count = tool_metrics.get(f"{tool_name}_executions", 0)
                if count > 0:
                    tool_breakdown[tool_name] = count

            # Check if external LLM was used
            used_external_llm = (
                TOOL_QUERY_EXTERNAL_LLM in tool_breakdown
                and tool_breakdown[TOOL_QUERY_EXTERNAL_LLM] > 0
            )

            # Build trace steps
            steps = self._build_trace_steps(
                agent_context, metrics, duration_ms,
                tool_breakdown, response or "",
                user_input=text,
                context_messages=metrics.get("_context_messages"),
                tools=metrics.get("_tools"),
            )
            # Aggregate tokens_per_sec from target step
            llm_lat_sync = metrics.get("performance", {}).get("llm_latency_ms", 0)
            comp_sync = metrics.get("tokens", {}).get("completion", 0)
            tps_sync = (
                round(comp_sync / (llm_lat_sync / 1000), 1)
                if llm_lat_sync > 0
                else 0
            )

            # Fire conversation finished event with enhanced metrics
            if self.config.get(CONF_EMIT_EVENTS, True):
                try:
                    event_data: dict[str, Any] = {
                        "conversation_id": conversation_id,
                        "user_id": user_id,
                        "user_message": text,
                        "response_text": response or "",
                        "model": self.config.get(CONF_LLM_MODEL, "unknown"),
                        "duration_ms": duration_ms,
                        "tokens": metrics["tokens"],
                        "performance": metrics["performance"],
                        "context": metrics.get("context", {}),
                        "tool_calls": metrics["tool_calls"],
                        "tool_breakdown": tool_breakdown,
                        "used_external_llm": used_external_llm,
                        "tokens_per_sec": tps_sync,
                        "steps": steps,
                    }
                    if agent_context:
                        event_data["routed_agent"] = agent_context.agent_id
                        event_data["routing_reason"] = agent_context.routing_reason
                    self.hass.bus.async_fire(EVENT_CONVERSATION_FINISHED, event_data)
                except Exception as event_err:
                    _LOGGER.warning("Failed to fire conversation finished event: %s", event_err)

            # Update session activity to prevent expiration of active conversations
            await self.session_manager.update_activity(
                user_id=user_id,
                device_id=device_id,
            )

            return response

        except Exception as err:
            _LOGGER.error("Error processing message: %s", err, exc_info=True)

            # Fire error event
            if self.config.get(CONF_EMIT_EVENTS, True):
                try:
                    self.hass.bus.async_fire(
                        EVENT_ERROR,
                        {
                            "error_type": type(err).__name__,
                            "error_message": str(err),
                            "conversation_id": conversation_id,
                            "component": "agent",
                            "context": {
                                "text_length": len(text),
                            },
                        },
                    )
                except Exception as event_err:
                    _LOGGER.warning("Failed to fire error event: %s", event_err)

            raise

    async def invoke_agent(
        self,
        agent_id: str,
        message: str,
        context: dict[str, Any] | None = None,
        user_id: str | None = None,
        conversation_id: str | None = None,
        include_history: bool = False,
    ) -> dict[str, Any]:
        """Directly invoke a specific agent, bypassing orchestrator routing.

        Args:
            agent_id: The agent to invoke (must be in AGENT_DEFINITIONS).
            message: The user message / instruction.
            context: Optional extra context dict (sensor readings, scan results, etc.).
            user_id: Optional user ID.
            conversation_id: Optional conversation ID for history tracking.
            include_history: Whether to include conversation history (default stateless).

        Returns:
            Structured result dict with response_text, tool_results, tokens, etc.

        Raises:
            ValueError: If agent_id is not a valid agent.
        """
        from ..agent_prompts import get_default_prompt
        from ..connection_manager import resolve_agent_to_flat_config
        from ..helpers import normalize_usage, strip_thinking_blocks

        self._ensure_tools_registered()

        # Validate agent_id
        if agent_id not in AGENT_DEFINITIONS:
            raise ValueError(f"Unknown agent_id: {agent_id}")

        start_time = time.time()

        # Resolve agent's LLM config
        flat_config = resolve_agent_to_flat_config(self.config, agent_id)
        if flat_config is None:
            flat_config = resolve_agent_to_flat_config(self.config, AGENT_CONVERSATION)
        if flat_config is None:
            flat_config = {}

        resolved_model = flat_config.get(CONF_LLM_MODEL) or self.config.get(CONF_LLM_MODEL, "unknown")

        # Build system prompt
        agents_cfg = self.config.get(CONF_AGENTS, {})
        custom_prompt = agents_cfg.get(agent_id, {}).get("system_prompt")
        system_prompt = custom_prompt if custom_prompt else get_default_prompt(agent_id)

        # Append context section if provided
        if context:
            system_prompt += "\n\n## Context\n\n```json\n" + json.dumps(context, indent=2) + "\n```"

        # Build messages
        messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]

        if include_history and conversation_id and self.config.get(CONF_HISTORY_ENABLED, True):
            history = self.conversation_manager.get_history(
                conversation_id,
                max_messages=self.config.get(CONF_HISTORY_MAX_MESSAGES, DEFAULT_HISTORY_MAX_MESSAGES),
            )
            messages.extend(history)

        messages.append({"role": "user", "content": message})

        # Get tool definitions for this agent
        tool_names = AGENT_TOOL_MAP.get(agent_id)
        tool_definitions = self.tool_handler.get_tool_definitions_for_agent(tool_names)

        # Token tracking
        total_prompt_tokens = 0
        total_completion_tokens = 0
        tool_results_list: list[dict[str, Any]] = []

        # Tool calling loop
        max_iterations = self.config.get(CONF_TOOLS_MAX_CALLS_PER_TURN, DEFAULT_TOOLS_MAX_CALLS_PER_TURN)
        final_text = ""

        for iteration in range(max_iterations):
            llm_response = await self._call_llm(
                messages, tools=tool_definitions, config_override=flat_config or None
            )

            # Track tokens
            usage = llm_response.get("usage", {})
            if usage:
                norm = normalize_usage(usage)
                total_prompt_tokens += norm["prompt"]
                total_completion_tokens += norm["completion"]

            response_message = llm_response.get("choices", [{}])[0].get("message", {})
            if response_message.get("content") is None:
                response_message["content"] = ""

            tool_calls = response_message.get("tool_calls", [])

            if not tool_calls:
                raw_content = response_message.get("content") or ""
                final_text = strip_thinking_blocks(raw_content) or ""
                break

            # Execute tool calls
            messages.append(response_message)

            for tool_call in tool_calls:
                tool_name = tool_call.get("function", {}).get("name", "")
                tool_args_raw = tool_call.get("function", {}).get("arguments", "{}")
                tool_call_id = tool_call.get("id", "")
                tool_args: dict[str, Any] = {}

                try:
                    if isinstance(tool_args_raw, str):
                        tool_args = json.loads(tool_args_raw)
                    elif isinstance(tool_args_raw, dict):
                        tool_args = tool_args_raw

                    result = await self.tool_handler.execute_tool(
                        tool_name, tool_args, conversation_id or "invoke"
                    )

                    tool_results_list.append({
                        "tool_name": tool_name,
                        "arguments": tool_args,
                        "result": result,
                    })

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "name": tool_name,
                        "content": json.dumps(result),
                    })

                except Exception as err:
                    _LOGGER.error("invoke_agent tool '%s' failed: %s", tool_name, err)
                    error_result = {"success": False, "error": str(err)}
                    tool_results_list.append({
                        "tool_name": tool_name,
                        "arguments": tool_args,
                        "result": error_result,
                    })
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call_id,
                        "name": tool_name,
                        "content": json.dumps(error_result),
                    })
        else:
            # Max iterations reached without a final text response
            if not final_text:
                final_text = "Agent reached maximum tool call iterations without a final response."

        duration_ms = int((time.time() - start_time) * 1000)

        defn = AGENT_DEFINITIONS[agent_id]
        result = {
            "agent_id": agent_id,
            "agent_name": defn.name,
            "response_text": final_text,
            "tool_results": tool_results_list,
            "tokens": {
                "prompt": total_prompt_tokens,
                "completion": total_completion_tokens,
                "total": total_prompt_tokens + total_completion_tokens,
            },
            "duration_ms": duration_ms,
            "model": resolved_model,
            "success": True,
        }

        # Fire HA event
        self.hass.bus.async_fire(EVENT_AGENT_INVOKED, result)

        # Fire conversation finished event so test invocations appear in the trace panel
        try:
            from ..helpers import estimate_claude_cost
            from ..connection_manager import resolve_agent_to_flat_config as _resolve

            conn_type = (flat_config or {}).get("connection_type", "local")
            llm_lat = duration_ms  # approximate: entire duration is LLM time
            tps = (
                round(total_completion_tokens / (llm_lat / 1000), 1)
                if llm_lat > 0
                else 0
            )
            cost = estimate_claude_cost(
                resolved_model, total_prompt_tokens, total_completion_tokens
            ) if conn_type == "claude_api" else None

            tool_breakdown: dict[str, int] = {}
            for tr in tool_results_list:
                tn = tr.get("tool_name", "unknown")
                tool_breakdown[tn] = tool_breakdown.get(tn, 0) + 1

            step: dict[str, Any] = {
                "agent_id": agent_id,
                "agent_name": defn.name,
                "model": resolved_model,
                "duration_ms": duration_ms,
                "tokens": {
                    "prompt": total_prompt_tokens,
                    "completion": total_completion_tokens,
                },
                "tokens_per_sec": tps,
                "performance": {"llm_latency_ms": llm_lat, "tool_latency_ms": 0, "context_latency_ms": 0, "ttft_ms": 0},
                "response_text": final_text,
                "tool_calls": len(tool_results_list),
                "tool_breakdown": tool_breakdown,
                "user_input": message,
                "connection_type": conn_type,
                "context_messages": [],
                "tools": [d.get("function", d).get("name", "") for d in tool_definitions] if tool_definitions else [],
            }
            if cost is not None:
                step["cost_estimate"] = round(cost, 6)

            self.hass.bus.async_fire(EVENT_CONVERSATION_FINISHED, {
                "conversation_id": conversation_id or f"invoke_{agent_id}",
                "user_id": user_id,
                "user_message": message,
                "response_text": final_text,
                "model": resolved_model,
                "duration_ms": duration_ms,
                "tokens": {"prompt": total_prompt_tokens, "completion": total_completion_tokens},
                "performance": step["performance"],
                "context": {},
                "tool_calls": len(tool_results_list),
                "tool_breakdown": tool_breakdown,
                "used_external_llm": False,
                "tokens_per_sec": tps,
                "steps": [step],
                "routed_agent": agent_id,
                "routing_reason": "direct_invoke_test",
            })
        except Exception as trace_err:
            _LOGGER.debug("Failed to emit trace for invoke_agent: %s", trace_err)

        return result

    async def _async_process_streaming(
        self,
        user_input: ha_conversation.ConversationInput,
        agent_context: AgentContext | None = None,
    ) -> ha_conversation.ConversationResult:
        """Process conversation with streaming support.

        Args:
            user_input: The conversation input
            agent_context: Optional orchestrator-resolved agent context

        Returns:
            ConversationResult with the response
        """
        from homeassistant.components import conversation
        from homeassistant.components.conversation.chat_log import current_chat_log
        from homeassistant.helpers import llm

        from ..streaming import OpenAIStreamingHandler

        chat_log = current_chat_log.get()
        if chat_log is None:
            raise RuntimeError("ChatLog not available in streaming mode")

        user_message = self._preprocess_user_message(user_input.text)
        device_id = user_input.device_id
        user_id = user_input.context.user_id if user_input.context else None

        # Get or create persistent conversation ID for voice interactions
        conversation_id = user_input.conversation_id
        if conversation_id is None:
            # Try to get existing conversation for this user/device
            conversation_id = self.session_manager.get_conversation_id(
                user_id=user_id,
                device_id=device_id,
            )

            if conversation_id:
                _LOGGER.debug(
                    "Reusing conversation %s for user=%s device=%s (streaming)",
                    conversation_id,
                    user_id,
                    device_id,
                )
            else:
                # Generate new conversation ID using Home Assistant's ULID format
                from homeassistant.util.ulid import ulid_now

                conversation_id = ulid_now()

                _LOGGER.info(
                    "Created new conversation %s for user=%s device=%s (streaming)",
                    conversation_id,
                    user_id,
                    device_id,
                )

                # Store the mapping
                await self.session_manager.set_conversation_id(
                    conversation_id,
                    user_id=user_id,
                    device_id=device_id,
                )
        else:
            # Update activity for explicitly provided conversation_id
            await self.session_manager.update_activity(
                user_id=user_id,
                device_id=device_id,
            )

        # Create a simple APIInstance adapter to handle tool calls
        # This allows ChatLog to execute tools via our tool_handler
        class ToolHandlerAPIInstance:
            """Adapter to make tool_handler compatible with llm.APIInstance interface."""

            def __init__(self, tool_handler, metrics, conv_id, max_calls_per_turn):
                self.tool_handler = tool_handler
                self.metrics = metrics
                self.conversation_id = conv_id
                self.max_calls_per_turn = max_calls_per_turn
                self.calls_this_turn = 0

            async def async_call_tool(self, tool_input: llm.ToolInput) -> dict:
                """Execute tool via tool_handler."""
                # Enforce max calls per turn limit
                if self.calls_this_turn >= self.max_calls_per_turn:
                    error_msg = (
                        f"Tool call limit reached ({self.max_calls_per_turn} calls per turn). "
                        f"Skipping tool '{tool_input.tool_name}'."
                    )
                    _LOGGER.warning(error_msg)
                    return {"error": error_msg}

                self.calls_this_turn += 1

                try:
                    result = await self.tool_handler.execute_tool(
                        tool_input.tool_name, tool_input.tool_args, self.conversation_id
                    )
                    self.metrics["tool_calls"] += 1
                    return result if isinstance(result, dict) else {"result": str(result)}
                except Exception as err:
                    _LOGGER.error("Tool execution failed: %s", err, exc_info=True)
                    return {"error": str(err)}

        # Initialize metrics that will be passed to the adapter
        metrics: dict[str, Any] = {
            "tokens": {"prompt": 0, "completion": 0, "total": 0},
            "performance": {
                "llm_latency_ms": 0,
                "tool_latency_ms": 0,
                "context_latency_ms": 0,
                "ttft_ms": 0,
            },
            "context": {},
            "tool_calls": 0,
        }

        # Get max calls per turn for enforcement
        max_calls_per_turn = self.config.get(
            CONF_TOOLS_MAX_CALLS_PER_TURN, DEFAULT_TOOLS_MAX_CALLS_PER_TURN
        )

        # Set the llm_api so ChatLog can execute tools
        chat_log.llm_api = ToolHandlerAPIInstance(
            self.tool_handler, metrics, conversation_id, max_calls_per_turn
        )

        # Track start time for metrics
        start_time = time.time()

        context_start = time.time()
        context = await self.context_manager.get_formatted_context(
            user_message, conversation_id, metrics
        )
        context_latency_ms = int((time.time() - context_start) * 1000)
        metrics["performance"]["context_latency_ms"] = context_latency_ms

        # Build system prompt — use orchestrator-routed agent prompt when available
        if agent_context and agent_context.system_prompt:
            # Start with the agent-specific prompt, then append entity context
            system_prompt = agent_context.system_prompt
            if context:
                system_prompt += "\n\n## Available Devices\n\n" + context
        else:
            system_prompt = self._build_system_prompt(
                entity_context=context,
                conversation_id=conversation_id,
                device_id=device_id,
                user_message=user_message,
            )

        # Build messages list
        messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]

        # Add conversation history if enabled
        if self.config.get(CONF_HISTORY_ENABLED, True):
            history = self.conversation_manager.get_history(
                conversation_id,
                max_messages=self.config.get(
                    CONF_HISTORY_MAX_MESSAGES, DEFAULT_HISTORY_MAX_MESSAGES
                ),
            )
            messages.extend(history)

        # Add current user message
        messages.append({"role": "user", "content": user_message})

        # Snapshot initial context for debug trace (before tool loop mutates messages)
        metrics["_context_messages"] = [
            {"role": m["role"], "content": m.get("content", "")[:100000]}
            for m in messages
        ]

        # Resolve tool definitions for this agent
        streaming_config_override: dict[str, Any] | None = None
        streaming_tools_override: list[dict] | None = None
        if agent_context:
            streaming_config_override = agent_context.flat_config or None
            streaming_tools_override = self.tool_handler.get_tool_definitions_for_agent(
                agent_context.tool_names
            )

        # Snapshot tool definitions for debug trace
        metrics["_tools"] = streaming_tools_override or self.tool_handler.get_tool_definitions() or []

        # Tool calling loop (max iterations to prevent infinite loops)
        max_iterations = self.config.get(
            CONF_TOOLS_MAX_CALLS_PER_TURN, DEFAULT_TOOLS_MAX_CALLS_PER_TURN
        )

        entry_id = None
        # Try to find entry_id from config or hass.data
        if "entry_id" in self.config:
            entry_id = self.config["entry_id"]
        else:
            # Try to find it from domain data
            domain_data = self.hass.data.get(DOMAIN, {})
            for config_entry_id, entry_data in domain_data.items():
                if isinstance(entry_data, dict) and entry_data.get("agent") is self:
                    entry_id = config_entry_id
                    break

        if entry_id is None:
            _LOGGER.warning("Could not find entry_id for streaming, using 'proxlab'")
            entry_id = "proxlab"

        # Track TTFT (Time To First Token) - only set once on first iteration
        first_content_time: float | None = None

        for iteration in range(max_iterations):
            _LOGGER.debug("Starting streaming iteration %d/%d", iteration + 1, max_iterations)
            # Call LLM with streaming
            llm_start = time.time()
            stream = self._call_llm_streaming(
                messages,
                config_override=streaming_config_override,
                tools_override=streaming_tools_override,
            )

            # Transform and send to chat log
            handler = OpenAIStreamingHandler()

            # This will:
            # 1. Transform OpenAI SSE to HA deltas
            # 2. Send deltas to assist pipeline (via chat_log.delta_listener)
            # 3. Execute tools automatically (chat_log.async_add_delta_content_stream does this)
            # 4. Return the content that was added
            new_content = []
            async for content in chat_log.async_add_delta_content_stream(
                entry_id,
                handler.transform_openai_stream(stream),
            ):
                # Track TTFT on first content item
                if first_content_time is None:
                    first_content_time = time.time()
                    ttft_ms = int((first_content_time - llm_start) * 1000)
                    metrics["performance"]["ttft_ms"] = ttft_ms
                new_content.append(content)

            _LOGGER.debug(
                "Iteration %d: Received %d content items from stream",
                iteration + 1,
                len(new_content),
            )
            for idx, content_item in enumerate(new_content):
                _LOGGER.debug(
                    "Iteration %d: Content item %d type: %s",
                    iteration + 1,
                    idx,
                    type(content_item).__name__,
                )
                if isinstance(content_item, conversation.AssistantContent):
                    has_tool_calls = bool(content_item.tool_calls)
                    num_tool_calls = len(content_item.tool_calls) if content_item.tool_calls else 0
                    _LOGGER.debug(
                        "Iteration %d: AssistantContent[%d] has_tool_calls=%s, num_tool_calls=%d",
                        iteration + 1,
                        idx,
                        has_tool_calls,
                        num_tool_calls,
                    )
                    if content_item.tool_calls:
                        for tc_idx, tc in enumerate(content_item.tool_calls):
                            _LOGGER.debug(
                                "Iteration %d: AssistantContent[%d] tool_call[%d]: id=%s, tool_name=%s",
                                iteration + 1,
                                idx,
                                tc_idx,
                                tc.id,
                                tc.tool_name,
                            )
                elif isinstance(content_item, conversation.ToolResultContent):
                    _LOGGER.debug(
                        "Iteration %d: ToolResultContent[%d] tool_call_id=%s, tool_name=%s",
                        iteration + 1,
                        idx,
                        content_item.tool_call_id,
                        content_item.tool_name,
                    )

            # Track LLM latency
            llm_latency = int((time.time() - llm_start) * 1000)
            metrics["performance"]["llm_latency_ms"] += llm_latency

            # Track token usage from stream (already normalized by handler)
            usage = handler.get_usage()
            if usage:
                metrics["tokens"]["prompt"] += usage.get("prompt", 0)
                metrics["tokens"]["completion"] += usage.get("completion", 0)
                metrics["tokens"]["total"] += usage.get("total", 0)
                _LOGGER.info("Received token usage from LLM stream: %s", usage)
            else:
                _LOGGER.info("No token usage data received from LLM stream")

            # Convert new content back to messages for next iteration
            for content_item in new_content:
                if isinstance(content_item, conversation.AssistantContent):
                    # Build a single message with both content and tool_calls
                    # Always include content (empty string if None) for llama.cpp compatibility
                    msg = {"role": "assistant", "content": content_item.content or ""}

                    if content_item.tool_calls:
                        # Track tool calls
                        metrics["tool_calls"] += len(content_item.tool_calls)

                        # Add tool calls to message
                        msg["tool_calls"] = [
                            {
                                "id": tc.id,
                                "type": "function",
                                "function": {
                                    "name": tc.tool_name,
                                    "arguments": json.dumps(tc.tool_args),
                                },
                            }
                            for tc in content_item.tool_calls
                        ]

                    messages.append(msg)

                elif isinstance(content_item, conversation.ToolResultContent):
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": content_item.tool_call_id,
                            "name": content_item.tool_name,
                            "content": json.dumps(content_item.tool_result),
                        }
                    )

            # Check if we need another iteration using two conditions:
            # 1. Check the LAST AssistantContent (not any) - because HA may yield multiple
            #    AssistantContent items in one iteration (one with tool_calls, then one
            #    with the final response after tool execution)
            # 2. Also check chat_log.unresponded_tool_results as a fallback signal from HA
            last_assistant_content = None
            for content_item in reversed(new_content):
                if isinstance(content_item, conversation.AssistantContent):
                    last_assistant_content = content_item
                    break

            _LOGGER.debug("Iteration %d: Checking loop continuation conditions", iteration + 1)
            _LOGGER.debug(
                "Iteration %d: last_assistant_content is None: %s",
                iteration + 1,
                last_assistant_content is None,
            )
            if last_assistant_content is not None:
                has_tool_calls = bool(last_assistant_content.tool_calls)
                num_tool_calls = (
                    len(last_assistant_content.tool_calls)
                    if last_assistant_content.tool_calls
                    else 0
                )
                _LOGGER.debug(
                    "Iteration %d: last_assistant_content.tool_calls: %s (count: %d)",
                    iteration + 1,
                    has_tool_calls,
                    num_tool_calls,
                )
                if last_assistant_content.tool_calls:
                    for tc_idx, tc in enumerate(last_assistant_content.tool_calls):
                        _LOGGER.debug(
                            "Iteration %d: last_assistant_content tool_call[%d]: id=%s, tool_name=%s",
                            iteration + 1,
                            tc_idx,
                            tc.id,
                            tc.tool_name,
                        )
            _LOGGER.debug(
                "Iteration %d: chat_log.unresponded_tool_results: %s",
                iteration + 1,
                chat_log.unresponded_tool_results,
            )

            # Break if: no content, OR last AssistantContent has no tool_calls,
            # OR HA signals no unresponded tool results
            if (
                last_assistant_content is None
                or not last_assistant_content.tool_calls
                or not chat_log.unresponded_tool_results
            ):
                _LOGGER.debug(
                    "Iteration %d: BREAKING loop - Reason: last_assistant_content is None=%s, "
                    "last_assistant_content.tool_calls empty=%s, unresponded_tool_results empty=%s",
                    iteration + 1,
                    last_assistant_content is None,
                    not last_assistant_content.tool_calls if last_assistant_content else "N/A",
                    not chat_log.unresponded_tool_results,
                )
                break
            else:
                _LOGGER.debug(
                    "Iteration %d: CONTINUING loop - last_assistant_content has tool_calls AND "
                    "chat_log has unresponded_tool_results",
                    iteration + 1,
                )

        # Save to conversation history if enabled
        if self.config.get(CONF_HISTORY_ENABLED, True):
            # Extract final response from chat log
            final_response = ""
            for content_item in new_content:
                if isinstance(content_item, conversation.AssistantContent) and content_item.content:
                    final_response = content_item.content
                    break

            self.conversation_manager.add_message(conversation_id, "user", user_message)
            if final_response:
                self.conversation_manager.add_message(conversation_id, "assistant", final_response)

        # Extract and store memories if enabled (fire and forget)
        if self.config.get(CONF_MEMORY_ENABLED, DEFAULT_MEMORY_ENABLED):
            # Extract final response for memory extraction
            final_response = ""
            for content_item in new_content:
                if isinstance(content_item, conversation.AssistantContent) and content_item.content:
                    final_response = content_item.content
                    break

            if final_response:
                self.hass.async_create_task(
                    self._extract_and_store_memories(
                        conversation_id=conversation_id,
                        user_message=user_message,
                        assistant_response=final_response,
                        full_messages=messages,
                        user_id=user_id,
                    )
                )

        # Calculate total duration
        duration_ms = int((time.time() - start_time) * 1000)

        # Get tool metrics
        tool_metrics = self.tool_handler.get_metrics()
        tool_breakdown = {}
        for tool_name in self.tool_handler.get_registered_tools():
            count = tool_metrics.get(f"{tool_name}_executions", 0)
            if count > 0:
                tool_breakdown[tool_name] = count

        # Check if external LLM was used
        used_external_llm = (
            TOOL_QUERY_EXTERNAL_LLM in tool_breakdown
            and tool_breakdown[TOOL_QUERY_EXTERNAL_LLM] > 0
        )

        # Build trace steps
        steps = self._build_trace_steps(
            agent_context, metrics, duration_ms,
            tool_breakdown, final_response or "",
            user_input=user_message,
            context_messages=metrics.get("_context_messages"),
            tools=metrics.get("_tools"),
        )
        # Aggregate tokens_per_sec from target step
        llm_lat_stream = metrics.get("performance", {}).get("llm_latency_ms", 0)
        comp_stream = metrics.get("tokens", {}).get("completion", 0)
        tps_stream = (
            round(comp_stream / (llm_lat_stream / 1000), 1)
            if llm_lat_stream > 0
            else 0
        )

        # Fire conversation finished event with enhanced metrics
        if self.config.get(CONF_EMIT_EVENTS, True):
            try:
                event_data: dict[str, Any] = {
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "user_message": user_message,
                    "response_text": final_response or "",
                    "model": self.config.get(CONF_LLM_MODEL, "unknown"),
                    "duration_ms": duration_ms,
                    "tokens": metrics["tokens"],
                    "performance": metrics["performance"],
                    "context": metrics.get("context", {}),
                    "tool_calls": metrics["tool_calls"],
                    "tool_breakdown": tool_breakdown,
                    "used_external_llm": used_external_llm,
                    "tokens_per_sec": tps_stream,
                    "steps": steps,
                }
                if agent_context:
                    event_data["routed_agent"] = agent_context.agent_id
                    event_data["routing_reason"] = agent_context.routing_reason
                self.hass.bus.async_fire(EVENT_CONVERSATION_FINISHED, event_data)
            except Exception as event_err:
                _LOGGER.warning("Failed to fire conversation finished event: %s", event_err)

        # Update session activity to prevent expiration of active conversations
        await self.session_manager.update_activity(
            user_id=user_id,
            device_id=device_id,
        )

        # Extract result from chat log
        return conversation.async_get_result_from_chat_log(user_input, chat_log)

    async def _async_process_synchronous(
        self,
        user_input: ha_conversation.ConversationInput,
        agent_context: AgentContext | None = None,
    ) -> ha_conversation.ConversationResult:
        """Process conversation without streaming (backward compatible mode).

        This is the original processing logic, preserved for backward compatibility
        and as a fallback when streaming fails.

        Args:
            user_input: The conversation input
            agent_context: Optional orchestrator-resolved agent context

        Returns:
            ConversationResult with the complete response
        """
        # Use the existing process_message method
        response_text = await self.process_message(
            text=user_input.text,
            conversation_id=user_input.conversation_id,
            user_id=user_input.context.user_id if user_input.context else None,
            device_id=user_input.device_id,
            agent_context=agent_context,
        )

        # Create and return conversation result
        intent_response = intent.IntentResponse(language=user_input.language)
        intent_response.async_set_speech(response_text)

        return ha_conversation.ConversationResult(
            response=intent_response,
            conversation_id=user_input.conversation_id,
        )

    async def _process_conversation(
        self,
        user_message: str,
        conversation_id: str,
        device_id: str | None = None,
        metrics: dict[str, Any] | None = None,
        user_id: str | None = None,
        agent_context: AgentContext | None = None,
    ) -> str:
        """Process a conversation with tool calling loop.

        Args:
            user_message: User's message
            conversation_id: Conversation ID for history
            device_id: Device ID that triggered the conversation
            metrics: Optional metrics dictionary to populate
            user_id: User ID for the conversation
            agent_context: Optional orchestrator-resolved agent context

        Returns:
            Final response text
        """
        if metrics is None:
            metrics = {}

        # Get context from context manager with timing
        context_start = time.time()
        context = await self.context_manager.get_formatted_context(
            user_message, conversation_id, metrics
        )
        context_latency_ms = int((time.time() - context_start) * 1000)

        if "performance" in metrics:
            metrics["performance"]["context_latency_ms"] = context_latency_ms

        # Build system prompt — use orchestrator-routed agent prompt when available
        if agent_context and agent_context.system_prompt:
            system_prompt = agent_context.system_prompt
            if context:
                system_prompt += "\n\n## Available Devices\n\n" + context
        else:
            system_prompt = self._build_system_prompt(
                entity_context=context,
                conversation_id=conversation_id,
                device_id=device_id,
                user_message=user_message,
            )

        # Debug: Log context injection
        if context:
            _LOGGER.debug(
                "Entity context injected: %d chars, contains %d entities",
                len(context),
                context.count('"entity_id"') if isinstance(context, str) else 0,
            )

        # Build messages list
        messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]

        # Add conversation history if enabled
        if self.config.get(CONF_HISTORY_ENABLED, True):
            history = self.conversation_manager.get_history(
                conversation_id,
                max_messages=self.config.get(
                    CONF_HISTORY_MAX_MESSAGES, DEFAULT_HISTORY_MAX_MESSAGES
                ),
            )
            messages.extend(history)

        # Add current user message
        messages.append({"role": "user", "content": user_message})

        # Snapshot initial context for debug trace (before tool loop mutates messages)
        if metrics is not None:
            metrics["_context_messages"] = [
                {"role": m["role"], "content": m.get("content", "")[:100000]}
                for m in messages
            ]

        # Get tool definitions — filtered by agent if routed
        if agent_context:
            tool_definitions = self.tool_handler.get_tool_definitions_for_agent(
                agent_context.tool_names
            )
        else:
            tool_definitions = self.tool_handler.get_tool_definitions()

        # Snapshot tool definitions for debug trace
        if metrics is not None:
            metrics["_tools"] = tool_definitions or []

        # Resolve LLM config override for this agent
        sync_config_override = agent_context.flat_config if agent_context else None

        # Tool calling loop
        max_iterations = self.config.get(CONF_TOOLS_MAX_CALLS_PER_TURN, 5)
        iteration = 0
        total_llm_latency_ms = 0
        total_tool_latency_ms = 0

        while iteration < max_iterations:
            iteration += 1

            # Call LLM with timing
            llm_start = time.time()
            llm_response = await self._call_llm(
                messages, tools=tool_definitions, config_override=sync_config_override
            )
            llm_latency_ms = int((time.time() - llm_start) * 1000)
            total_llm_latency_ms += llm_latency_ms

            # Track TTFT on first iteration (for non-streaming, TTFT = full response time)
            if iteration == 1 and "performance" in metrics:
                metrics["performance"]["ttft_ms"] = llm_latency_ms

            # Track token usage from LLM response
            # Handles both OpenAI (prompt_tokens) and Anthropic (input_tokens) formats
            usage = llm_response.get("usage", {})
            if usage and "tokens" in metrics:
                from ..helpers import normalize_usage

                norm = normalize_usage(usage)
                metrics["tokens"]["prompt"] += norm["prompt"]
                metrics["tokens"]["completion"] += norm["completion"]
                metrics["tokens"]["total"] += norm["total"]

            # Extract response message
            response_message = llm_response.get("choices", [{}])[0].get("message", {})

            # Ensure content is never null for llama.cpp compatibility
            # (llama.cpp chat templates crash on null content with "lstrip on null" error)
            if response_message.get("content") is None:
                response_message["content"] = ""

            # Log response for debugging
            _LOGGER.debug(
                "LLM response (iteration %d): content=%s, has_tool_calls=%s",
                iteration,
                bool(response_message.get("content")),
                bool(response_message.get("tool_calls")),
            )

            # Check if LLM wants to call tools
            tool_calls = response_message.get("tool_calls", [])

            # Always log tool call detection for debugging
            if tool_calls:
                _LOGGER.info("Detected %d tool call(s) from LLM", len(tool_calls))
            else:
                _LOGGER.info("No tool calls in LLM response")

            if not tool_calls:
                # No tool calls, we're done
                # Strip thinking blocks from reasoning models before returning
                raw_content = response_message.get("content") or ""
                final_content = strip_thinking_blocks(raw_content) or ""

                # Log if we got an empty response
                if not final_content:
                    _LOGGER.error(
                        "LLM returned empty content after iteration %d. Response message: %s",
                        iteration,
                        response_message,
                    )
                    # Provide an error message instead of misleading success message
                    final_content = (
                        "There was an error completing your request. "
                        "The assistant did not provide a response."
                    )

                # Update final performance metrics
                if "performance" in metrics:
                    metrics["performance"]["llm_latency_ms"] = total_llm_latency_ms
                    metrics["performance"]["tool_latency_ms"] = total_tool_latency_ms

                # Save to conversation history
                if self.config.get(CONF_HISTORY_ENABLED, True):
                    self.conversation_manager.add_message(conversation_id, "user", user_message)
                    self.conversation_manager.add_message(
                        conversation_id, "assistant", final_content
                    )

                # Extract and store memories if enabled (fire and forget)
                if self.config.get(CONF_MEMORY_ENABLED, DEFAULT_MEMORY_ENABLED):
                    self.hass.async_create_task(
                        self._extract_and_store_memories(
                            conversation_id=conversation_id,
                            user_message=user_message,
                            assistant_response=final_content,
                            full_messages=messages,
                            user_id=user_id,
                        )
                    )

                return final_content

            # Execute tool calls
            _LOGGER.info("Executing %d tool call(s)", len(tool_calls))

            # Enforce tool call limit
            max_calls = self.config.get(
                CONF_TOOLS_MAX_CALLS_PER_TURN, DEFAULT_TOOLS_MAX_CALLS_PER_TURN
            )
            if len(tool_calls) > max_calls:
                _LOGGER.warning(
                    "LLM requested %d tool calls, but limit is %d. Only executing first %d.",
                    len(tool_calls),
                    max_calls,
                    max_calls,
                )
                tool_calls = tool_calls[:max_calls]

            metrics["tool_calls"] = metrics.get("tool_calls", 0) + len(tool_calls)

            # Add assistant message with tool calls to messages
            messages.append(response_message)

            # Execute each tool
            for tool_call in tool_calls:
                tool_name = tool_call.get("function", {}).get("name", "")
                tool_args_raw = tool_call.get("function", {}).get("arguments", "{}")
                tool_call_id = tool_call.get("id", "")

                try:
                    # Parse tool arguments - handle both string (OpenAI) and dict (Ollama) formats
                    if isinstance(tool_args_raw, str):
                        tool_args = json.loads(tool_args_raw)
                        _LOGGER.info("Tool '%s': parsed arguments from JSON string", tool_name)
                    elif isinstance(tool_args_raw, dict):
                        tool_args = tool_args_raw
                        _LOGGER.info("Tool '%s': using dict arguments (Ollama format)", tool_name)
                    else:
                        _LOGGER.error(
                            "Invalid tool arguments type for '%s': %s",
                            tool_name,
                            type(tool_args_raw),
                        )
                        tool_args = {}

                    # Execute tool with timing
                    _LOGGER.info("Calling tool '%s' with args: %s", tool_name, tool_args)
                    tool_start = time.time()
                    result = await self.tool_handler.execute_tool(
                        tool_name, tool_args, conversation_id
                    )
                    _LOGGER.info(
                        "Tool '%s' completed successfully in %.2fms",
                        tool_name,
                        (time.time() - tool_start) * 1000,
                    )
                    tool_latency_ms = int((time.time() - tool_start) * 1000)
                    total_tool_latency_ms += tool_latency_ms

                    # Add tool result to messages
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call_id,
                            "name": tool_name,
                            "content": json.dumps(result),
                        }
                    )

                except Exception as err:
                    _LOGGER.error("Tool execution failed: %s", err)
                    # Add error result
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call_id,
                            "name": tool_name,
                            "content": json.dumps(
                                {
                                    "success": False,
                                    "error": str(err),
                                }
                            ),
                        }
                    )

            # Continue loop to get LLM's response with tool results

        # Update final performance metrics
        if "performance" in metrics:
            metrics["performance"]["llm_latency_ms"] = total_llm_latency_ms
            metrics["performance"]["tool_latency_ms"] = total_tool_latency_ms

        # Max iterations reached
        _LOGGER.warning("Max tool calling iterations reached")
        return (
            "I apologize, but I couldn't complete your request after "
            "multiple attempts. Please try rephrasing your request."
        )

    async def clear_history(self, conversation_id: str | None = None) -> None:
        """Clear conversation history.

        Args:
            conversation_id: Specific conversation to clear, or None for all
        """
        if conversation_id:
            self.conversation_manager.clear_history(conversation_id)
            _LOGGER.info("Cleared history for conversation %s", conversation_id)
        else:
            self.conversation_manager.clear_all()
            _LOGGER.info("Cleared all conversation history")

    async def reload_context(self) -> None:
        """Reload entity context (useful after entity changes)."""
        # Context is fetched fresh each time, but we can clear cache
        _LOGGER.info("Context reload requested (context is fetched dynamically)")

    async def execute_tool_debug(
        self,
        tool_name: str,
        parameters: dict[str, Any],
    ) -> dict[str, Any]:
        """Execute a tool directly for debugging/testing.

        Args:
            tool_name: Name of the tool to execute
            parameters: Tool parameters

        Returns:
            Tool execution result
        """
        _LOGGER.info("Debug tool execution: %s", tool_name)
        return await self.tool_handler.execute_tool(tool_name, parameters, "debug")

    async def update_config(self, config: dict[str, Any]) -> None:
        """Update agent configuration.

        Args:
            config: New configuration dictionary
        """
        self.config.update(config)

        # Update sub-components
        await self.context_manager.update_config(config)
        self.conversation_manager.update_limits(
            max_messages=config.get(CONF_HISTORY_MAX_MESSAGES),
            max_tokens=config.get(CONF_HISTORY_MAX_TOKENS),
        )

        _LOGGER.info("Agent configuration updated")
