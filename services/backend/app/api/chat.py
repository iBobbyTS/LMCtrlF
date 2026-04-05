from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Iterable
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.lmstudio_chat import (
    CHAT_SYSTEM_PROMPT,
    TITLE_SYSTEM_PROMPT,
    LMStudioChatClient,
    LMStudioChatRequestError,
    extract_message_text,
    extract_reasoning_text,
    is_invalid_previous_response_error,
    sanitize_title,
)
from app.model_settings import load_model_settings_payload
from app.models import ChatMessage, ChatThread, Project


logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])
SENDER_TYPES = {"user", "assistant"}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def serialize_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def serialize_thread(thread: ChatThread) -> dict[str, str]:
    return {
        "id": thread.id,
        "projectId": thread.project_id,
        "title": thread.title,
        "summary": thread.summary,
        "createdAt": serialize_timestamp(thread.created_at),
        "updatedAt": serialize_timestamp(thread.updated_at),
    }


def serialize_message(message: ChatMessage) -> dict[str, str]:
    return {
        "id": message.id,
        "threadId": message.thread_id,
        "senderType": message.sender_type,
        "role": message.role,
        "content": message.content,
        "reasoningContent": message.reasoning_content,
        "createdAt": serialize_timestamp(message.created_at),
    }


def get_project_or_404(project_id: str) -> Project:
    project = Project.get_or_none(Project.id == project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    return project


def get_thread_or_404(project_id: str, thread_id: str) -> ChatThread:
    thread = ChatThread.get_or_none((ChatThread.id == thread_id) & (ChatThread.project_id == project_id))
    if thread is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found.")
    return thread


def list_thread_messages(thread_id: str) -> list[ChatMessage]:
    query = (
        ChatMessage.select()
        .where(ChatMessage.thread_id == thread_id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
    )
    return list(query)


def build_summary(content: str) -> str:
    normalized = re.sub(r"\s+", " ", content).strip()
    return normalized[:100]


def build_transcript(thread: ChatThread, latest_user_message: ChatMessage) -> str:
    messages = list_thread_messages(thread.id)
    history_lines = [
        f"{message.role}: {message.content}"
        for message in messages
        if message.id != latest_user_message.id and message.content.strip()
    ]
    history_text = "\n".join(history_lines)
    if not history_text:
        history_text = "(empty)"
    return f"Conversation so far:\n{history_text}\n\nLatest user message:\n{latest_user_message.content}"


def get_selected_provider() -> dict[str, str]:
    payload = load_model_settings_payload()
    selected_provider_id = str(payload["selectedProviderId"])
    provider = next(
        (
            item
            for item in payload["providers"]
            if isinstance(item, dict) and str(item.get("id")) == selected_provider_id
        ),
        None,
    )
    if provider is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The selected model provider could not be found.",
        )
    return {
        "id": str(provider["id"]),
        "name": str(provider["name"]),
        "baseUrl": str(provider["baseUrl"]),
        "embeddingModel": str(provider["embeddingModel"]),
        "chattingModel": str(provider["chattingModel"]),
        "apiKey": str(provider["apiKey"]),
    }


def ensure_lmstudio_provider() -> dict[str, str]:
    provider = get_selected_provider()
    if provider["id"] != "lm-studio":
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=f"{provider['name']} chat is not implemented yet.",
        )
    return provider


def create_sse_event(event_name: str, payload: dict[str, Any]) -> bytes:
    return f"event: {event_name}\ndata: {json.dumps(payload)}\n\n".encode()


def extract_output_text(result: dict[str, Any]) -> tuple[str, str, str | None]:
    output = result.get("output")
    if not isinstance(output, list):
        return "", "", None
    return (
        extract_reasoning_text(output),
        extract_message_text(output),
        result.get("response_id") if isinstance(result.get("response_id"), str) else None,
    )


