from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Iterator

import httpx


CHAT_SYSTEM_PROMPT = (
    "You are the assistant inside LMCtrlF. This app does not yet have document retrieval or search. "
    "Do not claim that you have read project files or indexed documents unless the user pasted the text "
    "directly into the conversation. If a question depends on project documents, say that document retrieval "
    "has not been implemented yet."
)
TITLE_SYSTEM_PROMPT = (
    "Generate a short thread title in 2 to 6 words. Return only the title text without quotes or punctuation "
    "unless it is necessary."
)
LM_STUDIO_PLACEHOLDER_KEY = "lm-studio"


@dataclass
class LMStudioChatRequestError(Exception):
    status_code: int
    message: str
    payload: Any


def derive_chat_endpoint(base_url: str) -> str:
    normalized = base_url.rstrip("/")
    if normalized.endswith("/v1"):
        normalized = normalized[: -len("/v1")]
    return f"{normalized}/api/v1/chat"


def build_authorization_headers(api_key: str) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if api_key and api_key != LM_STUDIO_PLACEHOLDER_KEY:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def extract_message_text(output: list[dict[str, Any]]) -> str:
    parts = [str(item.get("content", "")) for item in output if item.get("type") == "message"]
    return "".join(parts).strip()


def extract_reasoning_text(output: list[dict[str, Any]]) -> str:
    parts = [str(item.get("content", "")) for item in output if item.get("type") == "reasoning"]
    return "".join(parts).strip()


def sanitize_title(text: str) -> str:
    cleaned = text.strip().strip("\"'`")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:80].strip()


class LMStudioChatClient:
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
    ) -> Iterator[tuple[str, dict[str, Any]]]:
        payload: dict[str, Any] = {
            "model": model,
            "input": input_text,
            "stream": True,
            "store": store,
            "reasoning": reasoning,
            "system_prompt": system_prompt,
        }
        if previous_response_id:
            payload["previous_response_id"] = previous_response_id

        with httpx.Client(timeout=120.0) as client:
            with client.stream(
                "POST",
                derive_chat_endpoint(base_url),
                json=payload,
                headers=build_authorization_headers(api_key),
            ) as response:
                if response.status_code >= 400:
                    raise self._build_request_error(response)

                current_event = ""
                current_data_lines: list[str] = []

                for line in response.iter_lines():
                    if line == "":
                        parsed = self._flush_event(current_event, current_data_lines)
                        current_event = ""
                        current_data_lines = []
                        if parsed is not None:
                            yield parsed
                        continue

                    if line.startswith("event:"):
                        current_event = line.removeprefix("event:").strip()
                        continue

                    if line.startswith("data:"):
                        current_data_lines.append(line.removeprefix("data:").strip())

                parsed = self._flush_event(current_event, current_data_lines)
                if parsed is not None:
                    yield parsed

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
    ) -> dict[str, Any]:
        payload = {
            "model": model,
            "input": input_text,
            "stream": False,
            "store": store,
            "reasoning": reasoning,
            "system_prompt": system_prompt,
        }
        response = httpx.post(
            derive_chat_endpoint(base_url),
            json=payload,
            headers=build_authorization_headers(api_key),
            timeout=120.0,
        )
        if response.status_code >= 400:
            raise self._build_request_error(response)
        return response.json()

    def _flush_event(
        self, current_event: str, current_data_lines: list[str]
    ) -> tuple[str, dict[str, Any]] | None:
        if not current_event or not current_data_lines:
            return None

        data = "\n".join(current_data_lines)
        payload = json.loads(data)
        return current_event, payload

    def _build_request_error(self, response: httpx.Response) -> LMStudioChatRequestError:
        try:
            payload = response.json()
        except ValueError:
            payload = response.text

        message = f"LM Studio request failed with status {response.status_code}."
        if isinstance(payload, dict):
            error = payload.get("error")
            if isinstance(error, dict):
                message = str(error.get("message") or message)
            elif payload.get("message"):
                message = str(payload["message"])
        elif isinstance(payload, str) and payload.strip():
            message = payload.strip()

        return LMStudioChatRequestError(
            status_code=response.status_code,
            message=message,
            payload=payload,
        )


def is_invalid_previous_response_error(error: LMStudioChatRequestError) -> bool:
    if not isinstance(error.payload, dict):
        return False

    payload_error = error.payload.get("error")
    if not isinstance(payload_error, dict):
        return False

    return (
        payload_error.get("param") == "previous_response_id"
        or str(payload_error.get("message", "")).find("previous_response_id") >= 0
    )
