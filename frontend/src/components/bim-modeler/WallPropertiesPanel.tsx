/**
 * WallPropertiesPanel — editable properties for the selected wall.
 * Shows when a wall is selected. Allows editing height, thickness, joint type.
 */
import { useState, useEffect } from "react";
import { Ruler, Layers, Link2, ChevronDown, Trash2, DoorOpen } from "lucide-react";
import { useWallStore } from "../../store/wall-store";
import { useToolStore } from "../../store/tool-store";
import * as api from "../../api/bim-modeler-api";

const JOINT_TYPES = [
  { value: "tablilla_osb", label: "Tablilla OSB", desc: "2 tablillas 11.1mm por junta" },
  { value: "lumber_spline", label: "Pie derecho compartido", desc: "1 stud compartido por junta" },
  { value: "double_stud", label: "Doble pie derecho", desc: "2 studs por junta" },
];

export default function WallPropertiesPanel() {
  const { walls, wallAssemblies, fetchWallAssembly, fetchSummary } = useWallStore();
  const { selectedWallId } = useToolStore();

  const wall = walls.find((w) => w.id === selectedWallId);
  const assembly = selectedWallId ? wallAssemblies[selectedWallId] : null;

  const [height, setHeight] = useState(2440);
  const [thickness, setThickness] = useState(136);
  const [jointType, setJointType] = useState("tablilla_osb");
  const [saving, setSaving] = useState(false);

  // Sync local state with selected wall
  useEffect(() => {
    if (wall) {
      setHeight(wall.height_mm);
      setThickness(wall.thickness_mm);
      setJointType(wall.standard_panel_width_mm ? "tablilla_osb" : "tablilla_osb"); // TODO: wall.joint_type when API exposes it
    }
  }, [wall]);

  if (!wall) return null;

  const handleSave = async (field: string, value: number | string) => {
    setSaving(true);
    try {
      await api.updateWall(wall.id, { [field]: value });
      await fetchWallAssembly(wall.id);
      // Refresh panels in wall store
      const { walls: currentWalls } = useWallStore.getState();
      const idx = currentWalls.findIndex((w) => w.id === wall.id);
      if (idx >= 0) {
        const result = await api.getWallAssembly(wall.id);
        useWallStore.setState((s) => ({
          wallAssemblies: { ...s.wallAssemblies, [wall.id]: result },
          walls: s.walls.map((w) => w.id === wall.id ? result.wall : w),
          panels: s.panels.filter((p) => p.wall_id !== wall.id).concat(result.panels),
        }));
      }
    } catch (e) {
      console.error("Failed to update wall:", e);
    } finally {
      setSaving(false);
    }
  };

  const panelCount = assembly?.panels?.length ?? wall.panel_count;
  const framingCount = assembly?.framing?.length ?? 0;
  const openingCount = wall.openings?.length ?? 0;

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
          onBlur={() => { if (height !== wall.height_mm) handleSave("height_mm", height); }} />

        <PropField label="Espesor (mm)" icon={<Layers size={12} />} value={thickness}
          onChange={setThickness}
          onBlur={() => { if (thickness !== wall.thickness_mm) handleSave("thickness_mm", thickness); }} />

        {/* Joint type */}
        <div>
          <label className="flex items-center gap-1 text-[11px] font-medium mb-1"
            style={{ color: "var(--muted-foreground)" }}>
            <Link2 size={12} /> Unión entre paneles
          </label>
          <select value={jointType}
            onChange={(e) => {
              setJointType(e.target.value);
              handleSave("joint_type", e.target.value);
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
                <div>
                  <span style={{ color: op.opening_type === "door" ? "#f5a623" : "#52a8ff" }}>
                    {op.opening_type === "door" ? "Puerta" : "Ventana"}
                  </span>
                  <span className="ml-1 font-mono" style={{ color: "var(--muted-foreground)" }}>
                    {op.width_mm}x{op.height_mm}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saving indicator */}
      {saving && (
        <div className="text-[10px] text-center animate-pulse" style={{ color: "var(--primary)" }}>
          Guardando...
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
