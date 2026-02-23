"""Text platform for ProxLab connection health monitoring.

Provides an editable URL entity per connection. Changing the URL writes back
to config entry data and triggers an immediate health re-check.
"""

from __future__ import annotations

from homeassistant.components.text import TextEntity, TextMode
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
    """Set up text entities for each connection."""
    coordinator: ConnectionHealthCoordinator = hass.data[DOMAIN][entry.entry_id][
        "coordinator"
    ]
    connections: dict = entry.data.get(CONF_CONNECTIONS, {})

    entities = [
        ConnectionUrlText(coordinator, entry, conn_id, conn)
        for conn_id, conn in connections.items()
    ]
    async_add_entities(entities)


class ConnectionUrlText(CoordinatorEntity[ConnectionHealthCoordinator], TextEntity):
    """Editable base URL for a connection endpoint."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:link-variant"
    _attr_mode = TextMode.TEXT
    _attr_native_max = 500

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
        self._attr_unique_id = f"{entry.entry_id}_{conn_id}_url"
        self._attr_name = "URL"

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
    def native_value(self) -> str | None:
        """Return the current base URL from config entry data."""
        connections = self._entry.data.get(CONF_CONNECTIONS, {})
        conn = connections.get(self._conn_id, {})
        return conn.get("base_url", "")

    async def async_set_value(self, value: str) -> None:
        """Update the connection URL in config entry data."""
        value = value.strip()
        if not value.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")

        # Build updated connections dict
        new_data = dict(self._entry.data)
        connections = dict(new_data.get(CONF_CONNECTIONS, {}))
        conn = dict(connections.get(self._conn_id, {}))
        conn["base_url"] = value
        connections[self._conn_id] = conn
        new_data[CONF_CONNECTIONS] = connections

        # Write back without full reload (avoids entity recreation flicker)
        self.hass.config_entries.async_update_entry(self._entry, data=new_data)

        # Trigger immediate health re-check
        await self.coordinator.async_request_refresh()

    @callback
    def _handle_coordinator_update(self) -> None:
        """Handle updated data from the coordinator."""
        self.async_write_ha_state()
