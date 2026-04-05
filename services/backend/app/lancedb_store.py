from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import lancedb
from lancedb.pydantic import LanceModel, Vector


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class DocumentChunk(LanceModel):
    id: str
    project_id: str
    document_id: str
    document_md5: str
    page_number: int
    chunk_index: int
    text: str
    vector: Vector(768)
    char_count: int
    created_at: str


class LanceDBStore:
    table_name = "document_chunks"

    def __init__(self, database_path: str):
        self.database_path = Path(database_path).expanduser().resolve()
        self.database_path.mkdir(parents=True, exist_ok=True)

    def _connect(self):
        return lancedb.connect(str(self.database_path))

    def _open_table(self):
        db = self._connect()
        try:
            return db.open_table(self.table_name)
        except FileNotFoundError:
            return db.create_table(self.table_name, schema=DocumentChunk)
        except ValueError:
            return db.create_table(self.table_name, schema=DocumentChunk)

    def ensure_table(self) -> None:
        self._open_table()

    def replace_document_chunks(self, rows: list[dict[str, Any]]) -> None:
        table = self._open_table()
        document_id = rows[0]["document_id"] if rows else None
        if document_id is not None:
            table.delete(f"document_id = '{document_id}'")
        if rows:
            table.add(rows)

    def delete_document_chunks(self, document_id: str) -> None:
        table = self._open_table()
        table.delete(f"document_id = '{document_id}'")

    def list_document_chunks(self, document_id: str) -> list[dict[str, Any]]:
        table = self._open_table()
        rows = table.search().where(f"document_id = '{document_id}'").limit(10_000).to_list()
        return [dict(row) for row in rows]

    def search_project_chunks(
        self, project_id: str, vector: list[float], limit: int = 6
    ) -> list[dict[str, Any]]:
        table = self._open_table()
        rows = table.search(vector).where(f"project_id = '{project_id}'").limit(limit).to_list()
        return [dict(row) for row in rows]
