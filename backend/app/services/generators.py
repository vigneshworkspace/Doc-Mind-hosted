"""
DocMind AI generation functions.
All functions are async. Routers must await them.
"""
from typing import AsyncIterable, List, Optional
from pydantic import BaseModel

from app.services.ai import get_provider_with_fallback


# ── Internal structured output schemas ────────────────────────────────────────

class _QuizQuestion(BaseModel):
    question_text: str
    options: List[str]
    correct_answer: str
    explanation: str


class _QuizList(BaseModel):
    questions: List[_QuizQuestion]


class _FlashCard(BaseModel):
    question: str
    answer: str


class _FlashCardList(BaseModel):
    cards: List[_FlashCard]


class _MindMapNode(BaseModel):
    id: str
    text: str
    children: List["_MindMapNode"] = []

_MindMapNode.model_rebuild()


class _ScriptLine(BaseModel):
    speaker: str
    dialogue: str


class _AudioScript(BaseModel):
    summary: str
    script: List[_ScriptLine]


class _RevisePoint(BaseModel):
    key_point: str
    simplified_explanation: str
    detailed_explanation: str


class _ReviseList(BaseModel):
    points: List[_RevisePoint]


class _VisualStep(BaseModel):
    step: str


class _VisualSolution(BaseModel):
    problem: str
    steps: List[str]
    result: str


class _Diagram(BaseModel):
    mermaid: str


class _Concept(BaseModel):
    mermaid: str
    explanation: str


class _YTChapter(BaseModel):
    timestamp: str
    title: str


class _YTSummary(BaseModel):
    summary: str
    chapters: List[_YTChapter]
    key_points: List[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _provider():
    return get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])


def _truncate(text: str, tokens: int = 4000) -> str:
    limit = tokens * 4
    return text[:limit] if len(text) > limit else text


def get_doc_text(doc, max_tokens: int = 30_000) -> str:
    text = getattr(doc, "parsed_md", None) or getattr(doc, "content", "") or ""
    limit = max_tokens * 4
    return text[:limit] if len(text) > limit else text


def get_doc_context(doc) -> str:
    parts = []
    summary = getattr(doc, "summary", None)
    if summary:
        parts.append(f"## Document Summary\n{summary}")
    text = get_doc_text(doc, max_tokens=25_000)
    if text:
        parts.append(f"## Full Document\n{text}")
    return "\n\n".join(parts)


# ── Public async API ──────────────────────────────────────────────────────────

async def generate_quiz(content: str, count: int = 5, difficulty: str = "medium") -> list[dict]:
    try:
        provider = _provider()
        result = await provider.structured_output(
            messages=[{
                "role": "user",
                "content": (
                    f"Generate exactly {count} {difficulty}-difficulty multiple-choice quiz questions "
                    f"from this content. Each question must have exactly 4 options.\n\n"
                    f"Content:\n{_truncate(content)}"
                ),
            }],
            schema=_QuizList,
            system_prompt="You are an expert educator. Generate quiz questions as instructed. Return valid JSON only.",
        )
        return [q.model_dump() for q in result.questions]
    except Exception:
        return _mock_quiz(count)


async def generate_flashcards(content: str) -> list[dict]:
    try:
        provider = _provider()
        result = await provider.structured_output(
            messages=[{
                "role": "user",
                "content": f"Generate flashcards from this content.\n\nContent:\n{_truncate(content)}",
            }],
            schema=_FlashCardList,
            system_prompt="You are an expert educator. Generate concise flashcard pairs. Return valid JSON only.",
        )
        return [c.model_dump() for c in result.cards]
    except Exception:
        return _mock_flashcards()


async def chat_complete(messages: list[dict], context: str = "") -> str:
    try:
        provider = _provider()
        system = "You are DocMind, a helpful AI study assistant. Be concise and pedagogically precise."
        if context:
            system += f"\n\nDocument context:\n{_truncate(context, tokens=3000)}"
        return await provider.chat_completion(messages=messages, system_prompt=system)
    except Exception:
        return f"[Demo] You asked: {messages[-1]['content'][:80]}..."


async def stream_chat_complete(messages: list[dict], context: str = "") -> AsyncIterable[str]:
    try:
        provider = _provider()
        system = "You are DocMind, a helpful AI study assistant. Be concise and pedagogically precise."
        if context:
            system += f"\n\nDocument context:\n{_truncate(context, tokens=3000)}"
        async for chunk in provider.stream_completion(messages=messages, system_prompt=system):
            yield chunk
    except Exception:
        yield f"[Demo] You asked: {messages[-1]['content'][:80]}..."


async def generate_mindmap(content: str) -> dict:
    try:
        provider = _provider()
        result = await provider.structured_output(
            messages=[{
                "role": "user",
                "content": (
                    "Create a mind map from the text below. Maximum 3 levels deep.\n\n"
                    f"TEXT:\n{_truncate(content)}"
                ),
            }],
            schema=_MindMapNode,
            system_prompt="You are a knowledge mapper. Return a valid JSON mind map tree.",
        )
        return result.model_dump()
    except Exception:
        return _mock_mindmap()


async def generate_audio_recap(content: str) -> tuple[str, list[dict]]:
    try:
        provider = _provider()
        result = await provider.structured_output(
            messages=[{
                "role": "user",
                "content": (
                    "Write a short podcast script between two speakers (Alex and Jamie) "
                    "that summarises the key points. Include a brief summary and a multi-turn script.\n\n"
                    f"TEXT:\n{_truncate(content)}"
                ),
            }],
            schema=_AudioScript,
            system_prompt="You are a podcast scriptwriter. Return valid JSON only.",
        )
        return result.summary, [s.model_dump() for s in result.script]
    except Exception:
        return (_mock_summary(), _mock_script())


