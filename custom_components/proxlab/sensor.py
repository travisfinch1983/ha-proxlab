"""Sensor platform for ProxLab connection health monitoring.

Provides three sensor entities per connection:
- Status: overall connection status (Connected / Unreachable / API Mismatch)
- API Check: API verification result (Pass / Fail / Unknown)
- Model: read-only model name display
"""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .connection_health import ConnectionCheckResult, ConnectionHealthCoordinator
from .const import CONF_CONNECTIONS, DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up sensor entities for each connection."""
    coordinator: ConnectionHealthCoordinator = hass.data[DOMAIN][entry.entry_id][
        "coordinator"
    ]
    connections: dict = entry.data.get(CONF_CONNECTIONS, {})

    entities: list[SensorEntity] = []
    for conn_id, conn in connections.items():
        entities.extend([
            ConnectionStatusSensor(coordinator, entry, conn_id, conn),
            ConnectionApiCheckSensor(coordinator, entry, conn_id, conn),
            ConnectionModelSensor(coordinator, entry, conn_id, conn),
        ])

    async_add_entities(entities)


class _ConnectionSensorBase(CoordinatorEntity[ConnectionHealthCoordinator], SensorEntity):
    """Base class for connection health sensors."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: ConnectionHealthCoordinator,
        entry: ConfigEntry,
        conn_id: str,
        conn: dict,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._entry = entry
        self._conn_id = conn_id
        self._conn = conn

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

    def _get_result(self) -> ConnectionCheckResult | None:
        """Get the check result for this connection."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get(self._conn_id)


class ConnectionStatusSensor(_ConnectionSensorBase):
    """Overall connection status: Connected, Unreachable, or API Mismatch."""

    _attr_icon = "mdi:lan-connect"

    def __init__(
        self,
        coordinator: ConnectionHealthCoordinator,
        entry: ConfigEntry,
        conn_id: str,
        conn: dict,
    ) -> None:
        """Initialize."""
        super().__init__(coordinator, entry, conn_id, conn)
        self._attr_unique_id = f"{entry.entry_id}_{conn_id}_status"
        self._attr_name = "Status"

    @callback
    def _handle_coordinator_update(self) -> None:
        """Handle updated data from the coordinator."""
        self.async_write_ha_state()

    @property
    def native_value(self) -> str:
        """Return the current status."""
        result = self._get_result()
        if result is None:
            return "Unknown"
        if not result.reachable:
            return "Unreachable"
        if not result.api_valid:
            return "API Mismatch"
        return "Connected"

    @property
    def extra_state_attributes(self) -> dict[str, str | None]:
        """Return detail and error as attributes."""
        result = self._get_result()
        if result is None:
            return {}
        return {"detail": result.detail, "error": result.error}


class ConnectionApiCheckSensor(_ConnectionSensorBase):
    """API verification result: Pass, Fail, or Unknown."""

    _attr_icon = "mdi:api"

    def __init__(
        self,
        coordinator: ConnectionHealthCoordinator,
        entry: ConfigEntry,
        conn_id: str,
        conn: dict,
    ) -> None:
        """Initialize."""
        super().__init__(coordinator, entry, conn_id, conn)
        self._attr_unique_id = f"{entry.entry_id}_{conn_id}_api_check"
        self._attr_name = "API Check"

    @callback
    def _handle_coordinator_update(self) -> None:
        """Handle updated data from the coordinator."""
        self.async_write_ha_state()

    @property
    def native_value(self) -> str:
        """Return the API check result."""
        result = self._get_result()
        if result is None:
            return "Unknown"
        if not result.reachable:
            return "Unknown"
        return "Pass" if result.api_valid else "Fail"


class ConnectionModelSensor(_ConnectionSensorBase):
    """Read-only model name display."""

    _attr_icon = "mdi:head-cog-outline"

    def __init__(
        self,
        coordinator: ConnectionHealthCoordinator,
        entry: ConfigEntry,
        conn_id: str,
        conn: dict,
    ) -> None:
        """Initialize."""
        super().__init__(coordinator, entry, conn_id, conn)
        self._attr_unique_id = f"{entry.entry_id}_{conn_id}_model"
        self._attr_name = "Model"

    @callback
    def _handle_coordinator_update(self) -> None:
        """Handle updated data from the coordinator."""
        self.async_write_ha_state()

    @property
    def native_value(self) -> str | None:
        """Return the model name.

        Prefers the live-detected model from the coordinator, falls back
        to the configured model name from entry.data.
        """
        result = self._get_result()
        if result is not None and result.model_name:
            return result.model_name
        return self._conn.get("model")
