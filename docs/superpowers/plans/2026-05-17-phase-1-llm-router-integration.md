# Phase 1 — LLM Router Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the toy `app/services/ai.py` (which calls Anthropic directly with hand-written prompts and JSON-extraction regex) with the user's existing multi-provider LLM router copied from the Lexi project. Every generator endpoint now uses `LLMProvider.structured_output(messages, schema, system_prompt)` against a Pydantic schema — no more text-slice JSON parsing.

**Architecture:** The Lexi router (`shared/ai/`) exposes `LLMProvider` ABC with `chat_completion`, `stream_completion`, `structured_output` plus a factory `get_llm_provider()` that selects provider via `LLM_PROVIDER` env or override file. Providers: openai, gemini (with multi-key rotation), ollama, groq, nvidia. We copy it wholesale, drop it under `backend/app/services/ai/`, then build a thin **prompt-and-schema layer** above it so each router can call `await ai_tasks.generate_quiz(content, count, difficulty) -> QuizResult` without reaching into messages/schema details inline.

**Tech Stack:** No new infra. New deps: `google-genai`, `openai`, plus the existing `httpx`. LangSmith tracing is optional (already pip-skip on `ImportError`).

**Depends on:** P0 boot fix. **Blocks:** P4, P5, P8, P9.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `backend/app/services/ai/__init__.py` | create (copy) | Re-export `LLMProvider`, `get_llm_provider`, `storage` |
| `backend/app/services/ai/provider.py` | create (copy) | Copied ABC + factory + fallback resolver |
| `backend/app/services/ai/openai_provider.py` | create (copy) | OpenAI provider |
| `backend/app/services/ai/gemini_provider.py` | create (copy) | Gemini provider w/ key rotation |
| `backend/app/services/ai/ollama_provider.py` | create (copy) | Ollama provider |
| `backend/app/services/ai/groq_provider.py` | create (copy) | Groq provider |
| `backend/app/services/ai/nvidia_nim_provider.py` | create (copy) | NVIDIA NIM provider |
| `backend/app/services/ai/gemini_key_manager.py` | create (copy) | Gemini multi-key rotation |
| `backend/app/services/ai/storage.py` | create (copy) | Provider-override file + gemini key file paths |
| `backend/app/services/ai/tracing.py` | create (copy) | Optional LangSmith wrapper |
| `backend/app/services/ai_tasks.py` | create | High-level task functions: `generate_quiz`, `generate_flashcards`, `generate_mindmap`, `generate_audio_recap`, `generate_quick_revise`, `chat_complete`, `summarize_youtube` |
| `backend/app/services/ai.py` | DELETE | Replaced by `ai_tasks.py` |
| `backend/app/schemas/schemas.py` | modify | Add `QuizGenerationResult`, `FlashcardSetGenerationResult`, `MindMapGenerationResult`, `AudioRecapGenerationResult`, `QuickReviseGenerationResult` (structured-output schemas) |
| `backend/app/routers/quizzes.py` | modify | Use `ai_tasks.generate_quiz` |
| `backend/app/routers/flashcards.py` | modify | Use `ai_tasks.generate_flashcards` |
| `backend/app/routers/mindmaps.py` | modify | Use `ai_tasks.generate_mindmap` |
| `backend/app/routers/audio_recaps.py` | modify | Use `ai_tasks.generate_audio_recap` |
| `backend/app/routers/quick_revise.py` | modify | Use `ai_tasks.generate_quick_revise` |
| `backend/app/routers/chat.py` | modify | Use `ai_tasks.chat_complete` (non-streaming for now; P5 adds streaming) |
| `backend/requirements.txt` | modify | Add `google-genai>=0.3`, `openai>=1.40`, `langsmith>=0.1` (optional) |
| `backend/tests/test_ai_tasks.py` | create | Tests using a mock `LLMProvider` |
| `backend/tests/test_router_integration.py` | create | Quiz endpoint test with monkeypatched provider |
| `backend/.env.example` | modify | Already updated in P0 — no changes here |

---

## Task 1: Copy LLM router files

**Files:**
- Create: 9 files under `backend/app/services/ai/`

