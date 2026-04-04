from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


default_database_path = Path(__file__).resolve().parents[2] / "data" / "lmctrlf.sqlite3"


class Settings(BaseSettings):
    app_name: str = "LMCtrlF Backend"
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    database_path: str = str(default_database_path)

    model_config = SettingsConfigDict(env_prefix="LMCTRLF_", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
