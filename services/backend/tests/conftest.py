from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


@pytest.fixture()
def database_path(tmp_path: Path) -> Path:
    return tmp_path / "test.sqlite3"


@pytest.fixture()
def lancedb_path(tmp_path: Path) -> Path:
    return tmp_path / "lancedb"


@pytest.fixture()
def client(database_path: Path, lancedb_path: Path) -> TestClient:
    settings = Settings(database_path=str(database_path), lancedb_path=str(lancedb_path))
    app = create_app(settings)

    class FakeEmbeddingClient:
        def embed_texts(
            self, base_url: str, model: str, api_key: str, texts: list[str]
        ) -> list[list[float]]:
            assert base_url
            assert model
            assert isinstance(api_key, str)
            return [[float(index + 1)] * 768 for index, _ in enumerate(texts)]

    app.state.indexing_worker.embedding_client = FakeEmbeddingClient()

    with TestClient(app) as test_client:
        yield test_client
