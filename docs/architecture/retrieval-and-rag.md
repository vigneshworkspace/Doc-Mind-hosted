# DocMind — Retrieval & RAG Architecture

**Status:** Locked 2026-05-17
**Scope:** Backend ingestion and query pipelines for AI Chat, PDF Q&A, and document-grounded generators (Quiz, Flashcards, Mind Map, Audio Recap, Quick Revise).
**Non-goals:** Real-time voice routing (see `voice.md`), frontend wiring (see `frontend-integration.md`).

## 1. Design Principles

1. **Adaptive routing, not religion.** Token-budget and intent decide whether to stuff full document context, retrieve chunks, or traverse the section tree. No single path is correct for every query.
2. **Embedding RAG as spine.** PDFs are prose without stable symbols; cross-encoder + dense retrieval beats agentic-only at student-app scale by 20–50× on cost and 10× on latency.
3. **Borrowed patterns from production systems.** Contextual Retrieval (Anthropic 2024), per-source summary cache (NotebookLM), hierarchical tree navigation (PageIndex / Cursor), bounded agentic fallback (Anthropic Effective Context Engineering).
4. **Resilient to fallback chain.** Primary path = Gemini 2.5 Flash (1M ctx); fallbacks Groq Llama 3.3 70B, NVIDIA Kimi K2, Ollama Qwen 2.5 7B (32K ctx). RAG path must work end-to-end on Ollama.
5. **Generators bypass retrieval.** Quiz / flashcards / mindmap / audio recap / quick revise are batch deterministic jobs that consume the cached summary plus full document text. Cleaner, faster, more accurate.
6. **Read-mostly corpus.** Documents are write-once after upload. No edit workflow in v1. Cache invalidation is a single FK cascade on `documents` delete.

## 2. Ingest Pipeline (per document upload)

Triggered when `POST /api/v1/documents` finishes upload. Pushed to ARQ queue. Status visible to UI via `documents.processing_status` enum.

### 2.1 Parse — Docling

- Input: uploaded file (PDF, DOCX, PPTX, HTML).
- Output: structured Markdown + outline tree (sections, headings) + page boundary map.
- Stored on `documents` table:
  - `parsed_md TEXT`
  - `outline JSONB` — `[{title, level, page_start, page_end, children: [...]}]`
  - `page_count INTEGER`
  - `token_count INTEGER` — Markdown token count, computed via `tiktoken` `cl100k_base`.

### 2.2 Summary Cache

One LLM call. Uses the `gemini` provider via the locked fallback chain. Prompt-cached doc enables cheap downstream contextual retrieval (next step).

- Output:
  - `documents.summary TEXT` — 300–600 words, doc-level. Always rendered in the system prompt for chat and generators.
  - `documents.section_summaries JSONB` — `[{section_id, summary}]`, mirrors outline. ~2–3 sentences per section.

System prompt template (Pydantic `BaseModel` enforced via `provider.structured_output`):

```
You are summarizing a document for future grounded retrieval. Produce
(a) a 300–600 word doc-level summary capturing key concepts, methodology,
and conclusions; and (b) per-section 2–3 sentence summaries indexed by
section_id. Be specific. No filler.
```

### 2.3 Chunking

- Strategy: semantic chunking at paragraph or sub-section boundaries.
- Target chunk size: 500 tokens.
- Overlap: 50 tokens.
- Library: Docling chunker if available, else manual paragraph split + token bucketing.
- Each chunk persisted to `chunks` table with `chunk_id`, `document_id`, `section_id`, `page_start`, `page_end`, `raw_text`, `position`.

### 2.4 Contextual Retrieval Prep — Anthropic 2024 pattern

For each chunk, generate a 50-token situating context. Pass whole document as Gemini-cached input (90 % discount, 1 hr TTL). Sequential per document so cache stays hot.

Prompt template:

```
<document>
{full_parsed_md}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{chunk.raw_text}
</chunk>

Provide a short, succinct context (≤50 tokens) explaining where this
chunk fits in the overall document — surrounding section, what came
before, what comes after. Answer only with the context, nothing else.
```

Store on `chunks` table:
- `context TEXT` — generated situating context.
- `contextualized_text TEXT` — `context + "\n" + raw_text`. **This is the text that gets embedded and indexed.**

Cost target: ~$0.06 per 200-page document with Gemini 2.5 Flash prompt caching. Rate-limit-aware retry through fallback chain.

### 2.5 Embedding

- Model: `nomic-embed-text-v1.5` via Ollama (`OLLAMA_BASE_URL` from env, locked default).
- Dim: 768.
- Task prefix: `search_document:` prepended at embed time (Nomic requirement).
- Storage: pgvector column `chunks.embedding vector(768)`.
- Index: HNSW (`vector_cosine_ops`, `m=16`, `ef_construction=64`).

