from __future__ import annotations

import hashlib
import time
from pathlib import Path

from fastapi.testclient import TestClient

from app.indexing import extract_pdf_chunks
from app.model_settings import DEFAULT_PROVIDERS, DEFAULT_SELECTED_PROVIDER_ID
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


def write_text_pdf(file_path: Path, page_texts: list[str]) -> None:
    objects: list[bytes] = []
    font_object_id = 1
    content_start_id = 2
    page_start_id = content_start_id + len(page_texts)
    pages_object_id = page_start_id + len(page_texts)
    catalog_object_id = pages_object_id + 1

    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for text in page_texts:
        escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 14 Tf 72 720 Td ({escaped}) Tj ET".encode()
        objects.append(
            b"<< /Length "
            + str(len(stream)).encode()
            + b" >>\nstream\n"
            + stream
            + b"\nendstream"
        )

    page_object_ids: list[int] = []
    for index, _ in enumerate(page_texts):
        content_object_id = content_start_id + index
        page_object_id = page_start_id + index
        page_object_ids.append(page_object_id)
        page = (
            f"<< /Type /Page /Parent {pages_object_id} 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font_object_id} 0 R >> >> /Contents {content_object_id} 0 R >>"
        ).encode()
        objects.append(page)

    kids = " ".join(f"{page_id} 0 R" for page_id in page_object_ids)
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(page_object_ids)} >>".encode())
    objects.append(f"<< /Type /Catalog /Pages {pages_object_id} 0 R >>".encode())

    buffer = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for object_id, body in enumerate(objects, start=1):
        offsets.append(len(buffer))
        buffer.extend(f"{object_id} 0 obj\n".encode())
        buffer.extend(body)
        buffer.extend(b"\nendobj\n")

    xref_offset = len(buffer)
    total_objects = catalog_object_id
    buffer.extend(f"xref\n0 {total_objects + 1}\n".encode())
    buffer.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        buffer.extend(f"{offset:010d} 00000 n \n".encode())
    buffer.extend(
        (
            f"trailer\n<< /Size {total_objects + 1} /Root {catalog_object_id} 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode()
    )
    file_path.write_bytes(bytes(buffer))


def wait_for_document_status(
    client: TestClient, project_id: str, document_id: str, expected_status: str
) -> dict[str, str | int]:
    deadline = time.time() + 5
    while time.time() < deadline:
        response = client.get(f"/projects/{project_id}/documents")
        assert response.status_code == 200
        for document in response.json():
            if document["id"] == document_id and document["status"] == expected_status:
                return document
        time.sleep(0.05)
    raise AssertionError(f"Timed out waiting for {document_id} to reach {expected_status}")


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
    write_text_pdf(file_path, ["launch overview"])
    file_bytes = file_path.read_bytes()

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
    write_text_pdf(file_path, ["same-content"])

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
    assert second_response.json()[0]["id"] == first_response.json()[0]["id"]
    assert second_response.json()[0]["status"] in {"queued", "indexing", "ready"}


def test_reimporting_changed_file_marks_document_as_file_changed(client: TestClient, tmp_path: Path) -> None:
    project = create_project(client)
    file_path = tmp_path / "weekly-summary.pdf"
    write_text_pdf(file_path, ["version-one"])

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

    write_text_pdf(file_path, ["version-two"])
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
    write_text_pdf(file_path, ["remove-me"])

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
    settings = Settings(database_path=str(database_path), lancedb_path=str(tmp_path / "lancedb"))
    file_path = tmp_path / "launch-plan.pdf"
    write_text_pdf(file_path, ["persistent-content"])

    class FakeEmbeddingClient:
        def embed_texts(self, base_url: str, model: str, api_key: str, texts: list[str]) -> list[list[float]]:
            return [[1.0] * 768 for _ in texts]

    first_app = create_app(settings)
    first_app.state.indexing_worker.embedding_client = FakeEmbeddingClient()
    with TestClient(first_app) as first_client:
        project = create_project(first_client, name="Archive")
        import_response = first_client.post(
            f"/projects/{project['id']}/documents/import",
            json={"items": [{"name": file_path.name, "filePath": str(file_path)}]},
        )
        assert import_response.status_code == 200

    second_app = create_app(settings)
    second_app.state.indexing_worker.embedding_client = FakeEmbeddingClient()
    with TestClient(second_app) as second_client:
        projects_response = second_client.get("/projects")
        documents_response = second_client.get(f"/projects/{project['id']}/documents")

    assert projects_response.status_code == 200
    assert len(projects_response.json()) == 1
    assert projects_response.json()[0]["name"] == "Archive"
    assert documents_response.status_code == 200
    assert len(documents_response.json()) == 1
    assert documents_response.json()[0]["name"] == "launch-plan.pdf"


def test_model_settings_can_be_loaded_and_saved(client: TestClient) -> None:
    response = client.get("/settings/model")

    assert response.status_code == 200
    assert response.json()["selectedProviderId"] == DEFAULT_SELECTED_PROVIDER_ID
    assert response.json()["providers"][0]["id"] == DEFAULT_PROVIDERS[0]["id"]

    updated_response = client.put(
        "/settings/model",
        json={
            "selectedProviderId": "openai",
            "providers": [
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
                    "apiKey": "sk-test",
                },
            ],
        },
    )

    assert updated_response.status_code == 200
    assert updated_response.json()["selectedProviderId"] == "openai"
    assert updated_response.json()["providers"][1]["chattingModel"] == "gpt-5-mini"


