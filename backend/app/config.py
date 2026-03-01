from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_KEY: str
    
    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # Storage
    STORAGE_BUCKET: str = "documents"
    
    # Explainer API
    GROQ_API_KEY: str
    GROQ_MODEL: str = "gpt-oss-20b"
    
    # App
    APP_NAME: str = "GovDoc AI"
    DEBUG: bool = False
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()


settings = get_settings()