from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import (
    auth,
    documents,
    quizzes,
    flashcards,
    chat,
    mindmaps,
    audio_recaps,
    quick_revise,
    notes,
    groups,
    history,
    user_settings,
    visual_ai,
    diagrams,
    concepts,
)
from app.youtube_transcript import router as youtube_router
from app.voice.router import router as voice_router, get_fastrtc_app

app = FastAPI(title="DocMind API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from arq.connections import RedisSettings
from arq import create_pool


def _get_redis_settings():
    import os
    url = os.getenv("REDIS_URL", "redis://localhost:6379").replace("redis://", "")
    if "/" in url:
        url = url.split("/")[0]
    host, _, port = url.partition(":")
    return RedisSettings(host=host or "localhost", port=int(port or 6379))


@app.on_event("startup")
async def startup():
    try:
        app.state.arq_pool = await create_pool(_get_redis_settings())
    except Exception:
        app.state.arq_pool = None


@app.on_event("shutdown")
async def shutdown():
    if getattr(app.state, "arq_pool", None):
        await app.state.arq_pool.close()


app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(quizzes.router, prefix="/api/v1/quizzes", tags=["quizzes"])
app.include_router(flashcards.router, prefix="/api/v1/flashcards", tags=["flashcards"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(mindmaps.router, prefix="/api/v1/mindmaps", tags=["mindmaps"])
app.include_router(audio_recaps.router, prefix="/api/v1/audio-recaps", tags=["audio"])
app.include_router(quick_revise.router, prefix="/api/v1/quick-revise", tags=["quick-revise"])
app.include_router(notes.router, prefix="/api/v1/notes", tags=["notes"])
app.include_router(groups.router, prefix="/api/v1/groups", tags=["groups"])
app.include_router(history.router, prefix="/api/v1/history", tags=["history"])
app.include_router(user_settings.router, prefix="/api/v1/settings", tags=["settings"])
app.include_router(visual_ai.router, prefix="/api/v1/visual-ai", tags=["visual-ai"])
app.include_router(diagrams.router, prefix="/api/v1/diagrams", tags=["diagrams"])
app.include_router(concepts.router, prefix="/api/v1/concepts", tags=["concepts"])
app.include_router(youtube_router, tags=["youtube"])
app.include_router(voice_router, prefix="/api/v1/voice", tags=["voice"])


@app.on_event("startup")
async def _mount_fastrtc():
    rtc = get_fastrtc_app()
    if rtc is not None:
        try:
            app.mount("/voice-stream", rtc)
        except Exception:
            pass


@app.get("/health")
def health():
    return {"status": "ok"}
