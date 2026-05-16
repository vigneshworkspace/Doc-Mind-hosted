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
)

app = FastAPI(title="DocMind API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/health")
def health():
    return {"status": "ok"}
