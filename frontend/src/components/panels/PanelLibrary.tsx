import { useState, useEffect } from "react";
import { Layers, Plus, Trash2 } from "lucide-react";
import { listPanels, createPanel, deletePanel, listMaterials } from "../../api/panels-api";
import type { Panel, Material } from "../../types/api";

export default function PanelLibrary() {
  const [panels, setPanels] = useState<Panel[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newPanel, setNewPanel] = useState({ name: "", category: "partition", description: "", volcanic_rock_kg_per_unit: "" });

  useEffect(() => {
    Promise.all([listPanels(), listMaterials()]).then(([p, m]) => { setPanels(p); setMaterials(m); setLoading(false); });
  }, []);

  const handleCreate = async () => {
    if (!newPanel.name) return;
    const panel = await createPanel({
      name: newPanel.name, category: newPanel.category,
      description: newPanel.description || undefined,
      volcanic_rock_kg_per_unit: newPanel.volcanic_rock_kg_per_unit ? parseFloat(newPanel.volcanic_rock_kg_per_unit) : undefined,
    });
    setPanels(prev => [...prev, panel]);
    setNewPanel({ name: "", category: "partition", description: "", volcanic_rock_kg_per_unit: "" });
    setShowCreate(false);
  };

  const handleDelete = async (id: number) => { await deletePanel(id); setPanels(prev => prev.filter(p => p.id !== id)); };

  if (loading) return <div className="text-center py-12 text-[var(--muted-foreground)]">Cargando paneles...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Layers className="text-purple-400" /> Paneles y Tabiques</h1>
          <p className="text-[var(--muted-foreground)] mt-1">Dise\u00f1ar y administrar tipos de paneles con capas de materiales</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-[var(--primary)] text-white rounded px-4 py-2 text-sm">
          <Plus size={16} /> Nuevo Tipo de Panel
        </button>
      </div>

      {showCreate && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 space-y-4">
          <h3 className="font-semibold">Crear Nuevo Tipo de Panel</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">Nombre</label>
              <input type="text" value={newPanel.name} onChange={e => setNewPanel({ ...newPanel, name: e.target.value })}
                className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" placeholder="Nombre del panel..." />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">Categor\u00eda</label>
              <select value={newPanel.category} onChange={e => setNewPanel({ ...newPanel, category: e.target.value })}
                className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm">
                <option value="partition">Tabique</option>
                <option value="exterior_wall">Muro Exterior</option>
                <option value="interior_wall">Muro Interior</option>
                <option value="floor">Piso</option>
                <option value="roof">Techo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">Lana de Roca (kg/unidad)</label>
              <input type="number" value={newPanel.volcanic_rock_kg_per_unit}
                onChange={e => setNewPanel({ ...newPanel, volcanic_rock_kg_per_unit: e.target.value })}
                className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" placeholder="Opcional..." />
            </div>
            <div>
              <label className="block text-sm text-[var(--muted-foreground)] mb-1">Descripci\u00f3n</label>
              <input type="text" value={newPanel.description} onChange={e => setNewPanel({ ...newPanel, description: e.target.value })}
                className="w-full bg-[var(--secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm" placeholder="Descripci\u00f3n..." />
            </div>
          </div>
          <button onClick={handleCreate} disabled={!newPanel.name}
            className="bg-green-600 text-white rounded px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50">Crear Panel</button>
        </div>
      )}

      <div className="grid gap-4">
        {panels.map(panel => (
          <div key={panel.id} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{panel.name}</h3>
                <span className="text-sm text-purple-400">{panel.category.replace("_", " ")}</span>
                {panel.description && <p className="text-sm text-[var(--muted-foreground)] mt-1">{panel.description}</p>}
              </div>
              <button onClick={() => handleDelete(panel.id)} className="p-2 text-[var(--muted-foreground)] hover:text-red-400"><Trash2 size={16} /></button>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="bg-[var(--secondary)] rounded p-3">
                <div className="font-mono font-bold">{panel.total_thickness_mm?.toFixed(1) || "\u2014"} mm</div>
                <div className="text-xs text-[var(--muted-foreground)]">Espesor Total</div>
              </div>
              <div className="bg-[var(--secondary)] rounded p-3">
                <div className="font-mono font-bold">{panel.total_weight_per_m2_kg?.toFixed(2) || "\u2014"} kg/m2</div>
                <div className="text-xs text-[var(--muted-foreground)]">Peso</div>
              </div>
              <div className="bg-[var(--secondary)] rounded p-3">
                <div className="font-mono font-bold">{panel.r_value_m2k_w?.toFixed(3) || "\u2014"}</div>
                <div className="text-xs text-[var(--muted-foreground)]">R-Value (m2K/W)</div>
              </div>
              <div className="bg-[var(--secondary)] rounded p-3">
                <div className="font-mono font-bold text-orange-400">{panel.volcanic_rock_kg_per_unit?.toFixed(2) || "\u2014"} kg</div>
                <div className="text-xs text-[var(--muted-foreground)]">Lana de Roca/Unidad</div>
              </div>
            </div>
            {panel.layers && panel.layers.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium text-[var(--muted-foreground)] mb-2">Capas ({panel.layers.length})</div>
                <div className="space-y-1">
                  {panel.layers.map(layer => {
                    const mat = materials.find(m => m.id === layer.material_id);
                    return (
                      <div key={layer.id} className="flex items-center gap-3 text-sm bg-[var(--background)] rounded px-3 py-2">
                        <span className="w-6 text-center text-[var(--muted-foreground)]">{layer.layer_order}</span>
                        <span className="flex-1">{mat?.name || `Material #${layer.material_id}`}</span>
                        <span className="font-mono">{layer.thickness_mm} mm</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
        {panels.length === 0 && (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-8 text-center text-[var(--muted-foreground)]">
            No hay tipos de paneles definidos. Haz clic en "Nuevo Tipo de Panel" para crear uno.
          </div>
        )}
      </div>
    </div>
  );
}
