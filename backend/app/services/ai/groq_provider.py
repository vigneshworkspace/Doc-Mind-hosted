"""
Groq LLM Provider.

Uses Groq's API for fast AI completions.
Set GROQ_API_KEY and GROQ_MODEL environment variables.
"""
import os
import json
from typing import AsyncIterable, Any, Dict, List, Optional

import httpx
from pydantic import BaseModel

from .provider import LLMProvider


class GroqProvider(LLMProvider):
    """Groq API LLM provider."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        self.model = model or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        self._client: Optional[httpx.AsyncClient] = None
        
        if not self.api_key:
            raise ValueError("GROQ_API_KEY environment variable is required")

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url="https://api.groq.com/openai/v1",
                timeout=120.0,
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
        return self._client

    def _format_messages(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Normalize messages to OpenAI-compatible text-only schema for Groq."""
        formatted: List[Dict[str, Any]] = []
        if system_prompt:
            formatted.append({"role": "system", "content": system_prompt})

        for msg in messages:
            role = msg.get("role", "user")
            if role == "model":
                role = "assistant"
            if role not in {"system", "user", "assistant"}:
                role = "user"

            content = msg.get("content", msg.get("text", ""))
            if not isinstance(content, str):
                content = str(content)

            # Groq chat completions reject unknown fields (e.g., files), so send text-only payload.
            formatted.append({"role": role, "content": content})

        return formatted

    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
    ) -> str:
        """Simple chat completion."""
        client = await self._get_client()
        api_messages = self._format_messages(messages, system_prompt)

        payload = {
            "model": self.model,
            "messages": api_messages,
            "stream": False,
        }

        resp = await client.post("/chat/completions", json=payload)
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
        api_messages = self._format_messages(messages, system_prompt)

        payload = {
            "model": self.model,
            "messages": api_messages,
            "stream": True,
        }

        async with client.stream("POST", "/chat/completions", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.strip():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            if chunk.get("choices"):
                                delta = chunk["choices"][0].get("delta", {})
                                content = delta.get("content")
                                if content:
                                    yield content
                        except json.JSONDecodeError:
                            continue

    async def structured_output(
        self,
        messages: List[Dict[str, Any]],
        schema: type[BaseModel],
        system_prompt: Optional[str] = None,
    ) -> BaseModel:
        """Structured output using Groq's JSON mode."""
        client = await self._get_client()
        api_messages = self._format_messages(messages, system_prompt)

        payload = {
            "model": self.model,
            "messages": api_messages,
            "response_format": {"type": "json_object"},
        }

        resp = await client.post("/chat/completions", json=payload)
        resp.raise_for_status()

        result = resp.json()
        content = result["choices"][0]["message"]["content"]
        
        try:
            return schema.model_validate_json(content)
        except Exception:
            # Try to extract JSON from the content
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                return schema.model_validate_json(json_match.group())
            raise

    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None
