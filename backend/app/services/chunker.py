"""
Semantic chunker: splits markdown into ~chunk_size token pieces with overlap.
Splits preferentially at paragraph boundaries.
"""
import re
from dataclasses import dataclass
from typing import Optional

import tiktoken

from app.core.config import settings

_enc = tiktoken.get_encoding("cl100k_base")


def _token_len(text: str) -> int:
    return len(_enc.encode(text))


@dataclass
class ChunkData:
    """In-memory chunk (not the ORM Chunk model)."""
    raw_text: str
    section_id: Optional[str]
    page_start: Optional[int]
    page_end: Optional[int]
    position: int


def chunk_markdown(
    markdown: str,
    outline: list[dict],
    chunk_size: int = None,
    overlap_tokens: int = None,
) -> list[ChunkData]:
    """Split markdown into token-bounded chunks."""
    chunk_size = chunk_size or settings.chunk_size
    overlap_tokens = overlap_tokens or settings.chunk_overlap

    paragraphs = re.split(r"\n\s*\n", markdown.strip())
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    chunks: list[ChunkData] = []
    current_text_parts: list[str] = []
    position = 0

    def flush():
        nonlocal position, current_text_parts
        if not current_text_parts:
            return
        text = "\n\n".join(current_text_parts)
        chunks.append(ChunkData(
            raw_text=text,
            section_id=None,  # TODO: populate from Docling prov metadata
            page_start=None,
            page_end=None,
            position=position,
        ))
        position += 1
        current_text_parts = []

    for para in paragraphs:
        para_tokens = _enc.encode(para)
        current_size = _token_len("\n\n".join(current_text_parts))

        if current_size + len(para_tokens) > chunk_size and current_text_parts:
            last_para = current_text_parts[-1]
            flush()
            last_para_tokens = _enc.encode(last_para)
            if len(last_para_tokens) > overlap_tokens:
                last_para = _enc.decode(last_para_tokens[-overlap_tokens:])
            if last_para:
                current_text_parts = [last_para]

        if len(para_tokens) > chunk_size:
            sentences = re.split(r"(?<=[.!?])\s+", para)
            for sent in sentences:
                sent_toks = _enc.encode(sent)
                if _token_len("\n\n".join(current_text_parts)) + len(sent_toks) > chunk_size and current_text_parts:
                    flush()
                current_text_parts.append(sent)
        else:
            current_text_parts.append(para)

    flush()
    return chunks
