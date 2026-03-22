import { useState, useEffect } from "react";
import { TreePine, Loader2, Download } from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import { useIfcStore } from "../../store/ifc-store";
import { getLumberTakeoff, type LumberTakeoffResponse } from "../../api/lumber-api";

export default function LumberTakeoff() {
  const { currentProjectId, getCurrentProject } = useProjectStore();
  const { currentModelId } = useIfcStore();
  const [data, setData] = useState<LumberTakeoffResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [wasteFactor, setWasteFactor] = useState(1.1);

  const project = getCurrentProject();

  useEffect(() => {
    if (!currentModelId) return;
    setLoading(true);
    getLumberTakeoff(currentModelId, wasteFactor)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [currentModelId, wasteFactor]);

  if (!currentProjectId || !currentModelId) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center text-[var(--muted-foreground)]">
        <TreePine size={48} className="mx-auto mb-3 opacity-50" />
        <p>Selecciona un proyecto e importa un modelo IFC para calcular madera.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-[var(--muted-foreground)]">
        <Loader2 className="animate-spin" size={20} /> Calculando cubicaci&oacute;n de madera...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center text-[var(--muted-foreground)]">
        <TreePine size={48} className="mx-auto mb-3 opacity-50" />
        <p>No se pudieron obtener los datos de madera.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TreePine className="text-amber-400" /> Cubicaci&oacute;n de Madera
          </h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Cantidad de madera estructural para {project?.name || "proyecto"}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <div className="font-mono text-2xl font-bold text-amber-400">{data.total_lumber_pieces}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Piezas de Madera</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <div className="font-mono text-2xl font-bold text-blue-400">{data.total_length_m.toFixed(1)}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Metros Lineales</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <div className="font-mono text-2xl font-bold text-green-400">{data.total_volume_m3.toFixed(3)}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Volumen (m3)</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <div className="font-mono text-2xl font-bold text-purple-400">{data.total_board_feet.toFixed(0)}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Pies Tabla (BF)</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
          <div className="font-mono text-2xl font-bold text-orange-400">{data.by_size.length}</div>
          <div className="text-sm text-[var(--muted-foreground)]">Dimensiones</div>
        </div>
      </div>

      {/* Waste factor + with-waste totals */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Factor de Desperdicio:</label>
          <input
            type="range"
            min={1}
            max={1.5}
            step={0.05}
            value={wasteFactor}
            onChange={(e) => setWasteFactor(parseFloat(e.target.value))}
            className="w-32 accent-amber-500"
          />
          <span className="font-mono text-sm w-12">{((wasteFactor - 1) * 100).toFixed(0)}%</span>
        </div>
        <div className="border-l border-[var(--border)] pl-6 flex gap-6 text-sm">
          <div>
            <span className="text-[var(--muted-foreground)]">Con desperdicio: </span>
            <span className="font-mono font-bold text-amber-400">{data.total_length_with_waste_m.toFixed(1)} m</span>
          </div>
          <div>
            <span className="text-[var(--muted-foreground)]">Volumen: </span>
            <span className="font-mono font-bold text-amber-400">{data.total_volume_with_waste_m3.toFixed(3)} m3</span>
          </div>
          <div>
            <span className="text-[var(--muted-foreground)]">Pies tabla: </span>
            <span className="font-mono font-bold text-amber-400">{data.total_board_feet_with_waste.toFixed(0)} BF</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* By Size - main table */}
        <div className="col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="font-semibold text-sm">Por Dimensi&oacute;n de Madera</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--secondary)]">
                  <th className="text-left px-4 py-3 font-medium">Dimensi&oacute;n</th>
                  <th className="text-right px-4 py-3 font-medium">Piezas</th>
                  <th className="text-right px-4 py-3 font-medium">Long. (m)</th>
                  <th className="text-right px-4 py-3 font-medium">Long. (ft)</th>
                  <th className="text-right px-4 py-3 font-medium">Vol. (m3)</th>
                  <th className="text-right px-4 py-3 font-medium">Pies Tabla</th>
                  <th className="text-right px-4 py-3 font-medium">Con Desp.</th>
                </tr>
              </thead>
              <tbody>
                {data.by_size.map((item) => (
                  <tr key={item.lumber_size} className="border-t border-[var(--border)]/50 hover:bg-[var(--secondary)]/50">
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-bold text-amber-400">{item.lumber_size}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{item.count}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{item.total_length_m.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[var(--muted-foreground)]">{item.total_length_ft.toFixed(0)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{item.total_volume_m3.toFixed(4)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{item.board_feet.toFixed(0)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-amber-400 font-bold">{item.board_feet_with_waste.toFixed(0)} BF</td>
                  </tr>
                ))}
                {data.by_size.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                      No se encontraron elementos de madera en el modelo.
                    </td>
                  </tr>
                )}
              </tbody>
              {data.by_size.length > 0 && (
                <tfoot>
                  <tr className="bg-[var(--secondary)] font-bold">
                    <td className="px-4 py-3">TOTAL</td>
                    <td className="px-4 py-3 text-right font-mono">{data.total_lumber_pieces}</td>
                    <td className="px-4 py-3 text-right font-mono">{data.total_length_m.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--muted-foreground)]">{data.total_length_ft.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right font-mono">{data.total_volume_m3.toFixed(4)}</td>
                    <td className="px-4 py-3 text-right font-mono">{data.total_board_feet.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400">{data.total_board_feet_with_waste.toFixed(0)} BF</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Right column: by storey + by type */}
        <div className="space-y-6">
          {/* By Storey */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-3">Por Nivel</h3>
            <div className="space-y-2">
              {data.by_storey.map((item) => (
                <div key={item.storey} className="flex items-center justify-between text-sm">
                  <span className="truncate mr-2">{item.storey}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-2 bg-[var(--secondary)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${(item.count / data.total_lumber_pieces) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono w-10 text-right text-xs">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* By IFC Type */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-3">Por Tipo IFC</h3>
            <div className="space-y-2">
              {Object.entries(data.by_ifc_type).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-blue-400 text-xs">{type.replace("Ifc", "")}</span>
                  <span className="font-mono">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick reference */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-2 text-amber-400">Referencia R&aacute;pida</h3>
            <div className="space-y-1 text-xs text-[var(--muted-foreground)]">
              <div>1 pie tabla (BF) = 1" x 12" x 12"</div>
              <div>1 m3 = 423.78 pies tabla</div>
              <div>2x4 = 38mm x 89mm real</div>
              <div>2x3 = 38mm x 64mm real</div>
              <div>2x8 = 38mm x 184mm real</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
