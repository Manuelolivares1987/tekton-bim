/**
 * OpeningDialog — modal for adding doors/windows to a wall.
 * Fully self-contained, receives callbacks via props.
 */
import { useState } from "react";

interface OpeningDialogProps {
  wallId: number;
  wallLengthMm: number;
  onApply: (data: {
    opening_type: string;
    position_along_mm: number;
    position_y_mm: number;
    width_mm: number;
    height_mm: number;
  }) => Promise<void>;
  onClose: () => void;
}

const PRESETS = {
  door: { width_mm: 900, height_mm: 2100, position_y_mm: 0, label: "Puerta estándar 900x2100" },
  window: { width_mm: 1200, height_mm: 1200, position_y_mm: 900, label: "Ventana estándar 1200x1200" },
  window_small: { width_mm: 600, height_mm: 600, position_y_mm: 1500, label: "Ventana baño 600x600" },
  window_large: { width_mm: 1800, height_mm: 1200, position_y_mm: 900, label: "Ventanal 1800x1200" },
};

export default function OpeningDialog({ wallId, wallLengthMm, onApply, onClose }: OpeningDialogProps) {
  const [type, setType] = useState<"door" | "window">("window");
  const [positionAlong, setPositionAlong] = useState(Math.round(wallLengthMm / 3));
  const [positionY, setPositionY] = useState(900);
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(1200);
  const [loading, setLoading] = useState(false);

  const applyPreset = (key: keyof typeof PRESETS) => {
    const p = PRESETS[key];
    setWidth(p.width_mm);
    setHeight(p.height_mm);
    setPositionY(p.position_y_mm);
    setType(key === "door" ? "door" : "window");
  };

  const handleApply = async () => {
    setLoading(true);
    try {
      await onApply({
        opening_type: type,
        position_along_mm: positionAlong,
        position_y_mm: positionY,
        width_mm: width,
        height_mm: height,
      });
      onClose();
    } catch {
      // keep dialog open on error
    } finally {
      setLoading(false);
    }
  };

  const maxPosition = wallLengthMm - width;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fadeIn">
      <div className="w-[420px] rounded-xl overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Agregar Abertura al Muro
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Largo del muro: {(wallLengthMm / 1000).toFixed(2)} m
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Type selector */}
          <div className="flex gap-2">
            <button onClick={() => { setType("door"); setPositionY(0); }}
              className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
              style={{
                background: type === "door" ? "rgba(245,166,35,0.15)" : "var(--secondary)",
                color: type === "door" ? "#f5a623" : "var(--muted-foreground)",
                border: `1px solid ${type === "door" ? "#f5a623" : "var(--border)"}`,
              }}>
              Puerta
            </button>
            <button onClick={() => { setType("window"); setPositionY(900); }}
              className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
              style={{
                background: type === "window" ? "rgba(82,168,255,0.15)" : "var(--secondary)",
                color: type === "window" ? "#52a8ff" : "var(--muted-foreground)",
                border: `1px solid ${type === "window" ? "#52a8ff" : "var(--border)"}`,
              }}>
              Ventana
            </button>
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(PRESETS).map(([key, p]) => (
              <button key={key} onClick={() => applyPreset(key as keyof typeof PRESETS)}
                className="text-[11px] px-2 py-1 rounded-md transition-colors"
                style={{ background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ancho (mm)" value={width} onChange={setWidth} />
            <Field label="Alto (mm)" value={height} onChange={setHeight} />
            <Field label="Posición X (mm)" value={positionAlong} onChange={setPositionAlong}
              min={0} max={maxPosition > 0 ? maxPosition : wallLengthMm} />
            <Field label="Altura base (mm)" value={positionY} onChange={setPositionY}
              disabled={type === "door"} />
          </div>

          {/* Visual position indicator */}
          <div className="rounded-lg p-3" style={{ background: "var(--secondary)" }}>
            <div className="text-[10px] mb-1.5" style={{ color: "var(--muted-foreground)" }}>Vista en planta</div>
            <div className="relative h-6 rounded" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="absolute top-0 bottom-0 rounded"
                style={{
                  left: `${(positionAlong / wallLengthMm) * 100}%`,
                  width: `${(width / wallLengthMm) * 100}%`,
                  background: type === "door" ? "rgba(245,166,35,0.4)" : "rgba(82,168,255,0.4)",
                  border: `1px solid ${type === "door" ? "#f5a623" : "#52a8ff"}`,
                }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg"
            style={{ color: "var(--muted-foreground)" }}>
            Cancelar
          </button>
          <button onClick={handleApply} disabled={loading || width <= 0 || height <= 0}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-opacity disabled:opacity-40"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
            {loading ? "Aplicando..." : "Aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, min = 0, max, disabled }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </label>
      <input type="number" value={value} min={min} max={max} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full text-sm rounded-lg px-3 py-1.5 disabled:opacity-40"
        style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
    </div>
  );
}
