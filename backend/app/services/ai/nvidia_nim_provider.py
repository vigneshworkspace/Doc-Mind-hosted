"""
NVIDIA NIM (NVIDIA Inference Microservice) LLM Provider.

Uses NVIDIA's API for AI completions via the OpenAI compatibility layer.
Set NVIDIA_API_KEY and NVIDIA_MODEL environment variables.

Example models:
- deepseek-ai/deepseek-v4-pro
- meta/llama-3.3-70b-instruct
- nvidia/llama-3.1-nemotron-70b-instruct
"""
import os
import json
from typing import AsyncIterable, Any, Dict, List, Optional

import httpx
from pydantic import BaseModel

from .provider import LLMProvider


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class NvidiaNIMProvider(LLMProvider):
    """NVIDIA NIM API LLM provider using OpenAI compatibility."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.api_key = api_key or os.getenv("NVIDIA_API_KEY")
        self.model = model or os.getenv("NVIDIA_MODEL", "moonshotai/kimi-k2-instruct")
        self.temperature = float(os.getenv("NVIDIA_TEMPERATURE", os.getenv("LLM_TEMPERATURE", "1")))
        self.top_p = float(os.getenv("NVIDIA_TOP_P", "0.95"))
        self.max_tokens = int(os.getenv("NVIDIA_MAX_TOKENS", "16384"))
        self.enable_thinking = _env_bool("NVIDIA_ENABLE_THINKING", False)
        self._client: Optional[httpx.AsyncClient] = None
        
        if not self.api_key:
            raise ValueError("NVIDIA_API_KEY environment variable is required")

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url="https://integrate.api.nvidia.com/v1",
                timeout=120.0,
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
        return self._client

    def _build_payload(
        self,
        api_messages: List[Dict[str, Any]],
        *,
        stream: bool,
        response_format: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": api_messages,
            "temperature": self.temperature,
            "top_p": self.top_p,
            "max_tokens": self.max_tokens,
            "stream": stream,
            "chat_template_kwargs": {"thinking": self.enable_thinking},
        }

        if response_format is not None:
            payload["response_format"] = response_format

        return payload

    async def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
    ) -> str:
        """Simple chat completion."""
        client = await self._get_client()

        api_messages = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        api_messages.extend(messages)

        payload = self._build_payload(api_messages, stream=False)

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

        api_messages = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        api_messages.extend(messages)

        payload = self._build_payload(api_messages, stream=True)

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
        """Structured output using JSON mode. json_object guarantees valid JSON but
        not the schema shape — inject the schema into the prompt so fields match."""
        import json as _json
        client = await self._get_client()

        api_messages = []
        if system_prompt:
            api_messages.append({"role": "system", "content": system_prompt})
        api_messages.extend(messages)
        api_messages.append({
            "role": "system",
            "content": (
                "Respond with a single JSON object that strictly matches this JSON Schema. "
                "Use exactly these field names and nesting; no extra keys, no markdown.\n"
                f"{_json.dumps(schema.model_json_schema())}"
            ),
        })

        payload = self._build_payload(
            api_messages,
            stream=False,
            response_format={"type": "json_object"},
        )

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
