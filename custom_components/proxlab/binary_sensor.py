"""Binary sensor platform for ProxLab connection health monitoring.

Provides a connectivity binary sensor per connection: on = reachable, off = down.
"""

from __future__ import annotations

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
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
    """Set up binary sensor entities for each connection."""
    coordinator: ConnectionHealthCoordinator = hass.data[DOMAIN][entry.entry_id][
        "coordinator"
    ]
    connections: dict = entry.data.get(CONF_CONNECTIONS, {})

    entities = [
        ConnectionReachableSensor(coordinator, entry, conn_id, conn)
        for conn_id, conn in connections.items()
    ]
    async_add_entities(entities)


class ConnectionReachableSensor(
    CoordinatorEntity[ConnectionHealthCoordinator], BinarySensorEntity
):
    """Binary sensor indicating whether a connection endpoint is reachable."""

    _attr_has_entity_name = True
    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY

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
        self._attr_unique_id = f"{entry.entry_id}_{conn_id}_reachable"
        self._attr_name = "Reachable"

    @property
    def device_info(self) -> DeviceInfo:
        """Return device info grouping all entities for this connection."""
        caps = ", ".join(self._conn.get("capabilities", []))
        return DeviceInfo(
            identifiers={(DOMAIN, f"{self._entry.entry_id}_{self._conn_id}")},
            name=self._conn.get("name", self._conn_id),
            manufacturer="ProxLab",
            model=caps,
            via_device=(DOMAIN, self._entry.entry_id),
        )

    @property
    def is_on(self) -> bool | None:
        """Return True if the endpoint is reachable."""
        if self.coordinator.data is None:
            return None
        result = self.coordinator.data.get(self._conn_id)
        if result is None:
            return None
        return result.reachable

    @callback
    def _handle_coordinator_update(self) -> None:
        """Handle updated data from the coordinator."""
        self.async_write_ha_state()
