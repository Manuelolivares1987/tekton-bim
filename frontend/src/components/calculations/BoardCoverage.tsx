import { useState, useEffect } from "react";
import { LayoutGrid, Loader2 } from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import { useIfcStore } from "../../store/ifc-store";
import {
  getBoardCoverage,
  listBoardTypes,
  type BoardCoverageResponse,
  type BoardType,
} from "../../api/board-coverage-api";

export default function BoardCoverage() {
  const { currentProjectId, getCurrentProject } = useProjectStore();
  const { currentModelId } = useIfcStore();
  const [data, setData] = useState<BoardCoverageResponse | null>(null);
  const [boardTypes, setBoardTypes] = useState<Record<string, BoardType>>({});
  const [loading, setLoading] = useState(false);
  const [boardType, setBoardType] = useState("VOLCANBOARD");
  const [wasteFactor, setWasteFactor] = useState(1.1);
  const [bothSides, setBothSides] = useState(true);

  const project = getCurrentProject();

  useEffect(() => {
    listBoardTypes().then(setBoardTypes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentModelId) return;
    setLoading(true);
    getBoardCoverage(currentModelId, {
      board_type: boardType,
      waste_factor: wasteFactor,
      both_sides: bothSides,
    })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [currentModelId, boardType, wasteFactor, bothSides]);

  if (!currentProjectId || !currentModelId) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center text-[var(--muted-foreground)]">
        <LayoutGrid size={48} className="mx-auto mb-3 opacity-50" />
        <p>Selecciona un proyecto e importa un modelo IFC para calcular revestimiento.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-[var(--muted-foreground)]">
        <Loader2 className="animate-spin" size={20} /> Calculando revestimiento...
      </div>
    );
  }

  const currentBoard = boardTypes[boardType];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <LayoutGrid className="text-cyan-400" /> Revestimiento de Muros
        </h1>
        <p className="text-[var(--muted-foreground)] mt-1">
          Cantidad de planchas necesarias para {project?.name || "proyecto"}
        </p>
      </div>

      {/* Controls */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 flex flex-wrap items-center gap-6">
        <div>
          <label className="block text-xs text-[var(--muted-foreground)] mb-1">Tipo de Plancha</label>
          <select
            value={boardType}
            onChange={(e) => setBoardType(e.target.value)}
            className="bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm"
          >
            {Object.entries(boardTypes).map(([key, bt]) => (
              <option key={key} value={key}>
                {bt.name} ({bt.width_m}x{bt.height_m}m)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--muted-foreground)] mb-1">Desperdicio</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={1.5}
              step={0.05}
              value={wasteFactor}
              onChange={(e) => setWasteFactor(parseFloat(e.target.value))}
              className="w-28 accent-cyan-500"
            />
            <span className="font-mono text-sm w-12">{((wasteFactor - 1) * 100).toFixed(0)}%</span>
          </div>
        </div>

        <div>
          <label className="block text-xs text-[var(--muted-foreground)] mb-1">Caras</label>
          <div className="flex gap-2">
            <button
              onClick={() => setBothSides(true)}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                bothSides
                  ? "bg-cyan-600 text-white"
                  : "bg-[var(--secondary)] text-[var(--muted-foreground)]"
              }`}
            >
              Ambos lados
            </button>
            <button
              onClick={() => setBothSides(false)}
              className={`px-3 py-1.5 rounded text-xs font-medium ${
                !bothSides
                  ? "bg-cyan-600 text-white"
                  : "bg-[var(--secondary)] text-[var(--muted-foreground)]"
              }`}
            >
              Un lado
            </button>
          </div>
        </div>

        {currentBoard && (
          <div className="ml-auto bg-[var(--secondary)] rounded px-4 py-2 text-xs">
            <div className="font-bold text-cyan-400">{currentBoard.name}</div>
            <div className="text-[var(--muted-foreground)]">
              {currentBoard.width_m * 1000} x {currentBoard.height_m * 1000} mm = {currentBoard.area_m2.toFixed(2)} m2/plancha
            </div>
          </div>
        )}
      </div>

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
              <div className="font-mono text-2xl font-bold text-cyan-400">{data.total_boards_needed}</div>
              <div className="text-sm text-[var(--muted-foreground)]">Planchas Totales</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
              <div className="font-mono text-2xl font-bold text-blue-400">{data.wall_count}</div>
              <div className="text-sm text-[var(--muted-foreground)]">Muros</div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
              <div className="font-mono text-2xl font-bold text-green-400">{data.total_wall_area_m2.toFixed(1)}</div>
              <div className="text-sm text-[var(--muted-foreground)]">
                {"\u00c1"}rea a Cubrir (m2)
              </div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
              <div className="font-mono text-2xl font-bold text-purple-400">{data.total_board_area_m2.toFixed(1)}</div>
              <div className="text-sm text-[var(--muted-foreground)]">
                {"\u00c1"}rea en Planchas (m2)
              </div>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
              <div className="font-mono text-2xl font-bold text-orange-400">{data.coverage_efficiency_pct}%</div>
              <div className="text-sm text-[var(--muted-foreground)]">Eficiencia</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Wall detail table */}
            <div className="col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <h3 className="font-semibold text-sm">Detalle por Muro</h3>
              </div>
              <div className="overflow-x-auto max-h-[calc(100vh-480px)] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-[var(--secondary)]">
                      <th className="text-left px-4 py-2.5 font-medium">Muro</th>
                      <th className="text-left px-4 py-2.5 font-medium">Nivel</th>
                      <th className="text-right px-4 py-2.5 font-medium">Largo (m)</th>
                      <th className="text-right px-4 py-2.5 font-medium">Alto (m)</th>
                      <th className="text-right px-4 py-2.5 font-medium">
                        {"\u00c1"}rea (m2)
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium">H x V</th>
                      <th className="text-right px-4 py-2.5 font-medium">Planchas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.walls.map((w) => (
                      <tr key={w.element_id} className="border-t border-[var(--border)]/50 hover:bg-[var(--secondary)]/50">
                        <td className="px-4 py-2 truncate max-w-[200px]" title={w.name}>{w.name}</td>
                        <td className="px-4 py-2 text-[var(--muted-foreground)] text-xs">{w.storey}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs">
                          {w.wall_length_m != null ? w.wall_length_m.toFixed(2) : "\u2014"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs">
                          {w.wall_height_m != null ? w.wall_height_m.toFixed(2) : "\u2014"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">{w.coverage_area_m2.toFixed(1)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-[var(--muted-foreground)]">
                          {w.boards_horizontal > 0 ? `${w.boards_horizontal}x${w.boards_vertical}` : "\u2014"}
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-bold text-cyan-400">{w.boards_needed}</td>
                      </tr>
                    ))}
                    {data.walls.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                          No se encontraron muros en el modelo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {data.walls.length > 0 && (
                    <tfoot>
                      <tr className="bg-[var(--secondary)] font-bold">
                        <td className="px-4 py-3" colSpan={4}>TOTAL</td>
                        <td className="px-4 py-3 text-right font-mono">{data.total_wall_area_m2.toFixed(1)}</td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3 text-right font-mono text-cyan-400">{data.total_boards_needed}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="space-y-6">
              {/* By storey */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-3">Por Nivel</h3>
                <div className="space-y-3">
                  {data.by_storey.map((s) => (
                    <div key={s.storey}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="truncate mr-2">{s.storey}</span>
                        <span className="font-mono font-bold text-cyan-400">{s.boards_needed}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[var(--secondary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-500 rounded-full"
                            style={{ width: `${(s.boards_needed / data.total_boards_needed) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-[var(--muted-foreground)] w-20 text-right">
                          {s.wall_count} muros
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick math */}
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-2 text-cyan-400">Resumen de Compra</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Plancha:</span>
                    <span className="font-mono">{data.board_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Dimensi&oacute;n:</span>
                    <span className="font-mono">{data.board_width_m * 1000} x {data.board_height_m * 1000} mm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Caras:</span>
                    <span className="font-mono">{data.both_sides ? "Ambos lados" : "Un lado"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--muted-foreground)]">Desperdicio:</span>
                    <span className="font-mono">{((data.waste_factor - 1) * 100).toFixed(0)}%</span>
                  </div>
                  <hr className="border-[var(--border)]" />
                  <div className="flex justify-between font-bold text-lg">
                    <span className="text-cyan-400">Total:</span>
                    <span className="font-mono text-cyan-400">{data.total_boards_needed} planchas</span>
                  </div>
                </div>
              </div>

              {/* Board types reference */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-2">Tipos de Plancha</h3>
                <div className="space-y-2">
                  {Object.entries(boardTypes).map(([key, bt]) => (
                    <div
                      key={key}
                      onClick={() => setBoardType(key)}
                      className={`text-xs p-2 rounded cursor-pointer transition-colors ${
                        boardType === key
                          ? "bg-cyan-500/20 border border-cyan-500/40"
                          : "bg-[var(--secondary)] hover:bg-[var(--secondary)]/80"
                      }`}
                    >
                      <div className="font-bold">{bt.name}</div>
                      <div className="text-[var(--muted-foreground)]">
                        {bt.width_m * 1000} x {bt.height_m * 1000} mm ({bt.area_m2.toFixed(2)} m2)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
