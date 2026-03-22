import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.session import init_db, close_db, SessionLocal
from app.db.seed import seed_all
from app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.upload_dir, exist_ok=True)
    await init_db()
    # Seed default data
    db = SessionLocal()
    try:
        seed_all(db)
        # Seed building code normativas
        from app.services.code_knowledge_service import CodeKnowledgeService
        CodeKnowledgeService(db).seed_builtin_codes()
    finally:
        db.close()
    yield
    await close_db()


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.version}
