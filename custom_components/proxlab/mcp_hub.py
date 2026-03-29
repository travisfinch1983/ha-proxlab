"""MCP Server Connection — manages a single MCP server lifecycle.

Uses the MCP Python SDK to connect via stdio, SSE, or streamable HTTP
transports and discover/call tools.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import AsyncExitStack
from typing import Any

from .const import MCP_TRANSPORT_SSE, MCP_TRANSPORT_HTTP, MCP_TRANSPORT_STDIO

_LOGGER = logging.getLogger(__name__)

CONNECT_TIMEOUT = 30  # seconds
SSE_READ_TIMEOUT = 3600  # 1 hour — SSE streams are long-lived


class McpServerConnection:
    """Manages the lifecycle of a single MCP server connection."""

    def __init__(self, server_config: dict[str, Any]) -> None:
        self._config = server_config
        self._session = None  # mcp.ClientSession
        self._exit_stack: AsyncExitStack | None = None
        self._tools: list[dict[str, Any]] = []
        self._status = "disconnected"
        self._error: str | None = None

    @property
    def status(self) -> str:
        return self._status

    @property
    def error(self) -> str | None:
        return self._error

    @property
    def tools(self) -> list[dict[str, Any]]:
        return self._tools

    @property
    def server_id(self) -> str:
        return self._config.get("id", "")

    async def connect(self) -> bool:
        """Connect to the MCP server and discover tools.

        Returns True on success, False on failure.
        """
        if self._session is not None:
            await self.disconnect()

        self._status = "starting"
        self._error = None

        try:
            transport = self._config.get("transport", MCP_TRANSPORT_STDIO)
            self._exit_stack = AsyncExitStack()

            if transport == MCP_TRANSPORT_STDIO:
                connected = await self._connect_stdio()
            elif transport == MCP_TRANSPORT_SSE:
                connected = await self._connect_sse()
            elif transport == MCP_TRANSPORT_HTTP:
                connected = await self._connect_streamable_http()
            else:
                raise ValueError(f"Unknown transport: {transport}")

            if not connected:
                return False

            # Discover tools
            tools_result = await asyncio.wait_for(
                self._session.list_tools(), timeout=CONNECT_TIMEOUT
            )
            self._tools = [
                {
                    "name": t.name,
                    "description": t.description or "",
                    "inputSchema": t.inputSchema if hasattr(t, "inputSchema") else {},
                }
                for t in tools_result.tools
            ]

            self._status = "connected"
            _LOGGER.info(
                "MCP server '%s' connected — %d tools discovered",
                self._config.get("name", self.server_id),
                len(self._tools),
            )
            return True

        except asyncio.TimeoutError:
            self._status = "error"
            self._error = "Connection timed out"
            _LOGGER.error("MCP server '%s' connect timeout", self._config.get("name"))
            await self._cleanup()
            return False
        except Exception as err:
            self._status = "error"
            self._error = str(err)
            _LOGGER.error(
                "MCP server '%s' connect failed: %s",
                self._config.get("name"),
                err,
            )
            await self._cleanup()
            return False

    async def _connect_stdio(self) -> bool:
        """Connect via stdio transport."""
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        command = self._config.get("command", "python3")
        args = self._config.get("args", [])
        env = self._config.get("env") or None

        server_params = StdioServerParameters(
            command=command,
            args=args,
            env=env,
        )

        stdio_transport = await self._exit_stack.enter_async_context(
            stdio_client(server_params)
        )
        read_stream, write_stream = stdio_transport

        self._session = await self._exit_stack.enter_async_context(
            ClientSession(read_stream, write_stream)
        )

        await asyncio.wait_for(
            self._session.initialize(), timeout=CONNECT_TIMEOUT
        )
        return True

    async def _connect_sse(self) -> bool:
        """Connect via SSE transport."""
        from mcp import ClientSession
        from mcp.client.sse import sse_client

        url = self._config.get("url", "")
        headers = self._config.get("headers") or {}

        sse_transport = await self._exit_stack.enter_async_context(
            sse_client(
                url=url,
                headers=headers,
                timeout=CONNECT_TIMEOUT,
                sse_read_timeout=SSE_READ_TIMEOUT,
            )
        )
        read_stream, write_stream = sse_transport

        self._session = await self._exit_stack.enter_async_context(
            ClientSession(read_stream, write_stream)
        )

        await asyncio.wait_for(
            self._session.initialize(), timeout=CONNECT_TIMEOUT
        )
        return True

    async def _connect_streamable_http(self) -> bool:
        """Connect via streamable HTTP transport."""
        from mcp import ClientSession
        from mcp.client.streamable_http import streamablehttp_client

        url = self._config.get("url", "")
        headers = self._config.get("headers") or {}

        http_transport = await self._exit_stack.enter_async_context(
            streamablehttp_client(url=url, headers=headers)
        )
        read_stream, write_stream, _ = http_transport

        self._session = await self._exit_stack.enter_async_context(
            ClientSession(read_stream, write_stream)
        )

        await asyncio.wait_for(
            self._session.initialize(), timeout=CONNECT_TIMEOUT
        )
        return True

    async def call_tool(
        self, tool_name: str, arguments: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Call an MCP tool and return the result.

        Returns:
            Dict with {success, result, error} keys.
        """
        if self._session is None or self._status != "connected":
            return {
                "success": False,
                "result": None,
                "error": f"MCP server not connected (status: {self._status})",
            }

        try:
            result = await asyncio.wait_for(
                self._session.call_tool(tool_name, arguments or {}),
                timeout=60,
            )

            # Extract text content from result
            text_parts = []
            for content in result.content:
                if hasattr(content, "text"):
                    text_parts.append(content.text)
                elif hasattr(content, "data"):
                    text_parts.append(str(content.data))

            return {
                "success": not result.isError if hasattr(result, "isError") else True,
                "result": "\n".join(text_parts) if text_parts else str(result.content),
                "error": None,
            }

        except asyncio.TimeoutError:
            return {
                "success": False,
                "result": None,
                "error": "Tool call timed out (60s)",
            }
        except Exception as err:
            _LOGGER.error("MCP tool '%s' call failed: %s", tool_name, err)
            return {
                "success": False,
                "result": None,
                "error": str(err),
            }

    async def disconnect(self) -> None:
        """Disconnect from the MCP server."""
        await self._cleanup()
        self._status = "disconnected"
        self._error = None
        self._tools = []

    async def _cleanup(self) -> None:
        """Clean up resources."""
        if self._exit_stack:
            try:
                await self._exit_stack.aclose()
            except Exception as err:
                _LOGGER.debug("MCP cleanup error: %s", err)
            self._exit_stack = None
        self._session = None
