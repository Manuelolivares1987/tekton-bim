import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { SipPanelConfig, Material } from "../../types/api";
import { createSipConfig, deleteSipConfig } from "../../api/panelization-api";
import { usePanelizationStore } from "../../store/panelization-store";
import client from "../../api/client";

interface Props {
  projectId: number;
  onConfigSelect: (config: SipPanelConfig | null) => void;
}

export default function SipConfigForm({ projectId, onConfigSelect }: Props) {
  const { sipConfigs, fetchSipConfigs, currentConfigId, setCurrentConfig } = usePanelizationStore();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    core_material_id: 0,
    core_thickness_mm: 114,
    skin_material_id: 0,
    skin_thickness_mm: 11,
    standard_width_mm: 1220,
    standard_height_mm: 2440,
    joint_type: "spline",
  });

  useEffect(() => {
    fetchSipConfigs(projectId);
    client.get("/materials").then((res) => setMaterials(res.data));
  }, [projectId, fetchSipConfigs]);

  const coreMaterials = materials.filter(
    (m) => m.category === "insulation"
  );
  const skinMaterials = materials.filter(
    (m) => m.category === "sheathing" || m.category === "finish"
  );

  const handleCreate = async () => {
    if (!formData.name || !formData.core_material_id || !formData.skin_material_id) return;
    try {
      await createSipConfig({
        project_id: projectId,
        ...formData,
        max_width_mm: formData.standard_width_mm,
        max_height_mm: 3660,
        min_panel_width_mm: 200,
        spline_material_id: null,
        spline_width_mm: 89,
        spline_depth_mm: 38,
      } as any);
      setShowForm(false);
      setFormData({ ...formData, name: "" });
      fetchSipConfigs(projectId);
    } catch (err) {
      console.error("Error creating SIP config:", err);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteSipConfig(id);
    if (currentConfigId === id) {
      setCurrentConfig(null);
      onConfigSelect(null);
    }
    fetchSipConfigs(projectId);
  };

  const handleSelect = (config: SipPanelConfig) => {
    setCurrentConfig(config.id);
    onConfigSelect(config);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Configuraciones SIP</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="p-1 rounded hover:bg-[var(--secondary)] text-[var(--primary)]"
          title="Nueva configuración"
        >
          <Plus size={16} />
        </button>
      </div>

      {showForm && (
        <div className="p-3 bg-[var(--secondary)] rounded-lg space-y-2">
          <input
            type="text"
            placeholder="Nombre (ej: SIP EPS 114mm)"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] rounded"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Núcleo</label>
              <select
                value={formData.core_material_id}
                onChange={(e) => setFormData({ ...formData, core_material_id: Number(e.target.value) })}
                className="w-full px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] rounded"
              >
                <option value={0}>Seleccionar...</option>
                {coreMaterials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Espesor núcleo</label>
              <select
                value={formData.core_thickness_mm}
                onChange={(e) => setFormData({ ...formData, core_thickness_mm: Number(e.target.value) })}
                className="w-full px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] rounded"
              >
                {[64, 89, 114, 140, 165, 210].map((t) => (
                  <option key={t} value={t}>{t} mm</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Piel</label>
              <select
                value={formData.skin_material_id}
                onChange={(e) => setFormData({ ...formData, skin_material_id: Number(e.target.value) })}
                className="w-full px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] rounded"
              >
                <option value={0}>Seleccionar...</option>
                {skinMaterials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Espesor piel</label>
              <select
                value={formData.skin_thickness_mm}
                onChange={(e) => setFormData({ ...formData, skin_thickness_mm: Number(e.target.value) })}
                className="w-full px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] rounded"
              >
                <option value={11}>11 mm</option>
                <option value={15}>15 mm</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Ancho estándar</label>
              <select
                value={formData.standard_width_mm}
                onChange={(e) => setFormData({ ...formData, standard_width_mm: Number(e.target.value) })}
                className="w-full px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] rounded"
              >
                <option value={610}>610 mm</option>
                <option value={1220}>1220 mm</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)]">Alto estándar</label>
              <select
                value={formData.standard_height_mm}
                onChange={(e) => setFormData({ ...formData, standard_height_mm: Number(e.target.value) })}
                className="w-full px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] rounded"
              >
                {[2440, 2745, 3050, 3660].map((h) => (
                  <option key={h} value={h}>{h} mm</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--muted-foreground)]">Tipo de junta</label>
            <select
              value={formData.joint_type}
              onChange={(e) => setFormData({ ...formData, joint_type: e.target.value })}
              className="w-full px-2 py-1.5 text-sm bg-[var(--background)] border border-[var(--border)] rounded"
            >
              <option value="spline">Spline (lengüeta)</option>
              <option value="cam_lock">Cam-Lock</option>
              <option value="surface_spline">Spline superficial</option>
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={!formData.name || !formData.core_material_id || !formData.skin_material_id}
            className="w-full py-1.5 text-sm bg-[var(--primary)] text-white rounded hover:opacity-90 disabled:opacity-50"
          >
            Crear Configuración
          </button>
        </div>
      )}

      {/* Config list */}
      <div className="space-y-1">
        {sipConfigs.map((config) => (
          <div
            key={config.id}
            onClick={() => handleSelect(config)}
            className={`flex items-center justify-between p-2 rounded cursor-pointer text-sm transition-colors ${
              currentConfigId === config.id
                ? "bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/30"
                : "hover:bg-[var(--secondary)] text-[var(--foreground)]"
            }`}
          >
            <div>
              <div className="font-medium">{config.name}</div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {config.core_thickness_mm}mm + 2x{config.skin_thickness_mm}mm | {config.joint_type}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(config.id); }}
              className="p-1 rounded hover:bg-red-500/10 text-[var(--muted-foreground)] hover:text-red-500"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {sipConfigs.length === 0 && (
          <p className="text-xs text-[var(--muted-foreground)] text-center py-2">
            No hay configuraciones. Crea una para comenzar.
          </p>
        )}
      </div>
    </div>
  );
}
