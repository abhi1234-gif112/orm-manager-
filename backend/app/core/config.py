from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    DATABASE_URL: str = "postgresql+psycopg://saptanga:saptanga@localhost:5432/saptanga_newsroom"

    SUPABASE_URL: str = ""
    SUPABASE_JWT_SECRET: str = "change-me-in-env"
    SUPABASE_JWT_AUDIENCE: str = "authenticated"

    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Model tiers -- swapping a model is a config change, never a code change (see AGENTS.md)
    AI_FAST_MODEL_PROVIDER: str = "anthropic"
    AI_FAST_MODEL_NAME: str = "claude-haiku-4-5"
    AI_REASONING_MODEL_PROVIDER: str = "anthropic"
    AI_REASONING_MODEL_NAME: str = "claude-sonnet-5"

    S3_ENDPOINT_URL: str = ""
    S3_BUCKET: str = "saptanga-newsroom-media"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""

    # Ingestion (Phase 2 -- see docs/ROADMAP.md)
    INGESTION_SCHEDULER_ENABLED: bool = True
    INGESTION_POLL_INTERVAL_SECONDS: int = 900
    INGESTION_HTTP_TIMEOUT_SECONDS: float = 15.0
    INGESTION_MAX_ITEMS_PER_SOURCE: int = 50
    INGESTION_MAX_LINKS_PER_WEB_SOURCE: int = 20
    INGESTION_FAILURE_THRESHOLD: int = 10
    INGESTION_TITLE_SIMILARITY_THRESHOLD: float = 0.55
    INGESTION_TITLE_SIMILARITY_WINDOW_DAYS: int = 7


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