**Source root:** `C:\Users\vicky\Desktop\samsung-lap-19-4\samsung-lap-19-4\projects\ai-native-learning\lexi-ai-backend\backend\shared\ai\`

**Source files to copy verbatim:**

| Source | Destination |
|---|---|
| `__init__.py` | `backend/app/services/ai/__init__.py` |
| `provider.py` | `backend/app/services/ai/provider.py` |
| `openai_provider.py` | `backend/app/services/ai/openai_provider.py` |
| `gemini_provider.py` | `backend/app/services/ai/gemini_provider.py` |
| `ollama_provider.py` | `backend/app/services/ai/ollama_provider.py` |
| `groq_provider.py` | `backend/app/services/ai/groq_provider.py` |
| `nvidia_nim_provider.py` | `backend/app/services/ai/nvidia_nim_provider.py` |
| `gemini_key_manager.py` | `backend/app/services/ai/gemini_key_manager.py` |
| `storage.py` | `backend/app/services/ai/storage.py` |
| `tracing.py` | `backend/app/services/ai/tracing.py` |

- [ ] **Step 1: Copy all 10 files**

Each source file already documented in [[../../../../samsung-lap-19-4/.../shared/ai/]] — files read during planning. Copy bytes 1:1, do NOT edit imports yet (they use relative `from .provider import …` which keeps working since we keep them in the same package).

- [ ] **Step 2: Verify imports resolve**

```bash
cd backend && python -c "from app.services.ai import get_llm_provider, LLMProvider; print(LLMProvider)"
```
Expected: `<class 'app.services.ai.provider.LLMProvider'>`. May warn about missing `google.genai` / `openai` — install in Task 2.

- [ ] **Step 3: Delete the old stub**

```bash
git rm backend/app/services/ai.py
```

Note: the old file is referenced by routers (`from app.services import ai`). Those break until Task 4. We will run tests at end of Task 4, not now.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/ai/
git commit -m "feat(ai): copy multi-provider LLM router from Lexi project"
```

### Edge cases (Task 1)

- **Lexi storage path baked to `__file__/data`**: the copied `storage.py` resolves `AI_DATA_DIR` env first, falls back to package-local `data/`. In docker we set `AI_DATA_DIR=/data/ai` (already in P0 env) so per-user gemini key state persists in the `appdata` volume, not inside the image.
- **LangSmith import is optional**: `tracing.py` does `try import langsmith` and silently no-ops if missing. Do not add `langsmith` to runtime requirements unless tracing is desired.
- **Gemini model name drift**: Lexi defaults to `gemini-3-flash-preview` (a placeholder). Override via `LLM_MODEL=gemini-2.5-flash` in `.env`. Document.

---

## Task 2: Add LLM deps to requirements

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Append**

```
google-genai>=0.3.0
openai>=1.40.0
# langsmith — only if you want tracing. Uncomment to enable.
# langsmith>=0.1.0
```

- [ ] **Step 2: Local install**

```bash
cd backend && pip install -r requirements.txt
```
Expected: installs cleanly. If `google-genai` resolution fails, pin `google-genai==1.0.0` and rerun.

- [ ] **Step 3: Smoke test factory with no creds**

