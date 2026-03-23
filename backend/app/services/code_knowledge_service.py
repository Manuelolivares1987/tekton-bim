"""Building Code Knowledge Service - RAG pipeline for construction standards.

Flow:
1. Seed: Load built-in normativas for SA countries
2. Upload: User uploads PDF → extract text → chunk → categorize with Claude
3. Retrieve: Given a country + prompt, find relevant code chunks
4. Inject: Add retrieved chunks to Claude's system prompt for house generation
"""

from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.config import settings
from app.core.normativas_sudamerica import BUILTIN_CODES
from app.models.building_code import BuildingCode, BuildingCodeChunk

# Topics for categorization
TOPICS = [
    "seismic", "structural_walls", "structural_roof", "fire_rating",
    "insulation", "ventilation", "dimensions", "openings", "foundations",
    "electrical", "plumbing", "accessibility", "general",
]


class CodeKnowledgeService:
    def __init__(self, db: Session):
        self.db = db

    # ── Seeding ──

    def seed_builtin_codes(self):
        """Load built-in SA country codes if not already present."""
        for code_data in BUILTIN_CODES:
            existing = (
                self.db.query(BuildingCode)
                .filter(
                    BuildingCode.country == code_data["country"],
                    BuildingCode.name == code_data["code_name"],
                    BuildingCode.source == "builtin",
                )
                .first()
            )
            if existing:
                continue

            code = BuildingCode(
                name=code_data["code_name"],
                country=code_data["country"],
                code_type=code_data["code_type"],
                source="builtin",
                is_active=True,
            )
            self.db.add(code)
            self.db.flush()

            for chunk_data in code_data["chunks"]:
                chunk = BuildingCodeChunk(
                    code_id=code.id,
                    section_title=chunk_data["section"],
                    content=chunk_data["content"],
                    topic=chunk_data["topic"],
                    keywords=chunk_data.get("keywords", ""),
                )
                self.db.add(chunk)

        self.db.commit()

    # ── PDF Upload & Processing ──

    def upload_and_process_pdf(
        self,
        file_path: str,
        name: str,
        country: str,
        code_type: str,
        version: str = "",
    ) -> dict:
        """Upload a PDF, extract text, chunk it, and categorize with Claude."""
        import pdfplumber

        # Extract text from PDF
        pages_text = []
        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text and len(text.strip()) > 50:
                    pages_text.append({"page": i + 1, "text": text.strip()})

        if not pages_text:
            raise ValueError("No se pudo extraer texto del PDF")

        # Create code record
        code = BuildingCode(
            name=name,
            country=country,
            code_type=code_type,
            version=version,
            source="uploaded",
            file_path=file_path,
            is_active=True,
        )
        self.db.add(code)
        self.db.flush()

        # Chunk pages into sections (~1000 chars each)
        raw_chunks = []
        for page_data in pages_text:
            text = page_data["text"]
            page_num = page_data["page"]

            # Split by double newlines or numbered sections
            sections = text.split("\n\n")
            current_chunk = ""
            for section in sections:
                if len(current_chunk) + len(section) > 1200 and current_chunk:
                    raw_chunks.append({"text": current_chunk.strip(), "page": page_num})
                    current_chunk = section
                else:
                    current_chunk += "\n\n" + section
            if current_chunk.strip():
                raw_chunks.append({"text": current_chunk.strip(), "page": page_num})

        # Categorize chunks with Claude (batch to save API calls)
        categorized = self._categorize_chunks_with_ai(raw_chunks, name, country)

        # Store chunks
        chunks_created = 0
        for cat in categorized:
            chunk = BuildingCodeChunk(
                code_id=code.id,
                section_title=cat.get("section", ""),
                content=cat["text"],
                topic=cat.get("topic", "general"),
                keywords=cat.get("keywords", ""),
                page_number=cat.get("page"),
                relevance_score=cat.get("relevance", 1.0),
            )
            self.db.add(chunk)
            chunks_created += 1

        self.db.commit()

        return {
            "code_id": code.id,
            "name": name,
            "pages_extracted": len(pages_text),
            "chunks_created": chunks_created,
        }

    def _categorize_chunks_with_ai(self, chunks: list[dict], code_name: str, country: str) -> list[dict]:
        """Use Claude to categorize text chunks by topic."""
        if not settings.anthropic_api_key:
            # Fallback: no AI categorization, use "general" topic
            return [{"text": c["text"], "page": c["page"], "topic": "general", "section": "", "keywords": ""} for c in chunks]

        client = Anthropic(api_key=settings.anthropic_api_key)

        # Process in batches of 10 chunks
        categorized = []
        for i in range(0, len(chunks), 10):
            batch = chunks[i:i + 10]
            batch_text = "\n---CHUNK---\n".join(
                f"[Página {c['page']}]\n{c['text'][:800]}" for c in batch
            )

            prompt = f"""Categoriza los siguientes fragmentos de la normativa "{code_name}" ({country}).

Para cada fragmento, responde con una línea en formato:
CHUNK_NUM|topic|section_title|keywords

Topics válidos: {', '.join(TOPICS)}

Fragmentos:
{batch_text}

Responde SOLO las líneas de categorización, una por chunk, en orden."""

            try:
                response = client.messages.create(
                    model=settings.claude_model,
                    max_tokens=2048,
                    messages=[{"role": "user", "content": prompt}],
                )
                lines = response.content[0].text.strip().split("\n")

                for j, chunk in enumerate(batch):
                    if j < len(lines):
                        parts = lines[j].split("|")
                        topic = parts[1].strip() if len(parts) > 1 else "general"
                        section = parts[2].strip() if len(parts) > 2 else ""
                        keywords = parts[3].strip() if len(parts) > 3 else ""
                        if topic not in TOPICS:
                            topic = "general"
                    else:
                        topic, section, keywords = "general", "", ""

                    categorized.append({
                        "text": chunk["text"],
                        "page": chunk["page"],
                        "topic": topic,
                        "section": section,
                        "keywords": keywords,
                        "relevance": 1.0,
                    })
            except Exception:
                # Fallback on API error
                for chunk in batch:
                    categorized.append({
                        "text": chunk["text"],
                        "page": chunk["page"],
                        "topic": "general",
                        "section": "",
                        "keywords": "",
                    })

        return categorized

    # ── Retrieval ──

    def get_context_for_generation(self, country: str, topics: list[str] | None = None) -> str:
        """Retrieve relevant code chunks for house generation prompt."""
        query = (
            self.db.query(BuildingCodeChunk)
            .join(BuildingCode)
            .filter(
                BuildingCode.country == country,
                BuildingCode.is_active == True,
            )
        )

        if topics:
            query = query.filter(BuildingCodeChunk.topic.in_(topics))

        chunks = query.order_by(BuildingCodeChunk.relevance_score.desc()).limit(20).all()

        if not chunks:
            return ""

        context_parts = []
        current_code = ""
        for chunk in chunks:
            code_name = chunk.code.name if chunk.code else ""
            if code_name != current_code:
                current_code = code_name
                context_parts.append(f"\n### {code_name}")
            if chunk.section_title:
                context_parts.append(f"\n**{chunk.section_title}**")
            context_parts.append(chunk.content)

        return "\n".join(context_parts)

    def search_codes(self, country: str, query: str) -> list[dict]:
        """Search code chunks by keyword."""
        keywords = query.lower().split()

        chunks = (
            self.db.query(BuildingCodeChunk)
            .join(BuildingCode)
            .filter(BuildingCode.country == country, BuildingCode.is_active == True)
            .all()
        )

        results = []
        for chunk in chunks:
            searchable = f"{chunk.content} {chunk.keywords or ''} {chunk.section_title or ''}".lower()
            score = sum(1 for kw in keywords if kw in searchable)
            if score > 0:
                results.append({
                    "id": chunk.id,
                    "code_name": chunk.code.name,
                    "section": chunk.section_title,
                    "topic": chunk.topic,
                    "content": chunk.content[:300],
                    "score": score,
                })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:10]

    # ── Management ──

    def list_codes(self, country: str | None = None) -> list[dict]:
        query = self.db.query(BuildingCode)
        if country:
            query = query.filter(BuildingCode.country == country)
        codes = query.order_by(BuildingCode.country, BuildingCode.name).all()
        return [
            {
                "id": c.id,
                "name": c.name,
                "country": c.country,
                "code_type": c.code_type,
                "version": c.version,
                "source": c.source,
                "is_active": c.is_active,
                "chunk_count": len(c.chunks),
            }
            for c in codes
        ]

    def delete_code(self, code_id: int):
        code = self.db.query(BuildingCode).filter(BuildingCode.id == code_id).first()
        if not code:
            raise ValueError("Code not found")
        if code.source == "builtin":
            raise ValueError("No se pueden eliminar normativas predeterminadas")
        self.db.delete(code)
        self.db.commit()
