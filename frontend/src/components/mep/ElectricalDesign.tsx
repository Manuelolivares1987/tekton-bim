import { useState } from "react";
import { Zap, Calculator } from "lucide-react";
import client from "../../api/client";
import type { LoadCalculationResult, WireSizingResult } from "../../types/api";

export default function ElectricalDesign() {
  const [loadResult, setLoadResult] = useState<LoadCalculationResult | null>(null);
  const [wireResult, setWireResult] = useState<WireSizingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [watts, setWatts] = useState("1800");
  const [voltage, setVoltage] = useState("120");
  const [phase, setPhase] = useState("single");
  const [continuous, setContinuous] = useState(false);

  const [wireAmps, setWireAmps] = useState("15");
  const [wireLength, setWireLength] = useState("30");
  const [wireVoltage, setWireVoltage] = useState("120");
  const [maxDrop, setMaxDrop] = useState("3.0");

  const handleLoadCalc = async () => {
    setError(null);
    try {
      const { data } = await client.post("/calculations/electrical/load", {
        total_watts: parseFloat(watts), voltage: parseFloat(voltage), phase, power_factor: 1.0, is_continuous: continuous,
      });
      setLoadResult(data);
    } catch (err: any) { setError(err.response?.data?.detail || err.message); }
  };

  const handleWireSizing = async () => {
    setError(null);
    try {
      const { data } = await client.post("/calculations/electrical/wire-sizing", {
        load_amps: parseFloat(wireAmps), length_m: parseFloat(wireLength),
        voltage: parseFloat(wireVoltage), max_drop_pct: parseFloat(maxDrop), phase,
      });
      setWireResult(data);
    } catch (err: any) { setError(err.response?.data?.detail || err.message); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="text-yellow-400" /> Dise\u00f1o El\u00e9ctrico</h1>
        <p className="text-[var(--muted-foreground)] mt-1">C\u00e1lculos de carga de circuitos y calibre de cables seg\u00fan NEC</p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">{error}</div>}

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><Calculator size={18} /> C\u00e1lculo de Carga de Circuito Derivado</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Carga Total (W)</label>
            <input type="number" value={watts} onChange={e => setWatts(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Voltaje (V)</label>
            <select value={voltage} onChange={e => setVoltage(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm">
              <option value="120">120V</option><option value="208">208V</option>
              <option value="240">240V</option><option value="480">480V</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Fase</label>
            <select value={phase} onChange={e => setPhase(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm">
              <option value="single">Monof\u00e1sico</option><option value="three">Trif\u00e1sico</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={continuous} onChange={e => setContinuous(e.target.checked)} />
            Carga continua (factor 125%)
          </label>
          <button onClick={handleLoadCalc} className="bg-[var(--primary)] text-white rounded px-4 py-2 text-sm">Calcular Carga</button>
        </div>
        {loadResult && (
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="bg-[var(--secondary)] rounded p-3 text-center">
              <div className="text-xl font-bold">{loadResult.current_amps.toFixed(1)} A</div>
              <div className="text-xs text-[var(--muted-foreground)]">Corriente</div>
            </div>
            <div className="bg-[var(--secondary)] rounded p-3 text-center">
              <div className="text-xl font-bold">{loadResult.adjusted_amps.toFixed(1)} A</div>
              <div className="text-xs text-[var(--muted-foreground)]">Ajustada</div>
            </div>
            <div className="bg-[var(--secondary)] rounded p-3 text-center">
              <div className="text-xl font-bold text-yellow-400">{loadResult.recommended_breaker_amps} A</div>
              <div className="text-xs text-[var(--muted-foreground)]">Interruptor</div>
            </div>
            <div className="bg-[var(--secondary)] rounded p-3 text-center">
              <div className="text-xl font-bold text-yellow-400">AWG {loadResult.recommended_wire_size}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Calibre</div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 space-y-4">
        <h3 className="font-semibold">Calibre de Cable con Ca\u00edda de Tensi\u00f3n</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Carga (A)</label>
            <input type="number" value={wireAmps} onChange={e => setWireAmps(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Longitud (m)</label>
            <input type="number" value={wireLength} onChange={e => setWireLength(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Voltaje (V)</label>
            <input type="number" value={wireVoltage} onChange={e => setWireVoltage(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-[var(--muted-foreground)] mb-1">Ca\u00edda M\u00e1x (%)</label>
            <input type="number" value={maxDrop} onChange={e => setMaxDrop(e.target.value)}
              className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" />
          </div>
        </div>
        <button onClick={handleWireSizing} className="bg-[var(--primary)] text-white rounded px-4 py-2 text-sm">Calcular Calibre</button>
        {wireResult && (
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="bg-[var(--secondary)] rounded p-3 text-center">
              <div className="text-xl font-bold text-yellow-400">AWG {wireResult.wire_size_awg}</div>
              <div className="text-xs text-[var(--muted-foreground)]">Calibre</div>
            </div>
            <div className="bg-[var(--secondary)] rounded p-3 text-center">
              <div className="text-xl font-bold">{wireResult.ampacity} A</div>
              <div className="text-xs text-[var(--muted-foreground)]">Ampacidad</div>
            </div>
            <div className="bg-[var(--secondary)] rounded p-3 text-center">
              <div className="text-xl font-bold">{wireResult.voltage_drop_pct.toFixed(2)}%</div>
              <div className="text-xs text-[var(--muted-foreground)]">Ca\u00edda de Tensi\u00f3n</div>
            </div>
            <div className="bg-[var(--secondary)] rounded p-3 text-center">
              <div className="text-xl font-bold">{wireResult.voltage_drop_volts.toFixed(1)} V</div>
              <div className="text-xs text-[var(--muted-foreground)]">Ca\u00edda (V)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
