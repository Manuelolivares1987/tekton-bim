"""PDF generation service for assembly plans using ReportLab."""

import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    PageBreak,
)


class PdfGenerator:
    """Generates PDF assembly plan documents."""

    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.styles.add(ParagraphStyle(
            name="CoverTitle",
            parent=self.styles["Title"],
            fontSize=28,
            spaceAfter=20,
        ))
        self.styles.add(ParagraphStyle(
            name="CoverSubtitle",
            parent=self.styles["Normal"],
            fontSize=14,
            textColor=colors.grey,
            spaceAfter=10,
        ))
        self.styles.add(ParagraphStyle(
            name="SectionTitle",
            parent=self.styles["Heading2"],
            fontSize=16,
            spaceAfter=12,
            spaceBefore=20,
        ))

    def generate_assembly_pdf(
        self,
        project_name: str,
        schedule: dict,
        bom: dict,
        summary: dict,
    ) -> bytes:
        """Generate full assembly plan PDF."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.75 * inch,
            leftMargin=0.75 * inch,
            topMargin=0.75 * inch,
            bottomMargin=0.75 * inch,
        )

        elements = []

        # Cover page
        elements.extend(self._build_cover_page(project_name, summary))
        elements.append(PageBreak())

        # Panel schedule
        elements.extend(self._build_panel_schedule(schedule))
        elements.append(PageBreak())

        # Material BOM
        elements.extend(self._build_material_bom(bom))
        elements.append(PageBreak())

        # Summary
        elements.extend(self._build_summary(summary))

        doc.build(elements)
        return buffer.getvalue()

    def _build_cover_page(self, project_name: str, summary: dict) -> list:
        """Build the cover page."""
        elements = []
        elements.append(Spacer(1, 2 * inch))
        elements.append(Paragraph("Plan de Producción y Montaje", self.styles["CoverTitle"]))
        elements.append(Paragraph(project_name, self.styles["CoverSubtitle"]))
        elements.append(Spacer(1, 0.5 * inch))
        elements.append(Paragraph(
            f"Generado: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
            self.styles["CoverSubtitle"],
        ))
        elements.append(Paragraph(
            f"Total de Paneles: {summary.get('total_panels', 0)}",
            self.styles["CoverSubtitle"],
        ))
        elements.append(Paragraph(
            f"\u00c1rea Total: {summary.get('total_area_m2', 0):.1f} m\u00b2",
            self.styles["CoverSubtitle"],
        ))
        elements.append(Paragraph(
            f"Costo Estimado de Materiales: ${summary.get('total_material_cost', 0):,.2f}",
            self.styles["CoverSubtitle"],
        ))
        return elements

    def _build_panel_schedule(self, schedule: dict) -> list:
        """Build the production panel schedule table with dimensions."""
        elements = []
        elements.append(Paragraph("Plan de Producción de Paneles", self.styles["SectionTitle"]))

        headers = [
            "ID Panel", "Tipo", "Ancho (m)", "Alto (m)",
            "Espesor (mm)", "Área (m²)", "Peso (kg)",
            "Destino", "Nivel",
        ]
        data = [headers]

        total_area = 0.0
        total_weight = 0.0

        for item in schedule.get("items", []):
            area = item.get("area_m2") or 0
            weight = item.get("weight_kg") or 0
            total_area += area
            total_weight += weight
            data.append([
                item["panel_number"],
                item.get("panel_name") or item["panel_category"].replace("_", " ").title(),
                f"{item['width_m']:.3f}" if item.get("width_m") else "",
                f"{item['height_m']:.3f}" if item.get("height_m") else "",
                f"{item['thickness_mm']:.1f}" if item.get("thickness_mm") else "",
                f"{area:.2f}" if area else "",
                f"{weight:.1f}" if weight else "",
                (item.get("element_name") or "")[:25],
                (item.get("storey") or "")[:20],
            ])

        # Totals row
        data.append([
            "", "TOTALES", "", "", "",
            f"{total_area:.1f}", f"{total_weight:.0f}",
            "", "",
        ])

        if len(data) > 2:
            col_widths = [
                0.8 * inch, 1.1 * inch, 0.6 * inch, 0.6 * inch,
                0.7 * inch, 0.6 * inch, 0.6 * inch,
                1.2 * inch, 0.9 * inch,
            ]
            table = Table(data, repeatRows=1, colWidths=col_widths)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563eb")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 7),
                ("FONTSIZE", (0, 1), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("TOPPADDING", (0, 1), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f0f4ff")]),
                ("ALIGN", (2, 1), (6, -1), "RIGHT"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#dbeafe")),
            ]))
            elements.append(table)
        else:
            elements.append(Paragraph("No se encontraron asignaciones de paneles.", self.styles["Normal"]))

        elements.append(Spacer(1, 0.25 * inch))
        elements.append(Paragraph(
            f"Total: {schedule.get('total_panels', 0)} paneles",
            self.styles["Normal"],
        ))
        return elements

    def _build_material_bom(self, bom: dict) -> list:
        """Build the material BOM table."""
        elements = []
        elements.append(Paragraph("Lista de Materiales", self.styles["SectionTitle"]))
        elements.append(Paragraph(
            f"Factor de desperdicio: {bom.get('waste_factor', 1.1):.0%}",
            self.styles["Normal"],
        ))
        elements.append(Spacer(1, 0.15 * inch))

        headers = ["Material", "Categor\u00eda", "Cantidad", "Unidad", "Costo/Unidad", "Costo Total"]
        data = [headers]

        for item in bom.get("items", []):
            data.append([
                item["material_name"][:30],
                item["category"],
                f"{item['quantity']:,.1f}",
                item["unit"],
                f"${item['cost_per_unit']:,.2f}" if item.get("cost_per_unit") else "",
                f"${item['total_cost']:,.2f}" if item.get("total_cost") else "",
            ])

        # Totals row
        data.append(["", "", "", "", "TOTAL:", f"${bom.get('total_cost', 0):,.2f}"])

        if len(data) > 2:
            table = Table(data, repeatRows=1)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#059669")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("FONTSIZE", (0, 1), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
                ("TOPPADDING", (0, 1), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f0fdf4")]),
                ("ALIGN", (2, 1), (2, -1), "RIGHT"),
                ("ALIGN", (4, 1), (-1, -1), "RIGHT"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#ecfdf5")),
            ]))
            elements.append(table)
        else:
            elements.append(Paragraph("No hay datos de materiales disponibles.", self.styles["Normal"]))

        return elements

    def _build_summary(self, summary: dict) -> list:
        """Build the summary statistics page."""
        elements = []
        elements.append(Paragraph("Resumen de Montaje", self.styles["SectionTitle"]))

        # Summary stats
        stats = [
            ["M\u00e9trica", "Valor"],
            ["Total de Paneles", str(summary.get("total_panels", 0))],
            ["\u00c1rea Total de Muros", f"{summary.get('total_area_m2', 0):.1f} m\u00b2"],
            ["Costo Estimado de Materiales", f"${summary.get('total_material_cost', 0):,.2f}"],
        ]
        stats_table = Table(stats, colWidths=[3 * inch, 3 * inch])
        stats_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7c3aed")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("ALIGN", (1, 1), (1, -1), "RIGHT"),
        ]))
        elements.append(stats_table)
        elements.append(Spacer(1, 0.3 * inch))

        # By panel type
        by_type = summary.get("by_panel_type", {})
        if by_type:
            elements.append(Paragraph("Por Tipo de Panel", self.styles["Heading3"]))
            type_data = [["Tipo de Panel", "Cantidad"]]
            for name, count in sorted(by_type.items()):
                type_data.append([name, str(count)])
            type_table = Table(type_data, colWidths=[4 * inch, 2 * inch])
            type_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ]))
            elements.append(type_table)
            elements.append(Spacer(1, 0.2 * inch))

        # By storey
        by_storey = summary.get("by_storey", {})
        if by_storey:
            elements.append(Paragraph("Por Nivel", self.styles["Heading3"]))
            storey_data = [["Nivel", "Cantidad"]]
            for name, count in sorted(by_storey.items()):
                storey_data.append([name, str(count)])
            storey_table = Table(storey_data, colWidths=[4 * inch, 2 * inch])
            storey_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ]))
            elements.append(storey_table)

        return elements
