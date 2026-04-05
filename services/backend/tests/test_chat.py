from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.lmstudio_chat import LMStudioChatRequestError
from app.models import Document


def create_project(client: TestClient, name: str = "Field Notes", accent: str = "#c2410c") -> dict[str, str]:
    response = client.post("/projects", json={"name": name, "accent": accent})
    assert response.status_code == 201
    return response.json()


def update_lmstudio_chat_model(client: TestClient, chatting_model: str) -> None:
    response = client.put(
        "/settings/model",
        json={
            "selectedProviderId": "lm-studio",
            "providers": [
                {
                    "id": "lm-studio",
                    "name": "LM Studio",
                    "baseUrl": "http://127.0.0.1:1234/v1",
                    "embeddingModel": "text-embedding-embeddinggemma-300m",
                    "chattingModel": chatting_model,
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
                {
                    "id": "anthropic",
                    "name": "Anthropic",
                    "baseUrl": "https://api.anthropic.com",
                    "embeddingModel": "text-embedding-embeddinggemma-300m",
                    "chattingModel": "claude-sonnet-4-5",
                    "apiKey": "sk-ant-test",
                },
            ],
        },
    )
    assert response.status_code == 200


def parse_sse_events(payload: str) -> list[tuple[str, dict[str, object]]]:
    events: list[tuple[str, dict[str, object]]] = []
    for chunk in payload.split("\n\n"):
        lines = [line for line in chunk.splitlines() if line.strip()]
        if not lines:
            continue
        event_name = next((line.removeprefix("event: ").strip() for line in lines if line.startswith("event:")), "")
        data_line = next((line.removeprefix("data: ").strip() for line in lines if line.startswith("data:")), "")
        if not event_name or not data_line:
            continue
        events.append((event_name, json.loads(data_line)))
    return events


class FakeChatClient:
    def __init__(self) -> None:
        self.stream_calls: list[dict[str, object]] = []
        self.complete_calls: list[dict[str, object]] = []
        self.stream_sequences: list[list[tuple[str, dict[str, object]]]] = []
        self.complete_responses: list[dict[str, object]] = []
        self.invalid_previous_response_once = False

    def stream_chat(
        self,
        *,
        base_url: str,
        model: str,
        api_key: str,
        input_text: str,
        system_prompt: str,
        reasoning: str,
        store: bool,
        previous_response_id: str | None = None,
    ):
        self.stream_calls.append(
            {
                "base_url": base_url,
                "model": model,
                "api_key": api_key,
                "input_text": input_text,
                "system_prompt": system_prompt,
                "reasoning": reasoning,
                "store": store,
                "previous_response_id": previous_response_id,
            }
        )
        if previous_response_id and self.invalid_previous_response_once:
            self.invalid_previous_response_once = False
            raise LMStudioChatRequestError(
                status_code=400,
                message="Could not find stored response for previous_response_id.",
                payload={
                    "error": {
                        "message": "Could not find stored response for previous_response_id.",
                        "param": "previous_response_id",
                        "code": "invalid_value",
                    }
                },
            )

        sequence = self.stream_sequences.pop(0)
        for item in sequence:
            yield item

    def complete_chat(
        self,
        *,
        base_url: str,
        model: str,
        api_key: str,
        input_text: str,
        system_prompt: str,
        reasoning: str,
        store: bool,
    ) -> dict[str, object]:
        self.complete_calls.append(
            {
                "base_url": base_url,
                "model": model,
                "api_key": api_key,
                "input_text": input_text,
                "system_prompt": system_prompt,
                "reasoning": reasoning,
                "store": store,
            }
        )
        response = self.complete_responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def test_threads_and_messages_are_persisted_with_generated_title(client: TestClient) -> None:
    project = create_project(client)
    update_lmstudio_chat_model(client, "google/gemma-4-26b-a4b")
    fake_chat_client = FakeChatClient()
    fake_chat_client.stream_sequences = [
        [
            ("reasoning.delta", {"type": "reasoning.delta", "content": "Planning the answer."}),
            ("reasoning.end", {"type": "reasoning.end"}),
            ("message.delta", {"type": "message.delta", "content": "Ready to help with launch notes."}),
            ("message.end", {"type": "message.end"}),
            (
                "chat.end",
                {
                    "type": "chat.end",
                    "result": {
                        "output": [
                            {"type": "reasoning", "content": "Planning the answer."},
                            {"type": "message", "content": "Ready to help with launch notes."},
                        ],
                        "response_id": "resp-first",
                    },
                },
            ),
        ]
    ]
    fake_chat_client.complete_responses = [
        {
            "output": [{"type": "message", "content": "Launch Notes"}],
        }
    ]
    client.app.state.chat_client = fake_chat_client

    thread_response = client.post(f"/projects/{project['id']}/threads", json={})
    assert thread_response.status_code == 201
    thread = thread_response.json()

    stream_response = client.post(
        f"/projects/{project['id']}/threads/{thread['id']}/messages/stream",
        json={"content": "Summarize the next steps."},
    )

    assert stream_response.status_code == 200
    events = parse_sse_events(stream_response.text)
    assert [event[0] for event in events] == [
        "reasoning.delta",
        "reasoning.end",
        "message.delta",
        "message.end",
        "completed",
    ]

    messages_response = client.get(f"/projects/{project['id']}/threads/{thread['id']}/messages")
    assert messages_response.status_code == 200
    messages = messages_response.json()
    assert len(messages) == 2
    assert messages[0]["role"] == "User"
    assert messages[1]["role"] == "google/gemma-4-26b-a4b"
    assert messages[1]["reasoningContent"] == "Planning the answer."
    assert messages[1]["citations"] == []

    threads_response = client.get(f"/projects/{project['id']}/threads")
    assert threads_response.status_code == 200
    assert threads_response.json()[0]["title"] == "Launch Notes"
    assert threads_response.json()[0]["summary"] == "Ready to help with launch notes."


def test_second_turn_uses_previous_response_id(client: TestClient) -> None:
    project = create_project(client)
    update_lmstudio_chat_model(client, "google/gemma-4-26b-a4b")
    fake_chat_client = FakeChatClient()
    fake_chat_client.stream_sequences = [
        [
            (
                "chat.end",
                {
                    "type": "chat.end",
                    "result": {
                        "output": [{"type": "message", "content": "First reply."}],
                        "response_id": "resp-first",
                    },
                },
            )
        ],
        [
            (
                "chat.end",
                {
                    "type": "chat.end",
                    "result": {
                        "output": [{"type": "message", "content": "Second reply."}],
                        "response_id": "resp-second",
                    },
                },
            )
        ],
    ]
    fake_chat_client.complete_responses = [
        {"output": [{"type": "message", "content": "First title"}]},
    ]
    client.app.state.chat_client = fake_chat_client

    thread = client.post(f"/projects/{project['id']}/threads", json={}).json()
    first_response = client.post(
        f"/projects/{project['id']}/threads/{thread['id']}/messages/stream",
        json={"content": "First prompt"},
    )
    second_response = client.post(
        f"/projects/{project['id']}/threads/{thread['id']}/messages/stream",
        json={"content": "Second prompt"},
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert fake_chat_client.stream_calls[1]["previous_response_id"] == "resp-first"
    assert fake_chat_client.stream_calls[1]["input_text"] == "Second prompt"


def test_invalid_previous_response_id_falls_back_to_transcript(client: TestClient) -> None:
    project = create_project(client)
    update_lmstudio_chat_model(client, "google/gemma-4-26b-a4b")
    fake_chat_client = FakeChatClient()
    fake_chat_client.stream_sequences = [
        [
            (
                "chat.end",
                {
                    "type": "chat.end",
                    "result": {
                        "output": [{"type": "message", "content": "First assistant reply."}],
                        "response_id": "resp-first",
                    },
                },
            )
        ],
        [
            (
                "chat.end",
                {
                    "type": "chat.end",
                    "result": {
                        "output": [{"type": "message", "content": "Recovered reply."}],
                        "response_id": "resp-recovered",
                    },
                },
            )
        ],
    ]
    fake_chat_client.complete_responses = [
        {"output": [{"type": "message", "content": "Recovered title"}]},
    ]
    fake_chat_client.invalid_previous_response_once = True
    client.app.state.chat_client = fake_chat_client

    thread = client.post(f"/projects/{project['id']}/threads", json={}).json()
    client.post(
        f"/projects/{project['id']}/threads/{thread['id']}/messages/stream",
        json={"content": "First prompt"},
    )
    fallback_response = client.post(
        f"/projects/{project['id']}/threads/{thread['id']}/messages/stream",
        json={"content": "What did I ask before?"},
    )

    assert fallback_response.status_code == 200
    assert len(fake_chat_client.stream_calls) == 3
    assert fake_chat_client.stream_calls[1]["previous_response_id"] == "resp-first"
    assert fake_chat_client.stream_calls[2]["previous_response_id"] is None
    assert "Conversation so far:" in str(fake_chat_client.stream_calls[2]["input_text"])
    assert "User: First prompt" in str(fake_chat_client.stream_calls[2]["input_text"])
    assert "google/gemma-4-26b-a4b: First assistant reply." in str(
        fake_chat_client.stream_calls[2]["input_text"]
    )
    assert "Latest user message:\nWhat did I ask before?" in str(
        fake_chat_client.stream_calls[2]["input_text"]
    )


def test_chat_uses_retrieved_chunks_and_persists_citations(client: TestClient) -> None:
    project = create_project(client)
    update_lmstudio_chat_model(client, "google/gemma-4-26b-a4b")
    document = Document.create(
        id="document-1",
        project_id=project["id"],
        name="launch-overview.pdf",
        file_path="/tmp/launch-overview.pdf",
        md5="md5-1",
        status="ready",
        progress=100,
    )
    client.app.state.lancedb_store.replace_document_chunks(
        [
            {
                "id": "chunk-1",
                "project_id": project["id"],
                "document_id": document.id,
                "document_md5": "md5-1",
                "page_number": 2,
                "chunk_index": 1,
                "text": "Budget approval is still pending before launch.",
                "vector": [1.0] * 768,
                "char_count": 47,
                "created_at": "2026-04-03T12:00:00Z",
            }
        ]
    )

    fake_chat_client = FakeChatClient()
    fake_chat_client.stream_sequences = [
        [
            (
                "chat.end",
                {
                    "type": "chat.end",
                    "result": {
                        "output": [{"type": "message", "content": "The blocker is still budget approval."}],
                        "response_id": "resp-first",
                    },
                },
            )
        ]
    ]
    fake_chat_client.complete_responses = [{"output": [{"type": "message", "content": "Budget status"}]}]
    client.app.state.chat_client = fake_chat_client

    thread = client.post(f"/projects/{project['id']}/threads", json={}).json()
    stream_response = client.post(
        f"/projects/{project['id']}/threads/{thread['id']}/messages/stream",
        json={"content": "What is blocked right now?"},
    )

    assert stream_response.status_code == 200
    assert "Retrieved context:" in str(fake_chat_client.stream_calls[0]["input_text"])
    assert "launch-overview.pdf (page 2, chunk 1)" in str(fake_chat_client.stream_calls[0]["input_text"])
    assert "Budget approval is still pending before launch." in str(
        fake_chat_client.stream_calls[0]["input_text"]
    )

    messages_response = client.get(f"/projects/{project['id']}/threads/{thread['id']}/messages")
    messages = messages_response.json()
    assert messages[1]["citations"] == [
        {
            "documentId": "document-1",
            "documentName": "launch-overview.pdf",
            "pageNumber": 2,
            "chunkIndex": 1,
            "snippet": "Budget approval is still pending before launch.",
            "score": 0.0,
        }
    ]


def test_non_lm_studio_provider_returns_not_implemented(client: TestClient) -> None:
    project = create_project(client)
    response = client.put(
        "/settings/model",
        json={
            "selectedProviderId": "openai",
            "providers": [
                {
                    "id": "lm-studio",
                    "name": "LM Studio",
                    "baseUrl": "http://127.0.0.1:1234/v1",
                    "embeddingModel": "text-embedding-embeddinggemma-300m",
                    "chattingModel": "google/gemma-4-26b-a4b",
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
    assert response.status_code == 200

    thread = client.post(f"/projects/{project['id']}/threads", json={}).json()
    chat_response = client.post(
        f"/projects/{project['id']}/threads/{thread['id']}/messages/stream",
        json={"content": "Hello"},
    )

    assert chat_response.status_code == 501
    assert "not implemented yet" in chat_response.json()["detail"]


def test_title_generation_failure_keeps_provisional_thread_title(client: TestClient) -> None:
    project = create_project(client)
    update_lmstudio_chat_model(client, "google/gemma-4-26b-a4b")
    fake_chat_client = FakeChatClient()
    fake_chat_client.stream_sequences = [
        [
            (
                "chat.end",
                {
                    "type": "chat.end",
                    "result": {
                        "output": [{"type": "message", "content": "Assistant reply."}],
                        "response_id": "resp-first",
                    },
                },
            )
        ]
    ]
    fake_chat_client.complete_responses = [
        LMStudioChatRequestError(
            status_code=500,
            message="Title generation failed.",
            payload={"error": {"message": "Title generation failed."}},
        )
    ]
    client.app.state.chat_client = fake_chat_client

    thread = client.post(f"/projects/{project['id']}/threads", json={}).json()
    response = client.post(
        f"/projects/{project['id']}/threads/{thread['id']}/messages/stream",
        json={"content": "Hello"},
    )

    assert response.status_code == 200
    threads_response = client.get(f"/projects/{project['id']}/threads")
    assert threads_response.status_code == 200
    assert threads_response.json()[0]["title"] == "New thread 1"
