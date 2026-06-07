"""initial schema — all ORM tables

Baseline migration. Creates every table defined on the ORM metadata
(users, documents, quizzes, flashcard_sets, mind_maps, audio_recaps,
quick_revise_sessions, notes, study_groups, user_settings, activity_logs,
chunks, chat_history). This mirrors the create_all step in init_db.py so that
`alembic upgrade head` builds the same schema as the one-shot initializer.

The pgvector-specific bits chunks.embedding/fts and their indexes — which
SQLAlchemy's create_all cannot express — are added in revision 0002.

Revision ID: 0001
Revises:
Create Date: 2026-06-01
"""
from alembic import op

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Build all tables straight from the ORM metadata (same as init_db.py).
    from app.db.base import Base
    import app.models.orm  # noqa: F401 — registers every model on Base.metadata

    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    from app.db.base import Base
    import app.models.orm  # noqa: F401

    Base.metadata.drop_all(bind=op.get_bind())
