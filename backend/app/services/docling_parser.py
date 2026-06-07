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


# Docling is opt-in: on CPU images its ML stages (layout/table need an ABI-matched
# torchvision; OCR pulls RapidOCR models from modelscope) either fail to import or
# hang on first-use downloads, stalling ingestion. Default to the pypdf fallback —
# which extracts real text reliably — and enable docling only on an image that has
# prefetched models + a working torchvision (DOCLING_ENABLED=true).
_DOCLING_ENABLED = os.getenv("DOCLING_ENABLED", "false").lower() in ("1", "true", "yes")


def parse_bytes(content: bytes, filename: str) -> ParsedDocument:
    """
    Parse a document from raw bytes into Markdown + outline + page count.

    Uses Docling when DOCLING_ENABLED is set (structured layout/tables); otherwise,
    and on any Docling failure, falls back to pypdf text extraction.
    """
    suffix = Path(filename).suffix.lower() or ".pdf"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        try:
            parsed = _parse_with_docling(tmp_path, content) if _DOCLING_ENABLED else _parse_fallback(content, filename)
        except Exception:
            parsed = _parse_fallback(content, filename)
        # Postgres TEXT columns reject NUL (0x00) bytes, which document parsers can
        # emit. Strip them so the markdown can be persisted.
        parsed.markdown = parsed.markdown.replace("\x00", "")
        return parsed
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


def _parse_with_docling(tmp_path: str, content: bytes) -> ParsedDocument:
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions

    # Disable OCR: it pulls RapidOCR models from modelscope.cn at runtime, which is
    # slow/often-blocked and was hanging ingestion. Digital PDFs need only the
    # layout model (prefetched at build via `docling-tools models download`). Scanned
    # docs that genuinely need OCR fall through to the pypdf text fallback.
    pdf_opts = PdfPipelineOptions()
    pdf_opts.do_ocr = False
    converter = DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_opts)}
    )
    result = converter.convert(tmp_path)
    doc = result.document

    markdown = doc.export_to_markdown()
    outline = _build_outline(doc)
    page_count = _get_page_count(doc)

    return ParsedDocument(markdown=markdown, outline=outline, page_count=page_count)


def _parse_fallback(content: bytes, filename: str) -> ParsedDocument:
    """Fallback when Docling can't run.

    For PDFs, extract real text per page with pypdf (pure-python, no native/vision
    deps) — NOT a raw UTF-8 decode, which on a binary PDF yields the compressed-
    stream garbage that used to reach the Q&A screen. Non-PDFs fall back to a
    best-effort text decode.
    """
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf" or content[:5].startswith(b"%PDF"):
        try:
            import io
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(content))
            pages = []
            for pg in reader.pages:
                try:
                    pages.append((pg.extract_text() or "").strip())
                except Exception:
                    pages.append("")
            md = "\n\n".join(p for p in pages if p).strip()
            if md:
                return ParsedDocument(markdown=md, outline=[], page_count=len(reader.pages))
        except Exception:
            pass  # fall through to text decode

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