### 2.6 BM25 Index

- Postgres native `tsvector` over `contextualized_text`.
- `chunks.fts tsvector` column generated from `contextualized_text`.
- GIN index on `fts`.
- Decision: skip ParadeDB / `pg_search` in v1 to keep deploy single-image. Upgrade later if BM25 quality matters.

### 2.7 Hierarchical TOC Tree

- Built from `documents.outline`.
- Stored as JSONB on `documents`; no separate table.
- Each node holds `section_id`, `title`, `page_start`, `page_end`, child IDs, and a pointer into `section_summaries`.
- Used at query time for "summarize chapter X" intent + click-to-source UX.

### 2.8 Idempotency & status

- `documents.processing_status` enum: `queued | parsing | embedding | ready | failed`.
- Each step writes status before/after. ARQ retry on transient failure.
- Failures preserve partial progress (e.g., parse done, embed failed → resume from embed).

## 3. Query Pipeline

### 3.1 Entry points

- `POST /api/v1/chat/complete` — body `{messages, document_id?}`. Used by AI Chat (optional doc) and PDF Q&A (required doc).
- Streaming variant returns SSE via `sse-starlette`. Token-by-token chunks.
- Generators (`/quizzes/generate`, `/flashcards/generate`, `/mindmaps/generate`, `/audio-recaps/generate`, `/quick-revise/generate`) **bypass this pipeline.** See §6.

### 3.2 Intent Classification

First step. Cheap LLM call (single short prompt to primary provider) or keyword heuristic — both supported, heuristic first, LLM fallback on ambiguity.

Heuristic regex passes:

| Intent | Trigger |
|---|---|
| `structural` | `^(summarize|summary of|outline|toc) (chapter|section|ch\.?|sec\.?) \d+`, `(page|p\.?) \d+` |
| `compositional` | `\b(compare|contrast|vs\.?|versus|both|relate|differ|connection between)\b` |
| `single` | default fallback |

If heuristic ambiguous (multiple triggers, or none on a long query), call provider with:

```
Classify the user's question as one of: structural, compositional, single.
- structural: asks for a specific section/page/chapter content directly.
- compositional: requires combining info from multiple distinct parts of the doc.
- single: a focused question with one primary intent.

Return JSON: {"intent": "..."}
Question: {query}
```

### 3.3 Branch by intent

#### 3.3.1 `structural`

Skip retrieval. Resolve target node from `outline` tree (regex `chapter 3` → look up by ordinal or title). Render that node's `section_summary` (always) plus the raw chunks belonging to its `page_range` (always, ordered by position). Return directly via LLM with cited page anchors.

#### 3.3.2 `compositional` — Decomposition

1. Decompose query via LLM:
   ```
   Break this question into independent sub-questions, each retrievable
   on its own. Return JSON: {"sub_queries": [str, ...]}
   Question: {query}
   ```
2. For each sub-query, run full retrieval pipeline (§3.4) → top-5 per sub-query.
3. Merge results (dedup by `chunk_id`, sort by max rerank score).
4. Single LLM synthesis pass with all merged chunks + cached doc summary.

#### 3.3.3 `single` — Expansion + Hybrid Retrieval

1. Optional expansion: rewrite query into 3 paraphrases (1 LLM call, structured output).
   ```
   Rewrite this question 3 different ways for retrieval. Preserve intent
   but vary wording, focus, and abstraction. Return JSON: {"rewrites": [str, str, str]}
   ```
2. Each rewrite + original = 4 query strings. Run §3.4 for each.
3. RRF merge across all 4 result sets → top-30 candidates.

### 3.4 Hybrid Retrieval (per query string)

1. **Vector search.** Embed query with `search_query:` prefix via Ollama → pgvector cosine search → top-50.
2. **BM25 search.** Postgres FTS `websearch_to_tsquery` against `fts` column → top-50.
3. **RRF merge.** `score = Σ 1 / (60 + rank_i)`, k=60. Output top-30.
4. Filter: `WHERE user_id = :uid AND (document_id = :did OR :did IS NULL)`.

### 3.5 Reranking

- Model: `jinaai/jina-reranker-v3` (0.6B params, BEIR nDCG@10 ≈ 61.94).
- Runtime: `sentence-transformers` or `transformers` direct, FP16, on GPU if available else CPU.
- VRAM: ~1.6 GB FP16. Co-tenant with Ollama (~4.7 GB qwen2.5:7b) → ~6.3 GB total on 8 GB GPU. Fits.
- Input: query + 30 candidate `contextualized_text`. Output: scores.
- Top-5 returned.

Strip `search_document:` prefix from chunk text before reranking — Nomic prefixes are for embed input only.

### 3.6 Grounding Check

