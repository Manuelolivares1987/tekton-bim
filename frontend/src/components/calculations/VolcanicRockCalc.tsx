import { useState, useEffect } from "react";
import { Mountain, RefreshCw } from "lucide-react";
import { useIfcStore } from "../../store/ifc-store";
import { calculateVolcanicRockByArea, calculateVolcanicRockByPanel } from "../../api/calculations-api";
import { listPanels } from "../../api/panels-api";
import type { VolcanicRockResult, Panel } from "../../types/api";

export default function VolcanicRockCalc() {
  const { currentModelId } = useIfcStore();
  const [method, setMethod] = useState<"area" | "panel">("area");
  const [result, setResult] = useState<VolcanicRockResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wallArea, setWallArea] = useState("");
  const [useModel, setUseModel] = useState(true);
  const [thickness, setThickness] = useState(80);
  const [density, setDensity] = useState(80);
  const [waste, setWaste] = useState(5);

  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => { listPanels().then(setPanels).catch(() => {}); }, []);

  const handleCalcArea = async () => {
    setLoading(true); setError(null);
    try {
      const params: any = { thickness_mm: thickness, density_kg_m3: density, waste_factor_pct: waste };
      if (useModel && currentModelId) params.model_id = currentModelId;
      else if (wallArea) params.wall_area_m2 = parseFloat(wallArea);
      else { setError("Proporcione el área de muros o seleccione un modelo IFC"); setLoading(false); return; }
      setResult(await calculateVolcanicRockByArea(params));
    } catch (err: any) { setError(err.response?.data?.detail || err.message); }
    finally { setLoading(false); }
  };

  const handleCalcPanel = async () => {
    if (!selectedPanelId) return;
    setLoading(true); setError(null);
    try { setResult(await calculateVolcanicRockByPanel(selectedPanelId, quantity)); }
    catch (err: any) { setError(err.response?.data?.detail || err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mountain className="text-orange-400" /> Calculadora de Lana de Roca
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1">Calcular requerimientos de aislamiento de lana de roca volcánica</p>
      </div>

      <div className="flex gap-1 bg-[var(--secondary)] p-1 rounded-lg w-fit">
        <button onClick={() => { setMethod("area"); setResult(null); }}
          className={`px-4 py-2 rounded text-sm font-medium ${method === "area" ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)]"}`}>
          Por Área de Muros
        </button>
        <button onClick={() => { setMethod("panel"); setResult(null); }}
          className={`px-4 py-2 rounded text-sm font-medium ${method === "panel" ? "bg-[var(--primary)] text-white" : "text-[var(--muted-foreground)]"}`}>
          Por Tipo de Panel
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">{error}</div>}

      {method === "area" && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 space-y-4">
          <h3 className="font-semibold">Método 1: Cálculo por Área</h3>
          {currentModelId && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useModel} onChange={(e) => setUseModel(e.target.checked)} />
              Usar área de muros del modelo IFC
            </label>
          )}
          {(!useModel || !currentModelId) && (
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">Área de Muros (m2)</label>
              <input type="number" value={wallArea} onChange={(e) => setWallArea(e.target.value)}
                className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" placeholder="Ingrese el área de muros..." />
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">Espesor (mm)</label>
              <select value={thickness} onChange={(e) => setThickness(Number(e.target.value))}
                className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm">
                {[25, 40, 50, 60, 80, 100, 120, 150].map(t => <option key={t} value={t}>{t} mm</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">Densidad (kg/m3)</label>
              <select value={density} onChange={(e) => setDensity(Number(e.target.value))}
                className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm">
                <option value={40}>40 - Baja (Rollos flexibles)</option>
                <option value={80}>80 - Media (Semi-rígida)</option>
                <option value={120}>120 - Alta (Paneles rígidos)</option>
                <option value={150}>150 - Extra Alta (Resistente al fuego)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">Factor de Desperdicio (%)</label>
              <input type="number" value={waste} onChange={(e) => setWaste(Number(e.target.value))}
                className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" min={0} max={30} />
            </div>
          </div>
          <button onClick={handleCalcArea} disabled={loading}
            className="flex items-center gap-2 bg-[var(--primary)] text-white rounded px-4 py-2 text-sm disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Calcular
          </button>
        </div>
      )}

      {method === "panel" && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 space-y-4">
          <h3 className="font-semibold">Método 2: Cálculo por Tipo de Panel</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">Tipo de Panel</label>
              <select value={selectedPanelId || ""} onChange={(e) => setSelectedPanelId(Number(e.target.value) || null)}
                className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm">
                <option value="">Seleccionar tipo de panel...</option>
                {panels.map(p => <option key={p.id} value={p.id}>{p.name} ({p.volcanic_rock_kg_per_unit || 0} kg/unit)</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">Cantidad</label>
              <input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" min={1} />
            </div>
          </div>
          <button onClick={handleCalcPanel} disabled={!selectedPanelId || loading}
            className="flex items-center gap-2 bg-[var(--primary)] text-white rounded px-4 py-2 text-sm disabled:opacity-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Calcular
          </button>
        </div>
      )}

      {result && (
        <div className="bg-[var(--card)] border border-orange-500/30 rounded-lg p-6">
          <h3 className="font-semibold mb-4 text-orange-400">Resultado del Cálculo</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {result.area_m2 != null && (
              <div className="bg-[var(--secondary)] rounded-lg p-4">
                <div className="text-2xl font-bold">{result.area_m2.toFixed(2)}</div>
                <div className="text-sm text-[var(--muted-foreground)]">Área de Muros (m2)</div>
              </div>
            )}
            {result.volume_m3 != null && (
              <div className="bg-[var(--secondary)] rounded-lg p-4">
                <div className="text-2xl font-bold">{result.volume_m3.toFixed(4)}</div>
                <div className="text-sm text-[var(--muted-foreground)]">Volumen (m3)</div>
              </div>
            )}
            <div className="bg-[var(--secondary)] rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-400">{result.weight_kg.toFixed(2)}</div>
              <div className="text-sm text-[var(--muted-foreground)]">Peso (kg)</div>
            </div>
            {result.weight_with_waste_kg != null && (
              <div className="bg-[var(--secondary)] rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-300">{result.weight_with_waste_kg.toFixed(2)}</div>
                <div className="text-sm text-[var(--muted-foreground)]">Con Desperdicio (kg)</div>
              </div>
            )}
            {result.panel_type_name && (
              <div className="bg-[var(--secondary)] rounded-lg p-4">
                <div className="text-lg font-bold">{result.panel_type_name}</div>
                <div className="text-sm text-[var(--muted-foreground)]">Tipo de Panel</div>
              </div>
            )}
            {result.quantity != null && (
              <div className="bg-[var(--secondary)] rounded-lg p-4">
                <div className="text-2xl font-bold">{result.quantity}</div>
                <div className="text-sm text-[var(--muted-foreground)]">Panels x {result.kg_per_unit} kg</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