```bash
cd backend && python -c "
import os
os.environ['LLM_PROVIDER']='ollama'
os.environ['OLLAMA_BASE_URL']='http://localhost:11434'
from app.services.ai import get_llm_provider
p = get_llm_provider()
print(type(p).__name__)
"
```
Expected: `OllamaProvider`. (Ollama provider doesn't validate connectivity at construction.)

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt
git commit -m "feat(deps): add google-genai + openai for LLM router providers"
```

---

## Task 3: Add structured-output schemas

**Files:**
- Modify: `backend/app/schemas/schemas.py`

- [ ] **Step 1: Write failing test**

`backend/tests/test_ai_schemas.py`:

```python
import pytest
from pydantic import ValidationError


def test_quiz_generation_result_validates():
    from app.schemas.schemas import QuizGenerationResult, QuizQuestion
    r = QuizGenerationResult(questions=[
        QuizQuestion(question_text="Q", options=["A","B","C","D"], correct_answer="A", explanation="because")
    ])
    assert len(r.questions) == 1


def test_quiz_generation_result_rejects_under_4_options():
    from app.schemas.schemas import QuizGenerationResult, QuizQuestion
    with pytest.raises(ValidationError):
        QuizGenerationResult(questions=[
            QuizQuestion(question_text="Q", options=["A","B"], correct_answer="A", explanation="x")
        ])


def test_flashcard_generation_result_validates():
    from app.schemas.schemas import FlashcardSetGenerationResult, FlashCard
    r = FlashcardSetGenerationResult(cards=[FlashCard(question="q", answer="a")])
    assert r.cards[0].answer == "a"


def test_mindmap_generation_result_root_required():
    from app.schemas.schemas import MindMapGenerationResult, MindMapNode
    r = MindMapGenerationResult(root=MindMapNode(id="r", text="root", children=[]))
    assert r.root.id == "r"


def test_audio_recap_generation_result_speakers_enforced():
    from app.schemas.schemas import AudioRecapGenerationResult, ScriptLine
    r = AudioRecapGenerationResult(
        summary="x",
        script=[ScriptLine(speaker="Alex", dialogue="hi"), ScriptLine(speaker="Jamie", dialogue="hi back")]
    )
    assert len(r.script) == 2
```

- [ ] **Step 2: Run, expect ImportError on the new names**

```bash
cd backend && pytest tests/test_ai_schemas.py -v
```
Expected: `ImportError: cannot import name 'QuizGenerationResult'` (or similar).

- [ ] **Step 3: Add schemas to `backend/app/schemas/schemas.py`**

Append after existing `QuizOut`:

```python
class QuizQuestion(BaseModel):
    question_text: str
    options: List[str]
    correct_answer: str
    explanation: str

    def model_post_init(self, __context) -> None:
        if len(self.options) != 4:
            raise ValueError("options must have exactly 4 entries")


class QuizGenerationResult(BaseModel):
    questions: List[QuizQuestion]


class FlashcardSetGenerationResult(BaseModel):
    cards: List[FlashCard]


class MindMapGenerationResult(BaseModel):
    root: MindMapNode


class AudioRecapGenerationResult(BaseModel):
    summary: str
    script: List[ScriptLine]


class QuickReviseGenerationResult(BaseModel):
    points: List[RevisePoint]
```

NOTE: `QuizQuestion` already exists at line 44 of the current file. Replace it in-place rather than duplicate. The `model_post_init` validator enforces exactly 4 options.

- [ ] **Step 4: Run test, expect pass**

```bash
cd backend && pytest tests/test_ai_schemas.py -v
```
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/schemas.py backend/tests/test_ai_schemas.py
git commit -m "feat(schemas): structured-output schemas for LLM generators"
```

### Edge cases (Task 3)

- **`QuizQuestion` exists twice in old file**: there is currently one definition. If a previous merge left a duplicate, delete the older copy. Search: `grep -n "class QuizQuestion" backend/app/schemas/schemas.py` should return exactly one line.
- **`model_post_init` runs after validation**: it executes for every instance, including those built from LLM output. The LLM contract says "return 4 options"; if it returns 3, we raise and the router's try/except retries (Task 4).

---

## Task 4: High-level `ai_tasks` module

**Files:**
- Create: `backend/app/services/ai_tasks.py`
- Create: `backend/tests/test_ai_tasks.py`

- [ ] **Step 1: Write failing test**

`backend/tests/test_ai_tasks.py`:

```python
import pytest
from typing import AsyncIterable, Any, Dict, List, Optional
from pydantic import BaseModel
from app.services.ai.provider import LLMProvider


class StubProvider(LLMProvider):
    def __init__(self, structured_result=None, chat_text="ok", stream_chunks=("hello ", "world")):
        self.calls = []
        self._structured_result = structured_result
        self._chat_text = chat_text
        self._stream_chunks = stream_chunks

    async def chat_completion(self, messages, system_prompt=None):
        self.calls.append(("chat", messages, system_prompt))
        return self._chat_text

    async def stream_completion(self, messages, system_prompt=None):
        self.calls.append(("stream", messages, system_prompt))
        for c in self._stream_chunks:
            yield c

    async def structured_output(self, messages, schema, system_prompt=None):
        self.calls.append(("structured", messages, system_prompt, schema))
        if isinstance(self._structured_result, dict):
            return schema.model_validate(self._structured_result)
        return self._structured_result


@pytest.mark.asyncio
async def test_generate_quiz_returns_questions(monkeypatch):
    from app.services import ai_tasks
    from app.schemas.schemas import QuizGenerationResult, QuizQuestion
    stub = StubProvider(structured_result=QuizGenerationResult(questions=[
        QuizQuestion(question_text="Q1", options=["a","b","c","d"], correct_answer="a", explanation="e"),
        QuizQuestion(question_text="Q2", options=["a","b","c","d"], correct_answer="b", explanation="e"),
    ]))
    monkeypatch.setattr(ai_tasks, "_get_provider", lambda: stub)
    out = await ai_tasks.generate_quiz("quantum content", count=2, difficulty="hard")
    assert len(out.questions) == 2
    assert stub.calls[0][0] == "structured"
    # Prompt contains content + difficulty
    user_msg = stub.calls[0][1][-1]["content"]
    assert "quantum content" in user_msg
    assert "hard" in user_msg


@pytest.mark.asyncio
async def test_generate_quiz_retries_once_on_validation_error(monkeypatch):
    from app.services import ai_tasks
    from pydantic import ValidationError

    class FlakyProvider(StubProvider):
        def __init__(self):
            super().__init__()
            self.n = 0

        async def structured_output(self, messages, schema, system_prompt=None):
            self.n += 1
            if self.n == 1:
                raise ValidationError.from_exception_data("err", line_errors=[])
            from app.schemas.schemas import QuizGenerationResult, QuizQuestion
            return QuizGenerationResult(questions=[QuizQuestion(
                question_text="ok", options=["a","b","c","d"], correct_answer="a", explanation="e"
            )])

    flaky = FlakyProvider()
    monkeypatch.setattr(ai_tasks, "_get_provider", lambda: flaky)
    out = await ai_tasks.generate_quiz("text", count=1)
    assert flaky.n == 2
    assert len(out.questions) == 1


@pytest.mark.asyncio
async def test_generate_quiz_gives_up_after_two_failures(monkeypatch):
    from app.services import ai_tasks
    from pydantic import ValidationError

    class AlwaysFail(StubProvider):
        async def structured_output(self, messages, schema, system_prompt=None):
            raise ValidationError.from_exception_data("err", line_errors=[])

    monkeypatch.setattr(ai_tasks, "_get_provider", lambda: AlwaysFail())
    with pytest.raises(ai_tasks.LLMTaskError):
        await ai_tasks.generate_quiz("text", count=1)


@pytest.mark.asyncio
async def test_chat_complete_passes_doc_context(monkeypatch):
    from app.services import ai_tasks
    stub = StubProvider(chat_text="reply")
    monkeypatch.setattr(ai_tasks, "_get_provider", lambda: stub)
    out = await ai_tasks.chat_complete(
        history=[{"role": "user", "content": "summarise"}],
        document_text="QUANTUM PHYSICS NOTES"
    )
    assert out == "reply"
    sys_prompt = stub.calls[0][2]
    assert "QUANTUM PHYSICS NOTES" in sys_prompt


@pytest.mark.asyncio
async def test_chat_complete_truncates_long_doc(monkeypatch):
    from app.services import ai_tasks
    stub = StubProvider(chat_text="ok")
    monkeypatch.setattr(ai_tasks, "_get_provider", lambda: stub)
    big = "x" * 50000
    await ai_tasks.chat_complete(history=[{"role":"user","content":"hi"}], document_text=big)
    sys_prompt = stub.calls[0][2]
    # Default cap is 24_000 chars; allow envelope text before/after
    assert len(sys_prompt) < 25_000
```

Add `pytest-asyncio>=0.23.0` already present; ensure `asyncio_mode = auto` in `backend/pytest.ini` (create if missing):

`backend/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 2: Run, expect ImportError**

```bash
cd backend && pytest tests/test_ai_tasks.py -v
```
Expected: `ModuleNotFoundError: No module named 'app.services.ai_tasks'`.

- [ ] **Step 3: Implement `app/services/ai_tasks.py`**

```python
"""High-level LLM task functions.

Wraps `app.services.ai.get_llm_provider()` with prompt construction,
schema-bound `structured_output`, retry-once-on-validation, and
context-length safety.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from pydantic import ValidationError

from app.services.ai import get_llm_provider
from app.services.ai.provider import LLMProvider
from app.schemas.schemas import (
    QuizGenerationResult,
    FlashcardSetGenerationResult,
    MindMapGenerationResult,
    AudioRecapGenerationResult,
    QuickReviseGenerationResult,
)

logger = logging.getLogger(__name__)


class LLMTaskError(Exception):
    """Raised when a generation task fails after retries."""


MAX_DOC_CHARS = 24_000
RETRIES = 1


def _get_provider() -> LLMProvider:
    """Indirection so tests can monkeypatch."""
    return get_llm_provider()


def _truncate(text: str, cap: int = MAX_DOC_CHARS) -> str:
    if len(text) <= cap:
        return text
    return text[:cap] + "\n\n…[truncated]"


async def _structured_with_retry(messages, schema, system_prompt=None):
    last_err: Optional[Exception] = None
    for attempt in range(RETRIES + 1):
        try:
            provider = _get_provider()
            return await provider.structured_output(messages, schema, system_prompt)
        except ValidationError as e:
            last_err = e
            logger.warning("structured_output validation failed (attempt %d): %s", attempt + 1, e)
        except Exception as e:
            last_err = e
            logger.error("structured_output errored (attempt %d): %s", attempt + 1, e)
    raise LLMTaskError(f"LLM task failed after {RETRIES + 1} attempts: {last_err}") from last_err


# ── Quiz ────────────────────────────────────────────────────────────────
QUIZ_SYSTEM = (
    "You are DocMind, an exam-question writer. Given study material, "
    "produce multiple-choice questions with exactly 4 plausible options each, "
    "marking one correct answer and supplying a one-sentence explanation. "
    "Difficulty levels: easy = recall, medium = application, hard = synthesis."
)


async def generate_quiz(content: str, count: int = 5, difficulty: str = "medium") -> QuizGenerationResult:
    content = _truncate(content)
    user = (
        f"Generate {count} {difficulty} multiple-choice questions from the material below. "
        f"Each question must have exactly 4 options.\n\n---\n{content}\n---"
    )
    return await _structured_with_retry(
        messages=[{"role": "user", "content": user}],
        schema=QuizGenerationResult,
        system_prompt=QUIZ_SYSTEM,
    )


# ── Flashcards ─────────────────────────────────────────────────────────
FLASHCARD_SYSTEM = (
    "You are DocMind, a spaced-repetition card author. "
    "Generate concise Q&A flashcards that test one atomic fact each."
)


async def generate_flashcards(content: str, count: int = 12) -> FlashcardSetGenerationResult:
    content = _truncate(content)
    user = (
        f"Generate {count} flashcards from the material below. "
        f"Each card has one short question and one short answer.\n\n---\n{content}\n---"
    )
    return await _structured_with_retry(
        messages=[{"role": "user", "content": user}],
        schema=FlashcardSetGenerationResult,
        system_prompt=FLASHCARD_SYSTEM,
    )


# ── Mind Map ───────────────────────────────────────────────────────────
MINDMAP_SYSTEM = (
    "You are DocMind, a study-skills map maker. "
    "Build a balanced hierarchical mind map with a clear root and 3–6 first-level branches. "
    "Maximum depth 3. Each node has a short text label."
)


async def generate_mindmap(content: str) -> MindMapGenerationResult:
    content = _truncate(content)
    user = (
        "Build a hierarchical mind map of the material below. Root summarises the document; "
        "first level lists primary themes; second level lists details; depth 3 max.\n\n"
        f"---\n{content}\n---"
    )
    return await _structured_with_retry(
        messages=[{"role": "user", "content": user}],
        schema=MindMapGenerationResult,
        system_prompt=MINDMAP_SYSTEM,
    )


# ── Audio Recap ────────────────────────────────────────────────────────
AUDIO_RECAP_SYSTEM = (
    "You are DocMind, a podcast-script writer. Two hosts named Alex and Jamie discuss the material "
    "in a friendly, conversational tone. Alex asks questions; Jamie explains. "
    "Produce a `summary` (3 sentences) and a `script` of 8–14 alternating turns starting with Alex."
)


async def generate_audio_recap(content: str) -> AudioRecapGenerationResult:
    content = _truncate(content)
    user = (
        "Write a short two-host podcast script (Alex + Jamie) covering the material below. "
        "Then write a 3-sentence summary suitable for show notes.\n\n"
        f"---\n{content}\n---"
    )
    return await _structured_with_retry(
        messages=[{"role": "user", "content": user}],
        schema=AudioRecapGenerationResult,
        system_prompt=AUDIO_RECAP_SYSTEM,
    )


# ── Quick Revise ───────────────────────────────────────────────────────
QUICK_REVISE_SYSTEM = (
    "You are DocMind, the TL;DR author. For the given material, produce 5–7 key points; "
    "each point has a short `key_point` headline, a 1–2-sentence `simplified_explanation`, "
    "and a 3–5-sentence `detailed_explanation` with examples."
)


async def generate_quick_revise(content: str) -> QuickReviseGenerationResult:
    content = _truncate(content)
    user = (
        "Extract the most important learning points from the material below.\n\n"
        f"---\n{content}\n---"
    )
    return await _structured_with_retry(
        messages=[{"role": "user", "content": user}],
        schema=QuickReviseGenerationResult,
        system_prompt=QUICK_REVISE_SYSTEM,
    )


# ── Chat ───────────────────────────────────────────────────────────────
CHAT_SYSTEM_BASE = "You are DocMind, a calm, precise study assistant. Be concise and pedagogically sound."


async def chat_complete(
    history: List[Dict[str, Any]],
    document_text: str = "",
) -> str:
    """Non-streaming chat. P5 adds streaming variant."""
    sys = CHAT_SYSTEM_BASE
    if document_text:
        sys = f"{CHAT_SYSTEM_BASE}\n\nDocument context (verbatim):\n{_truncate(document_text)}"
    provider = _get_provider()
    return await provider.chat_completion(history, system_prompt=sys)


# ── Streaming chat (used in P5) ───────────────────────────────────────
async def chat_stream(history: List[Dict[str, Any]], document_text: str = ""):
    sys = CHAT_SYSTEM_BASE
    if document_text:
        sys = f"{CHAT_SYSTEM_BASE}\n\nDocument context (verbatim):\n{_truncate(document_text)}"
    provider = _get_provider()
    async for chunk in provider.stream_completion(history, system_prompt=sys):
        yield chunk
```

- [ ] **Step 4: Run, expect pass**

```bash
cd backend && pytest tests/test_ai_tasks.py -v
```
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ai_tasks.py backend/tests/test_ai_tasks.py backend/pytest.ini
git commit -m "feat(ai-tasks): high-level prompt+schema wrappers with retry"
```

### Edge cases (Task 4)

- **Provider raises auth error mid-stream**: streaming chat surfaces error mid-tokens. `chat_stream` propagates exceptions; the SSE layer (P5) catches and emits an error event. v1 does not retry streaming on auth error.
- **Validation retry on JSON-corrupt output**: `_structured_with_retry` re-fetches a fresh `_get_provider()` per attempt so Gemini key rotation can pick a different key.
- **Content longer than `MAX_DOC_CHARS`**: silently truncated with a "…[truncated]" tag. Document for users — `count` of quiz questions should not exceed material density of remaining 24k chars.
- **`stream_completion` of Gemini returns mid-stream error sentinel** (`[ERROR: stream interrupted, please retry]`): downstream SSE handler passes it through; UI shows toast.

---

## Task 5: Switch routers from `services.ai` to `services.ai_tasks`

**Files:** modify all listed routers below. Each follows the same recipe; expand to show one example then summarize the rest.

### 5a — `routers/quizzes.py`

- [ ] **Step 1: Write router integration test**

`backend/tests/test_router_integration.py`:

```python
import pytest
from app.schemas.schemas import QuizGenerationResult, QuizQuestion


@pytest.fixture
def auth_headers(client):
    client.post("/api/v1/auth/signup", json={"name": "U", "email": "x@x.com", "password": "pw"})
    r = client.post("/api/v1/auth/login", json={"email": "x@x.com", "password": "pw"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_generate_quiz_uses_ai_tasks(client, auth_headers, monkeypatch):
    from app.services import ai_tasks

    async def fake_gen(content, count=5, difficulty="medium"):
        return QuizGenerationResult(questions=[
            QuizQuestion(question_text=f"Q{i+1}", options=["a","b","c","d"],
                         correct_answer="a", explanation="e") for i in range(count)
        ])
    monkeypatch.setattr(ai_tasks, "generate_quiz", fake_gen)

    r = client.post("/api/v1/quizzes/generate", json={"count": 3, "difficulty": "easy"}, headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["questions"]) == 3
    assert body["questions"][0]["question_text"] == "Q1"


def test_generate_quiz_500_on_task_error(client, auth_headers, monkeypatch):
    from app.services import ai_tasks

    async def boom(*a, **kw):
        raise ai_tasks.LLMTaskError("nope")
    monkeypatch.setattr(ai_tasks, "generate_quiz", boom)

    r = client.post("/api/v1/quizzes/generate", json={"count": 3}, headers=auth_headers)
    assert r.status_code == 500
    assert "nope" in r.text or "LLMTaskError" in r.text
```

- [ ] **Step 2: Run test, expect fail (current router uses old module)**

```bash
cd backend && pytest tests/test_router_integration.py::test_generate_quiz_uses_ai_tasks -v
```
Expected: error referencing missing `services.ai` (we deleted it in Task 1).

- [ ] **Step 3: Rewrite `routers/quizzes.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from app.core.deps import get_db, get_current_user
from app.models.orm import User, Quiz, Document
from app.schemas.schemas import QuizCreate, QuizGenerateRequest, QuizOut
from app.services import ai_tasks

router = APIRouter()


@router.get("", response_model=List[QuizOut])
def list_quizzes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Quiz).filter(Quiz.user_id == current_user.id).all()


@router.get("/{quiz_id}", response_model=QuizOut)
def get_quiz(quiz_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@router.post("/generate", response_model=QuizOut)
async def generate_quiz(
    req: QuizGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = ""
    title = "Practice Quiz"
    if req.document_id:
        doc = db.query(Document).filter(
            Document.id == req.document_id, Document.user_id == current_user.id
        ).first()
        if doc:
            content = doc.content or ""
            title = f"Quiz: {doc.name}"

    try:
        result = await ai_tasks.generate_quiz(content, count=req.count, difficulty=req.difficulty)
    except ai_tasks.LLMTaskError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return QuizOut(
        id=0,
        title=title,
        questions=[q.model_dump() for q in result.questions],
        completed=False,
        score=None,
        date=date.today(),
    )


@router.post("", response_model=QuizOut, status_code=201)
def save_quiz(
    req: QuizCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = Quiz(
        user_id=current_user.id,
        title=req.title,
        questions=[q.model_dump() for q in req.questions],
        completed=req.completed,
        score=req.score,
    )
    db.add(quiz); db.commit(); db.refresh(quiz)
    return quiz


@router.delete("/{quiz_id}")
def delete_quiz(quiz_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id, Quiz.user_id == current_user.id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    db.delete(quiz); db.commit()
    return {"ok": True}
```

Key changes vs old: `async def generate_quiz`, awaits `ai_tasks.generate_quiz`, returns `result.questions` (Pydantic models) rather than raw `questions` list.

- [ ] **Step 4: Run tests, expect pass**

```bash
cd backend && pytest tests/test_router_integration.py -v
```
Expected: 2 passed.

- [ ] **Step 5: Run full suite — existing quiz tests still pass**

```bash
cd backend && pytest -q
```
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/quizzes.py backend/tests/test_router_integration.py
git commit -m "feat(quizzes): generate uses ai_tasks structured output"
```

### 5b–5f: Same shape for `flashcards`, `mindmaps`, `audio_recaps`, `quick_revise`, `chat`

For each:

- [ ] **Replace `from app.services import ai` → `from app.services import ai_tasks`.**
- [ ] **Replace synchronous `ai.generate_X(...)` call → `async` route + `await ai_tasks.generate_X(...)` returning a Pydantic result; `.model_dump()` on output where needed.**
- [ ] **Handle `ai_tasks.LLMTaskError` → `HTTPException(500, detail=str(e))`.**
- [ ] **Add a router-level test analogous to `test_generate_quiz_uses_ai_tasks` monkey-patching the task function.**
- [ ] **Commit one router per task.**

Complete code for the remaining routers:

#### `routers/flashcards.py` — `generate_flashcard_set` body

Replace the old call:

```python
cards = ai.generate_flashcards(doc.content or "")
```

with:

```python
try:
    result = await ai_tasks.generate_flashcards(doc.content or "")
except ai_tasks.LLMTaskError as e:
    raise HTTPException(status_code=500, detail=str(e))
cards = [c.model_dump() for c in result.cards]
```

Make handler `async def`. Imports: `from app.services import ai_tasks`.

#### `routers/mindmaps.py` — `generate_mindmap` body

Replace:

```python
root = ai.generate_mindmap(doc.content or "")
```

with:

```python
try:
    result = await ai_tasks.generate_mindmap(doc.content or "")
except ai_tasks.LLMTaskError as e:
    raise HTTPException(status_code=500, detail=str(e))
root = result.root.model_dump()
```

#### `routers/audio_recaps.py` — `generate_audio_recap` body

```python
try:
    result = await ai_tasks.generate_audio_recap(doc.content or "")
except ai_tasks.LLMTaskError as e:
    raise HTTPException(status_code=500, detail=str(e))
summary = result.summary
script = [s.model_dump() for s in result.script]
```

#### `routers/quick_revise.py` — `generate_quick_revise` body

```python
try:
    result = await ai_tasks.generate_quick_revise(doc.content or "")
except ai_tasks.LLMTaskError as e:
    raise HTTPException(status_code=500, detail=str(e))
points = [p.model_dump() for p in result.points]
```

#### `routers/chat.py` — `complete`

```python
@router.post("/complete", response_model=ChatCompleteResponse)
async def complete(
    req: ChatCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc_text = ""
    if req.document_id:
        doc = db.query(Document).filter(
            Document.id == req.document_id, Document.user_id == current_user.id
        ).first()
        if doc and doc.content:
            doc_text = doc.content

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    try:
        reply = await ai_tasks.chat_complete(history=messages, document_text=doc_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    chat_record = ChatHistory(
        user_id=current_user.id,
        document_id=req.document_id,
        messages=messages + [{"role": "assistant", "content": reply}],
    )
    db.add(chat_record); db.commit()

    import os
    model_used = os.getenv("LLM_MODEL", "unknown")
    return ChatCompleteResponse(content=reply, model=model_used)
```

- [ ] **After all 6 routers updated, run full suite**

```bash
cd backend && pytest -q
```
Expected: green. Existing `test_quizzes.py::test_quiz_generate` still passes because it patches none — it goes through real `ai_tasks` which calls `get_llm_provider()`. **That will fail without env vars.** Fix by stubbing:

In `backend/tests/conftest.py`, append:

```python
@pytest.fixture(autouse=True)
def stub_llm(monkeypatch):
    """Default to a Stub provider so tests don't need real API keys."""
    from app.services import ai_tasks
    from app.schemas.schemas import (
        QuizGenerationResult, QuizQuestion,
        FlashcardSetGenerationResult, FlashCard,
        MindMapGenerationResult, MindMapNode,
        AudioRecapGenerationResult, ScriptLine,
        QuickReviseGenerationResult, RevisePoint,
    )

    async def quiz(content, count=5, difficulty="medium"):
        return QuizGenerationResult(questions=[QuizQuestion(
            question_text=f"Q{i+1}", options=["a","b","c","d"], correct_answer="a", explanation="e"
        ) for i in range(count)])

    async def flash(content, count=12):
        return FlashcardSetGenerationResult(cards=[FlashCard(question="q", answer="a")])

    async def mindmap(content):
        return MindMapGenerationResult(root=MindMapNode(id="r", text="root", children=[]))

    async def audio(content):
        return AudioRecapGenerationResult(
            summary="ok",
            script=[ScriptLine(speaker="Alex", dialogue="hi"), ScriptLine(speaker="Jamie", dialogue="ok")]
        )

    async def revise(content):
        return QuickReviseGenerationResult(points=[
            RevisePoint(key_point="k", simplified_explanation="s", detailed_explanation="d")
        ])

    async def chat(history, document_text=""):
        return "stubbed reply"

    monkeypatch.setattr(ai_tasks, "generate_quiz", quiz)
    monkeypatch.setattr(ai_tasks, "generate_flashcards", flash)
    monkeypatch.setattr(ai_tasks, "generate_mindmap", mindmap)
    monkeypatch.setattr(ai_tasks, "generate_audio_recap", audio)
    monkeypatch.setattr(ai_tasks, "generate_quick_revise", revise)
    monkeypatch.setattr(ai_tasks, "chat_complete", chat)
```

This keeps the existing `test_quizzes.py::test_quiz_generate` green.

- [ ] **Commit conftest stub**

```bash
git add backend/tests/conftest.py
git commit -m "test(conftest): stub ai_tasks so tests run without LLM creds"
```

---

## Task 6: End-to-end smoke against real LLM (manual, optional)

**Files:** none.

- [ ] **Step 1: Set creds in `backend/.env`**

```
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
GEMINI_API_KEYS=AIza...           # real keys
```

- [ ] **Step 2: Bring up stack**

```bash
docker compose up -d
```

- [ ] **Step 3: Signup + ask LLM to generate a quiz from inline doc**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"t","email":"t@t.com","password":"pw"}' | jq -r .access_token)

curl -s -X POST http://localhost:8000/api/v1/quizzes/generate \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"count":3,"difficulty":"easy"}' | jq .
```
Expected: JSON with 3 questions, each with 4 options. (No document context yet — Phase 2 wires that.)

- [ ] **Step 4: Tear down**

```bash
docker compose down
```

---

## Phase 1 verification checklist

- [ ] `pytest -q` from `backend/` returns green (existing + new tests).
- [ ] `app/services/ai/` directory contains 10 copied files.
- [ ] `app/services/ai.py` deleted (single-file old stub).
- [ ] `app/services/ai_tasks.py` exists with 7 task functions.
- [ ] Six routers (`quizzes`, `flashcards`, `mindmaps`, `audio_recaps`, `quick_revise`, `chat`) all `await ai_tasks.*` and translate `LLMTaskError` to `HTTPException(500)`.
- [ ] `conftest.py` autouse stub keeps tests cred-free.
- [ ] (Optional manual) `/api/v1/quizzes/generate` returns valid structured output against real Gemini.

## Edge cases summary

1. **JSON drift across providers**: `structured_output` is implemented differently in each provider (Gemini `response_mime_type=application/json`, OpenAI native `parse`, Groq/NVIDIA `response_format={"type":"json_object"}`, Ollama `format:"json"`). `_structured_with_retry` handles failures uniformly.
2. **Provider failure should fall back**: NOT in v1. `get_llm_provider()` uses single provider; failures bubble up as 500. Later, switch to `get_provider_with_fallback("gemini", ["groq","ollama"])` in `ai_tasks._get_provider`.
3. **Long documents** truncated to 24k chars before reaching the provider — most providers cap at 30–128k. Token budget for Gemini 2.5 Flash supports far more, but we keep it small to prevent runaway costs and rate limits. Multi-chunk summarisation (map-reduce) is **deferred** to a later refactor.
4. **Empty `Document.content`** (e.g. unparsed PDF before P2): `generate_quiz` etc. receive `""` and the LLM produces generic content. Acceptable v1; P2 fixes the upstream so content is real.
5. **`QuizQuestion` 4-option invariant**: enforced in Pydantic `model_post_init`. If provider returns 3 options, validation fails → retry — usually succeeds on attempt 2.
6. **Gemini key exhaustion**: provider rotates via `gemini_key_manager`. When ALL keys are exhausted, `get_available_key()` returns None and `GeminiProvider.__init__` raises. We surface 500 to the client. UI shows "Provider unavailable" toast.
7. **Tests are async**: `pytest.ini` sets `asyncio_mode=auto` so plain `async def test_…` works without decorator. `pytest-asyncio>=0.23` already present in requirements.
8. **Chat history non-streaming for now**: P5 builds streaming SSE wrapper using `ai_tasks.chat_stream`. Frontend still talks to `/api/v1/chat/complete` (P1) and switches to `/api/v1/chat/stream` in P5.
