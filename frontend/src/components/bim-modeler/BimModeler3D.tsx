/**
 * BimModeler3D — Main BIM modeler component (Lote 2).
 * Split view: 2D floor plan (left) + 3D viewport (right).
 *
 * Architecture:
 *   - wall-store.ts: domain state (walls, panels, assemblies)
 *   - tool-store.ts: UI state (active tool, selection, drawing)
 *   - history-store.ts: undo/redo command stack
 *   - geometry.ts: pure math
 *   - SceneSetup.ts: Three.js init
 *   - WallRenderer.ts: mesh creation
 *   - OpeningDialog.tsx: opening placement
 *   - FloorPlanView.tsx: 2D canvas
 */
import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { PenLine, DoorOpen, Trash2, Navigation, Hammer, Undo2, Redo2, ShieldCheck, Home } from "lucide-react";
import { useProjectStore } from "../../store/project-store";
import { useWallStore } from "../../store/wall-store";
import { useToolStore, type BimTool } from "../../store/tool-store";
import { useHistoryStore } from "../../store/history-store";
import type { BimPanelData } from "../../api/bim-modeler-api";
import FloorPlanView from "./FloorPlanView";
import OpeningDialog from "./OpeningDialog";
import WallPropertiesPanel from "./WallPropertiesPanel";
import CompliancePanel from "./CompliancePanel";
import RoofPanel from "./RoofPanel";
import { createScene, startRenderLoop, handleResize } from "./SceneSetup";
import { rebuildPanels, rebuildFraming, rebuildRoofs, createGhostWall, createStartMarker } from "./WallRenderer";
import { SCALE, snapToGrid, axisLock } from "./geometry";
import client from "../../api/client";

const TOOLS: { id: BimTool; label: string; icon: React.ReactNode; key: string }[] = [
  { id: "draw-wall", label: "Dibujar Muro", icon: <PenLine size={16} />, key: "W" },
  { id: "wall-opening", label: "Abertura", icon: <DoorOpen size={16} />, key: "D" },
  { id: "orbit", label: "Seleccionar", icon: <Navigation size={16} />, key: "O" },
  { id: "delete", label: "Borrar", icon: <Trash2 size={16} />, key: "X" },
];

