from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator, model_validator

from app.model_settings import load_model_settings_payload, save_model_settings_payload


router = APIRouter(tags=["settings"])


class ProviderSettingsPayload(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    baseUrl: str = Field(min_length=1)
    embeddingModel: str = Field(min_length=1)
    chattingModel: str = Field(min_length=1)
    apiKey: str

    @field_validator("id", "name", "baseUrl", "embeddingModel", "chattingModel", "apiKey")
    @classmethod
    def strip_fields(cls, value: str) -> str:
        return value.strip()


class UpdateModelSettingsRequest(BaseModel):
    selectedProviderId: str = Field(min_length=1)
    providers: list[ProviderSettingsPayload] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_selected_provider(self) -> "UpdateModelSettingsRequest":
        provider_ids = {provider.id for provider in self.providers}
        if self.selectedProviderId not in provider_ids:
            raise ValueError("Selected provider must exist in the providers list.")
        return self


@router.get("/settings/model")
def get_model_settings() -> dict[str, object]:
    return load_model_settings_payload()


@router.put("/settings/model")
def update_model_settings(payload: UpdateModelSettingsRequest) -> dict[str, object]:
    return save_model_settings_payload(payload.model_dump())
