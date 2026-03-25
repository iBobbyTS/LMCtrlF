from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "LMCtrlF Backend"
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000

    model_config = SettingsConfigDict(env_prefix="LMCTRLF_", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