def test_extract_pdf_chunks_preserves_page_numbers_and_skips_empty_pages(tmp_path: Path) -> None:
    file_path = tmp_path / "chunked.pdf"
    write_text_pdf(file_path, ["Alpha page", "", "Beta page"])

    chunks = extract_pdf_chunks(file_path)

    assert [chunk.page_number for chunk in chunks] == [1, 3]
    assert chunks[0].text == "Alpha page"
    assert chunks[1].text == "Beta page"


def test_index_worker_marks_documents_ready_and_writes_chunks(client: TestClient, tmp_path: Path) -> None:
    project = create_project(client)
    file_path = tmp_path / "indexed.pdf"
    write_text_pdf(file_path, ["Alpha page", "Beta page"])

    import_response = client.post(
        f"/projects/{project['id']}/documents/import",
        json={"items": [{"name": file_path.name, "filePath": str(file_path)}]},
    )
    assert import_response.status_code == 200
    document_id = import_response.json()[0]["id"]

    document = wait_for_document_status(client, project["id"], document_id, "ready")
    chunks = client.app.state.lancedb_store.list_document_chunks(document_id)

    assert document["progress"] == 100
    assert len(chunks) == 2
    assert chunks[0]["document_id"] == document_id
    assert len(chunks[0]["vector"]) == 768


def test_reindex_replaces_existing_chunks(client: TestClient, tmp_path: Path) -> None:
    project = create_project(client)
    file_path = tmp_path / "reindex.pdf"
    write_text_pdf(file_path, ["Original text"])

    import_response = client.post(
        f"/projects/{project['id']}/documents/import",
        json={"items": [{"name": file_path.name, "filePath": str(file_path)}]},
    )
    document_id = import_response.json()[0]["id"]
    wait_for_document_status(client, project["id"], document_id, "ready")

    write_text_pdf(file_path, ["Updated text after reindex"])
    response = client.post(f"/projects/{project['id']}/documents/{document_id}/reindex")

    assert response.status_code == 200
    reindexed_document = wait_for_document_status(client, project["id"], document_id, "ready")
    chunks = client.app.state.lancedb_store.list_document_chunks(document_id)

    assert reindexed_document["progress"] == 100
    assert len(chunks) == 1
    assert chunks[0]["text"] == "Updated text after reindex"


def test_indexing_failure_marks_document_paused(client: TestClient, tmp_path: Path) -> None:
    project = create_project(client)
    file_path = tmp_path / "empty.pdf"
    write_text_pdf(file_path, [""])

    import_response = client.post(
        f"/projects/{project['id']}/documents/import",
        json={"items": [{"name": file_path.name, "filePath": str(file_path)}]},
    )
    document_id = import_response.json()[0]["id"]

    document = wait_for_document_status(client, project["id"], document_id, "paused")

    assert document["progress"] == 15
