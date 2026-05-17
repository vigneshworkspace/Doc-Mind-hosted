import os
import json
from typing import AsyncIterable, Any, Dict, List, Optional
from pydantic import BaseModel
from openai import AsyncOpenAI
from .provider import LLMProvider

class OpenAIProvider(LLMProvider):
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = os.getenv("LLM_MODEL", "gpt-4o")

    def _format_messages(self, messages: List[Dict[str, Any]], system_prompt: Optional[str] = None) -> List[Dict[str, Any]]:
        formatted = []
        if system_prompt:
            formatted.append({"role": "system", "content": system_prompt})

        for msg in messages:
            # Handle text and potential file attachments based on standard openai schema
            content = msg.get("content", msg.get("text", ""))
            files = msg.get("files", [])

            # Ensure role is safe for OpenAI
            role = msg["role"]
            if role == "model":
                role = "assistant"

            if files:
                # Multi-modal payload
                content_array = [{"type": "text", "text": content}]
                for file in files:
                    # In OpenAI, base64 images use image_url
                    if "image" in file.get("mime_type", ""):
                        content_array.append({
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{file['mime_type']};base64,{file['data']}"
                            }
                        })
                formatted.append({"role": role, "content": content_array})
            else:
                formatted.append({"role": role, "content": content})

        return formatted

    async def chat_completion(self, messages: List[Dict[str, Any]], system_prompt: Optional[str] = None) -> str:
        formatted_msgs = self._format_messages(messages, system_prompt)
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=formatted_msgs
        )
        if not response.choices:
            return ""
        return response.choices[0].message.content

    async def stream_completion(self, messages: List[Dict[str, Any]], system_prompt: Optional[str] = None) -> AsyncIterable[str]:
        formatted_msgs = self._format_messages(messages, system_prompt)
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=formatted_msgs,
            stream=True
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def structured_output(self, messages: List[Dict[str, Any]], schema: type[BaseModel], system_prompt: Optional[str] = None) -> BaseModel:
        formatted_msgs = self._format_messages(messages, system_prompt)
        response = await self.client.beta.chat.completions.parse(
            model=self.model,
            messages=formatted_msgs,
            response_format=schema
        )
        if not response.choices:
            return None
        return response.choices[0].message.parsed
