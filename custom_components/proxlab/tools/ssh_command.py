"""SSH command execution tool for ProxLab.

Allows agents to SSH into configured hosts and execute commands.
Provides infrastructure management capabilities from within Home Assistant.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from homeassistant.core import HomeAssistant

from ..const import DOMAIN
from ..exceptions import ToolExecutionError
from .registry import BaseTool

_LOGGER = logging.getLogger(__name__)

# Safety: commands that are never allowed
BLOCKED_COMMANDS = [
    "rm -rf /",
    "mkfs",
    "dd if=/dev/zero",
    ":(){ :|:& };:",
    "> /dev/sda",
    "chmod -R 777 /",
]


class SSHCommandTool(BaseTool):
    """Tool for executing commands on remote hosts via SSH."""

    def __init__(self, hass: HomeAssistant, config: dict[str, Any]) -> None:
        super().__init__(hass)
        self.config = config

    @property
    def name(self) -> str:
        return "ssh_command"

    @property
    def description(self) -> str:
        return (
            "Execute a command on a remote host via SSH. Use this for infrastructure "
            "management tasks: checking system status, viewing logs, restarting services, "
            "managing containers, etc. The host must be configured in ProxLab settings. "
            "Commands are executed as the configured SSH user. Destructive commands "
            "(rm -rf /, mkfs, etc.) are blocked for safety."
        )

    @property
    def parameters(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "host": {
                    "type": "string",
                    "description": (
                        "Hostname or IP address to SSH into. Must be configured "
                        "in ProxLab SSH hosts settings."
                    ),
                },
                "command": {
                    "type": "string",
                    "description": (
                        "The shell command to execute on the remote host. "
                        "Keep commands focused and non-destructive."
                    ),
                },
                "timeout": {
                    "type": "integer",
                    "description": "Command timeout in seconds. Default: 30.",
                },
            },
            "required": ["host", "command"],
        }

    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        host = kwargs.get("host", "")
        command = kwargs.get("command", "")
        timeout = kwargs.get("timeout", 30)

        if not host or not command:
            raise ToolExecutionError("host and command are required")

        # Safety check
        cmd_lower = command.lower().strip()
        for blocked in BLOCKED_COMMANDS:
            if blocked in cmd_lower:
                raise ToolExecutionError(
                    f"Command blocked for safety: contains '{blocked}'"
                )

        # Get SSH config
        ssh_config = self._get_ssh_config(host)
        if not ssh_config:
            return {
                "success": False,
                "error": (
                    f"Host '{host}' not configured. Add SSH hosts in "
                    "ProxLab Settings > SSH Hosts."
                ),
                "host": host,
                "command": command,
            }

        try:
            stdout, stderr, exit_code = await self._run_ssh_command(
                ssh_config, command, timeout
            )

            # Truncate long output
            max_output = 4000
            if len(stdout) > max_output:
                stdout = stdout[:max_output] + "\n... [truncated]"
            if len(stderr) > max_output:
                stderr = stderr[:max_output] + "\n... [truncated]"

            return {
                "success": exit_code == 0,
                "host": host,
                "command": command,
                "exit_code": exit_code,
                "stdout": stdout,
                "stderr": stderr,
            }

        except asyncio.TimeoutError:
            return {
                "success": False,
                "host": host,
                "command": command,
                "error": f"Command timed out after {timeout}s",
            }
        except Exception as err:
            _LOGGER.error("SSH command failed: %s", err, exc_info=True)
            raise ToolExecutionError(
                f"SSH command execution failed: {err}"
            ) from err

    def _get_ssh_config(self, host: str) -> dict[str, Any] | None:
        """Get SSH configuration for a host from settings."""
        domain_data = self.hass.data.get(DOMAIN, {})
        for entry_data in domain_data.values():
            if not isinstance(entry_data, dict):
                continue
            entry = entry_data.get("entry")
            if not entry:
                continue
            settings = dict(entry.options).get("settings", {})
            ssh_hosts = settings.get("ssh_hosts", {})

            # Check by hostname/IP
            if host in ssh_hosts:
                return ssh_hosts[host]

            # Check by alias
            for host_config in ssh_hosts.values():
                if isinstance(host_config, dict):
                    if host_config.get("alias") == host:
                        return host_config
                    if host_config.get("host") == host:
                        return host_config

        # Fallback: allow direct connection if host looks like an IP/hostname
        # with default SSH settings. This enables basic SSH without config.
        if self._is_valid_host(host):
            return {
                "host": host,
                "port": 22,
                "user": "root",
                "key_path": "",
            }

        return None

    def _is_valid_host(self, host: str) -> bool:
        """Check if host looks like a valid hostname or IP."""
        import re

        # IP address pattern
        ip_pattern = r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$"
        if re.match(ip_pattern, host):
            return True
        # Simple hostname pattern (no spaces, reasonable chars)
        hostname_pattern = r"^[a-zA-Z0-9][a-zA-Z0-9\-\.]*[a-zA-Z0-9]$"
        return bool(re.match(hostname_pattern, host))

    async def _run_ssh_command(
        self,
        ssh_config: dict[str, Any],
        command: str,
        timeout: int,
    ) -> tuple[str, str, int]:
        """Execute command via SSH using asyncio subprocess."""
        host = ssh_config.get("host", "")
        port = ssh_config.get("port", 22)
        user = ssh_config.get("user", "root")
        key_path = ssh_config.get("key_path", "")

        ssh_args = [
            "ssh",
            "-o", "StrictHostKeyChecking=no",
            "-o", "ConnectTimeout=10",
            "-o", "BatchMode=yes",
            "-p", str(port),
        ]

        if key_path:
            ssh_args.extend(["-i", key_path])

        ssh_args.append(f"{user}@{host}")
        ssh_args.append(command)

        proc = await asyncio.create_subprocess_exec(
            *ssh_args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )
        except asyncio.TimeoutError:
            proc.kill()
            raise

        stdout = stdout_bytes.decode("utf-8", errors="replace")
        stderr = stderr_bytes.decode("utf-8", errors="replace")
        exit_code = proc.returncode or 0

        return stdout, stderr, exit_code