def maybe_generate_thread_title(
    chat_client: LMStudioChatClient,
    provider: dict[str, str],
    thread: ChatThread,
    latest_assistant_content: str,
) -> None:
    first_user_message = (
        ChatMessage.select()
        .where((ChatMessage.thread_id == thread.id) & (ChatMessage.sender_type == "user"))
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        .first()
    )
    if first_user_message is None:
        return

    title_input = (
        "Write a short chat thread title for this exchange.\n\n"
        f"User: {first_user_message.content}\n"
        f"Assistant: {latest_assistant_content}"
    )
    try:
        result = chat_client.complete_chat(
            base_url=provider["baseUrl"],
            model=provider["chattingModel"],
            api_key=provider["apiKey"],
            input_text=title_input,
            system_prompt=TITLE_SYSTEM_PROMPT,
            reasoning="off",
            store=False,
        )
    except LMStudioChatRequestError:
        logger.warning("Failed to generate a title for thread %s.", thread.id, exc_info=True)
        return

    output = result.get("output")
    if not isinstance(output, list):
        return
    generated_title = sanitize_title(extract_message_text(output))
    if not generated_title:
        return
    thread.title = generated_title


def iter_chat_events(
    *,
    chat_client: LMStudioChatClient,
    provider: dict[str, str],
    thread: ChatThread,
    latest_user_message: ChatMessage,
) -> Iterable[tuple[str, dict[str, Any]]]:
    previous_response_id = thread.lmstudio_last_response_id
    if previous_response_id:
        try:
            yield from chat_client.stream_chat(
                base_url=provider["baseUrl"],
                model=provider["chattingModel"],
                api_key=provider["apiKey"],
                input_text=latest_user_message.content,
                system_prompt=CHAT_SYSTEM_PROMPT,
                reasoning="on",
                store=True,
                previous_response_id=previous_response_id,
            )
            return
        except LMStudioChatRequestError as error:
            if not is_invalid_previous_response_error(error):
                raise

    history_before_current_turn = (
        ChatMessage.select()
        .where((ChatMessage.thread_id == thread.id) & (ChatMessage.id != latest_user_message.id))
        .exists()
    )
    input_text = latest_user_message.content
    if history_before_current_turn:
        input_text = build_transcript(thread, latest_user_message)

    yield from chat_client.stream_chat(
        base_url=provider["baseUrl"],
        model=provider["chattingModel"],
        api_key=provider["apiKey"],
        input_text=input_text,
        system_prompt=CHAT_SYSTEM_PROMPT,
        reasoning="on",
        store=True,
        previous_response_id=None,
    )


class SendChatMessageRequest(BaseModel):
    content: str = Field(min_length=1)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Message content cannot be empty.")
        return stripped


@router.get("/projects/{project_id}/threads")
def list_threads(project_id: str) -> list[dict[str, str]]:
    get_project_or_404(project_id)
    query = (
        ChatThread.select()
        .where(ChatThread.project_id == project_id)
        .order_by(ChatThread.updated_at.desc(), ChatThread.created_at.desc(), ChatThread.id.desc())
    )
    return [serialize_thread(thread) for thread in query]


@router.post("/projects/{project_id}/threads", status_code=status.HTTP_201_CREATED)
def create_thread(project_id: str) -> dict[str, str]:
    project = get_project_or_404(project_id)
    timestamp = utc_now()
    next_count = ChatThread.select().where(ChatThread.project_id == project_id).count() + 1
    thread = ChatThread.create(
        id=f"thread-{uuid4().hex}",
        project=project,
        title=f"New thread {next_count}",
        summary="",
        lmstudio_last_response_id=None,
        created_at=timestamp,
        updated_at=timestamp,
    )
    project.updated_at = timestamp
    project.save()
    return serialize_thread(thread)


@router.get("/projects/{project_id}/threads/{thread_id}/messages")
def get_thread_messages(project_id: str, thread_id: str) -> list[dict[str, str]]:
    get_thread_or_404(project_id, thread_id)
    return [serialize_message(message) for message in list_thread_messages(thread_id)]


