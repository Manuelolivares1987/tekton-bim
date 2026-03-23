/**
 * RoofPanel — create and manage roof/techumbre.
 */
import { useState } from "react";
import { Home, Plus, Trash2, Loader2 } from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import client from "../../api/client";

interface RoofData {
  id: number;
  label: string;
  roof_type: string;
  pitch_deg: number;
  overhang_mm: number;
  ridge_height_mm: number;
  span_mm: number;
  ridge_length_mm: number;
}

const ROOF_TYPES = [
  { value: "gable", label: "2 Aguas" },
  { value: "hip", label: "4 Aguas" },
  { value: "shed", label: "1 Agua" },
  { value: "flat", label: "Plano" },
];

export default function RoofPanel() {
  const { currentProjectId } = useProjectStore();
  const [roofs, setRoofs] = useState<RoofData[]>([]);
  const [roofType, setRoofType] = useState("gable");
  const [pitch, setPitch] = useState(25);
  const [overhang, setOverhang] = useState(400);
  const [loading, setLoading] = useState(false);

  const fetchRoofs = async () => {
    if (!currentProjectId) return;
    const res = await client.get(`/roof/project/${currentProjectId}/roofs`);
    setRoofs(res.data);
  };

  const createRoof = async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      await client.post(`/roof/project/${currentProjectId}/roofs`, {
        roof_type: roofType,
        pitch_deg: pitch,
        overhang_mm: overhang,
      });
      await fetchRoofs();
    } catch (e) {
      console.error("Failed to create roof:", e);
    } finally {
      setLoading(false);
    }
  };

  const deleteRoof = async (roofId: number) => {
    await client.delete(`/roof/roofs/${roofId}`);
    await fetchRoofs();
  };

  // Fetch on mount
  useState(() => { fetchRoofs(); });

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--muted-foreground)" }}>
        Techumbre
      </div>

      {/* Create form */}
      <div className="space-y-2">
        <select value={roofType} onChange={(e) => setRoofType(e.target.value)}
          className="w-full text-xs rounded-lg px-2.5 py-1.5"
          style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
          {ROOF_TYPES.map((rt) => (
            <option key={rt.value} value={rt.value}>{rt.label}</option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Pendiente°</label>
            <input type="number" value={pitch} onChange={(e) => setPitch(Number(e.target.value))}
              className="w-full text-xs rounded-lg px-2 py-1 font-mono"
              style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
          </div>
          <div>
            <label className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Alero mm</label>
            <input type="number" value={overhang} onChange={(e) => setOverhang(Number(e.target.value))}
              className="w-full text-xs rounded-lg px-2 py-1 font-mono"
              style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }} />
          </div>
        </div>

        <button onClick={createRoof} disabled={loading}
          className="flex items-center justify-center gap-1 w-full py-1.5 text-xs font-medium rounded-lg disabled:opacity-40"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Generar Techumbre
        </button>
      </div>

      {/* Existing roofs */}
      {roofs.map((r) => (
        <div key={r.id} className="flex items-center justify-between p-2 rounded-lg text-xs"
          style={{ background: "var(--secondary)" }}>
          <div>
            <div className="flex items-center gap-1" style={{ color: "var(--foreground)" }}>
              <Home size={11} />
              <span className="font-medium">{r.label}</span>
            </div>
            <div className="mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {ROOF_TYPES.find((rt) => rt.value === r.roof_type)?.label} | {r.pitch_deg}° |
              Alero {r.overhang_mm}mm
            </div>
          </div>
          <button onClick={() => deleteRoof(r.id)} className="p-1 rounded"
            style={{ color: "var(--muted-foreground)" }}>
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
