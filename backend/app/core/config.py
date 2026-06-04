from functools import lru_cache
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database — either set DATABASE_URL directly, or provide the mysql_* parts
    # (matches the naming used across the other hivoco services) and the URL is
    # assembled from them.
    database_url: str = ""
    mysql_host: str = "127.0.0.1"
    mysql_port: int = 3306
    mysql_user: str = "root"
    mysql_password: str = ""
    mysql_db: str = "creative_os"

    # Auth
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 43200  # 30 days

    # Super admin — the single global admin, seeded on startup if not present.
    superadmin_email: str = ""
    superadmin_password: str = ""

    @property
    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self.database_url
        pwd = quote_plus(self.mysql_password)
        return (
            f"mysql+pymysql://{self.mysql_user}:{pwd}"
            f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_db}"
        )

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite-preview"

    # Segmind (AI smart-resize, nano-banana, lipsync)
    segmind_api_key: str = ""

    # Fish Audio (voice clone + TTS for Video AI)
    fish_api_key: str = ""

    # AWS S3 (public URLs for Segmind input + resized output)
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-south-1"
    aws_bucket_name: str = ""
    s3_base_prefix: str = "creative_os"

    # Storage
    upload_dir: str = "uploads"
    public_base_url: str = "http://localhost:8000"

    # CORS
    cors_origins: str = "http://localhost:6101,http://127.0.0.1:6101"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
