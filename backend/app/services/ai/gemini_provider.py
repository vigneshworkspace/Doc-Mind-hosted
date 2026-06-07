import os
from typing import AsyncIterable, Any, Dict, List, Optional
from pydantic import BaseModel
from google import genai
from google.genai import types
from google.genai import errors
from .provider import LLMProvider
from . import gemini_key_manager

def _parse_json_response(text: str, schema):
    """Robustly coerce a model response into the schema. Handles raw JSON, fenced
    JSON, and JSON embedded in prose (first {...}/[...] span). Raises on empty/garbage."""
    import re as _re
    if not text or not text.strip():
        raise ValueError("empty model response")
    for candidate in (
        text,
        text.replace("```json", "").replace("```", "").strip(),
    ):
        try:
            return schema.model_validate_json(candidate)
        except Exception:
            pass
    m = _re.search(r"[\[{].*[\]}]", text, _re.DOTALL)
    if m:
        return schema.model_validate_json(m.group(0))
    raise ValueError("no parseable JSON in model response")


class GeminiProvider(LLMProvider):
    def __init__(self):
        # Get key from key manager (rotates automatically)
        api_key = gemini_key_manager.get_available_key()
        if not api_key:
            raise ValueError("No available Gemini API keys")
        self.client = genai.Client(api_key=api_key)
        self.current_key = api_key
        self.model_name = os.getenv("LLM_MODEL", "gemini-2.5-flash")

    def _get_new_client(self):
        """Get a fresh client with a new API key."""
        api_key = gemini_key_manager.get_available_key()
        if not api_key:
            raise ValueError("No available Gemini API keys")
        self.current_key = api_key
        return genai.Client(api_key=api_key)

    def _build_contents(self, messages: List[Dict[str, Any]]) -> List[types.Content]:
        contents = []
        for msg in messages:
            role = "user" if msg.get("role") == "user" else "model"
            content = msg.get("content", msg.get("text", ""))
            files = msg.get("files", [])

            parts = []
            if content:
                parts.append(types.Part.from_text(text=content))
            for file in files:
                parts.append(types.Part(inline_data=types.Blob(
                    mime_type=file["mime_type"],
                    data=file["data"]
                )))
            contents.append(types.Content(role=role, parts=parts))
        return contents

    async def chat_completion(self, messages: List[Dict[str, Any]], system_prompt: Optional[str] = None) -> str:
        contents = self._build_contents(messages)
        config = types.GenerateContentConfig(system_instruction=system_prompt) if system_prompt else None
        try:
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=config,
            )
            gemini_key_manager.mark_key_success(self.current_key)
            return response.text
        except Exception as e:
            error_str = str(e).lower()
            # Model/config error (bad model id, model not enabled) — not the key's
            # fault. Surface it without disabling the key, so a wrong LLM_MODEL can't
            # silently brick a working key.
            if any(s in error_str for s in ("not found", "does not exist", "not supported", "unsupported", " 404")):
                raise
            if "quota" in error_str or "429" in error_str or "rate limit" in error_str:
                gemini_key_manager.mark_key_quota_exceeded(self.current_key)
                # Try with new key
                self.client = self._get_new_client()
                response = await self.client.aio.models.generate_content(
                    model=self.model_name,
                    contents=contents,
                    config=config,
                )
                gemini_key_manager.mark_key_success(self.current_key)
                return response.text
            else:
                gemini_key_manager.mark_key_error(self.current_key)
                raise

    async def stream_completion(self, messages: List[Dict[str, Any]], system_prompt: Optional[str] = None) -> AsyncIterable[str]:
        contents = self._build_contents(messages)
        config = types.GenerateContentConfig(system_instruction=system_prompt) if system_prompt else None
        chunks_yielded = False
        try:
            async for chunk in await self.client.aio.models.generate_content_stream(
                model=self.model_name,
                contents=contents,
                config=config,
            ):
                if chunk.text:
                    chunks_yielded = True
                    yield chunk.text
            gemini_key_manager.mark_key_success(self.current_key)
        except Exception as e:
            error_str = str(e).lower()
            if any(s in error_str for s in ("not found", "does not exist", "not supported", "unsupported", " 404")):
                raise
            if "quota" in error_str or "429" in error_str or "rate limit" in error_str:
                gemini_key_manager.mark_key_quota_exceeded(self.current_key)
                if chunks_yielded:
                    # Surface the failure instead of injecting error text into the
                    # answer stream; the transport layer emits a distinct error frame.
                    raise
                else:
                    # No chunks yielded yet — safe to retry with new key
                    self.client = self._get_new_client()
                    async for chunk in await self.client.aio.models.generate_content_stream(
                        model=self.model_name,
                        contents=contents,
                        config=config,
                    ):
                        if chunk.text:
                            yield chunk.text
                    gemini_key_manager.mark_key_success(self.current_key)
            else:
                gemini_key_manager.mark_key_error(self.current_key)
                if chunks_yielded:
                    # Surface the failure instead of injecting error text into the
                    # answer stream; the transport layer emits a distinct error frame.
                    raise
                else:
                    raise

    async def structured_output(self, messages: List[Dict[str, Any]], schema: type[BaseModel], system_prompt: Optional[str] = None) -> BaseModel:
        import json as _json
        contents = self._build_contents(messages)
        schema_hint = f"\n\nRespond strictly with JSON matching this schema:\n{_json.dumps(schema.model_json_schema(), indent=2)}"
        if contents and contents[-1].role == "user":
            contents[-1].parts.append(types.Part.from_text(text=schema_hint))
        else:
            contents.append(types.Content(role="user", parts=[types.Part.from_text(text=schema_hint)]))

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
        )
        try:
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=config,
            )
            gemini_key_manager.mark_key_success(self.current_key)
            return _parse_json_response(response.text, schema)
        except Exception as e:
            error_str = str(e).lower()
            if "quota" in error_str or "429" in error_str or "rate limit" in error_str:
                gemini_key_manager.mark_key_quota_exceeded(self.current_key)
                self.client = self._get_new_client()
                response = await self.client.aio.models.generate_content(
                    model=self.model_name,
                    contents=contents,
                    config=config,
                )
                gemini_key_manager.mark_key_success(self.current_key)
                return _parse_json_response(response.text, schema)
            else:
                gemini_key_manager.mark_key_error(self.current_key)
                raise
