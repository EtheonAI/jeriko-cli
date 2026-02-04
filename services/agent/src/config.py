from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Agent service configuration."""

    # Server
    environment: str = "development"
    port: int = 8000
    debug: bool = False

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str | None = None

    # Database
    database_url: str = "postgresql://rubic:rubic@localhost:5432/rubic"

    # LLM Providers
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    google_api_key: str | None = None

    # E2B Sandboxing
    e2b_api_key: str | None = None

    # Service URLs
    task_service_url: str = "http://localhost:3002"
    device_service_url: str = "http://localhost:8080"
    file_service_url: str = "http://localhost:3003"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
