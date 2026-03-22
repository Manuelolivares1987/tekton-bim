import { useRef, useEffect, useState, useCallback } from "react";
import { useBimModelerStore } from "../../store/bim-modeler-store";
import { useProjectStore } from "../../store/project-store";

const GRID_SIZE = 100; // mm
const PX_PER_MM = 0.12; // pixels per mm at default zoom

export default function FloorPlanView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentProjectId } = useProjectStore();
  const {
    walls, panels, drawingWallStart, activeTool,
    drawWall, startDrawingWall, cancelDrawingWall, setTool,
    fetchWalls, fetchSummary, activeStoreyId,
  } = useBimModelerStore();

  const [zoom, setZoom] = useState(PX_PER_MM);
  const [pan, setPan] = useState({ x: 100, y: 100 });
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Convert world mm to canvas px
  const toScreen = useCallback((xMm: number, zMm: number) => ({
    x: pan.x + xMm * zoom,
    y: pan.y + zMm * zoom,
  }), [pan, zoom]);

  // Convert canvas px to world mm (snapped to grid)
  const toWorld = useCallback((px: number, py: number) => {
    const xMm = (px - pan.x) / zoom;
    const zMm = (py - pan.y) / zoom;
    return {
      x: Math.round(xMm / GRID_SIZE) * GRID_SIZE,
      z: Math.round(zMm / GRID_SIZE) * GRID_SIZE,
    };
  }, [pan, zoom]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = "#0a0e17";
    ctx.fillRect(0, 0, w, h);

    // Grid
    const gridPx = GRID_SIZE * zoom;
    if (gridPx > 4) {
      ctx.strokeStyle = "#1a2030";
      ctx.lineWidth = 0.5;
      const startX = pan.x % gridPx;
      const startY = pan.y % gridPx;
      for (let x = startX; x < w; x += gridPx) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = startY; y < h; y += gridPx) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
    }

    // Major grid (1000mm = 1m)
    const majorPx = 1000 * zoom;
    if (majorPx > 20) {
      ctx.strokeStyle = "#232d40";
      ctx.lineWidth = 1;
      const startX = pan.x % majorPx;
      const startY = pan.y % majorPx;
      for (let x = startX; x < w; x += majorPx) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = startY; y < h; y += majorPx) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
    }

    // Origin axes
    const origin = toScreen(0, 0);
    ctx.strokeStyle = "#e5484d44";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(origin.x, 0); ctx.lineTo(origin.x, h); ctx.stroke();
    ctx.strokeStyle = "#30a46c44";
    ctx.beginPath(); ctx.moveTo(0, origin.y); ctx.lineTo(w, origin.y); ctx.stroke();

    // Walls (as filled rectangles from top view)
    for (const wall of walls) {
      const s = toScreen(wall.start_x_mm, wall.start_z_mm);
      const e = toScreen(wall.end_x_mm, wall.end_z_mm);
      const dx = e.x - s.x;
      const dy = e.y - s.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) continue;

      const angle = Math.atan2(dy, dx);
      const thickPx = (wall.thickness_mm || 136) * zoom;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(angle);

      // Wall body
      ctx.fillStyle = "#8b735566";
      ctx.fillRect(0, -thickPx / 2, len, thickPx);

      // Wall outline
      ctx.strokeStyle = "#c8a87088";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, -thickPx / 2, len, thickPx);

      // Panel division lines
      const wallPanels = panels.filter((p) => p.wall_id === wall.id);
      let offset = 0;
      for (const p of wallPanels) {
        if (offset > 0) {
          const px = offset * zoom;
          ctx.strokeStyle = "#e5a44c44";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(px, -thickPx / 2);
          ctx.lineTo(px, thickPx / 2);
          ctx.stroke();
        }
        offset += p.width_mm;
      }

      // Wall label
      ctx.fillStyle = "#e8ecf4";
      ctx.font = `${Math.max(9, 11 * zoom / PX_PER_MM * 0.3)}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(wall.label, len / 2, 3);

      // Dimension
      ctx.fillStyle = "#7a8599";
      ctx.font = `${Math.max(8, 10 * zoom / PX_PER_MM * 0.3)}px monospace`;
      ctx.fillText(`${(wall.length_mm / 1000).toFixed(2)}m`, len / 2, -thickPx / 2 - 4);

      // Openings
      for (const op of wall.openings) {
        const opX = op.position_along_mm * zoom;
        const opW = op.width_mm * zoom;
        ctx.fillStyle = op.opening_type === "door" ? "#f5a62366" : "#52a8ff44";
        ctx.fillRect(opX, -thickPx / 2 - 1, opW, thickPx + 2);
        ctx.strokeStyle = op.opening_type === "door" ? "#f5a623" : "#52a8ff";
        ctx.lineWidth = 1;
        ctx.strokeRect(opX, -thickPx / 2 - 1, opW, thickPx + 2);
      }

      ctx.restore();
    }

    // Drawing wall ghost
    if (drawingWallStart && activeTool === "draw-wall") {
      const s = toScreen(drawingWallStart.x, drawingWallStart.z);

      // Start point
      ctx.fillStyle = "#e5a44c";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Ghost line to cursor
      const worldMouse = toWorld(mouse.x, mouse.y);
      // Axis lock
      let endX = worldMouse.x;
      let endZ = worldMouse.z;
      if (Math.abs(endX - drawingWallStart.x) >= Math.abs(endZ - drawingWallStart.z)) {
        endZ = drawingWallStart.z;
      } else {
        endX = drawingWallStart.x;
      }
      const e = toScreen(endX, endZ);

      ctx.strokeStyle = "#e5a44c88";
      ctx.lineWidth = 136 * zoom;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();

      // Dashed center line
      ctx.strokeStyle = "#e5a44c";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dimension
      const lengthMm = Math.sqrt((endX - drawingWallStart.x) ** 2 + (endZ - drawingWallStart.z) ** 2);
      const midScreenX = (s.x + e.x) / 2;
      const midScreenY = (s.y + e.y) / 2;
      ctx.fillStyle = "#e5a44c";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(lengthMm)} mm`, midScreenX, midScreenY - 12);
    }

    // Cursor crosshair
    if (activeTool === "draw-wall") {
      ctx.strokeStyle = "#e5a44c33";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(mouse.x, 0);
      ctx.lineTo(mouse.x, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, mouse.y);
      ctx.lineTo(w, mouse.y);
      ctx.stroke();

      // Coordinate readout
      const worldPt = toWorld(mouse.x, mouse.y);
      ctx.fillStyle = "#7a8599";
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`X:${worldPt.x} Z:${worldPt.z}`, mouse.x + 12, mouse.y - 8);
    }
  }, [walls, panels, drawingWallStart, activeTool, zoom, pan, mouse, toScreen, toWorld]);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMouse({ x, y });

    if (isPanning) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.button !== 0 || isPanning) return;
    if (activeTool !== "draw-wall" || !currentProjectId) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const worldPt = toWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (!drawingWallStart) {
      startDrawingWall(worldPt.x, worldPt.z);
    } else {
      // Axis lock
      let endX = worldPt.x;
      let endZ = worldPt.z;
      if (Math.abs(endX - drawingWallStart.x) >= Math.abs(endZ - drawingWallStart.z)) {
        endZ = drawingWallStart.z;
      } else {
        endX = drawingWallStart.x;
      }

      const dx = endX - drawingWallStart.x;
      const dz = endZ - drawingWallStart.z;
      if (Math.sqrt(dx * dx + dz * dz) > 300) {
        drawWall({
          project_id: currentProjectId,
          start_x_mm: drawingWallStart.x,
          start_z_mm: drawingWallStart.z,
          end_x_mm: endX,
          end_z_mm: endZ,
          storey_id: activeStoreyId ?? undefined,
        }).then(() => {
          if (currentProjectId) fetchSummary(currentProjectId);
        });
      }
      cancelDrawingWall();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) { // middle button = pan
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 1) setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.01, Math.min(1, zoom * factor));

    // Zoom toward cursor
    setPan({
      x: mx - (mx - pan.x) * (newZoom / zoom),
      y: my - (my - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ cursor: activeTool === "draw-wall" ? "crosshair" : "default" }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
