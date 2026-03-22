import {
  Sparkles,
  PenLine,
  Boxes,
  ClipboardList,
  Zap,
  ArrowRight,
  Home,
  Layers,
} from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import { useUIStore, type ViewType } from "../../store/ui-store";
// import { useIfcStore } from "../../store/ifc-store";

interface ActionCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  view: ViewType;
  accent: string;
  featured?: boolean;
}

const actions: ActionCard[] = [
  {
    icon: <Sparkles size={22} />,
    title: "Generar con IA",
    description: "Describe tu casa y la IA genera todo: muros, paneles, entramado y costos",
    view: "ai-generator",
    accent: "#e5a44c",
    featured: true,
  },
  {
    icon: <PenLine size={20} />,
    title: "Modelador BIM",
    description: "Diseña dibujando muros directamente en 3D",
    view: "bim-modeler",
    accent: "#52a8ff",
  },
  {
    icon: <Boxes size={20} />,
    title: "Panelización SIP",
    description: "Divide muros en paneles SIP fabricables",
    view: "sip-panelization",
    accent: "#30a46c",
  },
  {
    icon: <ClipboardList size={20} />,
    title: "Cubicación",
    description: "Cantidades, materiales y costos detallados",
    view: "panelization-takeoff",
    accent: "#e5484d",
  },
  {
    icon: <Zap size={20} />,
    title: "Instalaciones",
    description: "Diseño eléctrico y sanitario",
    view: "electrical",
    accent: "#f5a623",
  },
];

export default function Dashboard() {
  const { getCurrentProject } = useProjectStore();
  const { setActiveView } = useUIStore();
  const project = getCurrentProject();

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          {project ? project.name : "Bienvenido a Tekton"}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Construcción Inteligente
        </p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {actions.map((action) => (
          <button
            key={action.view}
            onClick={() => setActiveView(action.view)}
            className={`group text-left rounded-xl p-5 transition-all duration-300 ${
              action.featured ? "md:col-span-2 lg:col-span-3" : ""
            }`}
            style={{
              background: action.featured
                ? `linear-gradient(135deg, ${action.accent}15, ${action.accent}05)`
                : "var(--card)",
              border: `1px solid ${action.featured ? action.accent + "30" : "var(--border)"}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = action.accent + "60";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = `0 8px 24px ${action.accent}15`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = action.featured ? action.accent + "30" : "var(--border)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div className={`flex ${action.featured ? "items-center gap-5" : "flex-col gap-3"}`}>
              <div
                className={`${action.featured ? "w-14 h-14" : "w-10 h-10"} rounded-xl flex items-center justify-center flex-shrink-0`}
                style={{ background: action.accent + "18", color: action.accent }}
              >
                {action.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold ${action.featured ? "text-base" : "text-sm"}`} style={{ color: "var(--foreground)" }}>
                    {action.title}
                  </h3>
                  {action.featured && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: action.accent, color: "var(--background)" }}
                    >
                      NUEVO
                    </span>
                  )}
                </div>
                <p className={`${action.featured ? "text-sm" : "text-xs"} mt-1`} style={{ color: "var(--muted-foreground)" }}>
                  {action.description}
                </p>
              </div>
              <ArrowRight
                size={16}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: action.accent }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
