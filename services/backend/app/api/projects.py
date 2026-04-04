from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel, Field, field_validator

from app.models import Document, Project


router = APIRouter(tags=["projects"])
document_statuses = {"queued", "indexing", "paused", "ready", "file_changed"}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def serialize_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def serialize_project(project: Project) -> dict[str, str]:
    return {
        "id": project.id,
        "name": project.name,
        "accent": project.accent,
        "createdAt": serialize_timestamp(project.created_at),
        "updatedAt": serialize_timestamp(project.updated_at),
    }


def serialize_document(document: Document) -> dict[str, str]:
    return {
        "id": document.id,
        "projectId": document.project_id,
        "name": document.name,
        "filePath": document.file_path,
        "md5": document.md5,
        "status": document.status,
        "createdAt": serialize_timestamp(document.created_at),
        "updatedAt": serialize_timestamp(document.updated_at),
    }


def get_project_or_404(project_id: str) -> Project:
    project = Project.get_or_none(Project.id == project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    return project


def get_document_or_404(project_id: str, document_id: str) -> Document:
    document = Document.get_or_none(
        (Document.id == document_id) & (Document.project_id == project_id)
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return document


def hash_file(file_path: Path) -> str:
    digest = hashlib.md5()
    with file_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def list_serialized_documents(project_id: str) -> list[dict[str, str]]:
    query = (
        Document.select()
        .where(Document.project_id == project_id)
        .order_by(Document.created_at.desc(), Document.id.desc())
    )
    return [serialize_document(document) for document in query]


class CreateProjectRequest(BaseModel):
    name: str = Field(min_length=1)
    accent: str = Field(min_length=1)

    @field_validator("name", "accent")
    @classmethod
    def strip_required_fields(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Field cannot be empty.")
        return stripped


class ImportDocumentItem(BaseModel):
    name: str = Field(min_length=1)
    filePath: str = Field(min_length=1)

    @field_validator("name", "filePath")
    @classmethod
    def strip_required_fields(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Field cannot be empty.")
        return stripped


class ImportDocumentsRequest(BaseModel):
    items: list[ImportDocumentItem] = Field(min_length=1)


@router.get("/projects")
def list_projects() -> list[dict[str, str]]:
    query = Project.select().order_by(Project.updated_at.desc(), Project.created_at.desc())
    return [serialize_project(project) for project in query]


@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(payload: CreateProjectRequest) -> dict[str, str]:
    timestamp = utc_now()
    project = Project.create(
        id=f"project-{uuid4().hex}",
        name=payload.name,
        accent=payload.accent,
        created_at=timestamp,
        updated_at=timestamp,
    )
    return serialize_project(project)


@router.get("/projects/{project_id}/documents")
def list_documents(project_id: str) -> list[dict[str, str]]:
    get_project_or_404(project_id)
    return list_serialized_documents(project_id)


@router.post("/projects/{project_id}/documents/import")
def import_documents(project_id: str, payload: ImportDocumentsRequest) -> list[dict[str, str]]:
    project = get_project_or_404(project_id)
    touched_at = utc_now()

    for item in payload.items:
        resolved_path = Path(item.filePath).expanduser().resolve()
        if not resolved_path.is_file():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File does not exist: {resolved_path}",
            )

        md5 = hash_file(resolved_path)
        existing = Document.get_or_none(
            (Document.project == project) & (Document.file_path == str(resolved_path))
        )

        if existing is None:
            Document.create(
                id=f"document-{uuid4().hex}",
                project=project,
                name=item.name,
                file_path=str(resolved_path),
                md5=md5,
                status="queued",
                created_at=touched_at,
                updated_at=touched_at,
            )
            continue

        existing.name = item.name
        existing.updated_at = touched_at
        if existing.md5 != md5:
            existing.md5 = md5
            existing.status = "file_changed"
        existing.save()

    project.updated_at = touched_at
    project.save()
    return list_serialized_documents(project_id)


@router.delete("/projects/{project_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(project_id: str, document_id: str) -> Response:
    project = get_project_or_404(project_id)
    document = get_document_or_404(project_id, document_id)
    document.delete_instance()
    project.updated_at = utc_now()
    project.save()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
