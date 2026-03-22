import { useState } from "react";
import { ClipboardList, Download, RefreshCw } from "lucide-react";
import { useIfcStore } from "../../store/ifc-store";
import { runQuantityTakeoff, exportQuantityTakeoffCsv } from "../../api/calculations-api";
import type { QuantityTakeoffResponse } from "../../types/api";

export default function QuantityTakeoff() {
  const { currentModelId } = useIfcStore();
  const [result, setResult] = useState<QuantityTakeoffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!currentModelId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await runQuantityTakeoff(currentModelId);
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!currentModelId) return;
    try {
      const blob = await exportQuantityTakeoffCsv(currentModelId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "quantity_takeoff.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const grouped = result?.items.reduce<Record<string, typeof result.items>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {}) || {};

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="text-blue-400" />
            Cubicación
          </h1>
          <p className="text-[var(--muted-foreground)] mt-1">Calcular cantidades de elementos del modelo IFC</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRun} disabled={!currentModelId || loading}
            className="flex items-center gap-2 bg-[var(--primary)] text-white rounded px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            {loading ? "Calculando..." : "Ejecutar Cubicación"}
          </button>
          {result && (
            <button onClick={handleExport}
              className="flex items-center gap-2 bg-[var(--secondary)] text-[var(--foreground)] rounded px-4 py-2 text-sm hover:opacity-80">
              <Download size={16} /> Exportar CSV
            </button>
          )}
        </div>
      </div>

      {!currentModelId && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8 text-center text-[var(--muted-foreground)]">
          Importa un modelo IFC primero para ejecutar la cubicación.
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">{error}</div>}

      {result && (
        <div className="space-y-4">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <span className="text-[var(--muted-foreground)]">Total de Elementos: </span>
            <span className="font-bold text-lg">{result.total_elements}</span>
          </div>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="bg-[var(--secondary)] px-4 py-3 font-semibold">
                {category} ({items.reduce((s, i) => s + i.count, 0)})
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                    <th className="text-left px-4 py-2">Tipo</th>
                    <th className="text-left px-4 py-2">Nombre</th>
                    <th className="text-right px-4 py-2">Cantidad</th>
                    <th className="text-right px-4 py-2">Área (m2)</th>
                    <th className="text-right px-4 py-2">Volumen (m3)</th>
                    <th className="text-right px-4 py-2">Longitud (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-[var(--border)] hover:bg-[var(--secondary)]">
                      <td className="px-4 py-2">{item.ifc_type.replace("Ifc", "")}</td>
                      <td className="px-4 py-2">{item.type_name || "\u2014"}</td>
                      <td className="text-right px-4 py-2 font-medium">{item.count}</td>
                      <td className="text-right px-4 py-2">{item.total_area_m2?.toFixed(2) || "\u2014"}</td>
                      <td className="text-right px-4 py-2">{item.total_volume_m3?.toFixed(3) || "\u2014"}</td>
                      <td className="text-right px-4 py-2">{item.total_length_m?.toFixed(2) || "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