Decision signal: `reranker_top1_score >= GROUNDING_THRESHOLD` (default `0.40`, tunable in `app/core/config.py`).

| Outcome | Action |
|---|---|
| PASS | Continue to generation (§3.8) |
| FAIL | Bounded agentic fallback (§3.7) |

### 3.7 Bounded Agentic Fallback

LLM gets tool access. Budget: max 2 tool calls, then must answer or refuse.

Tools exposed (Python function tools, schema-validated):

```python
def search_chunks(query: str, top_k: int = 10) -> list[Chunk]:
    """Re-run hybrid retrieval with the LLM's reformulated query."""

def read_section(section_id: str) -> str:
    """Fetch raw markdown for a specific section_id from outline."""
```

System prompt addendum:

```
The initial retrieval didn't return high-confidence chunks. You have two
tool calls to find better evidence. After two calls, either answer with
explicit citations, or reply: "I can't find a grounded answer in the
provided source."
```

If still ungrounded after the budget: return refusal template, do not hallucinate.

### 3.8 Generation

Always-included in system prompt:
- `documents.summary` (cached doc-level summary)
- Relevant section_summaries (the sections of the retrieved chunks)
- Retrieved chunks (rendered with `<chunk page="N">{text}</chunk>` for cite anchoring)
- Citation instruction:
  ```
  Cite every factual claim with the page number in brackets, e.g. [p.42].
  If a claim spans pages, use [p.42–43]. If no source supports a claim,
  say so explicitly.
  ```

LLM call via `provider.structured_output` (for generators) or `provider.stream_completion` (for chat).

## 4. Adaptive Stuff-or-Retrieve

Before steps 3.2–3.7 a top-level gate applies for **single-document Q&A only**:

```python
if document_id and doc.token_count < STUFF_THRESHOLD and primary_provider.healthy():
    # Stuff path: paste full doc + summary, single LLM call, exploit prompt cache
    return llm.complete(
        system=f"{doc.summary}\n\n<document>{doc.parsed_md}</document>",
        user=query,
    )
# else: fall through to retrieval pipeline above
```

- `STUFF_THRESHOLD` default: **150 000 tokens** (~300 pages, well under Gemini 2.5 Flash 1M but inside the "context rot" safe zone).
- For docs `< 5 000 tokens`: skip even the tree shortcut; stuff is always fastest.
- Library-wide chat (`document_id IS NULL`): always retrieve.
- Fallback chain active (primary unhealthy): always retrieve (Ollama 32 k ctx demands it).

## 5. Schema additions

```sql
ALTER TABLE documents ADD COLUMN parsed_md TEXT;
ALTER TABLE documents ADD COLUMN outline JSONB;
ALTER TABLE documents ADD COLUMN page_count INTEGER;
ALTER TABLE documents ADD COLUMN token_count INTEGER;
ALTER TABLE documents ADD COLUMN summary TEXT;
ALTER TABLE documents ADD COLUMN section_summaries JSONB;
ALTER TABLE documents ADD COLUMN processing_status TEXT DEFAULT 'queued';

CREATE TABLE chunks (
    id           BIGSERIAL PRIMARY KEY,
    document_id  INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    section_id   TEXT,
    page_start   INTEGER,
    page_end     INTEGER,
    position     INTEGER,
    raw_text     TEXT NOT NULL,
    context      TEXT NOT NULL,
    contextualized_text TEXT NOT NULL,
    embedding    VECTOR(768) NOT NULL,
    fts          TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', contextualized_text)) STORED,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX chunks_user_doc ON chunks(user_id, document_id);
CREATE INDEX chunks_hnsw ON chunks USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64);
CREATE INDEX chunks_fts ON chunks USING gin(fts);
```

Delete cascade ensures `chunks` are pruned when `documents` is deleted. No additional invalidation logic required.

## 6. Generators (Bypass Path)

Quiz, flashcards, mindmap, audio recap, quick revise:

```python
async def generate_quiz(doc_id, count, difficulty):
    doc = await get_doc(doc_id)
    fits = doc.token_count < STUFF_THRESHOLD
    payload = doc.parsed_md if fits else render_top_summaries(doc, target_tokens=STUFF_THRESHOLD - 4000)

    provider = get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])
    return await provider.structured_output(
        messages=[{"role": "user", "content": f"<doc>\n{payload}\n</doc>\nGenerate {count} {difficulty} questions."}],
        schema=QuizQuestionList,
        system_prompt=QUIZ_SYSTEM_PROMPT,
    )
```

When the document is too large to stuff:
- `render_top_summaries` walks the outline tree, concatenating `documents.summary` + top-N `section_summaries` by length, until `target_tokens` is reached. Avoids context rot, preserves doc-level coverage.
- Never falls into the §3 query path. Generators don't ask questions — they read the whole doc.

