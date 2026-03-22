import { useState } from "react";
import { Droplets, Calculator } from "lucide-react";
import client from "../../api/client";
import type { PipeSizingResult, PressureCalcResult } from "../../types/api";

export default function PlumbingDesign() {
  const [pipeResult, setPipeResult] = useState<PipeSizingResult | null>(null);
  const [pressureResult, setPressureResult] = useState<PressureCalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [flowGpm, setFlowGpm] = useState("10");
  const [velocityTarget, setVelocityTarget] = useState("5.0");
  const [pipeMaterial, setPipeMaterial] = useState("copper");

  const [supplyPressure, setSupplyPressure] = useState("60");
  const [elevation, setElevation] = useState("20");
  const [pipeLength, setPipeLength] = useState("100");
  const [fixtureUnits, setFixtureUnits] = useState("30");
  const [pipeDiameter, setPipeDiameter] = useState("0.75");

  const handlePipeSizing = async () => {
    setError(null);
    try {
      const { data } = await client.post("/calculations/plumbing/pipe-sizing", {
        flow_gpm: parseFloat(flowGpm), velocity_target_fps: parseFloat(velocityTarget), pipe_material: pipeMaterial,
      });
      setPipeResult(data);
    } catch (err: any) { setError(err.response?.data?.detail || err.message); }
  };

  const handlePressureCalc = async () => {
    setError(null);
    try {
      const { data } = await client.post("/calculations/plumbing/pressure", {
        supply_pressure_psi: parseFloat(supplyPressure), elevation_ft: parseFloat(elevation),
        total_pipe_length_ft: parseFloat(pipeLength), total_fixture_units: parseFloat(fixtureUnits),
        pipe_material: pipeMaterial, pipe_diameter_inches: parseFloat(pipeDiameter),
      });
      setPressureResult(data);
    } catch (err: any) { setError(err.response?.data?.detail || err.message); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Droplets className="text-cyan-400" /> Dise\u00f1o de Plomer\u00eda</h1>
        <p className="text-[var(--muted-foreground)] mt-1">Dimensionamiento de tuber\u00edas y c\u00e1lculos de presi\u00f3n seg\u00fan IPC</p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">{error}</div>}

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Calculator size={18} /> Dimensionamiento de Tuber\u00eda</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Flujo (GPM)</label>
            <input type="number" value={flowGpm} onChange={e => setFlowGpm(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Velocidad Objetivo (ft/s)</label>
            <input type="number" value={velocityTarget} onChange={e => setVelocityTarget(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Material de Tuber\u00eda</label>
            <select value={pipeMaterial} onChange={e => setPipeMaterial(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm">
              <option value="copper">Cobre</option><option value="pex">PEX</option>
              <option value="cpvc">CPVC</option><option value="pvc">PVC</option>
            </select>
          </div>
        </div>
        <button onClick={handlePipeSizing} className="bg-[var(--primary)] text-white rounded px-4 py-2 text-sm">Dimensionar Tuber\u00eda</button>
        {pipeResult && (
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="bg-[var(--secondary)] rounded p-3 text-center">
              <div className="text-xl font-bold text-cyan-400">{pipeResult.nominal_size}"</div>
              <div className="text-xs text-[var(--muted-foreground)]">Tama\u00f1o Nominal</div>
            </div>
            <div className="bg-[var(--secondary)] rounded p-3 text-center">
              <div className="text-xl font-bold">{pipeResult.diameter_mm.toFixed(1)} mm</div>
              <div className="text-xs text-[var(--muted-foreground)]">Di\u00e1metro</div>
            </div>
            <div className="bg-[var(--secondary)] rounded p-3 text-center">
              <div className="text-xl font-bold">{pipeResult.actual_velocity_fps.toFixed(2)} ft/s</div>
              <div className="text-xs text-[var(--muted-foreground)]">Velocidad</div>
            </div>
            <div className="bg-[var(--secondary)] rounded p-3 text-center">
              <div className="text-xl font-bold">{pipeResult.flow_gpm} GPM</div>
              <div className="text-xs text-[var(--muted-foreground)]">Flujo</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 space-y-4">
        <h3 className="font-semibold">An\u00e1lisis de Presi\u00f3n del Sistema</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Presi\u00f3n de Suministro (PSI)</label>
            <input type="number" value={supplyPressure} onChange={e => setSupplyPressure(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Elevaci\u00f3n (ft)</label>
            <input type="number" value={elevation} onChange={e => setElevation(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Longitud Total de Tuber\u00eda (ft)</label>
            <input type="number" value={pipeLength} onChange={e => setPipeLength(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Total Unidades de Servicio</label>
            <input type="number" value={fixtureUnits} onChange={e => setFixtureUnits(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Di\u00e1metro de Tuber\u00eda (in)</label>
            <input type="number" value={pipeDiameter} onChange={e => setPipeDiameter(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" step="0.25" />
          </div>
        </div>
        <button onClick={handlePressureCalc} className="bg-[var(--primary)] text-white rounded px-4 py-2 text-sm">Calcular Presi\u00f3n</button>
        {pressureResult && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[var(--secondary)] rounded p-3 text-center">
                <div className="text-xl font-bold">{pressureResult.supply_pressure_psi} PSI</div>
                <div className="text-xs text-[var(--muted-foreground)]">Suministro</div>
              </div>
              <div className="bg-[var(--secondary)] rounded p-3 text-center">
                <div className="text-xl font-bold text-red-400">-{pressureResult.static_loss_psi} PSI</div>
                <div className="text-xs text-[var(--muted-foreground)]">P\u00e9rdida Est\u00e1tica</div>
              </div>
              <div className="bg-[var(--secondary)] rounded p-3 text-center">
                <div className="text-xl font-bold text-red-400">-{pressureResult.friction_loss_psi} PSI</div>
                <div className="text-xs text-[var(--muted-foreground)]">P\u00e9rdida por Fricci\u00f3n</div>
              </div>
            </div>
            <div className={`rounded-lg p-4 text-center border ${pressureResult.is_adequate ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
              <div className={`text-3xl font-bold ${pressureResult.is_adequate ? "text-green-400" : "text-red-400"}`}>
                {pressureResult.available_pressure_psi} PSI
              </div>
              <div className="text-sm mt-1">
                Disponible en accesorio (m\u00edn: {pressureResult.min_fixture_pressure_psi} PSI)
                {" \u2014 "}
                <span className={pressureResult.is_adequate ? "text-green-400" : "text-red-400"}>
                  {pressureResult.is_adequate ? "ADECUADA" : "INADECUADA"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
