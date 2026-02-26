"""Button platform for ProxLab connection health monitoring.

Provides a "Test Connection" button per connection that triggers an immediate
health re-check via the coordinator.
"""

from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .connection_health import ConnectionHealthCoordinator
from .const import CONF_CONNECTIONS, DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up button entities for each connection."""
    coordinator: ConnectionHealthCoordinator = hass.data[DOMAIN][entry.entry_id][
        "coordinator"
    ]
    connections: dict = entry.data.get(CONF_CONNECTIONS, {})

    entities = [
        ConnectionTestButton(coordinator, entry, conn_id, conn)
        for conn_id, conn in connections.items()
    ]
    async_add_entities(entities)


class ConnectionTestButton(CoordinatorEntity[ConnectionHealthCoordinator], ButtonEntity):
    """Button that triggers an immediate health check for all connections."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:connection"

    def __init__(
        self,
        coordinator: ConnectionHealthCoordinator,
        entry: ConfigEntry,
        conn_id: str,
        conn: dict,
    ) -> None:
        """Initialize."""
        super().__init__(coordinator)
        self._entry = entry
        self._conn_id = conn_id
        self._conn = conn
        self._attr_unique_id = f"{entry.entry_id}_{conn_id}_test"
        self._attr_name = "Test Connection"

    @property
    def device_info(self) -> DeviceInfo:
        """Return device info grouping all entities for this connection."""
        caps = ", ".join(self._conn.get("capabilities", []))
        return DeviceInfo(
            identifiers={(DOMAIN, f"{self._entry.entry_id}_{self._conn_id}")},
            name=self._conn.get("name", self._conn_id),
            manufacturer="ProxLab",
            model=caps,
        )

    async def async_press(self) -> None:
        """Handle button press — trigger immediate coordinator refresh."""
        await self.coordinator.async_request_refresh()
