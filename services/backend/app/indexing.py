from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from queue import Queue
from threading import Lock, Thread
from typing import Any
from uuid import uuid4

import httpx
from pypdf import PdfReader

from app.db import database_proxy
from app.lancedb_store import LanceDBStore, utc_now_iso
from app.model_settings import load_model_settings_payload
from app.models import Document, Project


logger = logging.getLogger(__name__)


@dataclass
class ChunkPayload:
    page_number: int
    chunk_index: int
    text: str


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_whitespace(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_long_text(text: str, max_length: int, overlap: int) -> list[str]:
    if len(text) <= max_length:
        return [text]

    pieces: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + max_length)
        if end < len(text):
            breakpoint = text.rfind(" ", start, end)
            if breakpoint > start + max_length // 2:
                end = breakpoint
        piece = text[start:end].strip()
        if piece:
            pieces.append(piece)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return pieces


def chunk_page_text(text: str, target_length: int = 1000, overlap: int = 200) -> list[str]:
    paragraphs = [normalize_whitespace(part) for part in text.split("\n\n")]
    paragraphs = [paragraph for paragraph in paragraphs if paragraph]
    if not paragraphs:
        return []

    chunks: list[str] = []
    current = ""
    for paragraph in paragraphs:
        candidate = paragraph if not current else f"{current}\n\n{paragraph}"
        if len(candidate) <= target_length:
            current = candidate
            continue

        if current:
            chunks.append(current)
        if len(paragraph) <= target_length:
            current = paragraph
            continue

        sentence_parts = re.split(r"(?<=[.!?])\s+", paragraph)
        sentence_parts = [part.strip() for part in sentence_parts if part.strip()]
        if not sentence_parts:
            sentence_parts = split_long_text(paragraph, target_length, overlap)

        current = ""
        for sentence in sentence_parts:
            sentence_candidate = sentence if not current else f"{current} {sentence}"
            if len(sentence_candidate) <= target_length:
                current = sentence_candidate
                continue

            if current:
                chunks.append(current)
            if len(sentence) <= target_length:
                current = sentence
                continue

            pieces = split_long_text(sentence, target_length, overlap)
            chunks.extend(pieces[:-1])
            current = pieces[-1] if pieces else ""

    if current:
        chunks.append(current)

    return chunks


def extract_pdf_chunks(file_path: Path) -> list[ChunkPayload]:
    reader = PdfReader(str(file_path))
    chunks: list[ChunkPayload] = []
    for page_number, page in enumerate(reader.pages, start=1):
        text = normalize_whitespace(page.extract_text() or "")
        if not text:
            continue

        for chunk_index, chunk_text in enumerate(chunk_page_text(text), start=1):
            chunks.append(
                ChunkPayload(
                    page_number=page_number,
                    chunk_index=chunk_index,
                    text=chunk_text,
                )
            )
    return chunks


def update_document_progress(document: Document, *, status: str | None = None, progress: int | None = None) -> None:
    if status is not None:
        document.status = status
    if progress is not None:
        document.progress = progress
    document.updated_at = utc_now()
    document.save()
    project = document.project
    project.updated_at = document.updated_at
    project.save()


def update_document_progress_if_current(
    document_id: str,
    expected_md5: str,
    *,
    status: str | None = None,
    progress: int | None = None,
) -> Document | None:
    document = Document.get_or_none(Document.id == document_id)
    if document is None or document.md5 != expected_md5:
        return None
    update_document_progress(document, status=status, progress=progress)
    return document


class EmbeddingClient:
    def embed_texts(self, base_url: str, model: str, api_key: str, texts: list[str]) -> list[list[float]]:
        headers = {"Content-Type": "application/json"}
        if api_key and api_key != "lm-studio":
            headers["Authorization"] = f"Bearer {api_key}"

        response = httpx.post(
            f"{base_url.rstrip('/')}/embeddings",
            json={"model": model, "input": texts},
            headers=headers,
            timeout=120.0,
        )
        response.raise_for_status()
        payload = response.json()
        return [item["embedding"] for item in payload["data"]]


