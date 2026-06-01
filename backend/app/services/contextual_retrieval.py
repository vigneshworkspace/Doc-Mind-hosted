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
    system_prompt = SYSTEM_TEMPLATE.format(document_markdown=document_markdown[:60_000])

    contexts: list[str] = []
    for i, chunk_text in enumerate(chunk_texts):
        try:
            user_message = CHUNK_TEMPLATE.format(chunk_text=chunk_text[:2000])
            context = await provider.chat_completion(
                messages=[{"role": "user", "content": user_message}],
                system_prompt=system_prompt,
            )
            contexts.append(context.strip())
        except Exception as e:
            logger.warning(f"Contextual retrieval failed for chunk {i}: {e}")
            contexts.append("")

    return contexts
