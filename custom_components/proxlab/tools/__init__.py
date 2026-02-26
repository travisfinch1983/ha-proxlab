"""Tools for ProxLab integration.

This module provides the tool system for executing Home Assistant operations
and external queries through the LLM conversation interface.
"""

from __future__ import annotations

from .camera_vision import CameraVisionTool
from .ha_control import HomeAssistantControlTool
from .ha_query import HomeAssistantQueryTool
from .ha_system_log import HomeAssistantSystemLogTool
from .image_generation import ImageGenerationTool
from .registry import ToolRegistry
from .ssh_command import SSHCommandTool

__all__ = [
    "ToolRegistry",
    "CameraVisionTool",
    "HomeAssistantControlTool",
    "HomeAssistantQueryTool",
    "HomeAssistantSystemLogTool",
    "ImageGenerationTool",
    "SSHCommandTool",
]
