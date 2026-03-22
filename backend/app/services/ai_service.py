"""Claude API integration service for AI-powered analysis."""

import json
from anthropic import Anthropic

from app.config import settings


class AiAssistantService:
    """Integrates with Claude API for intelligent BIM analysis."""

    def __init__(self):
        self.client = Anthropic(api_key=settings.anthropic_api_key)
        self.model = settings.claude_model

    def _send_message(self, system_prompt: str, user_message: str) -> str:
        """Send a message to Claude and return the response text."""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        return response.content[0].text

    def analyze_ifc_model(self, model_summary: dict) -> str:
        """Analyze an IFC model and provide insights."""
        system = (
            "You are a BIM (Building Information Modeling) expert and construction engineer. "
            "Analyze the building model summary and provide: "
            "1. Overview of the building structure "
            "2. Potential issues or anomalies in the data "
            "3. Suggestions for improving the model "
            "4. Key metrics and ratios (wall-to-floor ratio, etc.) "
            "Be concise and professional."
        )

        user_msg = f"Analyze this BIM model:\n\n{json.dumps(model_summary, indent=2)}"
        return self._send_message(system, user_msg)

    def suggest_mep_design(self, building_info: dict) -> str:
        """Generate MEP design recommendations."""
        system = (
            "You are an MEP (Mechanical, Electrical, Plumbing) engineer. "
            "Given the building information, recommend: "
            "1. Electrical: number of circuits, panel sizing, wire home runs "
            "2. Plumbing: pipe sizing approach, water heater sizing, main line size "
            "3. Key code requirements to consider (NEC for electrical, IPC for plumbing) "
            "Provide specific, actionable recommendations with calculations where possible."
        )

        user_msg = f"Design MEP for this building:\n\n{json.dumps(building_info, indent=2)}"
        return self._send_message(system, user_msg)

    def check_code_compliance(self, design_data: dict, code: str = "NEC") -> str:
        """Review design against building codes."""
        system = (
            f"You are a {code} code compliance expert. "
            "Review the following MEP design and: "
            "1. Flag any code violations "
            "2. Identify areas of concern "
            "3. Reference specific code sections "
            "4. Suggest corrections for any issues found "
            "Be thorough and reference specific code articles."
        )

        user_msg = f"Review this design for {code} compliance:\n\n{json.dumps(design_data, indent=2)}"
        return self._send_message(system, user_msg)

    def optimize_materials(self, takeoff_data: dict) -> str:
        """Suggest material optimizations based on quantity takeoff."""
        system = (
            "You are a construction materials expert. "
            "Analyze the quantity takeoff and suggest: "
            "1. Cost reduction opportunities "
            "2. Alternative materials "
            "3. Waste reduction strategies "
            "4. Sustainability improvements "
            "Be specific about estimated savings where possible."
        )

        user_msg = f"Optimize materials for this takeoff:\n\n{json.dumps(takeoff_data, indent=2)}"
        return self._send_message(system, user_msg)

    def chat(self, message: str, context: dict | None = None) -> str:
        """General chat with project context."""
        system = (
            "You are a BIM and construction engineering assistant. "
            "Help users with design questions, calculations, code references, "
            "and best practices for building construction. "
            "Be concise and practical."
        )

        user_msg = message
        if context:
            user_msg = f"Project context:\n{json.dumps(context, indent=2)}\n\nUser question: {message}"

        return self._send_message(system, user_msg)
