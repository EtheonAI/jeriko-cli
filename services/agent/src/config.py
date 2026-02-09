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
    e2b_template: str = "rubic-desktop"
    e2b_warm_idle_ttl: int = 600  # 10 minutes — sandbox stays warm
    e2b_hibernate_reuse_ttl: int = 172800  # 48 hours — can reconnect
    e2b_hard_max_lifetime: int = 259200  # 72 hours — absolute max
    e2b_cpu_count: int = 4
    e2b_memory_mb: int = 4096

    # Service URLs
    task_service_url: str = "http://localhost:3002"
    device_service_url: str = "http://localhost:4001"
    file_service_url: str = "http://localhost:4005"
    connector_service_url: str = "http://localhost:4009"
    sandbox_service_url: str = "http://localhost:4012"
    billing_service_url: str = "http://localhost:4008"
    notification_service_url: str = "http://localhost:4010"
    gateway_url: str = "http://localhost:4000"
    knowledge_service_url: str = "http://localhost:4011"

    # Web Search
    serper_api_key: str | None = None

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
