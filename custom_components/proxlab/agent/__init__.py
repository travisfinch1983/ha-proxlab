"""ProxLab conversation agent package.

This package implements the core conversation agent functionality for the ProxLab
integration. It provides the main ProxLabAgent class that orchestrates LLM interactions,
tool execution, context management, and conversation history tracking.

Architecture:
    The agent is implemented using a mixin-based architecture to separate concerns:

    - core.py: Main ProxLabAgent class and orchestration logic
    - llm.py: LLM API communication for synchronous calls
    - streaming.py: Streaming LLM support for real-time responses
    - memory_extraction.py: Automatic memory extraction from conversations

Key Components:
    ProxLabAgent: Main conversation agent class that integrates with Home Assistant's
        conversation platform. Inherits from LLMMixin, StreamingMixin, and
        MemoryExtractionMixin to provide full functionality.

Usage:
    The ProxLabAgent class is typically instantiated by the integration's __init__.py
    during config entry setup:

    Example:
        from custom_components.proxlab.agent import ProxLabAgent

        agent = ProxLabAgent(
            hass=hass,
            config=entry.data,
            session_manager=session_manager
        )

        # Process a conversation
        result = await agent.async_process(user_input)

Integration Points:
    - Home Assistant conversation platform (AbstractConversationAgent)
    - Context manager for entity and memory context injection
    - Tool handler for executing Home Assistant actions
    - Conversation history manager for multi-turn conversations
    - Memory manager for long-term memory storage
    - Session manager for persistent voice conversations

For backward compatibility, the ProxLabAgent class is re-exported from this module,
allowing imports like:
    from custom_components.proxlab.agent import ProxLabAgent
"""

from .core import ProxLabAgent

__all__ = ["ProxLabAgent"]
