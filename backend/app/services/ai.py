import json
from app.core.config import settings


def _get_client():
    """Return an Anthropic client, or None if no API key is configured."""
    if not settings.anthropic_api_key:
        return None
    try:
        from anthropic import Anthropic
        return Anthropic(api_key=settings.anthropic_api_key)
    except ImportError:
        return None


def generate_quiz(content: str, count: int = 5, difficulty: str = "medium") -> list[dict]:
    client = _get_client()
    if not client:
        return _mock_quiz(count)
    resp = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": (
                f"Generate {count} {difficulty} multiple-choice quiz questions from this content. "
                "Return JSON array of objects with fields: question_text, options (array of 4), "
                f"correct_answer, explanation.\n\nContent:\n{content[:4000]}"
            )
        }]
    )
    text = resp.content[0].text
    start = text.find("[")
    end = text.rfind("]") + 1
    try:
        return json.loads(text[start:end]) if start >= 0 else _mock_quiz(count)
    except Exception:
        return _mock_quiz(count)


def generate_flashcards(content: str) -> list[dict]:
    client = _get_client()
    if not client:
        return _mock_flashcards()
    resp = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": (
                "Generate flashcards from this content. Return a JSON array of objects with "
                f"'question' and 'answer' fields.\n\nContent:\n{content[:4000]}"
            )
        }]
    )
    text = resp.content[0].text
    start = text.find("[")
    end = text.rfind("]") + 1
    try:
        return json.loads(text[start:end]) if start >= 0 else _mock_flashcards()
    except Exception:
        return _mock_flashcards()


def chat_complete(messages: list[dict], context: str = "") -> str:
    client = _get_client()
    if not client:
        last = messages[-1]["content"] if messages else ""
        return f"[Demo] You asked: {last[:80]}…"
    system = "You are DocMind, a helpful AI study assistant."
    if context:
        system += f"\n\nDocument context:\n{context[:3000]}"
    resp = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=system,
        messages=messages,
    )
    return resp.content[0].text


def generate_mindmap(content: str) -> dict:
    client = _get_client()
    if not client:
        return _mock_mindmap()
    prompt = (
        "Create a mind map from the text below. "
        "Return ONLY a JSON object with id (string), text (string), and children (array). "
        "Each child has the same structure. Maximum depth: 3 levels.\n\n"
        f"TEXT:\n{content[:4000]}"
    )
    resp = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    text = resp.content[0].text
    start = text.find("{")
    end = text.rfind("}") + 1
    try:
        return json.loads(text[start:end]) if start >= 0 else _mock_mindmap()
    except Exception:
        return _mock_mindmap()


def generate_audio_recap(content: str) -> tuple[str, list[dict]]:
    client = _get_client()
    if not client:
        return _mock_summary(), _mock_script()
    prompt = (
        "Write a short podcast script between two speakers (Alex and Jamie) that summarises "
        "the key points from the text below. "
        "Return a JSON object with: summary (string) and script (array of {speaker, dialogue}).\n\n"
        f"TEXT:\n{content[:4000]}"
    )
    resp = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    text = resp.content[0].text
    start = text.find("{")
    end = text.rfind("}") + 1
    try:
        data = json.loads(text[start:end]) if start >= 0 else {}
        return data.get("summary", _mock_summary()), data.get("script", _mock_script())
    except Exception:
        return _mock_summary(), _mock_script()


def generate_quick_revise(content: str) -> list[dict]:
    client = _get_client()
    if not client:
        return _mock_revise_points()
    prompt = (
        "Extract 5 key learning points from the text below. "
        "Return ONLY a JSON array where each element has: "
        "key_point, simplified_explanation, detailed_explanation.\n\n"
        f"TEXT:\n{content[:4000]}"
    )
    resp = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    text = resp.content[0].text
    start = text.find("[")
    end = text.rfind("]") + 1
    try:
        return json.loads(text[start:end]) if start >= 0 else _mock_revise_points()
    except Exception:
        return _mock_revise_points()


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
            {"id": "n3", "text": "Summary", "children": []},
        ],
    }


def _mock_summary() -> str:
    return "An AI-generated conversational recap of the document's key concepts."


def _mock_script() -> list[dict]:
    return [
        {"speaker": "Alex", "dialogue": "Welcome! Today we're reviewing this document together."},
        {"speaker": "Jamie", "dialogue": "Great! Let's dive into the key concepts."},
        {"speaker": "Alex", "dialogue": "The document covers several important topics worth remembering."},
        {"speaker": "Jamie", "dialogue": "That's a great summary. Thanks for the overview!"},
    ]


def _mock_revise_points() -> list[dict]:
    return [
        {
            "key_point": "Core Concept",
            "simplified_explanation": "The fundamental idea explained simply.",
            "detailed_explanation": "A more thorough explanation of the core concept with examples and context.",
        },
        {
            "key_point": "Key Process",
            "simplified_explanation": "How the process works in plain terms.",
            "detailed_explanation": "Step-by-step breakdown of the process with technical details.",
        },
        {
            "key_point": "Important Relationship",
            "simplified_explanation": "How two things connect.",
            "detailed_explanation": "The relationship between elements explained with supporting evidence.",
        },
    ]
