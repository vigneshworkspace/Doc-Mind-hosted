"""pgvector embedding + FTS on chunks

The base tables (including chunks with its embedding_json JSON column) are
created in 0001 from the ORM metadata. This revision adds only the Postgres-
specific pieces that SQLAlchemy's create_all cannot express: the pgvector
extension, the chunks.embedding vector(768) column, the generated FTS column,
and the supporting indexes. It mirrors the raw-DDL block in init_db.py exactly
(idempotent — ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-17
"""
from alembic import op


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # pgvector extension (must exist before the vector column)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # pgvector embedding column (768-dim for nomic-embed-text-v1.5)
    op.execute("ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding vector(768)")

    # HNSW index for cosine similarity search
    op.execute("""
        CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw
        ON chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # FTS column + GIN index
    op.execute("""
        ALTER TABLE chunks
        ADD COLUMN IF NOT EXISTS fts tsvector
        GENERATED ALWAYS AS (to_tsvector('english', contextualized_text)) STORED
    """)
    op.execute("CREATE INDEX IF NOT EXISTS chunks_fts_gin ON chunks USING gin(fts)")
    op.execute("CREATE INDEX IF NOT EXISTS chunks_user_doc ON chunks(user_id, document_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS chunks_user_doc")
    op.execute("DROP INDEX IF EXISTS chunks_fts_gin")
    op.execute("ALTER TABLE chunks DROP COLUMN IF EXISTS fts")
    op.execute("DROP INDEX IF EXISTS chunks_embedding_hnsw")
    op.execute("ALTER TABLE chunks DROP COLUMN IF EXISTS embedding")
