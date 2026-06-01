"""
ARQ worker entrypoint.
Run with: python -m arq app.workers.worker.WorkerSettings
"""
from arq.connections import RedisSettings

from app.core.config import settings
from app.workers.ingest import ingest_document, generate_audio_recap_task


def get_redis_settings() -> RedisSettings:
    url = settings.redis_url.replace("redis://", "")
    if "/" in url:
        url = url.split("/")[0]
    host, _, port = url.partition(":")
    return RedisSettings(host=host or "localhost", port=int(port or 6379))


class WorkerSettings:
    functions = [ingest_document, generate_audio_recap_task]
    redis_settings = get_redis_settings()
    max_jobs = 4
    job_timeout = 600