async def generate_quick_revise(content: str) -> list[dict]:
    try:
        provider = _provider()
        result = await provider.structured_output(
            messages=[{
                "role": "user",
                "content": (
                    "Extract exactly 5 key learning points from the text. "
                    "For each: key_point, simplified_explanation (2 sentences), detailed_explanation (4-6 sentences).\n\n"
                    f"TEXT:\n{_truncate(content)}"
                ),
            }],
            schema=_ReviseList,
            system_prompt="You are a study assistant. Return valid JSON only.",
        )
        return [p.model_dump() for p in result.points]
    except Exception:
        return _mock_revise_points()


def _strip_mermaid_fences(text: str) -> str:
    """Remove markdown code fences an LLM may wrap around mermaid output."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1] if "\n" in t else t
        t = t.replace("```mermaid", "").replace("```", "")
    return t.strip()


async def solve_visual(image_bytes: bytes, mime_type: str, prompt: str = "") -> dict:
    """Vision: solve a problem from an uploaded image. Gemini multimodal."""
    try:
        provider = _provider()
        user_text = prompt or "Solve the problem in this image. Show clear step-by-step working."
        result = await provider.structured_output(
            messages=[{
                "role": "user",
                "content": user_text,
                "files": [{"mime_type": mime_type, "data": image_bytes}],
            }],
            schema=_VisualSolution,
            system_prompt="You are a patient tutor. Read the image, identify the problem, solve it step by step. Return valid JSON only.",
        )
        return result.model_dump()
    except Exception:
        return {
            "problem": "Could not read the image.",
            "steps": ["Make sure the image is clear and contains a solvable problem."],
            "result": "N/A",
        }


async def generate_diagram(prompt: str, style: str = "flowchart") -> str:
    """Prompt -> Mermaid diagram source string."""
    try:
        provider = _provider()
        result = await provider.structured_output(
            messages=[{
                "role": "user",
                "content": f"Create a Mermaid {style} diagram for: {prompt}\n\nReturn the mermaid source in the 'mermaid' field.",
            }],
            schema=_Diagram,
            system_prompt="You are a diagram expert. Output ONLY valid Mermaid syntax in the mermaid field. No markdown fences, no prose.",
        )
        return _strip_mermaid_fences(result.mermaid)
    except Exception:
        return f"flowchart TD\n    A[{prompt[:40]}] --> B[Diagram unavailable]"


async def visualize_concept(concept: str) -> dict:
    """Concept -> Mermaid graph + short explanation."""
    try:
        provider = _provider()
        result = await provider.structured_output(
            messages=[{
                "role": "user",
                "content": f"Visualize the concept '{concept}' as a Mermaid graph (graph TD or mindmap). Add a 2-sentence explanation.",
            }],
            schema=_Concept,
            system_prompt="You explain concepts visually. mermaid field = valid Mermaid source (no fences). explanation field = 2 sentences.",
        )
        return {"mermaid": _strip_mermaid_fences(result.mermaid), "explanation": result.explanation}
    except Exception:
        return {
            "mermaid": f"graph TD\n    A[{concept[:30]}] --> B[Key idea]\n    A --> C[Application]",
            "explanation": f"A visual overview of {concept}.",
        }


async def summarize_youtube(transcript: str) -> dict:
    """Transcript -> summary + chapters + key points."""
    try:
        provider = _provider()
        result = await provider.structured_output(
            messages=[{
                "role": "user",
                "content": (
                    "Summarise this video transcript. Provide: a 150-word summary, "
                    "chapter markers (timestamp + title), and 5 key points.\n\n"
                    f"Transcript:\n{_truncate(transcript, tokens=6000)}"
                ),
            }],
            schema=_YTSummary,
            system_prompt="You summarise educational videos. Return valid JSON only.",
        )
        return result.model_dump()
    except Exception:
        return {
            "summary": "Summary unavailable — transcript could not be processed.",
            "chapters": [],
            "key_points": [],
        }


# ── Mock fallbacks (used when no LLM provider available) ─────────────────────

def _mock_quiz(count: int) -> list[dict]:
    return [
        {
            "question_text": f"Sample question {i + 1}",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": "Option A",
            "explanation": "This is a placeholder answer.",
        }
        for i in range(count)
    ]


def _mock_flashcards() -> list[dict]:
    return [
        {"question": "What is the main concept?", "answer": "The main concept is defined by its properties."},
        {"question": "How does it work?", "answer": "It works through a series of well-defined steps."},
    ]


def _mock_mindmap() -> dict:
    return {
        "id": "root",
        "text": "Document Overview",
        "children": [
            {"id": "n1", "text": "Key Concepts", "children": []},
            {"id": "n2", "text": "Main Ideas", "children": []},
        ],
    }


def _mock_summary() -> str:
    return "An AI-generated conversational recap of the document's key concepts."


def _mock_script() -> list[dict]:
    return [
        {"speaker": "Alex", "dialogue": "Welcome! Today we're reviewing this document together."},
        {"speaker": "Jamie", "dialogue": "Great! Let's dive into the key concepts."},
    ]


def _mock_revise_points() -> list[dict]:
    return [
        {
            "key_point": "Core Concept",
            "simplified_explanation": "The fundamental idea explained simply.",
            "detailed_explanation": "A more thorough explanation with examples and context.",
        },
        {
            "key_point": "Key Process",
            "simplified_explanation": "How the process works in plain terms.",
            "detailed_explanation": "Step-by-step breakdown of the process with technical details.",
        },
    ]
