"""
Docling wrapper: parses PDF/DOCX/PPTX/HTML into structured Markdown + outline.
"""
import os
import tempfile
from pathlib import Path
from dataclasses import dataclass
from typing import Optional


@dataclass
class ParsedDocument:
    markdown: str
    outline: list[dict]   # [{title, level, page_start, page_end, children: [...]}]
    page_count: int


def parse_bytes(content: bytes, filename: str) -> ParsedDocument:
    """
    Parse a document from raw bytes.
    Writes to a temp file, parses with Docling, returns structured output.
    Falls back to plain text extraction if Docling unavailable.
    """
    suffix = Path(filename).suffix.lower() or ".pdf"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        return _parse_with_docling(tmp_path, content)
    except Exception:
        return _parse_fallback(content, filename)
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


def _parse_with_docling(tmp_path: str, content: bytes) -> ParsedDocument:
    from docling.document_converter import DocumentConverter

    converter = DocumentConverter()
    result = converter.convert(tmp_path)
    doc = result.document

    markdown = doc.export_to_markdown()
    outline = _build_outline(doc)
    page_count = _get_page_count(doc)

    return ParsedDocument(markdown=markdown, outline=outline, page_count=page_count)


def _parse_fallback(content: bytes, filename: str) -> ParsedDocument:
    """Plain text fallback when Docling is not installed."""
    try:
        text = content.decode("utf-8", errors="ignore")
    except Exception:
        text = ""
    return ParsedDocument(
        markdown=text,
        outline=[],
        page_count=max(1, len(text) // 3000),
    )


def _build_outline(doc) -> list[dict]:
    outline = []
    try:
        for item in doc.body.children:
            node = _item_to_node(item)
            if node:
                outline.append(node)
    except Exception:
        pass
    return outline


def _item_to_node(item) -> Optional[dict]:
    try:
        label = str(item.label).lower()
        if "heading" not in label and "section" not in label:
            return None
        prov = item.prov[0] if item.prov else None
        return {
            "title": item.text or "",
            "level": getattr(item, "level", 1),
            "page_start": prov.page_no if prov else None,
            "page_end": prov.page_no if prov else None,
            "children": [],
        }
    except Exception:
        return None


def _get_page_count(doc) -> int:
    try:
        pages = set()
        for item, *_ in doc.iterate_items():
            for prov in getattr(item, "prov", []):
                if hasattr(prov, "page_no"):
                    pages.add(prov.page_no)
        return max(pages) if pages else 1
    except Exception:
        return 1
