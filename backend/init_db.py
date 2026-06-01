"""
One-shot DB init: create all ORM tables + pgvector extension + vector/FTS columns + indexes.
Idempotent. Run once after starting Postgres:  python init_db.py
"""
from sqlalchemy import create_engine, text

from app.core.config import settings
from app.db.base import Base
import app.models.orm  # noqa: F401 — registers models on Base.metadata

engine = create_engine(settings.database_url)

# 1. pgvector extension (must exist before vector column)
with engine.begin() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

# 2. All ORM tables (chunks table created with embedding_json JSON column)
Base.metadata.create_all(engine)

# 3. Raw DDL that ORM/create_all cannot express: pgvector column, FTS, indexes
DDL = [
    "ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding vector(768)",
    """CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw
       ON chunks USING hnsw (embedding vector_cosine_ops)
       WITH (m = 16, ef_construction = 64)""",
    """ALTER TABLE chunks ADD COLUMN IF NOT EXISTS fts tsvector
       GENERATED ALWAYS AS (to_tsvector('english', contextualized_text)) STORED""",
    "CREATE INDEX IF NOT EXISTS chunks_fts_gin ON chunks USING gin(fts)",
    "CREATE INDEX IF NOT EXISTS chunks_user_doc ON chunks(user_id, document_id)",
]
with engine.begin() as conn:
    for stmt in DDL:
        conn.execute(text(stmt))

print("DB initialised: tables + pgvector + FTS + indexes ready.")
