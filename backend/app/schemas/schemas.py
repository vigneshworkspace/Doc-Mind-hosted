from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any
import datetime


# ── Auth ──────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str


# ── Documents ────────────────────────────────────────────────
class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    size: Optional[str] = None
    type: Optional[str] = None
    upload_date: Optional[date] = None
    tags: List[str] = []


# ── Quizzes ──────────────────────────────────────────────────
class QuizQuestion(BaseModel):
    question_text: str
    options: List[str]
    correct_answer: str
    explanation: str


class QuizGenerateRequest(BaseModel):
    document_id: Optional[int] = None
    count: int = 5
    difficulty: str = "medium"


class QuizCreate(BaseModel):
    title: str = "Practice Quiz"
    questions: List[QuizQuestion] = []
    completed: bool = False
    score: Optional[int] = None


class QuizOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    questions: List[QuizQuestion] = []
    completed: bool = False
    score: Optional[int] = None
    date: Optional[date] = None


# ── Flashcards ───────────────────────────────────────────────
class FlashCard(BaseModel):
    id: Optional[int] = None
    question: str
    answer: str


class FlashcardSetGenerateRequest(BaseModel):
    document_id: int


class FlashcardSetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    date: Optional[date] = None
    source_document_id: Optional[int] = None
    cards: List[FlashCard] = []


# ── Chat ─────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatCompleteRequest(BaseModel):
    messages: List[ChatMessage]
    document_id: Optional[int] = None


class ChatCompleteResponse(BaseModel):
    content: str
    model: str


class ChatHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: Optional[int] = None
    messages: List[ChatMessage] = []


# ── Mind Maps ────────────────────────────────────────────────
class MindMapNode(BaseModel):
    id: str
    text: str
    children: List[Any] = []


class MindMapGenerateRequest(BaseModel):
    document_id: int


class MindMapOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    date: Optional[date] = None
    source_document_id: Optional[int] = None
    root: Optional[MindMapNode] = None


# ── Audio Recaps ─────────────────────────────────────────────
class ScriptLine(BaseModel):
    speaker: str
    dialogue: str


class AudioRecapGenerateRequest(BaseModel):
    document_id: int


class AudioRecapOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    date: Optional[date] = None
    source_document_id: Optional[int] = None
    summary: Optional[str] = None
    script: List[ScriptLine] = []


# ── Quick Revise ─────────────────────────────────────────────
class RevisePoint(BaseModel):
    key_point: str
    simplified_explanation: str
    detailed_explanation: str


class QuickReviseGenerateRequest(BaseModel):
    document_id: int


class QuickReviseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    date: Optional[date] = None
    source_document_id: Optional[int] = None
    points: List[RevisePoint] = []


# ── Notes ────────────────────────────────────────────────────
class NoteCreate(BaseModel):
    title: str
    content: str = ""
    subject: str = "General"


class NotePatch(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    subject: Optional[str] = None


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: Optional[str] = None
    subject: Optional[str] = None
    date: Optional[date] = None


# ── Groups ───────────────────────────────────────────────────
class GroupCreate(BaseModel):
    name: str
    subject: str = "General"
    description: str = ""
    next_session: Optional[str] = None


class GroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    members_count: int = 1
    subject: Optional[str] = None
    next_session: Optional[str] = None
    description: Optional[str] = None


# ── Settings ─────────────────────────────────────────────────
class SettingsPatch(BaseModel):
    language: Optional[str] = None
    notifications: Optional[bool] = None
    auto_save: Optional[bool] = None
    study_reminders: Optional[bool] = None
    ai_provider: Optional[str] = None
    ollama_endpoint: Optional[str] = None


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    language: str = "English"
    notifications: bool = True
    auto_save: bool = True
    study_reminders: bool = False
    ai_provider: str = "anthropic"
    ollama_endpoint: str = "http://localhost:11434"


# ── History ──────────────────────────────────────────────────
class HistoryEventOut(BaseModel):
    kind: str
    id: int
    title: str
    date: str
    meta: str


# ── Activity ─────────────────────────────────────────────────
class ActivityLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: Optional[date] = None
