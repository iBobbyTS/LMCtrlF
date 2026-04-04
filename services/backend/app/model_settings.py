from __future__ import annotations

import json
from datetime import datetime, timezone

from app.models import ModelSettings


DEFAULT_PROVIDERS = [
    {
        "id": "lm-studio",
        "name": "LM Studio",
        "baseUrl": "http://127.0.0.1:1234/v1",
        "embeddingModel": "text-embedding-embeddinggemma-300m",
        "chattingModel": "qwen/qwen3-8b",
        "apiKey": "lm-studio",
    },
    {
        "id": "openai",
        "name": "OpenAI",
        "baseUrl": "https://api.openai.com/v1",
        "embeddingModel": "text-embedding-3-small",
        "chattingModel": "gpt-5-mini",
        "apiKey": "sk-live-••••••••",
    },
    {
        "id": "anthropic",
        "name": "Anthropic",
        "baseUrl": "https://api.anthropic.com",
        "embeddingModel": "text-embedding-embeddinggemma-300m",
        "chattingModel": "claude-sonnet-4-5",
        "apiKey": "sk-ant-••••••••",
    },
]
DEFAULT_SELECTED_PROVIDER_ID = "lm-studio"
SETTINGS_ROW_ID = "default"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def default_model_settings_payload() -> dict[str, object]:
    return {
        "selectedProviderId": DEFAULT_SELECTED_PROVIDER_ID,
        "providers": [dict(provider) for provider in DEFAULT_PROVIDERS],
    }


def ensure_model_settings_record() -> ModelSettings:
    settings = ModelSettings.get_or_none(ModelSettings.id == SETTINGS_ROW_ID)
    if settings is not None:
        return settings

    payload = default_model_settings_payload()
    timestamp = utc_now()
    return ModelSettings.create(
        id=SETTINGS_ROW_ID,
        selected_provider_id=str(payload["selectedProviderId"]),
        providers_json=json.dumps(payload["providers"]),
        created_at=timestamp,
        updated_at=timestamp,
    )


def load_model_settings_payload() -> dict[str, object]:
    settings = ensure_model_settings_record()
    return {
        "selectedProviderId": settings.selected_provider_id,
        "providers": json.loads(settings.providers_json),
    }


def save_model_settings_payload(payload: dict[str, object]) -> dict[str, object]:
    settings = ensure_model_settings_record()
    settings.selected_provider_id = str(payload["selectedProviderId"])
    settings.providers_json = json.dumps(payload["providers"])
    settings.updated_at = utc_now()
    settings.save()
    return load_model_settings_payload()
