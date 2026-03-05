import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./test.db")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "dummy")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "secret")

settings = Settings()
