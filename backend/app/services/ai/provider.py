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
    # Check for dynamic provider override file first
    provider_file = get_provider_override_file()
    provider_source = "env"
    
    if os.path.exists(provider_file):
        with open(provider_file, "r") as f:
            provider_name = f.read().strip().lower()
        provider_source = "file"
    else:
        provider_name = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
    
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


def get_provider_with_fallback(primary_provider: str, fallback_providers: List[str]) -> LLMProvider:
    candidates: List[str] = []
    for name in [primary_provider, *fallback_providers]:
        normalized = (name or "").strip().lower()
        if normalized and normalized not in candidates:
            candidates.append(normalized)

    if not candidates:
        raise ValueError("No providers specified for fallback resolution")

    errors: List[str] = []
    for provider_name in candidates:
        try:
            return _get_provider_class(provider_name)
        except Exception as e:
            errors.append(f"{provider_name}: {type(e).__name__}: {e}")
            logger.warning(f"Provider '{provider_name}' unavailable: {type(e).__name__}: {e}")

    raise Exception(f"All providers failed: {'; '.join(errors)}")


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
