import {
  LayoutDashboard,
  PenLine,
  Boxes,
  ClipboardList,
  FileText,
  Eye,
  Zap,
  Droplets,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
  Box,
} from "lucide-react";
import { useUIStore, type ViewType } from "../../store/ui-store";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  view: ViewType;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    title: "",
    items: [
      { icon: <LayoutDashboard size={18} />, label: "Inicio", view: "dashboard" },
      { icon: <Sparkles size={18} />, label: "Generar con IA", view: "ai-generator", badge: "AI" },
    ],
  },
  {
    title: "Diseño",
    items: [
      { icon: <PenLine size={18} />, label: "Modelador BIM", view: "bim-modeler" },
      { icon: <Eye size={18} />, label: "Visor 3D", view: "viewer" },
    ],
  },
  {
    title: "Panelización",
    items: [
      { icon: <Boxes size={18} />, label: "Panelización SIP", view: "sip-panelization" },
      { icon: <ClipboardList size={18} />, label: "Cubicación", view: "panelization-takeoff" },
      { icon: <Eye size={18} />, label: "Visor Paneles", view: "panel-viewer-3d" },
      { icon: <FileText size={18} />, label: "Planos de Taller", view: "shop-drawings" },
    ],
  },
  {
    title: "Instalaciones",
    items: [
      { icon: <Zap size={18} />, label: "Eléctrico", view: "electrical" },
      { icon: <Droplets size={18} />, label: "Plomería", view: "plumbing" },
    ],
  },
];

export default function Sidebar() {
  const { activeView, setActiveView, sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <aside
      className={`flex flex-col border-r transition-all duration-300 ease-in-out ${
        sidebarOpen ? "w-56" : "w-14"
      }`}
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-3 h-14 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)" }}
      >
        {sidebarOpen ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <Box size={15} strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold tracking-tight truncate" style={{ color: "var(--foreground)" }}>
              Tekton
            </span>
          </div>
        ) : (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <Box size={15} strokeWidth={2.5} />
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded-md transition-colors flex-shrink-0"
          style={{ color: "var(--muted-foreground)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--secondary)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-4">
        {sections.map((section, si) => (
          <div key={si}>
            {sidebarOpen && section.title && (
              <div
                className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: "var(--muted-foreground)" }}
              >
                {section.title}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = activeView === item.view;
                return (
                  <button
                    key={item.view}
                    onClick={() => setActiveView(item.view)}
                    className={`flex items-center w-full rounded-lg text-[13px] transition-all duration-200 ${
                      !sidebarOpen ? "justify-center p-2" : "gap-2.5 px-2.5 py-2"
                    }`}
                    style={{
                      background: isActive ? "var(--primary-glow)" : "transparent",
                      color: isActive ? "var(--primary)" : "var(--muted-foreground)",
                      fontWeight: isActive ? 600 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = "var(--secondary)";
                      if (!isActive) e.currentTarget.style.color = "var(--foreground)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "transparent";
                      if (!isActive) e.currentTarget.style.color = "var(--muted-foreground)";
                    }}
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    {item.icon}
                    {sidebarOpen && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: "var(--primary)",
                              color: "var(--primary-foreground)",
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {sidebarOpen && (
        <div
          className="px-3 py-2.5 border-t text-[10px]"
          style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        >
          Tekton v0.2.0
        </div>
      )}
    </aside>
  );
}
