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
def client(database_path: Path) -> TestClient:
    settings = Settings(database_path=str(database_path))
    with TestClient(create_app(settings)) as test_client:
        yield test_client
