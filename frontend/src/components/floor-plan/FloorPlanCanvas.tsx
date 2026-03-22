import { useRef, useEffect, useCallback } from "react";
import { useFloorPlanStore } from "../../store/floor-plan-store";
import type { FloorPlanWall, FloorPlanOpening } from "../../types/api";

const WALL_COLOR = "#64748b";
const WALL_SELECTED_COLOR = "#3b82f6";
const DOOR_COLOR = "#f59e0b";
const WINDOW_COLOR = "#06b6d4";
const GRID_COLOR = "#1e293b";
const SNAP_COLOR = "#22c55e";
const PREVIEW_COLOR = "#3b82f680";
const BG_COLOR = "#0f172a";

export default function FloorPlanCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const {
    currentPlan,
    currentStoreyId,
    activeTool,
    gridSize,
    snapEnabled,
    wallThickness,
    selectedWallId,
    drawingStart,
    zoom,
    panOffset,
    setDrawingStart,
    setSelectedWall,
    setSelectedOpening,
    addWallToStorey,
    deleteWallFromStorey,
    addOpeningToWall,
    deleteOpeningFromWall,
    setZoom,
    setPanOffset,
  } = useFloorPlanStore();

  // Get walls for current storey
  const currentStorey = currentPlan?.storeys.find((s) => s.id === currentStoreyId);
  const walls = currentStorey?.walls || [];

  // Coordinate transforms
  const toCanvas = useCallback(
    (buildingX: number, buildingY: number) => ({
      x: buildingX * zoom + panOffset.x,
      y: (canvasRef.current?.height || 600) - buildingY * zoom - panOffset.y,
    }),
    [zoom, panOffset]
  );

  const toBuilding = useCallback(
    (canvasX: number, canvasY: number) => ({
      x: (canvasX - panOffset.x) / zoom,
      y: ((canvasRef.current?.height || 600) - canvasY - panOffset.y) / zoom,
    }),
    [zoom, panOffset]
  );

  // Snap point to grid or existing endpoints
  const snapPoint = useCallback(
    (x: number, y: number) => {
      if (!snapEnabled) return { x, y };

      // Check existing endpoints first (50mm tolerance)
      const tolerance = 50;
      for (const wall of walls) {
        for (const ep of [
          { x: wall.start_x_mm, y: wall.start_y_mm },
          { x: wall.end_x_mm, y: wall.end_y_mm },
        ]) {
          const dx = x - ep.x;
          const dy = y - ep.y;
          if (Math.sqrt(dx * dx + dy * dy) < tolerance) {
            return { x: ep.x, y: ep.y };
          }
        }
      }

      // Snap to grid
      return {
        x: Math.round(x / gridSize) * gridSize,
        y: Math.round(y / gridSize) * gridSize,
      };
    },
    [walls, gridSize, snapEnabled]
  );

  // Find wall at canvas position
  const findWallAtPoint = useCallback(
    (bx: number, by: number): FloorPlanWall | null => {
      for (const wall of walls) {
        // Project point onto wall segment and check distance
        const dx = wall.end_x_mm - wall.start_x_mm;
        const dy = wall.end_y_mm - wall.start_y_mm;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;

        const t = Math.max(0, Math.min(1,
          ((bx - wall.start_x_mm) * dx + (by - wall.start_y_mm) * dy) / (len * len)
        ));

        const projX = wall.start_x_mm + t * dx;
        const projY = wall.start_y_mm + t * dy;
        const dist = Math.sqrt((bx - projX) ** 2 + (by - projY) ** 2);

        if (dist < wall.thickness_mm / 2 + 30) {
          return wall;
        }
      }
      return null;
    },
    [walls]
  );

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;

    const gridPixels = gridSize * zoom;
    if (gridPixels > 5) {
      const startX = panOffset.x % gridPixels;
      const startY = panOffset.y % gridPixels;

      for (let x = startX; x < w; x += gridPixels) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = startY; y < h; y += gridPixels) {
        ctx.beginPath();
        ctx.moveTo(0, h - y);
        ctx.lineTo(w, h - y);
        ctx.stroke();
      }
    }

    // Origin indicator
    const origin = toCanvas(0, 0);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + 30, origin.y);
    ctx.stroke();
    ctx.strokeStyle = "#22c55e";
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x, origin.y - 30);
    ctx.stroke();

    // Draw walls
    for (const wall of walls) {
      const isSelected = wall.id === selectedWallId;
      drawWall(ctx, wall, isSelected, zoom, toCanvas);
    }

    // Draw preview line while drawing
    if (drawingStart && activeTool === "draw-wall") {
      const startC = toCanvas(drawingStart.x, drawingStart.y);
      // Draw snap indicator at start
      ctx.fillStyle = SNAP_COLOR;
      ctx.beginPath();
      ctx.arc(startC.x, startC.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scale indicator
    ctx.fillStyle = "#9ca3af";
    ctx.font = "11px monospace";
    ctx.fillText(`Zoom: ${(zoom * 1000).toFixed(0)}% | Grilla: ${gridSize}mm`, 10, h - 10);
  }, [walls, zoom, panOffset, gridSize, selectedWallId, drawingStart, activeTool, toCanvas]);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const bp = toBuilding(cx, cy);

    if (activeTool === "pan" || e.button === 1) {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (activeTool === "select") {
      const wall = findWallAtPoint(bp.x, bp.y);
      setSelectedWall(wall?.id || null);
      return;
    }

    if (activeTool === "draw-wall") {
      const snapped = snapPoint(bp.x, bp.y);
      if (!drawingStart) {
        setDrawingStart(snapped);
      } else {
        // Complete the wall
        const dx = snapped.x - drawingStart.x;
        const dy = snapped.y - drawingStart.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 50) {
          addWallToStorey({
            start_x_mm: drawingStart.x,
            start_y_mm: drawingStart.y,
            end_x_mm: snapped.x,
            end_y_mm: snapped.y,
            thickness_mm: wallThickness,
          });
        }
        setDrawingStart(null);
      }
      return;
    }

    if (activeTool === "door" || activeTool === "window") {
      const wall = findWallAtPoint(bp.x, bp.y);
      if (wall) {
        // Calculate position along wall
        const dx = wall.end_x_mm - wall.start_x_mm;
        const dy = wall.end_y_mm - wall.start_y_mm;
        const len = Math.sqrt(dx * dx + dy * dy);
        const t = Math.max(0, Math.min(1,
          ((bp.x - wall.start_x_mm) * dx + (bp.y - wall.start_y_mm) * dy) / (len * len)
        ));
        const posAlongWall = t * len;

        const isDoor = activeTool === "door";
        addOpeningToWall(wall.id, {
          opening_type: isDoor ? "door" : "window",
          position_along_wall_mm: posAlongWall,
          position_y_mm: isDoor ? 0 : 900,
          width_mm: isDoor ? 900 : 1200,
          height_mm: isDoor ? 2100 : 1200,
        });
      }
      return;
    }

    if (activeTool === "eraser") {
      const wall = findWallAtPoint(bp.x, bp.y);
      if (wall) {
        deleteWallFromStorey(wall.id);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      setPanOffset({
        x: panOffset.x + dx,
        y: panOffset.y - dy,
      });
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Update preview for drawing tool
    if (activeTool === "draw-wall" && drawingStart && canvasRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const bp = toBuilding(cx, cy);
      const snapped = snapPoint(bp.x, bp.y);

      // Redraw with preview line
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const startC = toCanvas(drawingStart.x, drawingStart.y);
        const endC = toCanvas(snapped.x, snapped.y);

        // Draw preview wall (on top of existing render)
        ctx.strokeStyle = PREVIEW_COLOR;
        ctx.lineWidth = wallThickness * zoom;
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.moveTo(startC.x, startC.y);
        ctx.lineTo(endC.x, endC.y);
        ctx.stroke();

        // Dimension label
        const dx = snapped.x - drawingStart.x;
        const dy = snapped.y - drawingStart.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "12px monospace";
        ctx.fillText(
          `${len.toFixed(0)} mm`,
          (startC.x + endC.x) / 2 + 10,
          (startC.y + endC.y) / 2 - 10
        );

        // End snap indicator
        ctx.fillStyle = SNAP_COLOR;
        ctx.beginPath();
        ctx.arc(endC.x, endC.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(zoom * delta);
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      className="w-full h-full cursor-crosshair"
      style={{ minHeight: 400 }}
    />
  );
}

// Helper: draw a wall as a thick line with optional openings
function drawWall(
  ctx: CanvasRenderingContext2D,
  wall: FloorPlanWall,
  isSelected: boolean,
  zoom: number,
  toCanvas: (x: number, y: number) => { x: number; y: number }
) {
  const start = toCanvas(wall.start_x_mm, wall.start_y_mm);
  const end = toCanvas(wall.end_x_mm, wall.end_y_mm);

  // Wall body
  ctx.strokeStyle = isSelected ? WALL_SELECTED_COLOR : WALL_COLOR;
  ctx.lineWidth = wall.thickness_mm * zoom;
  ctx.lineCap = "square";
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // Wall outline
  ctx.strokeStyle = isSelected ? "#60a5fa" : "#94a3b8";
  ctx.lineWidth = 1;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  const px = (-dy / len) * (wall.thickness_mm * zoom) / 2;
  const py = (dx / len) * (wall.thickness_mm * zoom) / 2;

  ctx.beginPath();
  ctx.moveTo(start.x + px, start.y + py);
  ctx.lineTo(end.x + px, end.y + py);
  ctx.lineTo(end.x - px, end.y - py);
  ctx.lineTo(start.x - px, start.y - py);
  ctx.closePath();
  ctx.stroke();

  // Wall label
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  ctx.fillStyle = isSelected ? "#93c5fd" : "#cbd5e1";
  ctx.font = `${Math.max(9, Math.min(12, wall.thickness_mm * zoom * 0.6))}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(wall.label || "", midX, midY - wall.thickness_mm * zoom / 2 - 8);

  // Length dimension
  const wallLen = wall.length_mm;
  ctx.fillStyle = "#9ca3af";
  ctx.font = "9px monospace";
  ctx.fillText(`${wallLen.toFixed(0)}mm`, midX, midY + wall.thickness_mm * zoom / 2 + 10);

  // Draw openings
  for (const op of wall.openings) {
    drawOpening(ctx, wall, op, zoom, toCanvas);
  }

  // Endpoint dots
  ctx.fillStyle = isSelected ? "#3b82f6" : "#64748b";
  ctx.beginPath();
  ctx.arc(start.x, start.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(end.x, end.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawOpening(
  ctx: CanvasRenderingContext2D,
  wall: FloorPlanWall,
  opening: FloorPlanOpening,
  zoom: number,
  toCanvas: (x: number, y: number) => { x: number; y: number }
) {
  const dx = wall.end_x_mm - wall.start_x_mm;
  const dy = wall.end_y_mm - wall.start_y_mm;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  // Position along wall
  const t = opening.position_along_wall_mm / len;
  const cx = wall.start_x_mm + dx * t;
  const cy = wall.start_y_mm + dy * t;
  const center = toCanvas(cx, cy);

  // Opening width in canvas coords
  const halfW = (opening.width_mm / 2) * zoom;

  // Direction along wall (canvas coords)
  const start = toCanvas(wall.start_x_mm, wall.start_y_mm);
  const end = toCanvas(wall.end_x_mm, wall.end_y_mm);
  const cdx = end.x - start.x;
  const cdy = end.y - start.y;
  const clen = Math.sqrt(cdx * cdx + cdy * cdy);
  if (clen === 0) return;
  const ux = cdx / clen;
  const uy = cdy / clen;

  const isDoor = opening.opening_type === "door";
  const color = isDoor ? DOOR_COLOR : WINDOW_COLOR;
  const halfThick = (wall.thickness_mm * zoom) / 2;

  // Draw opening break in wall
  ctx.fillStyle = BG_COLOR;
  ctx.beginPath();
  ctx.moveTo(center.x - ux * halfW - (-uy) * halfThick, center.y - uy * halfW - ux * halfThick);
  ctx.lineTo(center.x + ux * halfW - (-uy) * halfThick, center.y + uy * halfW - ux * halfThick);
  ctx.lineTo(center.x + ux * halfW + (-uy) * halfThick, center.y + uy * halfW + ux * halfThick);
  ctx.lineTo(center.x - ux * halfW + (-uy) * halfThick, center.y - uy * halfW + ux * halfThick);
  ctx.closePath();
  ctx.fill();

  // Draw opening indicator
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  if (isDoor) {
    // Door arc
    ctx.beginPath();
    ctx.arc(center.x - ux * halfW, center.y - uy * halfW, halfW * 2, 0, Math.PI / 2);
    ctx.stroke();
    // Door line
    ctx.beginPath();
    ctx.moveTo(center.x - ux * halfW, center.y - uy * halfW);
    ctx.lineTo(center.x + ux * halfW, center.y + uy * halfW);
    ctx.stroke();
  } else {
    // Window: double line
    ctx.beginPath();
    ctx.moveTo(center.x - ux * halfW, center.y - uy * halfW);
    ctx.lineTo(center.x + ux * halfW, center.y + uy * halfW);
    ctx.stroke();
    // Cross lines
    ctx.beginPath();
    ctx.moveTo(center.x - ux * halfW, center.y - uy * halfW - 3);
    ctx.lineTo(center.x - ux * halfW, center.y - uy * halfW + 3);
    ctx.moveTo(center.x + ux * halfW, center.y + uy * halfW - 3);
    ctx.lineTo(center.x + ux * halfW, center.y + uy * halfW + 3);
    ctx.stroke();
  }

  // Label
  ctx.fillStyle = color;
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.fillText(
    `${isDoor ? "P" : "V"} ${opening.width_mm}x${opening.height_mm}`,
    center.x,
    center.y - halfThick - 12
  );
}
