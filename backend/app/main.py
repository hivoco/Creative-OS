from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import Base, engine
from app.routers import auth, layers, render, review, templates, translate, video
from app.services import gemini
from app.services.storage import ensure_upload_dir

# Import models so metadata is populated before create_all.
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_upload_dir()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Creative OS — Multilingual Brand Template System", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

app.include_router(auth.router)
app.include_router(templates.router)
app.include_router(layers.router)
app.include_router(translate.router)
app.include_router(render.router)
app.include_router(review.router)
app.include_router(video.router)


@app.get("/health")
def health():
    return {"status": "ok", "gemini_live": gemini.is_live()}