class IndexingWorker:
    def __init__(self, lancedb_store: LanceDBStore, embedding_client: EmbeddingClient | None = None):
        self.lancedb_store = lancedb_store
        self.embedding_client = embedding_client or EmbeddingClient()
        self.queue: Queue[str | None] = Queue()
        self.pending: set[str] = set()
        self.pending_lock = Lock()
        self.thread: Thread | None = None

    def start(self) -> None:
        self.lancedb_store.ensure_table()
        self.thread = Thread(target=self._run, name="document-indexing-worker", daemon=True)
        self.thread.start()

    def stop(self) -> None:
        self.queue.put(None)
        if self.thread is not None:
            self.thread.join(timeout=5)

    def enqueue(self, document_id: str) -> None:
        with self.pending_lock:
            if document_id in self.pending:
                return
            self.pending.add(document_id)
        self.queue.put(document_id)

    def _run(self) -> None:
        database_proxy.connect(reuse_if_open=True)
        while True:
            document_id = self.queue.get()
            if document_id is None:
                self.queue.task_done()
                break

            try:
                self.index_document(document_id)
            except Exception:  # pragma: no cover - defensive worker guard
                logger.exception("Unexpected indexing failure for %s", document_id)
                self._mark_paused(document_id)
            finally:
                with self.pending_lock:
                    self.pending.discard(document_id)
                self.queue.task_done()

        database_proxy.close()

    def _mark_paused(self, document_id: str) -> None:
        document = Document.get_or_none(Document.id == document_id)
        if document is None:
            return
        update_document_progress(document, status="paused")

    def index_document(self, document_id: str) -> None:
        document = Document.get_or_none(Document.id == document_id)
        if document is None:
            return

        resolved_path = Path(document.file_path).expanduser().resolve()
        expected_md5 = document.md5
        current_document = update_document_progress_if_current(
            document_id, expected_md5, status="indexing", progress=5
        )
        if current_document is None:
            return
        if not resolved_path.is_file():
            update_document_progress_if_current(document_id, expected_md5, status="paused")
            return

        chunks = extract_pdf_chunks(resolved_path)
        if not chunks:
            update_document_progress_if_current(document_id, expected_md5, status="paused", progress=15)
            return

        if update_document_progress_if_current(document_id, expected_md5, status="indexing", progress=15) is None:
            return
        settings = load_model_settings_payload()
        provider = next(
            (
                item
                for item in settings["providers"]
                if item["id"] == settings["selectedProviderId"]
            ),
            None,
        )
        if provider is None:
            update_document_progress_if_current(document_id, expected_md5, status="paused")
            return

        batch_size = 16
        total_batches = max(1, (len(chunks) + batch_size - 1) // batch_size)
        rows: list[dict[str, Any]] = []

        for batch_index, start in enumerate(range(0, len(chunks), batch_size), start=1):
            batch = chunks[start : start + batch_size]
            embeddings = self.embedding_client.embed_texts(
                str(provider["baseUrl"]),
                str(provider["embeddingModel"]),
                str(provider["apiKey"]),
                [item.text for item in batch],
            )
            for chunk, vector in zip(batch, embeddings, strict=True):
                if len(vector) != 768:
                    raise ValueError(f"Unexpected embedding dimension: {len(vector)}")
                rows.append(
                    {
                        "id": f"chunk-{uuid4().hex}",
                        "project_id": document.project_id,
                        "document_id": document_id,
                        "document_md5": expected_md5,
                        "page_number": chunk.page_number,
                        "chunk_index": chunk.chunk_index,
                        "text": chunk.text,
                        "vector": vector,
                        "char_count": len(chunk.text),
                        "created_at": utc_now_iso(),
                    }
                )
            progress = 20 + int((70 * batch_index) / total_batches)
            if (
                update_document_progress_if_current(
                    document_id, expected_md5, status="indexing", progress=min(progress, 90)
                )
                is None
            ):
                return

        self.lancedb_store.replace_document_chunks(rows)
        if update_document_progress_if_current(document_id, expected_md5, status="indexing", progress=95) is None:
            self.lancedb_store.delete_document_chunks(document_id)
            return
        update_document_progress_if_current(document_id, expected_md5, status="ready", progress=100)
