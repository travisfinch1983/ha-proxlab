"""MCP Bridge Tool — wraps a single MCP tool as a ProxLab BaseTool.

Each MCP tool discovered from a connected server gets wrapped in an
McpBridgeTool instance so it can be registered in the ToolRegistry
and called by ProxLab agents.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from homeassistant.core import HomeAssistant

from .registry import BaseTool

if TYPE_CHECKING:
    from ..mcp_manager import McpManager

_LOGGER = logging.getLogger(__name__)


class McpBridgeTool(BaseTool):
    """Wraps one MCP tool for ProxLab's tool system."""

    def __init__(
        self,
        hass: HomeAssistant,
        mcp_manager: McpManager,
        server_id: str,
        server_name: str,
        tool_name: str,
        tool_description: str,
        tool_input_schema: dict[str, Any],
    ) -> None:
        super().__init__(hass)
        self._mcp_manager = mcp_manager
        self._server_id = server_id
        self._server_name = server_name
        self._tool_name = tool_name
        self._tool_description = tool_description
        self._tool_input_schema = tool_input_schema

    @property
    def name(self) -> str:
        """Collision-safe name: mcp_{server_id}_{original_name}."""
        return f"mcp_{self._server_id}_{self._tool_name}"

    @property
    def description(self) -> str:
        """Prefixed description indicating MCP source."""
        return f"[MCP: {self._server_name}] {self._tool_description}"

    @property
    def parameters(self) -> dict[str, Any]:
        """Pass through MCP tool's inputSchema."""
        if self._tool_input_schema:
            return self._tool_input_schema
        return {"type": "object", "properties": {}}

    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        """Delegate to McpManager.call_tool."""
        _LOGGER.debug(
            "MCP bridge calling %s.%s with %s",
            self._server_name,
            self._tool_name,
            list(kwargs.keys()),
        )
        return await self._mcp_manager.call_tool(
            self._server_id, self._tool_name, kwargs
        )
