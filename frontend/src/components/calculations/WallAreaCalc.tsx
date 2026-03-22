import { useState } from "react";
import { Building, RefreshCw } from "lucide-react";
import { useIfcStore } from "../../store/ifc-store";
import { calculateWallArea } from "../../api/calculations-api";
import type { WallAreaResult } from "../../types/api";

export default function WallAreaCalc() {
  const { currentModelId } = useIfcStore();
  const [result, setResult] = useState<WallAreaResult | null>(null);
  const [includeOpenings, setIncludeOpenings] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    if (!currentModelId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await calculateWallArea(currentModelId, includeOpenings);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building className="text-green-400" /> Calculadora de Área de Muros
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1">Calcular el área total de muros en metros cuadrados</p>
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeOpenings} onChange={(e) => setIncludeOpenings(e.target.checked)} className="rounded" />
          Descontar aberturas (puertas/ventanas)
        </label>
        <button onClick={handleCalculate} disabled={!currentModelId || loading}
          className="flex items-center gap-2 bg-[var(--primary)] text-white rounded px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          {loading ? "Calculando..." : "Calcular Área de Muros"}
        </button>
      </div>

      {!currentModelId && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8 text-center text-[var(--muted-foreground)]">
          Importa un modelo IFC primero.
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">{error}</div>}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-green-400">{result.total_gross_area_m2.toFixed(2)}</div>
              <div className="text-sm text-[var(--muted-foreground)] mt-1">Área Bruta (m2)</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-blue-400">{result.total_net_area_m2.toFixed(2)}</div>
              <div className="text-sm text-[var(--muted-foreground)] mt-1">Área Neta (m2)</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 text-center">
              <div className="text-3xl font-bold">{result.wall_count}</div>
              <div className="text-sm text-[var(--muted-foreground)] mt-1">Total de Muros</div>
            </div>
          </div>

          {Object.keys(result.by_storey).length > 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6">
              <h3 className="font-semibold mb-3">Por Nivel</h3>
              <div className="space-y-2">
                {Object.entries(result.by_storey).map(([storey, area]) => (
                  <div key={storey} className="flex justify-between items-center">
                    <span>{storey}</span>
                    <span className="font-mono font-medium">{area.toFixed(2)} m2</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(result.by_type).length > 0 && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6">
              <h3 className="font-semibold mb-3">Por Tipo de Muro</h3>
              <div className="space-y-2">
                {Object.entries(result.by_type).map(([type, area]) => (
                  <div key={type} className="flex justify-between items-center">
                    <span>{type}</span>
                    <span className="font-mono font-medium">{area.toFixed(2)} m2</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
