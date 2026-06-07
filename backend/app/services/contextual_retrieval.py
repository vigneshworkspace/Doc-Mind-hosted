"""
Contextual Retrieval: prepend a 50-token situating context to each chunk.
Anthropic 2024 pattern using system-prompt caching.
"""
import logging

from app.services.ai import get_provider_with_fallback

logger = logging.getLogger(__name__)

SYSTEM_TEMPLATE = """\
You are helping to build a retrieval index. The full document is below.
<document>
{document_markdown}
</document>

For each chunk you receive, output a single short paragraph (≤50 tokens)
explaining where the chunk fits in the document — which section it belongs to,
what topic it covers, and what came immediately before it in the document flow.
Output only the context paragraph, nothing else.\
"""

CHUNK_TEMPLATE = """\
Chunk to contextualise:
<chunk>
{chunk_text}
</chunk>
"""


async def add_context_to_chunks(
    document_markdown: str,
    chunk_texts: list[str],
) -> list[str]:
    """
    Returns one context string per chunk (same order as input).
    Sends all chunks to same provider with identical system prompt so
    Gemini implicit prompt caching activates after the first call.
    Returns empty strings on any failure (non-fatal — just degrades quality).
    """
    provider = get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])
    # Keep the situating document small: a 60k-char system prompt is rejected by some
    # providers (413) and is painfully slow on a local model — and this step only needs
    # rough situating context per chunk.
    system_prompt = SYSTEM_TEMPLATE.format(document_markdown=document_markdown[:12_000])

    contexts: list[str] = []
    consecutive_failures = 0
    gave_up = False
    for i, chunk_text in enumerate(chunk_texts):
        if gave_up:
            contexts.append("")
            continue
        try:
            user_message = CHUNK_TEMPLATE.format(chunk_text=chunk_text[:2000])
            context = await provider.chat_completion(
                messages=[{"role": "user", "content": user_message}],
                system_prompt=system_prompt,
            )
            contexts.append(context.strip())
            consecutive_failures = 0
        except Exception as e:
            logger.warning(f"Contextual retrieval failed for chunk {i}: {e}")
            contexts.append("")
            consecutive_failures += 1
            # If the LLM layer is down/rate-limited, don't grind through every chunk
            # (each one retries all providers, incl. slow timeouts). Bail to degraded
            # mode — chunks keep their raw text, ingestion completes promptly.
            if consecutive_failures >= 3:
                gave_up = True
                logger.error(
                    "Contextual retrieval: 3 consecutive failures — skipping remaining "
                    f"{len(chunk_texts) - i - 1} chunks (degraded; raw text retained)"
                )

    empty = sum(1 for c in contexts if not c)
    if empty:
        logger.warning(f"Contextual retrieval produced {empty}/{len(contexts)} empty contexts (degraded chunk quality)")
    return contexts
