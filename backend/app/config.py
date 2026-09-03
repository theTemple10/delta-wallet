from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    BMONI_MODE: str = "mock"
    BMONI_API_KEY: str = ""
    BMONI_BASE_URL: str = ""
    GROQ_API_KEY: str = ""
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/delta"
    DEMO_WALLET_OWNER_PRIVATE_KEY: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
