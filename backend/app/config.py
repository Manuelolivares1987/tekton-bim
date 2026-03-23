
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Tekton BIM Engine"
    version: str = "0.1.0"
    debug: bool = False

    # Database
    database_url: str = "sqlite:///./cadworks.db"

    # File storage
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 500

    # API
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
        "app://.",
    ]

    # Claude API
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-5-20250929"

    # Server
    host: str = "127.0.0.1"
    port: int = 8000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
