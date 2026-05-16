from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    database_url: str = "postgresql://docmind:docmind@localhost:5432/docmind"
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    anthropic_api_key: str = ""
    cors_origins: List[str] = ["http://localhost:5173"]

    model_config = {"env_file": ".env"}


settings = Settings()
