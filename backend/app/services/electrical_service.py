"""Electrical system design service (NEC-based)."""

from sqlalchemy.orm import Session

from app.models.mep_circuit import MepCircuit
from app.models.mep_electrical_device import MepElectricalDevice
from app.core.formulas.electrical import (
    calculate_current,
    apply_continuous_factor,
    select_breaker,
    select_wire_size,
    size_wire_with_voltage_drop,
    select_conduit,
    calculate_voltage_drop,
    calculate_lighting_load,
)


class ElectricalDesignService:
    """Electrical system design with NEC-compliant calculations."""

    def __init__(self, db: Session):
        self.db = db

    def calculate_branch_circuit_load(
        self,
        total_watts: float,
        voltage: float = 120.0,
        phase: str = "single",
        power_factor: float = 1.0,
        is_continuous: bool = False,
    ) -> dict:
        """Calculate branch circuit load per NEC Article 220."""
        current = calculate_current(total_watts, voltage, phase, power_factor)
        adjusted = apply_continuous_factor(current, is_continuous)
        breaker = select_breaker(adjusted)
        wire = select_wire_size(adjusted)

        return {
            "current_amps": round(current, 2),
            "adjusted_amps": round(adjusted, 2),
            "recommended_breaker_amps": breaker,
            "recommended_wire_size": wire,
        }

    def size_wire_for_circuit(
        self,
        load_amps: float,
        length_m: float,
        voltage: float = 120.0,
        max_drop_pct: float = 3.0,
        phase: str = "single",
    ) -> dict:
        """Size wire considering both ampacity and voltage drop."""
        wire_size, ampacity, vd_pct = size_wire_with_voltage_drop(
            load_amps, length_m, voltage, max_drop_pct, phase
        )
        vd_volts, _ = calculate_voltage_drop(wire_size, length_m, load_amps, voltage, phase)

        return {
            "wire_size_awg": wire_size,
            "ampacity": ampacity,
            "voltage_drop_pct": round(vd_pct, 2),
            "voltage_drop_volts": round(vd_volts, 2),
        }

    def size_conduit_for_circuit(
        self,
        wire_count: int,
        wire_size: str,
    ) -> dict:
        """Size conduit per NEC Chapter 9 fill rules."""
        conduit = select_conduit(wire_count, wire_size)
        return {
            "conduit_size": conduit,
            "wire_count": wire_count,
            "wire_size": wire_size,
        }

    def create_circuit(
        self,
        project_id: int,
        circuit_name: str,
        panel_name: str | None = None,
        phase: str = "single",
        voltage: float = 120.0,
    ) -> MepCircuit:
        """Create a new electrical circuit."""
        circuit = MepCircuit(
            project_id=project_id,
            circuit_name=circuit_name,
            panel_name=panel_name,
            phase=phase,
            voltage=voltage,
        )
        self.db.add(circuit)
        self.db.commit()
        self.db.refresh(circuit)
        return circuit

    def add_device_to_circuit(
        self,
        circuit_id: int,
        device_type: str,
        watts: float,
        location_x: float | None = None,
        location_y: float | None = None,
        location_z: float | None = None,
        storey_name: str | None = None,
        description: str | None = None,
    ) -> MepElectricalDevice:
        """Add an electrical device to a circuit."""
        device = MepElectricalDevice(
            circuit_id=circuit_id,
            device_type=device_type,
            watts=watts,
            location_x=location_x,
            location_y=location_y,
            location_z=location_z,
            storey_name=storey_name,
            description=description,
        )
        self.db.add(device)
        self.db.flush()

        # Recalculate circuit totals
        self._recalculate_circuit(circuit_id)
        self.db.commit()
        self.db.refresh(device)
        return device

    def calculate_panel_schedule(self, project_id: int) -> dict:
        """Generate panel schedule for all circuits in a project."""
        circuits = (
            self.db.query(MepCircuit)
            .filter(MepCircuit.project_id == project_id)
            .all()
        )

        schedule = []
        total_load = 0.0
        for circuit in circuits:
            devices = (
                self.db.query(MepElectricalDevice)
                .filter(MepElectricalDevice.circuit_id == circuit.id)
                .all()
            )
            circuit_load = sum(d.watts or 0 for d in devices)
            total_load += circuit_load

            schedule.append({
                "circuit_name": circuit.circuit_name,
                "panel_name": circuit.panel_name,
                "phase": circuit.phase,
                "voltage": circuit.voltage,
                "load_watts": round(circuit_load, 2),
                "breaker_amps": circuit.breaker_amps,
                "wire_size": circuit.wire_size_awg,
                "conduit_size": circuit.conduit_size,
                "device_count": len(devices),
            })

        return {
            "project_id": project_id,
            "circuits": schedule,
            "total_load_watts": round(total_load, 2),
            "total_load_kw": round(total_load / 1000.0, 2),
        }

    def _recalculate_circuit(self, circuit_id: int):
        """Recalculate circuit load and sizing."""
        circuit = self.db.query(MepCircuit).filter(MepCircuit.id == circuit_id).first()
        if not circuit:
            return

        devices = (
            self.db.query(MepElectricalDevice)
            .filter(MepElectricalDevice.circuit_id == circuit_id)
            .all()
        )

        total_watts = sum(d.watts or 0 for d in devices)
        circuit.total_load_watts = total_watts

        # Auto-size if we have enough info
        if total_watts > 0:
            load_calc = self.calculate_branch_circuit_load(
                total_watts, circuit.voltage, circuit.phase
            )
            circuit.breaker_amps = load_calc["recommended_breaker_amps"]
            circuit.wire_size_awg = load_calc["recommended_wire_size"]
