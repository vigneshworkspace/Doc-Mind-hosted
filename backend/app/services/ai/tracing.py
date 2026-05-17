import logging
from typing import Any, AsyncIterable, Awaitable, Callable, Dict, Optional


logger = logging.getLogger(__name__)


def _get_traceable():
    try:
        from langsmith import traceable  # type: ignore
        return traceable
    except ImportError:
        return None


async def trace_async_llm(
    provider: str,
    operation: str,
    runner: Callable[[], Awaitable[Any]],
    metadata: Optional[Dict[str, Any]] = None,
) -> Any:
    traceable = _get_traceable()
    if traceable is None:
        return await runner()

    traced_runner = traceable(
        name=f"{provider}.{operation}",
        run_type="llm",
        metadata=metadata or {},
    )(runner)
    return await traced_runner()


async def trace_stream_llm(
    provider: str,
    operation: str,
    runner: Callable[[], AsyncIterable[str]],
    metadata: Optional[Dict[str, Any]] = None,
) -> AsyncIterable[str]:
    traceable = _get_traceable()
    if traceable is None:
        async for chunk in runner():
            yield chunk
        return

    traced_runner = traceable(
        name=f"{provider}.{operation}",
        run_type="llm",
        metadata=metadata or {},
    )(runner)
    async for chunk in traced_runner():
        yield chunk


def wrap_provider_with_tracing(provider: Any, provider_name: str) -> Any:
    if getattr(provider, "_langsmith_wrapped", False):
        return provider

    metadata: Dict[str, Any] = {"provider": provider_name}
    model_name = getattr(provider, "model", None) or getattr(provider, "model_name", None)
    if model_name:
        metadata["model"] = str(model_name)

    original_chat = getattr(provider, "chat_completion", None)
    if callable(original_chat):
        async def _chat_completion_wrapper(*args, **kwargs):
            async def _run():
                return await original_chat(*args, **kwargs)

            return await trace_async_llm(
                provider=provider_name,
                operation="chat_completion",
                runner=_run,
                metadata=metadata,
            )

        setattr(provider, "chat_completion", _chat_completion_wrapper)

    original_structured = getattr(provider, "structured_output", None)
    if callable(original_structured):
        async def _structured_output_wrapper(*args, **kwargs):
            async def _run():
                return await original_structured(*args, **kwargs)

            return await trace_async_llm(
                provider=provider_name,
                operation="structured_output",
                runner=_run,
                metadata=metadata,
            )

        setattr(provider, "structured_output", _structured_output_wrapper)

    original_stream = getattr(provider, "stream_completion", None)
    if callable(original_stream):
        async def _stream_completion_wrapper(*args, **kwargs):
            async def _run():
                async for chunk in original_stream(*args, **kwargs):
                    yield chunk

            async for chunk in trace_stream_llm(
                provider=provider_name,
                operation="stream_completion",
                runner=_run,
                metadata=metadata,
            ):
                yield chunk

        setattr(provider, "stream_completion", _stream_completion_wrapper)

    setattr(provider, "_langsmith_wrapped", True)
    return provider
