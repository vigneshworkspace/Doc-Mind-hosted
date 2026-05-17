from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://docmind:docmind@localhost:5432/docmind"

    # Auth
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # CORS
    cors_origins: List[str] = ["http://localhost:5173"]

    # LLM providers
    llm_provider: str = "gemini"
    llm_model: str = "gemini-2.5-flash"
    gemini_api_keys: str = ""
    gemini_api_key: str = ""
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    nvidia_api_key: str = ""
    nvidia_model: str = "moonshotai/kimi-k2-instruct"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b-instruct"
    openai_api_key: str = ""

    # Optional LangSmith tracing
    langsmith_api_key: str = ""
    langchain_tracing_v2: bool = False

    # AI data dir (Gemini key rotation persistence)
    ai_data_dir: str = ""

    # Embedding
    embed_model: str = "nomic-embed-text-v1.5"

    # Voice
    vibevoice_url: str = "http://localhost:8001"
    stt_model: str = "small"
    stt_device: str = "cuda"
    stt_compute_type: str = "float16"

    # YouTube
    youtube_cookie_file: str = "/app/youtube_cookies.json"

    # Ingestion tuning
    stuff_threshold: int = 150_000
    chunk_size: int = 500
    chunk_overlap: int = 50

    # Retrieval tuning
    retrieve_topk: int = 50
    rrf_k: int = 60
    rrf_topk: int = 30
    rerank_topk: int = 5
    grounding_threshold: float = 0.40
    agentic_tool_budget: int = 2
    rerank_model: str = "jinaai/jina-reranker-v3"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
