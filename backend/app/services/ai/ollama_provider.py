"""
Ollama LLM Provider.

Uses local Ollama server for AI completions.
Set OLLAMA_BASE_URL (default: http://localhost:11434) and OLLAMA_MODEL.
"""
import os
import json
from typing import AsyncIterable, Any, Dict, List, Optional

import httpx
from pydantic import BaseModel

from .provider import LLMProvider


class OllamaProvider(LLMProvider):
    """Local LLM using Ollama server."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model = model or os.getenv("OLLAMA_MODEL", "llama3.2")
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(base_url=self.base_url, timeout=120.0)
        return self._client

    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
    ) -> str:
        """Simple chat completion."""
        client = await self._get_client()

        # Build messages array
        api_messages = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        api_messages.extend(messages)

        payload = {
            "model": self.model,
            "messages": api_messages,
            "stream": False,
        }

        resp = await client.post("/v1/chat/completions", json=payload)
        resp.raise_for_status()

        result = resp.json()
        return result["choices"][0]["message"]["content"]

    async def stream_completion(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
    ) -> AsyncIterable[str]:
        """Streaming chat completion."""
        client = await self._get_client()

        api_messages = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        api_messages.extend(messages)

        payload = {
            "model": self.model,
            "messages": api_messages,
            "stream": True,
        }

        async with client.stream("POST", "/v1/chat/completions", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    if "choices" in chunk and chunk["choices"]:
                        delta = chunk["choices"][0].get("delta", {})
                        if "content" in delta:
                            yield delta["content"]

    async def structured_output(
        self,
        messages: List[Dict[str, Any]],
        schema: type[BaseModel],
        system_prompt: Optional[str] = None,
    ) -> BaseModel:
        """Structured output using Ollama with JSON schema."""
        client = await self._get_client()

        # Build prompt with schema instructions
        schema_json = json.dumps(schema.model_json_schema(), indent=2)
        enhanced_system = f"{system_prompt or ''}\n\nRespond with valid JSON matching this schema:\n{schema_json}"

        api_messages = [
            {"role": "system", "content": enhanced_system},
            *messages,
        ]

        payload = {
            "model": self.model,
            "messages": api_messages,
            "stream": False,
            "format": "json",  # Ollama supports JSON output
        }

        resp = await client.post("/v1/chat/completions", json=payload)
        resp.raise_for_status()

        result = resp.json()
        content = result["choices"][0]["message"]["content"]

        return schema.model_validate_json(content)

    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