export default function BimModeler3D() {
  // ── Refs ──
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const groundRef = useRef<THREE.Mesh | null>(null);
  const meshMapRef = useRef<Map<THREE.Mesh, BimPanelData>>(new Map());
  const framingMeshesRef = useRef<THREE.Object3D[]>([]);
  const ghostWallRef = useRef<THREE.Group | null>(null);
  const startMarkerRef = useRef<THREE.Mesh | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const roofMeshesRef = useRef<THREE.Object3D[]>([]);

  // ── Stores ──
  const { currentProjectId } = useProjectStore();
  const { panels, walls, wallAssemblies, activeStoreyId,
    fetchWalls, fetchPanels, fetchSummary, fetchStoreys, fetchCatalog,
    drawWall, deleteWall, addWallOpening,
  } = useWallStore();
  const { activeTool, selectedWallId, selectedPanelId, drawingWallStart, showFraming,
    setTool, selectWall, selectPanel, clearSelection,
    startDrawingWall, cancelDrawingWall, toggleFraming,
  } = useToolStore();
  const { execute, undo, redo, canUndo, canRedo, lastAction } = useHistoryStore();

  // ── Local UI state ──
  const [liveDistance, setLiveDistance] = useState("");
  const [openingDialogWallId, setOpeningDialogWallId] = useState<number | null>(null);
  const [roofGeometries, setRoofGeometries] = useState<Array<{ planes: Array<{ vertices: number[][] }>; ridge_line?: number[][] | null }>>([]);
  const [showRightPanel, setShowRightPanel] = useState<"properties" | "roof" | "compliance" | null>(null);

  const selectedWall = walls.find((w) => w.id === selectedWallId);

  // ── Load project data ──
  useEffect(() => {
    if (!currentProjectId) return;
    fetchCatalog(currentProjectId);
    fetchPanels(currentProjectId);
    fetchSummary(currentProjectId);
    fetchStoreys(currentProjectId);
    fetchWalls(currentProjectId).then(() => {
      const { walls: w } = useWallStore.getState();
      w.forEach((wall) => useWallStore.getState().fetchWallAssembly(wall.id));
    });
    useHistoryStore.getState().clear();
  }, [currentProjectId]);

  // ── Init Three.js ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const refs = createScene(container);
    sceneRef.current = refs.scene;
    cameraRef.current = refs.camera;
    rendererRef.current = refs.renderer;
    groundRef.current = refs.groundPlane;
    const marker = createStartMarker();
    refs.scene.add(marker);
    startMarkerRef.current = marker;
    const stopLoop = startRenderLoop(refs.renderer, refs.scene, refs.camera, refs.controls);
    const observer = new ResizeObserver(() => handleResize(container, refs.camera, refs.renderer));
    observer.observe(container);
    requestAnimationFrame(() => handleResize(container, refs.camera, refs.renderer));
    return () => { stopLoop(); observer.disconnect(); container.removeChild(refs.renderer.domElement); refs.renderer.dispose(); };
  }, []);

  // ── Rebuild panels ──
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    rebuildPanels(scene, panels, selectedPanelId, meshMapRef.current);
  }, [panels, selectedPanelId]);

  // ── Rebuild framing ──
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    framingMeshesRef.current = rebuildFraming(scene, framingMeshesRef.current, wallAssemblies);
  }, [wallAssemblies]);

  // ── Rebuild roofs ──
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    roofMeshesRef.current = rebuildRoofs(scene, roofMeshesRef.current, roofGeometries);
  }, [roofGeometries]);

  // ── Fetch roofs on project load ──
  useEffect(() => {
    if (!currentProjectId) return;
    client.get(`/roof/project/${currentProjectId}/roofs`).then(async (res) => {
      const geos = [];
      for (const r of res.data) {
        try {
          const g = await client.get(`/roof/roofs/${r.id}/geometry`);
          geos.push(g.data);
        } catch { /* skip */ }
      }
      setRoofGeometries(geos);
    }).catch(() => {});
  }, [currentProjectId, walls.length]);

  // ── Pointer interaction ──
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    const ground = groundRef.current;
    if (!renderer || !camera || !scene || !ground) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const updateMouse = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      updateMouse(e);
      if (activeTool === "draw-wall" && drawingWallStart) {
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObject(ground);
        if (hits.length === 0) return;
        const pt = hits[0].point;
        const startX = drawingWallStart.x * SCALE;
        const startZ = drawingWallStart.z * SCALE;
        const locked = axisLock(startX / SCALE, startZ / SCALE, snapToGrid(pt.x / SCALE, 100), snapToGrid(pt.z / SCALE, 100));
        const endX = locked.x * SCALE;
        const endZ = locked.z * SCALE;
        if (ghostWallRef.current) scene.remove(ghostWallRef.current);
        const ghost = createGhostWall(startX, startZ, endX, endZ);
        scene.add(ghost);
        ghostWallRef.current = ghost;
        const mm = Math.round(Math.sqrt((endX - startX) ** 2 + (endZ - startZ) ** 2) / SCALE);
        setLiveDistance(`${mm} mm (${(mm / 1000).toFixed(2)} m)`);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) pointerDownRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const down = pointerDownRef.current;
      if (!down || Math.abs(e.clientX - down.x) > 5 || Math.abs(e.clientY - down.y) > 5) return;
      updateMouse(e);
      raycaster.setFromCamera(mouse, camera);

      // ── Draw Wall ──
      if (activeTool === "draw-wall" && currentProjectId) {
        const hits = raycaster.intersectObject(ground);
        if (hits.length === 0) return;
        const pt = hits[0].point;
        const snapX = snapToGrid(pt.x / SCALE, 100);
        const snapZ = snapToGrid(pt.z / SCALE, 100);
        if (!drawingWallStart) {
          startDrawingWall(snapX, snapZ);
          if (startMarkerRef.current) {
            startMarkerRef.current.position.set(snapX * SCALE, 0.07, snapZ * SCALE);
            startMarkerRef.current.visible = true;
          }
        } else {
          const locked = axisLock(drawingWallStart.x, drawingWallStart.z, snapX, snapZ);
          const endX = locked.x, endZ = locked.z;
          const length = Math.sqrt((endX - drawingWallStart.x) ** 2 + (endZ - drawingWallStart.z) ** 2);
          if (length > 300) {
            const startPt = { ...drawingWallStart };
            // Undo/redo wrapped
            execute({
              type: "draw-wall",
              description: `Muro ${Math.round(length)}mm`,
              execute: async () => {
                const result = await drawWall({
                  project_id: currentProjectId!,
                  start_x_mm: startPt.x, start_z_mm: startPt.z,
                  end_x_mm: endX, end_z_mm: endZ,
                  storey_id: activeStoreyId ?? undefined,
                });
                selectWall(result.wall.id);
                fetchSummary(currentProjectId!);
              },
              undo: async () => {
                // Delete last wall
                const { walls: w } = useWallStore.getState();
                const last = w[w.length - 1];
                if (last) await deleteWall(last.id);
                fetchSummary(currentProjectId!);
              },
            });
          }
          cancelDrawingWall();
          if (startMarkerRef.current) startMarkerRef.current.visible = false;
          if (ghostWallRef.current) { scene.remove(ghostWallRef.current); ghostWallRef.current = null; }
          setLiveDistance("");
        }
        return;
      }

      // ── Delete Wall ──
      if (activeTool === "delete") {
        const meshes = Array.from(meshMapRef.current.keys());
        const hits = raycaster.intersectObjects(meshes);
        if (hits.length > 0) {
          const panel = meshMapRef.current.get(hits[0].object as THREE.Mesh);
          if (panel?.wall_id) {
            const wallId = panel.wall_id;
            // Cache wall data + openings for complete undo restoration
            const { walls: currentWalls } = useWallStore.getState();
            const wallData = currentWalls.find((w) => w.id === wallId);
            const cachedWall = wallData ? structuredClone(wallData) : null;

            execute({
              type: "delete-wall",
              description: `Borrar ${cachedWall?.label || "muro"}`,
              execute: async () => {
                await deleteWall(wallId);
                clearSelection();
                fetchSummary(currentProjectId!);
              },
              undo: async () => {
                if (!cachedWall) return;
                // Recreate wall with same geometry
                const result = await drawWall({
                  project_id: currentProjectId!,
                  start_x_mm: cachedWall.start_x_mm,
                  start_z_mm: cachedWall.start_z_mm,
                  end_x_mm: cachedWall.end_x_mm,
                  end_z_mm: cachedWall.end_z_mm,
                  height_mm: cachedWall.height_mm,
                  thickness_mm: cachedWall.thickness_mm,
                  standard_panel_width_mm: cachedWall.standard_panel_width_mm,
                  stud_spacing_mm: cachedWall.stud_spacing_mm,
                });
                // Restore openings
                if (cachedWall.openings?.length > 0) {
                  for (const op of cachedWall.openings) {
                    await addWallOpening(result.wall.id, {
                      opening_type: op.opening_type,
                      position_along_mm: op.position_along_mm,
                      position_y_mm: op.position_y_mm,
                      width_mm: op.width_mm,
                      height_mm: op.height_mm,
                    });
                  }
                }
                selectWall(result.wall.id);
                fetchSummary(currentProjectId!);
              },
            });
          }
        }
        return;
      }

      // ── Select ──
      const meshes = Array.from(meshMapRef.current.keys());
      const hits = raycaster.intersectObjects(meshes);
      if (hits.length > 0) {
        const panel = meshMapRef.current.get(hits[0].object as THREE.Mesh);
        if (panel) {
          selectPanel(panel.id);
          if (panel.wall_id) selectWall(panel.wall_id);
          // If opening tool, open dialog
          if (activeTool === "wall-opening" && panel.wall_id) {
            setOpeningDialogWallId(panel.wall_id);
          }
        }
      } else {
        clearSelection();
      }
    };

    const el = renderer.domElement;
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);
    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
      if (ghostWallRef.current) { scene.remove(ghostWallRef.current); ghostWallRef.current = null; }
    };
  }, [activeTool, drawingWallStart, currentProjectId, activeStoreyId, execute,
      drawWall, deleteWall, addWallOpening, startDrawingWall, cancelDrawingWall, selectPanel, selectWall, clearSelection, fetchSummary, fetchWalls]);

  // ── Keyboard ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toUpperCase();
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && key === "Z") {
        e.preventDefault();
        if (e.shiftKey) { redo(); } else { undo(); }
        return;
      }
      const tool = TOOLS.find((t) => t.key === key);
      if (tool) setTool(tool.id);
      if (key === "ESCAPE") {
        cancelDrawingWall();
        if (startMarkerRef.current) startMarkerRef.current.visible = false;
        if (ghostWallRef.current && sceneRef.current) {
          sceneRef.current.remove(ghostWallRef.current);
          ghostWallRef.current = null;
        }
        setLiveDistance("");
        setOpeningDialogWallId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTool, cancelDrawingWall, undo, redo]);

  // ── No project ──
  if (!currentProjectId) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--muted-foreground)" }}>
        Selecciona un proyecto para empezar
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 h-11 flex-shrink-0"
        style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>

        {/* Tools */}
        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: "var(--secondary)" }}>
          {TOOLS.map((t) => (
            <button key={t.id} onClick={() => setTool(t.id)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-all"
              style={{
                background: activeTool === t.id ? "var(--primary)" : "transparent",
                color: activeTool === t.id ? "var(--primary-foreground)" : "var(--muted-foreground)",
                fontWeight: activeTool === t.id ? 600 : 400,
              }}
              title={`${t.label} (${t.key})`}>
              {t.icon}
              <span className="hidden lg:inline">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="w-px h-5" style={{ background: "var(--border)" }} />

        {/* Framing toggle */}
        <button onClick={toggleFraming}
          className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md transition-all"
          style={{
            background: showFraming ? "rgba(229,164,76,0.15)" : "transparent",
            color: showFraming ? "var(--primary)" : "var(--muted-foreground)",
          }}
          title="Mostrar entramado">
          <Hammer size={14} />
          <span className="hidden lg:inline">Entramado</span>
        </button>

        {/* Roof toggle */}
        <button onClick={() => setShowRightPanel(showRightPanel === "roof" ? null : "roof")}
          className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md transition-all"
          style={{
            background: showRightPanel === "roof" ? "rgba(184,115,51,0.15)" : "transparent",
            color: showRightPanel === "roof" ? "#b87333" : "var(--muted-foreground)",
          }}
          title="Techumbre">
          <Home size={14} />
          <span className="hidden xl:inline">Techo</span>
        </button>

        {/* Compliance toggle */}
        <button onClick={() => setShowRightPanel(showRightPanel === "compliance" ? null : "compliance")}
          className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md transition-all"
          style={{
            background: showRightPanel === "compliance" ? "rgba(48,164,108,0.15)" : "transparent",
            color: showRightPanel === "compliance" ? "#30a46c" : "var(--muted-foreground)",
          }}
          title="Validación normativa">
          <ShieldCheck size={14} />
          <span className="hidden xl:inline">Normas</span>
        </button>

        <div className="w-px h-5" style={{ background: "var(--border)" }} />

        {/* Undo / Redo */}
        <button onClick={undo} disabled={!canUndo}
          className="p-1.5 rounded-md transition-all disabled:opacity-25"
          style={{ color: "var(--muted-foreground)" }}
          title="Deshacer (Ctrl+Z)">
          <Undo2 size={15} />
        </button>
        <button onClick={redo} disabled={!canRedo}
          className="p-1.5 rounded-md transition-all disabled:opacity-25"
          style={{ color: "var(--muted-foreground)" }}
          title="Rehacer (Ctrl+Shift+Z)">
          <Redo2 size={15} />
        </button>

        <div className="w-px h-5" style={{ background: "var(--border)" }} />

        <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          W = muro | D = abertura | X = borrar | Ctrl+Z = deshacer
        </span>

        <div className="flex-1" />

        {/* Status */}
        {drawingWallStart && (
          <div className="text-[11px] px-2 py-1 rounded-md animate-pulse"
            style={{ background: "rgba(229,164,76,0.15)", color: "var(--primary)" }}>
            Click segundo punto...
          </div>
        )}
        {lastAction && !drawingWallStart && (
          <div className="text-[11px] px-2 py-1 rounded-md"
            style={{ color: "var(--muted-foreground)" }}>
            {lastAction}
          </div>
        )}
        {selectedWall && (
          <div className="text-[11px] px-2 py-1 rounded-md"
            style={{ background: "var(--secondary)", color: "var(--foreground)" }}>
            {selectedWall.label} — {(selectedWall.length_mm / 1000).toFixed(2)}m — {selectedWall.panel_count} paneles
          </div>
        )}
      </div>

      {/* Split viewport */}
      <div className="flex flex-1 overflow-hidden">
        {/* 2D */}
        <div className="flex-1 relative" style={{ borderRight: "1px solid var(--border)" }}>
          <div className="absolute top-2 left-2 z-10 text-[10px] font-semibold px-2 py-0.5 rounded"
            style={{ background: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
            PLANTA
          </div>
          <FloorPlanView />
        </div>

        {/* 3D */}
        <div className="flex-1 relative">
          <div className="absolute top-2 left-2 z-10 text-[10px] font-semibold px-2 py-0.5 rounded"
            style={{ background: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
            3D
          </div>
          <div ref={containerRef} className="w-full h-full"
            style={{ cursor: activeTool === "draw-wall" ? "crosshair" : activeTool === "wall-opening" ? "crosshair" : "default" }} />
          {liveDistance && (
            <div className="absolute bottom-3 right-3 text-xs font-mono px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(0,0,0,0.8)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" }}>
              {liveDistance}
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar */}
      {(selectedWall || showRightPanel) && (
        <div className="w-60 flex-shrink-0 overflow-y-auto p-3 space-y-4"
          style={{ background: "var(--card)", borderLeft: "1px solid var(--border)" }}>
          {selectedWall && showRightPanel !== "roof" && showRightPanel !== "compliance" && (
            <WallPropertiesPanel />
          )}
          {showRightPanel === "roof" && <RoofPanel />}
          {showRightPanel === "compliance" && <CompliancePanel />}
        </div>
      )}

      {/* Opening Dialog */}
      {openingDialogWallId && selectedWall && (
        <OpeningDialog
          wallId={openingDialogWallId}
          wallLengthMm={selectedWall.length_mm}
          onApply={async (data) => {
            await addWallOpening(openingDialogWallId, data);
            fetchSummary(currentProjectId);
          }}
          onClose={() => setOpeningDialogWallId(null)}
        />
      )}
    </div>
  );
}