Audio Recap takes the NotebookLM multi-step approach (chained LLM calls):

1. Outline (script structure) — `provider.structured_output(schema=AudioOutline)`
2. Critique outline — same provider, free-form text response
3. Revise outline — incorporate critique
4. Generate script — `schema=AudioScript`
5. Critique script — free-form
6. Final revised script — `schema=AudioScript`

ARQ chains the 6 calls; status reflected on `audio_recaps.processing_status`.

## 7. Tunable Constants (`app/core/config.py`)

| Constant | Default | Notes |
|---|---|---|
| `STUFF_THRESHOLD` | 150_000 | Tokens. Above this, fall to retrieval. |
| `CHUNK_SIZE` | 500 | Target token size per chunk. |
| `CHUNK_OVERLAP` | 50 | Token overlap between adjacent chunks. |
| `RRF_K` | 60 | Reciprocal rank fusion denominator. |
| `RETRIEVE_TOPK` | 50 | Top-K from each retrieval path before RRF. |
| `RRF_TOPK` | 30 | Top-K after RRF merge, fed to reranker. |
| `RERANK_TOPK` | 5 | Final chunks passed to LLM. |
| `GROUNDING_THRESHOLD` | 0.40 | Min `reranker_top1` score to skip agentic fallback. |
| `AGENTIC_TOOL_BUDGET` | 2 | Max tool calls before forced answer/refuse. |
| `EMBED_MODEL` | `nomic-embed-text-v1.5` | Ollama model. |
| `RERANK_MODEL` | `jinaai/jina-reranker-v3` | HF. |

## 8. Component Inventory

| Concern | Library / Service |
|---|---|
| Document parsing | `docling` |
| Embedding runtime | `ollama` (HTTP, `nomic-embed-text-v1.5`) |
| Vector store | `pgvector` extension on existing Postgres |
| BM25 | Postgres `tsvector` + GIN |
| Reranker | `jinaai/jina-reranker-v3` via `sentence-transformers` |
| LLM router | copied `app/services/ai/` from Lexi (`get_provider_with_fallback`) |
| Job queue | `arq` + Redis |
| Streaming | `sse-starlette` |
| Token counting | `tiktoken` (`cl100k_base`) |

## 9. Lifecycle Notes

- **Read-mostly.** Documents are immutable after upload. No edit flow. Re-upload = new `document_id`. Delete cascades to `chunks` via FK.
- **Cache invalidation.** Per-document; chunks, summary, outline all live on `documents` and `chunks` and are removed together.
- **No cross-user sharing.** All retrieval scoped to `user_id`. Future shared-textbook feature would need explicit ACL.

## 10. Out of Scope (v1)

- Full GraphRAG (entity extraction, community detection)
- RAPTOR-style cluster summarization trees
- Late chunking / ColBERT late interaction
- Custom multi-speaker TTS (Audio Recap ships with Kokoro single voice)
- Mind-map as retrieval substrate (stays a UI artifact stored as JSON tree on `mindmaps`)
- Document editing / re-ingest workflow

## 11. References

- Anthropic Contextual Retrieval: <https://www.anthropic.com/news/contextual-retrieval>
- Anthropic Effective Context Engineering: <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- Anthropic Context Management: <https://claude.com/blog/context-management>
- Claude Projects RAG: <https://support.claude.com/en/articles/11473015-retrieval-augmented-generation-rag-for-projects>
- Chroma Context Rot 2025: <https://research.trychroma.com/context-rot>
- ICLR 2025 Long-Context Meets RAG: <https://proceedings.iclr.cc/paper_files/paper/2025/file/5df5b1f121c915d8bdd00db6aac20827-Paper-Conference.pdf>
- RAGFlow 2025 Year-End: <https://ragflow.io/blog/rag-review-2025-from-rag-to-context>
- NotebookLM Engineering Insight: <https://northdenvertribune.com/ai-analysis/google-engineers-deliberately-avoid-calling-notebooklm-rag/>
- NotebookLM 1M Context Upgrade: <https://blog.google/technology/google-labs/notebooklm-custom-personas-engine-upgrade/>
- NotebookLM Audio pipeline: <https://simonwillison.net/2024/Sep/29/notebooklm-audio-overview/>
- Cursor codebase indexing: <https://cursor.com/blog/secure-codebase-indexing>
- Windsurf SWE-grep: <https://cognition.ai/blog/swe-grep>
- jina-reranker-v3: <https://arxiv.org/html/2509.25085v2>
- Nomic Embed v1.5: <https://huggingface.co/nomic-ai/nomic-embed-text-v1.5>
- PageIndex (VectifyAI): <https://github.com/VectifyAI/PageIndex>
- Hamel Husain — Is RAG dead?: <https://hamel.dev/blog/posts/evals-faq/is-rag-dead.html>
