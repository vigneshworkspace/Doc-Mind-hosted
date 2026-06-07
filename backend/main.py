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
    notes,
    history,
    user_settings,
    visual_ai,
    visualize,
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

# How long (seconds) we let the whole pool-creation attempt run before giving up.
# Even with conn_retries=0 a single connect can hang on a dead host's TCP timeout,
# so wrap the await in asyncio.wait_for as a hard upper bound. Keeps TestClient
# (and any no-Redis boot) from blocking on startup.
_ARQ_CONNECT_TIMEOUT = 1.5


def _get_redis_settings():
    import os
    url = os.getenv("REDIS_URL", "redis://localhost:6379").replace("redis://", "")
    if "/" in url:
        url = url.split("/")[0]
    host, _, port = url.partition(":")
    # conn_retries=0 + a short conn_timeout means a missing Redis fails fast
    # instead of ARQ's default 5 retries × 1s back-off (~10s of blocked startup).
    return RedisSettings(
        host=host or "localhost",
        port=int(port or 6379),
        conn_timeout=1,
        conn_retries=0,
        conn_retry_delay=0,
    )


@app.on_event("startup")
async def startup():
    import asyncio
    # Lazy / best-effort: never block boot on Redis. If the pool can't be built
    # quickly (no Redis, wrong host, slow network), leave arq_pool=None and let
    # request handlers fall back to inline processing.
    try:
        app.state.arq_pool = await asyncio.wait_for(
            create_pool(_get_redis_settings()),
            timeout=_ARQ_CONNECT_TIMEOUT,
        )
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
app.include_router(notes.router, prefix="/api/v1/notes", tags=["notes"])
app.include_router(history.router, prefix="/api/v1/history", tags=["history"])
app.include_router(user_settings.router, prefix="/api/v1/settings", tags=["settings"])
app.include_router(visual_ai.router, prefix="/api/v1/visual-ai", tags=["visual-ai"])
app.include_router(visualize.router, prefix="/api/v1/visualize", tags=["visualize"])
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
