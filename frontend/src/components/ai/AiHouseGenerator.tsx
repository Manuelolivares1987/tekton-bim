import { useState, useEffect } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  Home,
  DoorOpen,
  SquareStack,
  DollarSign,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Layers,
} from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import { useUIStore } from "../../store/ui-store";
import client from "../../api/client";
// useEffect already imported above

interface CostItem {
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

interface GenerateResult {
  project_id: number;
  spec: {
    name: string;
    description: string;
    total_area_m2: number;
    rooms: { name: string; area_m2: number }[];
    design_notes: string;
    walls: unknown[];
  };
  walls: { label: string; length_mm: number }[];
  total_panels: number;
  total_framing: number;
  cost_estimate: {
    currency: string;
    items: CostItem[];
    subtotal: number;
    iva: number;
    total: number;
    price_per_m2: number;
  };
}

const PRESETS = [
  { label: "Cabaña 40m²", prompt: "Cabaña de 40m², 1 dormitorio, 1 baño, living-cocina integrado, terraza" },
  { label: "Casa 60m²", prompt: "Casa de 60m², 2 dormitorios, 1 baño, cocina americana con living-comedor" },
  { label: "Casa 80m²", prompt: "Casa de 80m², 3 dormitorios, 2 baños, cocina americana, living-comedor, loggia" },
  { label: "Casa 120m²", prompt: "Casa de 120m², 4 dormitorios, 3 baños, cocina independiente, living, comedor, estudio, loggia" },
];

export default function AiHouseGenerator() {
  const { currentProjectId, setCurrentProject } = useProjectStore();
  const { setActiveView } = useUIStore();

  const [prompt, setPrompt] = useState("");
  const [projectName, setProjectName] = useState("Mi Casa SIP");
  const [country, setCountry] = useState("chile");
  const [seismicZone, setSeismicZone] = useState(2);
  const [floors, setFloors] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState("");
  const [countries, setCountries] = useState<{ code: string; name: string; flag: string; seismic_zones: string[]; default_seismic_zone: number }[]>([]);

  useEffect(() => {
    client.get("/codes/countries").then((r) => setCountries(r.data)).catch(() => {});
  }, []);

  const selectedCountry = countries.find((c) => c.code === country);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await client.post("/ai/commit", {
        prompt: prompt.trim(),
        project_name: projectName.trim() || "Casa IA",
        seismic_zone: seismicZone,
        country,
        floors,
      });
      setResult(res.data);
      setCurrentProject(res.data.project_id);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error generando la casa. Verifica tu API key de Anthropic.");
    } finally {
      setLoading(false);
    }
  };

  const formatCLP = (n: number) => `$${n.toLocaleString("es-CL")}`;

  return (
    <div className="h-full flex gap-5 animate-fadeIn">
      {/* Left: Input Panel */}
      <div className="w-[420px] flex-shrink-0 flex flex-col gap-4">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                Generador de Casas IA
              </h1>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Describe tu casa y la construimos completa
              </p>
            </div>
          </div>
        </div>

        {/* Config */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              Nombre del proyecto
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full text-sm rounded-lg px-3 py-2"
              style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            />
          </div>

          {/* Country selector */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              <MapPin size={11} className="inline mr-1" />País / Normativa
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {countries.map((c) => (
                <button
                  key={c.code}
                  onClick={() => {
                    setCountry(c.code);
                    setSeismicZone(c.default_seismic_zone);
                  }}
                  className="py-2 rounded-lg text-xs font-medium transition-all text-center"
                  style={{
                    background: country === c.code ? "var(--primary-glow)" : "var(--secondary)",
                    color: country === c.code ? "var(--primary)" : "var(--muted-foreground)",
                    border: `1px solid ${country === c.code ? "var(--primary)" : "var(--border)"}`,
                  }}
                >
                  {c.flag} {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                Zona sísmica
              </label>
              <select
                value={seismicZone}
                onChange={(e) => setSeismicZone(Number(e.target.value))}
                className="w-full text-sm rounded-lg px-3 py-2"
                style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              >
                {selectedCountry?.seismic_zones.map((z, i) => (
                  <option key={i} value={i}>{z}</option>
                )) || (
                  <>
                    <option value={1}>Zona 1</option>
                    <option value={2}>Zona 2</option>
                    <option value={3}>Zona 3</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                <Layers size={11} className="inline mr-1" />Pisos
              </label>
              <select
                value={floors}
                onChange={(e) => setFloors(Number(e.target.value))}
                className="w-full text-sm rounded-lg px-3 py-2"
                style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              >
                <option value={1}>1 Piso</option>
                <option value={2}>2 Pisos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setPrompt(p.prompt)}
              className="text-xs px-2.5 py-1 rounded-full transition-colors"
              style={{
                background: "var(--secondary)",
                color: "var(--muted-foreground)",
                border: "1px solid var(--border)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--primary)";
                e.currentTarget.style.color = "var(--primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.color = "var(--muted-foreground)";
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Prompt Input */}
        <div className="flex-1 flex flex-col">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe tu casa ideal...&#10;&#10;Ejemplo: Casa de 80m², 3 dormitorios, 2 baños, cocina americana con living-comedor, orientación norte para dormitorio principal, terraza cubierta..."
            className="flex-1 text-sm rounded-xl p-4 resize-none min-h-[160px]"
            style={{
              background: "var(--card)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
          />

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="mt-3 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{
              background: loading ? "var(--secondary)" : "var(--primary)",
              color: loading ? "var(--muted-foreground)" : "var(--primary-foreground)",
              boxShadow: loading ? "none" : "var(--shadow-glow)",
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generando casa con IA...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generar Casa
                <Send size={14} />
              </>
            )}
          </button>

          {error && (
            <div
              className="mt-3 flex items-start gap-2 text-xs p-3 rounded-lg animate-fadeIn"
              style={{ background: "rgba(229, 72, 77, 0.1)", color: "var(--destructive)" }}
            >
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Right: Results */}
      <div className="flex-1 overflow-y-auto">
        {!result && !loading && (
          <div className="h-full flex flex-col items-center justify-center gap-4" style={{ color: "var(--muted-foreground)" }}>
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <Home size={32} style={{ color: "var(--primary)", opacity: 0.5 }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                Describe tu casa y la IA la construye
              </p>
              <p className="text-xs mt-1">
                Paneles SIP, entramado de madera, cubicación y costos
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="animate-pulse-glow w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--card)", border: "1px solid var(--primary)" }}>
              <Sparkles size={32} style={{ color: "var(--primary)" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                Diseñando tu casa...
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                Claude está calculando muros, paneles y entramado
              </p>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4 animate-slideUp">
            {/* Success Header */}
            <div
              className="flex items-center gap-3 p-4 rounded-xl"
              style={{ background: "rgba(48, 164, 108, 0.08)", border: "1px solid rgba(48, 164, 108, 0.2)" }}
            >
              <CheckCircle2 size={20} style={{ color: "var(--success)" }} />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: "var(--success)" }}>
                  Casa generada exitosamente
                </p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {result.spec.description}
                </p>
              </div>
              <button
                onClick={() => setActiveView("bim-modeler")}
                className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                Ver en 3D <ArrowRight size={12} />
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { icon: <Home size={16} />, label: "Superficie", value: `${result.spec.total_area_m2} m²` },
                { icon: <SquareStack size={16} />, label: "Muros", value: result.walls.length },
                { icon: <Layers size={16} />, label: "Paneles SIP", value: result.total_panels },
                { icon: <DoorOpen size={16} />, label: "Entramado", value: `${result.total_framing} pzas` },
              ].map((s, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl text-center"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div className="flex justify-center mb-1.5" style={{ color: "var(--primary)" }}>{s.icon}</div>
                  <div className="text-lg font-bold" style={{ color: "var(--foreground)" }}>{s.value}</div>
                  <div className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Rooms */}
            {result.spec.rooms.length > 0 && (
              <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--muted-foreground)" }}>
                  Recintos
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {result.spec.rooms.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm px-2.5 py-1.5 rounded-lg" style={{ background: "var(--secondary)" }}>
                      <span>{r.name}</span>
                      <span className="font-mono font-medium" style={{ color: "var(--primary)" }}>{r.area_m2} m²</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cost Breakdown */}
            <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                  <DollarSign size={12} className="inline mr-1" />Cubicación y Costos
                </h3>
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>CLP</span>
              </div>
              <div className="space-y-1.5">
                {result.cost_estimate.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 px-2 rounded" style={{ background: i % 2 === 0 ? "var(--secondary)" : "transparent" }}>
                    <div>
                      <span style={{ color: "var(--foreground)" }}>{item.category}</span>
                      <span className="ml-2 text-xs" style={{ color: "var(--muted-foreground)" }}>{item.description}</span>
                    </div>
                    <span className="font-mono font-medium" style={{ color: "var(--foreground)" }}>
                      {formatCLP(item.total)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 space-y-1" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--muted-foreground)" }}>Subtotal</span>
                  <span className="font-mono">{formatCLP(result.cost_estimate.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--muted-foreground)" }}>IVA 19%</span>
                  <span className="font-mono">{formatCLP(result.cost_estimate.iva)}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-1" style={{ borderTop: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--primary)" }}>Total</span>
                  <span style={{ color: "var(--primary)" }}>{formatCLP(result.cost_estimate.total)}</span>
                </div>
                <div className="text-right text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {formatCLP(result.cost_estimate.price_per_m2)} / m²
                </div>
              </div>
            </div>

            {/* Design Notes */}
            {result.spec.design_notes && (
              <div className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted-foreground)" }}>
                  Notas del Diseño
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--secondary-foreground)" }}>
                  {result.spec.design_notes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
