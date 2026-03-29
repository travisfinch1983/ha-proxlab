"""MCP Manager — central orchestrator for MCP server marketplace.

Handles repo management, server CRUD, catalog merging, and server lifecycle.
Follows the AgentRegistry pattern for HA Store persistence.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from typing import Any
from uuid import uuid4

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    DOMAIN,
    MCP_DEFAULT_REPO_URL,
    MCP_STORAGE_KEY,
    MCP_STORAGE_VERSION,
    MCP_TRANSPORT_STDIO,
)
from .mcp_hub import McpServerConnection

_LOGGER = logging.getLogger(__name__)

REPO_FETCH_TIMEOUT = 10  # seconds
REPO_CACHE_TTL = 3600  # 1 hour
RECONNECT_INTERVAL = 60  # seconds


def _repo_id(url: str) -> str:
    """Generate a stable repo ID from URL."""
    return hashlib.sha256(url.encode()).hexdigest()[:12]


def _manifest_url(repo_url: str) -> str:
    """Convert a GitHub/Gitea repo URL to raw manifest URL."""
    url = repo_url.rstrip("/")

    # GitHub: https://github.com/owner/repo -> raw URL
    if "github.com" in url:
        parts = url.split("github.com/")[-1].split("/")
        if len(parts) >= 2:
            owner, repo = parts[0], parts[1]
            return f"https://raw.githubusercontent.com/{owner}/{repo}/main/manifest.json"

    # Gitea: {base}/{owner}/{repo} -> raw URL
    if "//" in url:
        # Try generic Gitea-style raw URL
        return f"{url}/raw/branch/main/manifest.json"

    return f"{url}/manifest.json"


class McpManager:
    """Central manager for MCP servers and repos."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self.hass = hass
        self._entry_id = entry_id
        self._store = Store(hass, MCP_STORAGE_VERSION, MCP_STORAGE_KEY)
        self._data: dict[str, Any] = {"repos": {}, "servers": {}}
        self._connections: dict[str, McpServerConnection] = {}
        self._manifest_cache: dict[str, tuple[float, dict]] = {}  # repo_id -> (timestamp, manifest)
        self._reconnect_task: asyncio.Task | None = None
        self._shutting_down = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def async_load(self) -> None:
        """Load persisted config and connect enabled servers."""
        stored = await self._store.async_load()
        if stored:
            self._data = stored
        else:
            self._data = {"repos": {}, "servers": {}}

        # Auto-add default repo on first load
        if not self._data["repos"]:
            rid = _repo_id(MCP_DEFAULT_REPO_URL)
            self._data["repos"][rid] = {
                "url": MCP_DEFAULT_REPO_URL,
                "name": "ProxLab MCP Servers",
                "added_at": time.time(),
                "last_fetched": 0,
                "servers_available": 0,
            }
            await self._save()

        # Connect enabled servers (non-blocking)
        for server_id, server_cfg in self._data["servers"].items():
            if server_cfg.get("enabled", True):
                self.hass.async_create_task(self._connect_server(server_id))

        # Start reconnect loop
        self._reconnect_task = self.hass.async_create_task(self._reconnect_loop())

        _LOGGER.info(
            "McpManager loaded: %d repos, %d servers",
            len(self._data["repos"]),
            len(self._data["servers"]),
        )

    async def async_shutdown(self) -> None:
        """Disconnect all servers and stop background tasks."""
        self._shutting_down = True

        if self._reconnect_task and not self._reconnect_task.done():
            self._reconnect_task.cancel()
            try:
                await self._reconnect_task
            except asyncio.CancelledError:
                pass

        for conn in self._connections.values():
            await conn.disconnect()
        self._connections.clear()

        _LOGGER.info("McpManager shut down")

    async def _save(self) -> None:
        """Persist current state to HA Store."""
        await self._store.async_save(self._data)

    # ------------------------------------------------------------------
    # Repo CRUD
    # ------------------------------------------------------------------

    async def add_repo(self, url: str) -> dict[str, Any]:
        """Add a repository URL and fetch its manifest."""
        url = url.rstrip("/")
        rid = _repo_id(url)

        if rid in self._data["repos"]:
            # Already exists, just refresh
            return await self.refresh_repo(rid)

        repo = {
            "url": url,
            "name": url.split("/")[-1],  # default name from URL
            "added_at": time.time(),
            "last_fetched": 0,
            "servers_available": 0,
        }
        self._data["repos"][rid] = repo
        await self._save()

        # Fetch manifest
        manifest = await self._fetch_manifest(url)
        if manifest:
            repo["name"] = manifest.get("name", repo["name"])
            repo["last_fetched"] = time.time()
            repo["servers_available"] = len(manifest.get("servers", []))
            self._manifest_cache[rid] = (time.time(), manifest)
            await self._save()

        return {"id": rid, **repo}

    async def remove_repo(self, repo_id: str) -> None:
        """Remove a repository."""
        if repo_id not in self._data["repos"]:
            raise ValueError(f"Repo {repo_id} not found")

        del self._data["repos"][repo_id]
        self._manifest_cache.pop(repo_id, None)
        await self._save()

    async def refresh_repo(self, repo_id: str) -> dict[str, Any]:
        """Re-fetch a repo's manifest."""
        repo = self._data["repos"].get(repo_id)
        if not repo:
            raise ValueError(f"Repo {repo_id} not found")

        manifest = await self._fetch_manifest(repo["url"])
        if manifest:
            repo["name"] = manifest.get("name", repo["name"])
            repo["last_fetched"] = time.time()
            repo["servers_available"] = len(manifest.get("servers", []))
            self._manifest_cache[repo_id] = (time.time(), manifest)
            await self._save()

        return {"id": repo_id, **repo}

    def list_repos(self) -> list[dict[str, Any]]:
        """List all configured repos."""
        return [{"id": rid, **repo} for rid, repo in self._data["repos"].items()]

    async def _fetch_manifest(self, repo_url: str) -> dict[str, Any] | None:
        """Fetch manifest.json from a repo URL."""
        url = _manifest_url(repo_url)
        try:
            timeout = aiohttp.ClientTimeout(total=REPO_FETCH_TIMEOUT)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url) as resp:
                    if resp.status != 200:
                        _LOGGER.warning(
                            "Failed to fetch manifest from %s: HTTP %d", url, resp.status
                        )
                        return None
                    return await resp.json()
        except Exception as err:
            _LOGGER.error("Failed to fetch manifest from %s: %s", url, err)
            return None

    # ------------------------------------------------------------------
    # Catalog
    # ------------------------------------------------------------------

    async def get_catalog(self) -> list[dict[str, Any]]:
        """Get merged catalog from all repos, with installed status."""
        catalog = []
        installed_catalog_ids = {
            s["catalog_id"] for s in self._data["servers"].values()
        }

        for repo_id, repo in self._data["repos"].items():
            manifest = await self._get_or_fetch_manifest(repo_id, repo["url"])
            if not manifest:
                continue

            for server_def in manifest.get("servers", []):
                catalog.append({
                    **server_def,
                    "installed": server_def.get("id", "") in installed_catalog_ids,
                    "repo_id": repo_id,
                    "repo_name": repo.get("name", ""),
                })

        return catalog

    async def _get_or_fetch_manifest(
        self, repo_id: str, repo_url: str
    ) -> dict[str, Any] | None:
        """Get cached manifest or fetch fresh one."""
        cached = self._manifest_cache.get(repo_id)
        if cached:
            ts, manifest = cached
            if time.time() - ts < REPO_CACHE_TTL:
                return manifest

        manifest = await self._fetch_manifest(repo_url)
        if manifest:
            self._manifest_cache[repo_id] = (time.time(), manifest)
        return manifest

    # ------------------------------------------------------------------
    # Server CRUD
    # ------------------------------------------------------------------

    async def create_server(self, data: dict[str, Any]) -> dict[str, Any]:
        """Install/create a new MCP server configuration."""
        server_id = uuid4().hex[:8]
        now = time.time()

        server = {
            "id": server_id,
            "name": data.get("name", "Unnamed"),
            "description": data.get("description", ""),
            "repo_id": data.get("repo_id", ""),
            "catalog_id": data.get("catalog_id", ""),
            "transport": data.get("transport", MCP_TRANSPORT_STDIO),
            "enabled": data.get("enabled", True),
            "command": data.get("command"),
            "args": data.get("args", []),
            "env": data.get("env", {}),
            "url": data.get("url"),
            "headers": data.get("headers", {}),
            "parameters": data.get("parameters", {}),
            "disabled_tools": data.get("disabled_tools", []),
            "tools": [],
            "created_at": now,
            "last_connected": None,
            "status": "disconnected",
            "error": None,
        }

        self._data["servers"][server_id] = server
        await self._save()

        # Auto-connect if enabled
        if server["enabled"]:
            await self._connect_server(server_id)
            # Update cached tools and status
            conn = self._connections.get(server_id)
            if conn:
                server["tools"] = conn.tools
                server["status"] = conn.status
                server["error"] = conn.error
                if conn.status == "connected":
                    server["last_connected"] = time.time()
                await self._save()

        return server

    async def update_server(
        self, server_id: str, updates: dict[str, Any]
    ) -> dict[str, Any]:
        """Update a server's configuration."""
        server = self._data["servers"].get(server_id)
        if not server:
            raise ValueError(f"Server {server_id} not found")

        # Apply updates to allowed fields
        allowed = {
            "name", "description", "enabled", "transport", "command", "args",
            "env", "url", "headers", "parameters", "disabled_tools",
        }
        for key, value in updates.items():
            if key in allowed:
                server[key] = value

        # Handle enable/disable toggle
        if "enabled" in updates:
            if updates["enabled"]:
                await self._connect_server(server_id)
                conn = self._connections.get(server_id)
                if conn:
                    server["tools"] = conn.tools
                    server["status"] = conn.status
                    server["error"] = conn.error
                    if conn.status == "connected":
                        server["last_connected"] = time.time()
            else:
                await self._disconnect_server(server_id)
                server["status"] = "disconnected"
                server["error"] = None
        elif {"transport", "url", "command", "args"} & updates.keys():
            # Connection config changed — reconnect if enabled
            if server.get("enabled", True):
                await self._connect_server(server_id)
                conn = self._connections.get(server_id)
                if conn:
                    if conn.tools:
                        server["tools"] = conn.tools
                    server["status"] = conn.status
                    server["error"] = conn.error
                    if conn.status == "connected":
                        server["last_connected"] = time.time()

        await self._save()
        return server

    async def delete_server(self, server_id: str) -> None:
        """Remove a server and disconnect it."""
        if server_id not in self._data["servers"]:
            raise ValueError(f"Server {server_id} not found")

        await self._disconnect_server(server_id)
        del self._data["servers"][server_id]
        await self._save()

    def list_servers(self) -> list[dict[str, Any]]:
        """List all installed servers with current status."""
        result = []
        for sid, server in self._data["servers"].items():
            # Overlay live status from connection
            conn = self._connections.get(sid)
            if conn:
                server["status"] = conn.status
                server["error"] = conn.error
                # Only overwrite tools if the connection has them;
                # keep persisted tools when the connection dropped.
                if conn.tools:
                    server["tools"] = conn.tools
            # Ensure disabled_tools key exists for older configs
            server.setdefault("disabled_tools", [])
            result.append(server)
        return result

    async def reconnect_server(self, server_id: str) -> dict[str, Any]:
        """Force reconnect a server."""
        server = self._data["servers"].get(server_id)
        if not server:
            raise ValueError(f"Server {server_id} not found")

        await self._disconnect_server(server_id)
        await self._connect_server(server_id)

        conn = self._connections.get(server_id)
        if conn:
            if conn.tools:
                server["tools"] = conn.tools
            server["status"] = conn.status
            server["error"] = conn.error
            if conn.status == "connected":
                server["last_connected"] = time.time()
            await self._save()

        return server

    # ------------------------------------------------------------------
    # Tool access (used by McpBridgeTool)
    # ------------------------------------------------------------------

    async def call_tool(
        self, server_id: str, tool_name: str, arguments: dict[str, Any]
    ) -> dict[str, Any]:
        """Call an MCP tool on a specific server."""
        conn = self._connections.get(server_id)
        if not conn:
            return {
                "success": False,
                "result": None,
                "error": f"Server {server_id} not connected",
            }
        return await conn.call_tool(tool_name, arguments)

    def get_all_tools(self) -> list[dict[str, Any]]:
        """Get all tools from all enabled servers.

        Returns a list of dicts with server_id, server_name, and tool info.
        Tools in a server's disabled_tools list are excluded.
        Uses live connection tools if available, otherwise persisted tools.
        """
        all_tools = []
        for sid, server in self._data["servers"].items():
            if not server.get("enabled", True):
                continue
            # Prefer live tools, fall back to persisted
            conn = self._connections.get(sid)
            tools = (conn.tools if conn and conn.tools else None) or server.get("tools", [])
            disabled = set(server.get("disabled_tools", []))
            for tool in tools:
                if tool.get("name") not in disabled:
                    all_tools.append({
                        "server_id": sid,
                        "server_name": server.get("name", sid),
                        **tool,
                    })
        return all_tools

    # ------------------------------------------------------------------
    # Internal connection management
    # ------------------------------------------------------------------

    async def _connect_server(self, server_id: str) -> None:
        """Create connection and connect to a server."""
        server = self._data["servers"].get(server_id)
        if not server:
            return

        # Disconnect existing connection if any
        await self._disconnect_server(server_id)

        conn = McpServerConnection(server)
        self._connections[server_id] = conn
        await conn.connect()

    async def _disconnect_server(self, server_id: str) -> None:
        """Disconnect a server."""
        conn = self._connections.pop(server_id, None)
        if conn:
            await conn.disconnect()

    async def _reconnect_loop(self) -> None:
        """Background loop to retry failed server connections."""
        while not self._shutting_down:
            await asyncio.sleep(RECONNECT_INTERVAL)

            for sid, server in self._data["servers"].items():
                if not server.get("enabled", True):
                    continue

                conn = self._connections.get(sid)
                if conn and conn.status in ("error", "disconnected"):
                    _LOGGER.debug("Retrying connection for MCP server '%s'", server.get("name"))
                    await conn.connect()
                    if conn.status == "connected":
                        server["tools"] = conn.tools
                        server["last_connected"] = time.time()
                        server["status"] = "connected"
                        server["error"] = None
                        await self._save()
                elif sid not in self._connections:
                    # Server enabled but never connected
                    await self._connect_server(sid)
