import os
import json
import logging
from typing import AsyncIterable, Any, Dict, List, Optional
from abc import ABC, abstractmethod
from pydantic import BaseModel
from .storage import get_provider_override_file
from .tracing import wrap_provider_with_tracing

logger = logging.getLogger(__name__)

class LLMProvider(ABC):
    @abstractmethod
    async def chat_completion(self, messages: List[Dict[str, Any]], system_prompt: Optional[str] = None) -> str:
        """Simple chat completion"""
        pass

    @abstractmethod
    async def stream_completion(self, messages: List[Dict[str, Any]], system_prompt: Optional[str] = None) -> AsyncIterable[str]:
        """Streaming chat completion"""
        pass

    @abstractmethod
    async def structured_output(self, messages: List[Dict[str, Any]], schema: type[BaseModel], system_prompt: Optional[str] = None) -> BaseModel:
        """Structured output (JSON matching schema)"""
        pass

def get_llm_provider() -> LLMProvider:
    # Env is authoritative. The override file is consulted ONLY when LLM_PROVIDER is
    # unset, so a stale persisted file can't silently override the configured/env
    # provider (and user-settings changes) across restarts.
    env_provider = os.getenv("LLM_PROVIDER", "").strip().lower()
    if env_provider:
        provider_name = env_provider
        provider_source = "env"
    else:
        provider_file = get_provider_override_file()
        if os.path.exists(provider_file):
            with open(provider_file, "r") as f:
                provider_name = f.read().strip().lower()
            provider_source = "file(fallback)"
        else:
            provider_name = "gemini"
            provider_source = "default"

    logger.debug(f"LLM Provider loaded from {provider_source}: '{provider_name}'")
    
    # Handle empty string case
    if not provider_name:
        provider_name = "gemini"
        logger.warning("Empty LLM_PROVIDER, defaulting to 'gemini'")

    supported = {"openai", "gemini", "ollama", "groq", "nvidia", "nvidia_nim"}
    if provider_name not in supported:
        display_supported = ["openai", "gemini", "ollama", "groq", "nvidia"]
        error_msg = f"Unknown LLM_PROVIDER: '{provider_name}' (from {provider_source}). Supported: {', '.join(display_supported)}"
        logger.error(error_msg)
        raise ValueError(error_msg)

    return _get_provider_class(provider_name)


class _FallbackProvider(LLMProvider):
    """Cascades each call across providers in order. A provider that raises (no
    key, quota/429, network) is skipped and the next is tried — at CALL time, not
    just construction time. This is what lets recap/RAG survive a quota-exhausted
    primary provider instead of falling back to a stub."""

    def __init__(self, providers: List[tuple]):
        self._providers = providers  # [(name, LLMProvider), ...]

    async def chat_completion(self, messages, system_prompt: Optional[str] = None) -> str:
        errors = []
        for name, p in self._providers:
            try:
                return await p.chat_completion(messages, system_prompt=system_prompt)
            except Exception as e:
                errors.append(f"{name}: {type(e).__name__}: {e}")
                logger.warning(f"chat_completion via '{name}' failed, trying next: {e}")
        raise Exception(f"All providers failed for chat_completion: {'; '.join(errors)}")

    async def structured_output(self, messages, schema, system_prompt: Optional[str] = None):
        errors = []
        for name, p in self._providers:
            try:
                return await p.structured_output(messages, schema, system_prompt=system_prompt)
            except Exception as e:
                errors.append(f"{name}: {type(e).__name__}: {e}")
                logger.warning(f"structured_output via '{name}' failed, trying next: {e}")
        raise Exception(f"All providers failed for structured_output: {'; '.join(errors)}")

    async def stream_completion(self, messages, system_prompt: Optional[str] = None):
        errors = []
        for name, p in self._providers:
            held = None          # first chunk buffered, not yet forwarded
            yielded_any = False  # have we forwarded real output downstream?
            try:
                async for chunk in p.stream_completion(messages, system_prompt=system_prompt):
                    if not yielded_any and held is None:
                        held = chunk  # hold the first chunk so an immediate failure can still switch
                        continue
                    if held is not None:
                        yield held
                        held = None
                        yielded_any = True
                    yield chunk
                    yielded_any = True
                if held is not None:
                    yield held
                    yielded_any = True
                return
            except Exception as e:
                if not yielded_any:
                    # Nothing forwarded yet (at most one buffered chunk) — safe to fall
                    # back to the next provider on an early/immediate failure.
                    errors.append(f"{name}: {type(e).__name__}: {e}")
                    logger.warning(f"stream_completion via '{name}' failed before output, trying next: {e}")
                    continue
                # Real output already streamed — cannot cleanly switch providers.
                logger.warning(f"stream_completion via '{name}' failed mid-stream: {e}")
                raise
        raise Exception(f"All providers failed for stream_completion: {'; '.join(errors)}")


def get_provider_with_fallback(primary_provider: str, fallback_providers: List[str]) -> LLMProvider:
    candidates: List[str] = []
    for name in [primary_provider, *fallback_providers]:
        normalized = (name or "").strip().lower()
        if normalized and normalized not in candidates:
            candidates.append(normalized)

    if not candidates:
        raise ValueError("No providers specified for fallback resolution")

    # Construct every provider that can be built; cascade across them per-call.
    built: List[tuple] = []
    errors: List[str] = []
    for provider_name in candidates:
        try:
            built.append((provider_name, _get_provider_class(provider_name)))
        except Exception as e:
            errors.append(f"{provider_name}: {type(e).__name__}: {e}")
            logger.warning(f"Provider '{provider_name}' unavailable at construction: {type(e).__name__}: {e}")

    if not built:
        raise Exception(f"All providers failed: {'; '.join(errors)}")

    return _FallbackProvider(built)


def _get_provider_class(provider_name: str) -> LLMProvider:
    """Get provider instance by name (without logging)."""
    provider_name = provider_name.strip().lower()

    if provider_name == "openai":
        from .openai_provider import OpenAIProvider
        provider = OpenAIProvider()
    elif provider_name == "gemini":
        from .gemini_provider import GeminiProvider
        provider = GeminiProvider()
    elif provider_name == "ollama":
        from .ollama_provider import OllamaProvider
        provider = OllamaProvider()
    elif provider_name == "groq":
        from .groq_provider import GroqProvider
        provider = GroqProvider()
    elif provider_name == "nvidia" or provider_name == "nvidia_nim":
        from .nvidia_nim_provider import NvidiaNIMProvider
        provider = NvidiaNIMProvider()
    else:
        raise ValueError(f"Unknown provider: {provider_name}")

    return wrap_provider_with_tracing(provider, provider_name)
