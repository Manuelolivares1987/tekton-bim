import { useEffect, lazy, Suspense } from "react";
import { useProjectStore } from "./store/project-store";
import { useUIStore } from "./store/ui-store";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import Dashboard from "./components/layout/Dashboard";
import ErrorBoundary from "./components/ui/ErrorBoundary";

// Core views (eager)
import BimModeler3D from "./components/bim-modeler/BimModeler3D";
import AiHouseGenerator from "./components/ai/AiHouseGenerator";

// Secondary views (lazy loaded)
const IfcViewer = lazy(() => import("./components/viewer/IfcViewer"));
const SipPanelization = lazy(() => import("./components/panelization/SipPanelization"));
const PanelizationTakeoff = lazy(() => import("./components/panelization/PanelizationTakeoff"));
const PanelViewer3D = lazy(() => import("./components/panelization/PanelViewer3D"));
const ShopDrawings = lazy(() => import("./components/panelization/ShopDrawings"));
const ElectricalDesign = lazy(() => import("./components/mep/ElectricalDesign"));
const PlumbingDesign = lazy(() => import("./components/mep/PlumbingDesign"));

// Legacy views (lazy, kept for backward compat but not in sidebar)
const QuantityTakeoff = lazy(() => import("./components/calculations/QuantityTakeoff"));
const WallAreaCalc = lazy(() => import("./components/calculations/WallAreaCalc"));
const VolcanicRockCalc = lazy(() => import("./components/calculations/VolcanicRockCalc"));
const LumberTakeoff = lazy(() => import("./components/calculations/LumberTakeoff"));
const BoardCoverage = lazy(() => import("./components/calculations/BoardCoverage"));
const PanelLibrary = lazy(() => import("./components/panels/PanelLibrary"));
const PanelAssignment = lazy(() => import("./components/panels/PanelAssignment"));
const AssemblyPlans = lazy(() => import("./components/assembly/AssemblyPlans"));
const FloorPlanEditor = lazy(() => import("./components/floor-plan/FloorPlanEditor"));

function LazyFallback() {
  return (
    <div className="flex items-center justify-center h-full"
      style={{ color: "var(--muted-foreground)" }}>
      Cargando...
    </div>
  );
}

function App() {
  const { activeView } = useUIStore();
  const { fetchProjects } = useProjectStore();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return <Dashboard />;
      case "bim-modeler":
        return (
          <ErrorBoundary fallbackTitle="Error en el Modelador 3D">
            <BimModeler3D />
          </ErrorBoundary>
        );
      case "ai-generator":
        return <AiHouseGenerator />;
      case "viewer":
        return <IfcViewer />;
      case "sip-panelization":
        return <SipPanelization />;
      case "panelization-takeoff":
        return <PanelizationTakeoff />;
      case "panel-viewer-3d":
        return <PanelViewer3D />;
      case "shop-drawings":
        return <ShopDrawings />;
      case "electrical":
        return <ElectricalDesign />;
      case "plumbing":
        return <PlumbingDesign />;
      // Legacy views
      case "takeoff": return <QuantityTakeoff />;
      case "wall-calc": return <WallAreaCalc />;
      case "volcanic-rock": return <VolcanicRockCalc />;
      case "lumber-takeoff": return <LumberTakeoff />;
      case "board-coverage": return <BoardCoverage />;
      case "panels": return <PanelLibrary />;
      case "panel-assignment": return <PanelAssignment />;
      case "assembly-plans": return <AssemblyPlans />;
      case "floor-plan": return <FloorPlanEditor />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Suspense fallback={<LazyFallback />}>
            {renderView()}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default App;
