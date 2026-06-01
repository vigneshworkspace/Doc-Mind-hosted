"""chunks and doc columns

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-17

"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = None   # Will be set to the actual previous revision if one exists
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── Document new columns ────────────────────────────────────
    op.add_column('documents', sa.Column('file_path', sa.String(500), nullable=True))
    op.add_column('documents', sa.Column('parsed_md', sa.Text(), nullable=True))
    op.add_column('documents', sa.Column('outline', sa.JSON(), nullable=True))
    op.add_column('documents', sa.Column('page_count', sa.Integer(), nullable=True))
    op.add_column('documents', sa.Column('token_count', sa.Integer(), nullable=True))
    op.add_column('documents', sa.Column('summary', sa.Text(), nullable=True))
    op.add_column('documents', sa.Column('section_summaries', sa.JSON(), nullable=True))
    op.add_column('documents', sa.Column('processing_status', sa.String(20), nullable=True, server_default='queued'))

    # ── AudioRecap new column ───────────────────────────────────
    op.add_column('audio_recaps', sa.Column('processing_status', sa.String(20), nullable=True, server_default='queued'))

    # ── Chunks table ────────────────────────────────────────────
    op.create_table(
        'chunks',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('section_id', sa.String(200), nullable=True),
        sa.Column('page_start', sa.Integer(), nullable=True),
        sa.Column('page_end', sa.Integer(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('raw_text', sa.Text(), nullable=False),
        sa.Column('context', sa.Text(), nullable=False, server_default=''),
        sa.Column('contextualized_text', sa.Text(), nullable=False),
        sa.Column('embedding_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    # pgvector embedding column (768-dim for nomic-embed-text-v1.5)
    op.execute("ALTER TABLE chunks ADD COLUMN embedding vector(768)")

    # HNSW index for cosine similarity search
    op.execute("""
        CREATE INDEX chunks_embedding_hnsw
        ON chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    """)

    # FTS column + GIN index
    op.execute("""
        ALTER TABLE chunks
        ADD COLUMN fts tsvector
        GENERATED ALWAYS AS (to_tsvector('english', contextualized_text)) STORED
    """)
    op.execute("CREATE INDEX chunks_fts_gin ON chunks USING gin(fts)")
    op.execute("CREATE INDEX chunks_user_doc ON chunks(user_id, document_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS chunks CASCADE")
    op.drop_column('documents', 'processing_status')
    op.drop_column('documents', 'section_summaries')
    op.drop_column('documents', 'summary')
    op.drop_column('documents', 'token_count')
    op.drop_column('documents', 'page_count')
    op.drop_column('documents', 'outline')
    op.drop_column('documents', 'parsed_md')
    op.drop_column('documents', 'file_path')
    op.drop_column('audio_recaps', 'processing_status')
