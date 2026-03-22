import { useRef, useEffect } from "react";
import type { PanelInstance, WallOpening } from "../../types/api";

interface Props {
  wallLengthMm: number;
  wallHeightMm: number;
  panels: PanelInstance[];
  openings: WallOpening[];
  selectedPanelId: number | null;
  onPanelClick: (panel: PanelInstance) => void;
}

// Color palette for panel types
const PANEL_COLORS: Record<string, string> = {
  full: "#3b82f6",      // blue
  filler: "#f59e0b",    // amber
  header: "#8b5cf6",    // purple
  sill: "#06b6d4",      // cyan
  corner_left: "#10b981", // green
  corner_right: "#10b981",
  t_junction: "#ec4899", // pink
};

const OPENING_COLOR = "#ef4444"; // red
const SELECTED_COLOR = "#22c55e"; // bright green

export default function PanelLayoutCanvas({
  wallLengthMm,
  wallHeightMm,
  panels,
  openings,
  selectedPanelId,
  onPanelClick,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const containerWidth = canvas.parentElement?.clientWidth || 800;
    const aspectRatio = wallHeightMm / wallLengthMm;
    const canvasWidth = containerWidth;
    const canvasHeight = Math.min(containerWidth * aspectRatio, 500);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const scaleX = (canvasWidth - 80) / wallLengthMm; // margins
    const scaleY = (canvasHeight - 60) / wallHeightMm;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = 50;
    const offsetY = canvasHeight - 30;

    // Clear
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw wall outline
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      offsetX,
      offsetY - wallHeightMm * scale,
      wallLengthMm * scale,
      wallHeightMm * scale
    );

    // Draw panels
    for (const panel of panels) {
      const x = offsetX + panel.position_x_mm * scale;
      const y = offsetY - (panel.position_y_mm + panel.height_mm) * scale;
      const w = panel.width_mm * scale;
      const h = panel.height_mm * scale;

      const isSelected = panel.id === selectedPanelId;
      const baseColor = PANEL_COLORS[panel.panel_type] || PANEL_COLORS.full;

      // Fill panel
      ctx.globalAlpha = isSelected ? 0.5 : 0.25;
      ctx.fillStyle = isSelected ? SELECTED_COLOR : baseColor;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;

      // Panel border
      ctx.strokeStyle = isSelected ? SELECTED_COLOR : baseColor;
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.setLineDash(panel.is_custom_cut ? [4, 4] : []);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);

      // Panel label
      ctx.fillStyle = "#e5e7eb";
      ctx.font = `${Math.max(9, Math.min(12, w / 6))}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(panel.panel_label, x + w / 2, y + h / 2 - 8);

      // Dimensions
      ctx.fillStyle = "#9ca3af";
      ctx.font = `${Math.max(8, Math.min(10, w / 8))}px monospace`;
      const dimText = `${Math.round(panel.width_mm)}x${Math.round(panel.height_mm)}`;
      ctx.fillText(dimText, x + w / 2, y + h / 2 + 8);

      // Draw opening inside panel if present
      if (panel.has_opening && panel.opening_x_mm != null && panel.opening_y_mm != null) {
        const ox = x + panel.opening_x_mm * scale;
        const oy = offsetY - (panel.position_y_mm + panel.opening_y_mm + (panel.opening_height_mm || 0)) * scale;
        const ow = (panel.opening_width_mm || 0) * scale;
        const oh = (panel.opening_height_mm || 0) * scale;

        ctx.fillStyle = "#1a1a2e";
        ctx.fillRect(ox, oy, ow, oh);
        ctx.strokeStyle = OPENING_COLOR;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ox, oy, ow, oh);

        // Opening label
        ctx.fillStyle = OPENING_COLOR;
        ctx.font = "9px monospace";
        ctx.fillText(
          panel.opening_type === "door" ? "PUERTA" : "VENTANA",
          ox + ow / 2,
          oy + oh / 2
        );
      }
    }

    // Draw standalone openings (from WallOpening data)
    for (const op of openings) {
      const ox = offsetX + op.position_x_mm * scale;
      const oy = offsetY - (op.position_y_mm + op.height_mm) * scale;
      const ow = op.width_mm * scale;
      const oh = op.height_mm * scale;

      ctx.strokeStyle = OPENING_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(ox, oy, ow, oh);
      ctx.setLineDash([]);
    }

    // Dimension lines
    ctx.strokeStyle = "#6b7280";
    ctx.fillStyle = "#9ca3af";
    ctx.lineWidth = 1;
    ctx.font = "11px monospace";
    ctx.textAlign = "center";

    // Bottom: wall length
    const dimY = offsetY + 18;
    ctx.beginPath();
    ctx.moveTo(offsetX, dimY);
    ctx.lineTo(offsetX + wallLengthMm * scale, dimY);
    ctx.stroke();
    ctx.fillText(
      `${(wallLengthMm / 1000).toFixed(2)} m`,
      offsetX + (wallLengthMm * scale) / 2,
      dimY + 12
    );

    // Left: wall height
    ctx.save();
    ctx.translate(offsetX - 18, offsetY - (wallHeightMm * scale) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${(wallHeightMm / 1000).toFixed(2)} m`, 0, 0);
    ctx.restore();
  }, [wallLengthMm, wallHeightMm, panels, openings, selectedPanelId]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const containerWidth = canvas.parentElement?.clientWidth || 800;
    const aspectRatio = wallHeightMm / wallLengthMm;
    const canvasHeight = Math.min(containerWidth * aspectRatio, 500);

    const scaleX = (containerWidth - 80) / wallLengthMm;
    const scaleY = (canvasHeight - 60) / wallHeightMm;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = 50;
    const offsetY = canvasHeight - 30;

    // Find clicked panel
    for (const panel of panels) {
      const x = offsetX + panel.position_x_mm * scale;
      const y = offsetY - (panel.position_y_mm + panel.height_mm) * scale;
      const w = panel.width_mm * scale;
      const h = panel.height_mm * scale;

      if (clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h) {
        onPanelClick(panel);
        return;
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className="w-full rounded-lg cursor-crosshair"
      style={{ minHeight: 200 }}
    />
  );
}
