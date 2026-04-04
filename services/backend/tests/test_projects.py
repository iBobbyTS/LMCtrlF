from __future__ import annotations

import hashlib
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def create_project(client: TestClient, name: str = "Field Notes", accent: str = "#c2410c") -> dict[str, str]:
    response = client.post(
        "/projects",
        json={
            "name": name,
            "accent": accent,
        },
    )

    assert response.status_code == 201
    return response.json()


def test_list_projects_returns_empty_array_for_new_database(client: TestClient) -> None:
    response = client.get("/projects")

    assert response.status_code == 200
    assert response.json() == []


def test_create_project_can_be_listed(client: TestClient) -> None:
    project = create_project(client)

    response = client.get("/projects")

    assert response.status_code == 200
    assert response.json() == [project]


def test_import_document_persists_file_path_md5_and_queued_status(client: TestClient, tmp_path: Path) -> None:
    project = create_project(client)
    file_path = tmp_path / "launch-overview.pdf"
    file_bytes = b"launch overview"
    file_path.write_bytes(file_bytes)

    response = client.post(
        f"/projects/{project['id']}/documents/import",
        json={
            "items": [
                {
                    "name": file_path.name,
                    "filePath": str(file_path),
                }
            ]
        },
    )

    assert response.status_code == 200

    documents = response.json()
    assert len(documents) == 1
    assert documents[0]["name"] == "launch-overview.pdf"
    assert documents[0]["filePath"] == str(file_path.resolve())
    assert documents[0]["md5"] == hashlib.md5(file_bytes).hexdigest()
    assert documents[0]["status"] == "queued"


def test_reimporting_the_same_file_does_not_duplicate_document(client: TestClient, tmp_path: Path) -> None:
    project = create_project(client)
    file_path = tmp_path / "notes.pdf"
    file_path.write_bytes(b"same-content")

    payload = {
        "items": [
            {
                "name": file_path.name,
                "filePath": str(file_path),
            }
        ]
    }

    first_response = client.post(f"/projects/{project['id']}/documents/import", json=payload)
    second_response = client.post(f"/projects/{project['id']}/documents/import", json=payload)

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert len(second_response.json()) == 1
    assert second_response.json()[0]["status"] == "queued"


def test_reimporting_changed_file_marks_document_as_file_changed(client: TestClient, tmp_path: Path) -> None:
    project = create_project(client)
    file_path = tmp_path / "weekly-summary.pdf"
    file_path.write_bytes(b"version-one")

    payload = {
        "items": [
            {
                "name": file_path.name,
                "filePath": str(file_path),
            }
        ]
    }

    initial_response = client.post(f"/projects/{project['id']}/documents/import", json=payload)
    initial_document = initial_response.json()[0]

    file_path.write_bytes(b"version-two")
    updated_response = client.post(f"/projects/{project['id']}/documents/import", json=payload)
    updated_document = updated_response.json()[0]

    assert updated_response.status_code == 200
    assert len(updated_response.json()) == 1
    assert updated_document["id"] == initial_document["id"]
    assert updated_document["status"] == "file_changed"
    assert updated_document["md5"] != initial_document["md5"]


def test_delete_document_removes_it_from_the_project(client: TestClient, tmp_path: Path) -> None:
    project = create_project(client)
    file_path = tmp_path / "stakeholder-notes.pdf"
    file_path.write_bytes(b"remove-me")

    import_response = client.post(
        f"/projects/{project['id']}/documents/import",
        json={"items": [{"name": file_path.name, "filePath": str(file_path)}]},
    )
    document_id = import_response.json()[0]["id"]

    delete_response = client.delete(f"/projects/{project['id']}/documents/{document_id}")
    list_response = client.get(f"/projects/{project['id']}/documents")

    assert delete_response.status_code == 204
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_import_missing_file_returns_bad_request(client: TestClient, tmp_path: Path) -> None:
    project = create_project(client)
    missing_file = tmp_path / "missing.pdf"

    response = client.post(
        f"/projects/{project['id']}/documents/import",
        json={"items": [{"name": missing_file.name, "filePath": str(missing_file)}]},
    )

    assert response.status_code == 400
    assert "File does not exist" in response.json()["detail"]


def test_missing_project_or_document_returns_not_found(client: TestClient) -> None:
    list_response = client.get("/projects/project-missing/documents")
    delete_response = client.delete("/projects/project-missing/documents/document-missing")

    assert list_response.status_code == 404
    assert delete_response.status_code == 404


def test_database_contents_survive_app_reinitialization(database_path: Path, tmp_path: Path) -> None:
    settings = Settings(database_path=str(database_path))
    file_path = tmp_path / "launch-plan.pdf"
    file_path.write_bytes(b"persistent-content")

    with TestClient(create_app(settings)) as first_client:
        project = create_project(first_client, name="Archive")
        import_response = first_client.post(
            f"/projects/{project['id']}/documents/import",
            json={"items": [{"name": file_path.name, "filePath": str(file_path)}]},
        )
        assert import_response.status_code == 200

    with TestClient(create_app(settings)) as second_client:
        projects_response = second_client.get("/projects")
        documents_response = second_client.get(f"/projects/{project['id']}/documents")

    assert projects_response.status_code == 200
    assert len(projects_response.json()) == 1
    assert projects_response.json()[0]["name"] == "Archive"
    assert documents_response.status_code == 200
    assert len(documents_response.json()) == 1
    assert documents_response.json()[0]["name"] == "launch-plan.pdf"
