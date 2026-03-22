import { useEffect } from "react";
import { useProjectStore } from "./store/project-store";
import { useUIStore } from "./store/ui-store";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import Dashboard from "./components/layout/Dashboard";
import QuantityTakeoff from "./components/calculations/QuantityTakeoff";
import WallAreaCalc from "./components/calculations/WallAreaCalc";
import VolcanicRockCalc from "./components/calculations/VolcanicRockCalc";
import PanelLibrary from "./components/panels/PanelLibrary";
import ElectricalDesign from "./components/mep/ElectricalDesign";
import PlumbingDesign from "./components/mep/PlumbingDesign";
import IfcViewer from "./components/viewer/IfcViewer";
import PanelAssignment from "./components/panels/PanelAssignment";
import AssemblyPlans from "./components/assembly/AssemblyPlans";
import LumberTakeoff from "./components/calculations/LumberTakeoff";
import BoardCoverage from "./components/calculations/BoardCoverage";
import SipPanelization from "./components/panelization/SipPanelization";
import PanelizationTakeoff from "./components/panelization/PanelizationTakeoff";
import PanelViewer3D from "./components/panelization/PanelViewer3D";
import ShopDrawings from "./components/panelization/ShopDrawings";
import FloorPlanEditor from "./components/floor-plan/FloorPlanEditor";
import BimModeler3D from "./components/bim-modeler/BimModeler3D";
import AiHouseGenerator from "./components/ai/AiHouseGenerator";

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
      case "takeoff":
        return <QuantityTakeoff />;
      case "wall-calc":
        return <WallAreaCalc />;
      case "volcanic-rock":
        return <VolcanicRockCalc />;
      case "panels":
        return <PanelLibrary />;
      case "electrical":
        return <ElectricalDesign />;
      case "plumbing":
        return <PlumbingDesign />;
      case "viewer":
        return <IfcViewer />;
      case "panel-assignment":
        return <PanelAssignment />;
      case "assembly-plans":
        return <AssemblyPlans />;
      case "lumber-takeoff":
        return <LumberTakeoff />;
      case "board-coverage":
        return <BoardCoverage />;
      case "sip-panelization":
        return <SipPanelization />;
      case "panelization-takeoff":
        return <PanelizationTakeoff />;
      case "panel-viewer-3d":
        return <PanelViewer3D />;
      case "shop-drawings":
        return <ShopDrawings />;
      case "floor-plan":
        return <FloorPlanEditor />;
      case "bim-modeler":
        return <BimModeler3D />;
      case "ai-generator":
        return <AiHouseGenerator />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-[var(--background)] text-[var(--foreground)]">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">{renderView()}</main>
      </div>
    </div>
  );
}

export default App;
