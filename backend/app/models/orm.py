from datetime import date, datetime
from sqlalchemy import (
    BigInteger, Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, String, Text, func
)
from sqlalchemy.orm import relationship
from app.db.base import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, nullable=False, index=True)
    password_hash = Column(String(200), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="owner", cascade="all, delete-orphan")
    quizzes = relationship("Quiz", back_populates="owner", cascade="all, delete-orphan")
    flashcard_sets = relationship("FlashcardSet", back_populates="owner", cascade="all, delete-orphan")
    mind_maps = relationship("MindMap", back_populates="owner", cascade="all, delete-orphan")
    audio_recaps = relationship("AudioRecap", back_populates="owner", cascade="all, delete-orphan")
    quick_revise_sessions = relationship("QuickReviseSession", back_populates="owner", cascade="all, delete-orphan")
    groups_created = relationship("StudyGroup", back_populates="creator", cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(500), nullable=False)
    size = Column(String(50))
    type = Column(String(20))
    upload_date = Column(Date, server_default=func.current_date())
    tags = Column(JSON, default=list)
    content = Column(Text)
    file_path = Column(String(500), nullable=True)
    parsed_md = Column(Text)
    outline = Column(JSON, default=list)
    page_count = Column(Integer, nullable=True)
    token_count = Column(Integer, nullable=True)
    summary = Column(Text)
    section_summaries = Column(JSON, default=list)
    processing_status = Column(String(20), default="queued")

    owner = relationship("User", back_populates="documents")


class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(500), nullable=False)
    questions = Column(JSON, default=list)
    completed = Column(Boolean, default=False)
    score = Column(Integer, nullable=True)
    date = Column(Date, server_default=func.current_date())

    owner = relationship("User", back_populates="quizzes")


class FlashcardSet(Base):
    __tablename__ = "flashcard_sets"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(500), nullable=False)
    date = Column(Date, server_default=func.current_date())
    source_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    cards = Column(JSON, default=list)

    owner = relationship("User", back_populates="flashcard_sets")


class MindMap(Base):
    __tablename__ = "mind_maps"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(500), nullable=False)
    date = Column(Date, server_default=func.current_date())
    source_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    root = Column(JSON)

    owner = relationship("User", back_populates="mind_maps")


class AudioRecap(Base):
    __tablename__ = "audio_recaps"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(500), nullable=False)
    date = Column(Date, server_default=func.current_date())
    source_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    summary = Column(Text)
    script = Column(JSON, default=list)
    audio_path = Column(String(1000), nullable=True)
    processing_status = Column(String(20), default="queued")

    owner = relationship("User", back_populates="audio_recaps")

    @property
    def audio_url(self):
        return f"/api/v1/audio-recaps/{self.id}/audio" if self.audio_path else None


class QuickReviseSession(Base):
    __tablename__ = "quick_revise_sessions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(500), nullable=False)
    date = Column(Date, server_default=func.current_date())
    source_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    points = Column(JSON, default=list)

    owner = relationship("User", back_populates="quick_revise_sessions")


class Note(Base):
    __tablename__ = "notes"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(500), nullable=False)
    content = Column(Text, default="")
    subject = Column(String(200))
    date = Column(Date, server_default=func.current_date())

    owner = relationship("User", back_populates="notes")


class StudyGroup(Base):
    __tablename__ = "study_groups"
    id = Column(Integer, primary_key=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(300), nullable=False)
    subject = Column(String(200))
    description = Column(Text)
    next_session = Column(String(200))
    members_count = Column(Integer, default=1)

    creator = relationship("User", back_populates="groups_created")


class UserSettings(Base):
    __tablename__ = "user_settings"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    language = Column(String(50), default="English")
    notifications = Column(Boolean, default=True)
    auto_save = Column(Boolean, default=True)
    study_reminders = Column(Boolean, default=False)
    ai_provider = Column(String(50), default="gemini")
    ollama_endpoint = Column(String(200), default="http://localhost:11434")

    user = relationship("User", back_populates="settings")


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, server_default=func.current_date())

    user = relationship("User", back_populates="activity_logs")


class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(BigInteger, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    section_id = Column(String(200), nullable=True)
    page_start = Column(Integer, nullable=True)
    page_end = Column(Integer, nullable=True)
    position = Column(Integer, nullable=False, default=0)
    raw_text = Column(Text, nullable=False)
    context = Column(Text, nullable=False, default="")
    contextualized_text = Column(Text, nullable=False)
    embedding_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class ChatHistory(Base):
    __tablename__ = "chat_history"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    messages = Column(JSON, default=list)
    created_at = Column(DateTime, server_default=func.now())