@router.post("/projects/{project_id}/threads/{thread_id}/messages/stream")
def stream_thread_message(
    project_id: str,
    thread_id: str,
    payload: SendChatMessageRequest,
    request: Request,
) -> StreamingResponse:
    project = get_project_or_404(project_id)
    thread = get_thread_or_404(project_id, thread_id)
    provider = ensure_lmstudio_provider()
    timestamp = utc_now()
    user_message = ChatMessage.create(
        id=f"message-{uuid4().hex}",
        thread=thread,
        sender_type="user",
        role="User",
        content=payload.content,
        reasoning_content="",
        created_at=timestamp,
    )
    existing_assistant_count = (
        ChatMessage.select()
        .where((ChatMessage.thread_id == thread.id) & (ChatMessage.sender_type == "assistant"))
        .count()
    )
    thread.updated_at = timestamp
    thread.save()
    project.updated_at = timestamp
    project.save()
    chat_client: LMStudioChatClient = request.app.state.chat_client

    def event_stream() -> Iterable[bytes]:
        reasoning_parts: list[str] = []
        message_parts: list[str] = []

        try:
            for event_name, event_payload in iter_chat_events(
                chat_client=chat_client,
                provider=provider,
                thread=thread,
                latest_user_message=user_message,
            ):
                if event_name == "reasoning.delta":
                    content = str(event_payload.get("content", ""))
                    if content:
                        reasoning_parts.append(content)
                        yield create_sse_event("reasoning.delta", {"type": "reasoning.delta", "content": content})
                    continue

                if event_name == "reasoning.end":
                    yield create_sse_event("reasoning.end", {"type": "reasoning.end"})
                    continue

                if event_name == "message.delta":
                    content = str(event_payload.get("content", ""))
                    if content:
                        message_parts.append(content)
                        yield create_sse_event("message.delta", {"type": "message.delta", "content": content})
                    continue

                if event_name == "message.end":
                    yield create_sse_event("message.end", {"type": "message.end"})
                    continue

                if event_name != "chat.end":
                    continue

                result = event_payload.get("result")
                if not isinstance(result, dict):
                    raise RuntimeError("LM Studio returned an invalid chat.end payload.")

                reasoning_text, message_text, response_id = extract_output_text(result)
                assistant_content = message_text or "".join(message_parts).strip()
                assistant_reasoning = reasoning_text or "".join(reasoning_parts).strip()
                if not assistant_content:
                    raise RuntimeError("LM Studio returned an empty assistant response.")

                assistant_timestamp = utc_now()
                assistant_message = ChatMessage.create(
                    id=f"message-{uuid4().hex}",
                    thread=thread,
                    sender_type="assistant",
                    role=provider["chattingModel"],
                    content=assistant_content,
                    reasoning_content=assistant_reasoning,
                    created_at=assistant_timestamp,
                )
                thread.summary = build_summary(assistant_content)
                thread.updated_at = assistant_timestamp
                if response_id:
                    thread.lmstudio_last_response_id = response_id
                if existing_assistant_count == 0:
                    maybe_generate_thread_title(
                        chat_client=chat_client,
                        provider=provider,
                        thread=thread,
                        latest_assistant_content=assistant_content,
                    )
                thread.save()
                project.updated_at = assistant_timestamp
                project.save()

                yield create_sse_event(
                    "completed",
                    {
                        "type": "completed",
                        "thread": serialize_thread(thread),
                        "userMessage": serialize_message(user_message),
                        "assistantMessage": serialize_message(assistant_message),
                    },
                )
                return

            raise RuntimeError("LM Studio stream ended without a completed response.")
        except LMStudioChatRequestError as error:
            logger.warning("LM Studio chat request failed for thread %s.", thread.id, exc_info=True)
            yield create_sse_event("error", {"type": "error", "message": error.message})
        except Exception as error:  # pragma: no cover - defensive runtime guard
            logger.exception("Failed to stream a chat response for thread %s.", thread.id)
            yield create_sse_event("error", {"type": "error", "message": str(error)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )
