"""Shop drawing generation service for panelization.

Generates PDF drawings for wall elevations, panel details, and cutting lists.
"""

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    PageBreak,
)
from reportlab.graphics.shapes import Drawing, Rect, Line, String, Group
from reportlab.graphics import renderPDF

from sqlalchemy.orm import Session

from app.models.panelization_result import PanelizationResult, PanelInstance
from app.models.ifc_element import IfcElement
from app.models.sip_panel_config import SipPanelConfig
from app.models.framing_member import FramingMember


class ShopDrawingService:
    """Generates shop drawing PDFs for panelized walls."""

    def __init__(self, db: Session):
        self.db = db
        self.styles = getSampleStyleSheet()

    def generate_wall_elevation_pdf(self, result_id: int) -> io.BytesIO:
        """Generate a wall elevation drawing showing all panels."""
        result = self.db.query(PanelizationResult).filter(PanelizationResult.id == result_id).first()
        if not result:
            raise ValueError("Panelization result not found")

        element = self.db.query(IfcElement).filter(IfcElement.id == result.ifc_element_id).first()
        wall_length = (element.length_m or 0) * 1000
        wall_height = (element.height_m or 0) * 1000

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter), leftMargin=0.5*inch, rightMargin=0.5*inch)

        elements = []

        # Title
        title = f"Elevación de Muro - {element.name or 'Muro'}"
        elements.append(Paragraph(title, self.styles["Title"]))
        elements.append(Paragraph(
            f"Piso: {element.storey_name or 'N/A'} | Tipo: {result.config_type.upper()} | "
            f"Dimensiones: {wall_length:.0f} x {wall_height:.0f} mm | "
            f"Paneles: {len(result.panel_instances)} | Fecha: {datetime.now().strftime('%Y-%m-%d')}",
            self.styles["Normal"]
        ))
        elements.append(Spacer(1, 0.3*inch))

        # Drawing
        drawing = self._create_wall_elevation_drawing(
            wall_length, wall_height, result.panel_instances
        )
        elements.append(drawing)

        # Panel schedule table
        elements.append(Spacer(1, 0.3*inch))
        elements.append(Paragraph("Lista de Paneles", self.styles["Heading2"]))
        table_data = [["Etiqueta", "Tipo", "Ancho (mm)", "Alto (mm)", "Area (m²)", "Peso (kg)", "Corte"]]
        for p in result.panel_instances:
            table_data.append([
                p.panel_label, p.panel_type,
                f"{p.width_mm:.0f}", f"{p.height_mm:.0f}",
                f"{p.area_m2:.3f}", f"{p.weight_kg:.1f}",
                "Si" if p.is_custom_cut else "No",
            ])

        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
            ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ]))
        elements.append(table)

        doc.build(elements)
        buffer.seek(0)
        return buffer

    def generate_cutting_list_pdf(self, project_id: int) -> io.BytesIO:
        """Generate a cutting list grouped by panel size."""
        results = (
            self.db.query(PanelizationResult)
            .filter(PanelizationResult.project_id == project_id)
            .all()
        )

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)

        elements = []
        elements.append(Paragraph("Lista de Corte - Paneles", self.styles["Title"]))
        elements.append(Paragraph(
            f"Proyecto ID: {project_id} | Fecha: {datetime.now().strftime('%Y-%m-%d')}",
            self.styles["Normal"]
        ))
        elements.append(Spacer(1, 0.3*inch))

        # Group panels by size
        size_groups: dict[str, list] = {}
        for result in results:
            element = self.db.query(IfcElement).filter(IfcElement.id == result.ifc_element_id).first()
            for p in result.panel_instances:
                key = f"{p.width_mm:.0f}x{p.height_mm:.0f}"
                if key not in size_groups:
                    size_groups[key] = []
                size_groups[key].append({
                    "label": p.panel_label,
                    "wall": element.name if element else "N/A",
                    "type": p.panel_type,
                    "custom": p.is_custom_cut,
                    "opening": p.has_opening,
                })

        # Table per size group
        for size_key in sorted(size_groups.keys()):
            panels = size_groups[size_key]
            elements.append(Paragraph(
                f"Tamaño: {size_key} mm ({len(panels)} unidades)",
                self.styles["Heading3"]
            ))

            table_data = [["#", "Etiqueta", "Muro", "Tipo", "Corte", "Vano"]]
            for i, p in enumerate(panels, 1):
                table_data.append([
                    str(i), p["label"], p["wall"], p["type"],
                    "Si" if p["custom"] else "No",
                    "Si" if p["opening"] else "No",
                ])

            table = Table(table_data, repeatRows=1)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
            ]))
            elements.append(table)
            elements.append(Spacer(1, 0.2*inch))

        doc.build(elements)
        buffer.seek(0)
        return buffer

    def generate_full_set_pdf(self, project_id: int) -> io.BytesIO:
        """Generate a complete drawing set with all wall elevations and cutting list."""
        results = (
            self.db.query(PanelizationResult)
            .filter(PanelizationResult.project_id == project_id)
            .all()
        )

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter), leftMargin=0.5*inch, rightMargin=0.5*inch)

        all_elements = []

        # Cover page
        all_elements.append(Paragraph("Planos de Taller", self.styles["Title"]))
        all_elements.append(Paragraph("Set Completo de Panelización", self.styles["Heading2"]))
        all_elements.append(Spacer(1, 0.5*inch))
        all_elements.append(Paragraph(
            f"Proyecto ID: {project_id} | "
            f"Muros: {len(results)} | "
            f"Total paneles: {sum(len(r.panel_instances) for r in results)} | "
            f"Fecha: {datetime.now().strftime('%Y-%m-%d')}",
            self.styles["Normal"]
        ))

        # Wall elevations
        for result in results:
            element = self.db.query(IfcElement).filter(IfcElement.id == result.ifc_element_id).first()
            wall_length = (element.length_m or 0) * 1000
            wall_height = (element.height_m or 0) * 1000

            all_elements.append(PageBreak())
            all_elements.append(Paragraph(
                f"Muro: {element.name or 'N/A'} | {element.storey_name or 'N/A'}",
                self.styles["Heading2"]
            ))
            all_elements.append(Paragraph(
                f"{wall_length:.0f} x {wall_height:.0f} mm | {len(result.panel_instances)} paneles | {result.config_type.upper()}",
                self.styles["Normal"]
            ))
            all_elements.append(Spacer(1, 0.2*inch))

            drawing = self._create_wall_elevation_drawing(
                wall_length, wall_height, result.panel_instances
            )
            all_elements.append(drawing)

            # Mini panel table
            all_elements.append(Spacer(1, 0.2*inch))
            table_data = [["Etiqueta", "Tipo", "Ancho", "Alto", "Area", "Peso"]]
            for p in result.panel_instances:
                table_data.append([
                    p.panel_label, p.panel_type,
                    f"{p.width_mm:.0f}", f"{p.height_mm:.0f}",
                    f"{p.area_m2:.3f}", f"{p.weight_kg:.1f}",
                ])
            table = Table(table_data, repeatRows=1)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
            ]))
            all_elements.append(table)

        doc.build(all_elements)
        buffer.seek(0)
        return buffer

    def _create_wall_elevation_drawing(
        self, wall_length_mm: float, wall_height_mm: float,
        panel_instances: list,
    ) -> Drawing:
        """Create a 2D wall elevation drawing using ReportLab shapes."""
        # Scale to fit page (max ~9 inches wide for landscape letter)
        max_width = 8.5 * inch
        max_height = 3.5 * inch
        scale_x = max_width / wall_length_mm if wall_length_mm > 0 else 1
        scale_y = max_height / wall_height_mm if wall_height_mm > 0 else 1
        scale = min(scale_x, scale_y)

        draw_w = wall_length_mm * scale + 60
        draw_h = wall_height_mm * scale + 60
        offset_x = 40
        offset_y = 20

        d = Drawing(draw_w, draw_h)

        # Wall outline
        d.add(Rect(
            offset_x, offset_y,
            wall_length_mm * scale, wall_height_mm * scale,
            strokeColor=colors.grey, fillColor=None, strokeWidth=1.5,
        ))

        # Panel colors
        panel_colors = {
            "full": colors.HexColor("#3b82f6"),
            "filler": colors.HexColor("#f59e0b"),
            "header": colors.HexColor("#8b5cf6"),
            "sill": colors.HexColor("#06b6d4"),
        }

        # Draw panels
        for p in panel_instances:
            x = offset_x + p.position_x_mm * scale
            y = offset_y + p.position_y_mm * scale
            w = p.width_mm * scale
            h = p.height_mm * scale

            fill = panel_colors.get(p.panel_type, panel_colors["full"])
            fill_with_alpha = colors.Color(fill.red, fill.green, fill.blue, alpha=0.15)

            d.add(Rect(x, y, w, h, strokeColor=fill, fillColor=fill_with_alpha, strokeWidth=0.8))

            # Panel label
            if w > 15 and h > 15:
                d.add(String(
                    x + w / 2, y + h / 2 + 3,
                    p.panel_label,
                    fontSize=max(5, min(8, w / 8)),
                    textAnchor="middle",
                    fillColor=colors.black,
                ))
                # Dimensions
                dim_text = f"{p.width_mm:.0f}x{p.height_mm:.0f}"
                d.add(String(
                    x + w / 2, y + h / 2 - 7,
                    dim_text,
                    fontSize=max(4, min(6, w / 10)),
                    textAnchor="middle",
                    fillColor=colors.grey,
                ))

            # Opening
            if p.has_opening and p.opening_x_mm is not None:
                ox = x + p.opening_x_mm * scale
                oy = y + (p.opening_y_mm or 0) * scale
                ow = (p.opening_width_mm or 0) * scale
                oh = (p.opening_height_mm or 0) * scale
                d.add(Rect(ox, oy, ow, oh, strokeColor=colors.red, fillColor=colors.white, strokeWidth=1))
                # X cross for opening
                d.add(Line(ox, oy, ox + ow, oy + oh, strokeColor=colors.red, strokeWidth=0.5))
                d.add(Line(ox + ow, oy, ox, oy + oh, strokeColor=colors.red, strokeWidth=0.5))

        # Dimension: wall length
        dim_y = offset_y - 12
        d.add(Line(offset_x, dim_y, offset_x + wall_length_mm * scale, dim_y, strokeColor=colors.black, strokeWidth=0.5))
        d.add(String(
            offset_x + wall_length_mm * scale / 2, dim_y - 8,
            f"{wall_length_mm:.0f} mm ({wall_length_mm/1000:.2f} m)",
            fontSize=7, textAnchor="middle",
        ))

        # Dimension: wall height
        dim_x = offset_x - 12
        d.add(Line(dim_x, offset_y, dim_x, offset_y + wall_height_mm * scale, strokeColor=colors.black, strokeWidth=0.5))

        return d
