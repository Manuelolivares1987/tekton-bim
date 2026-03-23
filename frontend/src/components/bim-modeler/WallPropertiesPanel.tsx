/**
 * WallPropertiesPanel — editable properties for the selected wall.
 * All mutations go through useWallStore.updateWall() — no direct API calls.
 */
import { useState, useEffect } from "react";
import { Ruler, Layers, Link2, FileDown } from "lucide-react";
import { useWallStore } from "../../store/wall-store";
import { useToolStore } from "../../store/tool-store";
import { useProjectStore } from "../../store/project-store";

const JOINT_TYPES = [
  { value: "tablilla_osb", label: "Tablilla OSB", desc: "2 tablillas 11.1mm por junta" },
  { value: "lumber_spline", label: "Pie derecho compartido", desc: "1 stud compartido" },
  { value: "double_stud", label: "Doble pie derecho", desc: "2 studs por junta" },
];

export default function WallPropertiesPanel() {
  const { walls, wallAssemblies, updateWall, fetchSummary } = useWallStore();
  const { selectedWallId } = useToolStore();
  const { currentProjectId } = useProjectStore();

  const wall = walls.find((w) => w.id === selectedWallId);
  const assembly = selectedWallId ? wallAssemblies[selectedWallId] : null;

  const [height, setHeight] = useState(2440);
  const [thickness, setThickness] = useState(136);
  const [jointType, setJointType] = useState("tablilla_osb");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (wall) {
      setHeight(wall.height_mm);
      setThickness(wall.thickness_mm);
      // TODO: read joint_type from wall when backend exposes it in list response
      setJointType("tablilla_osb");
    }
  }, [wall]);

  if (!wall) return null;

  const handleUpdate = async (data: Record<string, unknown>) => {
    setSaving(true);
    try {
      await updateWall(wall.id, data);
      if (currentProjectId) fetchSummary(currentProjectId);
    } catch (e) {
      console.error("Failed to update wall:", e);
    } finally {
      setSaving(false);
    }
  };

  const panelCount = assembly?.panels?.length ?? wall.panel_count;
  const framingCount = assembly?.framing?.length ?? 0;
  const openingCount = wall.openings?.length ?? 0;

  const handleExportExcel = () => {
    if (!currentProjectId) return;
    window.open(`/api/v1/export/project/${currentProjectId}/cubicacion/excel`, "_blank");
  };

  return (
    <div className="w-60 flex-shrink-0 overflow-y-auto p-3 space-y-4"
      style={{ background: "var(--card)", borderLeft: "1px solid var(--border)" }}>

      {/* Wall header */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider mb-1"
          style={{ color: "var(--primary)" }}>
          {wall.label}
        </div>
        <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          {(wall.length_mm / 1000).toFixed(2)} m | {wall.panel_count} paneles | {wall.rotation_deg}°
        </div>
      </div>

      {/* Properties */}
      <div className="space-y-3">
        <PropField label="Altura (mm)" icon={<Ruler size={12} />} value={height}
          onChange={setHeight}
          onBlur={() => { if (height !== wall.height_mm) handleUpdate({ height_mm: height }); }} />

        <PropField label="Espesor (mm)" icon={<Layers size={12} />} value={thickness}
          onChange={setThickness}
          onBlur={() => { if (thickness !== wall.thickness_mm) handleUpdate({ thickness_mm: thickness }); }} />

        <div>
          <label className="flex items-center gap-1 text-[11px] font-medium mb-1"
            style={{ color: "var(--muted-foreground)" }}>
            <Link2 size={12} /> Unión entre paneles
          </label>
          <select value={jointType}
            onChange={(e) => {
              setJointType(e.target.value);
              handleUpdate({ joint_type: e.target.value });
            }}
            className="w-full text-xs rounded-lg px-2.5 py-1.5"
            style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
            {JOINT_TYPES.map((jt) => (
              <option key={jt.value} value={jt.value}>{jt.label}</option>
            ))}
          </select>
          <div className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {JOINT_TYPES.find((j) => j.value === jointType)?.desc}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ borderTop: "1px solid var(--border)" }} className="pt-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: "var(--muted-foreground)" }}>
          Assembly
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label="Paneles" value={panelCount} />
          <Stat label="Framing" value={framingCount} />
          <Stat label="Aberturas" value={openingCount} />
        </div>
      </div>

      {/* Openings list */}
      {wall.openings && wall.openings.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }} className="pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: "var(--muted-foreground)" }}>
            Aberturas
          </div>
          <div className="space-y-1">
            {wall.openings.map((op) => (
              <div key={op.id} className="flex items-center justify-between text-xs p-1.5 rounded"
                style={{ background: "var(--secondary)" }}>
                <span style={{ color: op.opening_type === "door" ? "#f5a623" : "#52a8ff" }}>
                  {op.opening_type === "door" ? "Puerta" : "Ventana"}
                </span>
                <span className="font-mono" style={{ color: "var(--muted-foreground)" }}>
                  {op.width_mm}x{op.height_mm}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export */}
      <div style={{ borderTop: "1px solid var(--border)" }} className="pt-3">
        <button onClick={handleExportExcel}
          className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium rounded-lg transition-all"
          style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
          <FileDown size={13} />
          Exportar Cubicación Excel
        </button>
      </div>

      {saving && (
        <div className="text-[10px] text-center animate-pulse" style={{ color: "var(--primary)" }}>
          Actualizando...
        </div>
      )}
    </div>
  );
}

function PropField({ label, icon, value, onChange, onBlur }: {
  label: string; icon: React.ReactNode; value: number;
  onChange: (v: number) => void; onBlur: () => void;
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-[11px] font-medium mb-1"
        style={{ color: "var(--muted-foreground)" }}>
        {icon} {label}
      </label>
      <input type="number" value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onBlur={onBlur}
        className="w-full text-xs rounded-lg px-2.5 py-1.5 font-mono"
        style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-1.5 rounded" style={{ background: "var(--secondary)" }}>
      <div className="text-sm font-bold" style={{ color: "var(--foreground)" }}>{value}</div>
      <div className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{label}</div>
    </div>
  );
}
