import type {
  ChatMessageRecord,
  ChatStreamEvent,
  ChatThreadRecord,
  CreateChatThreadRequest,
  CreateProjectRequest,
  DocumentRecord,
  HealthResponse,
  ImportDocumentsRequest,
  ModelSettingsResponse,
  ProjectRecord,
  SendChatMessageRequest
} from "@lmctrlf/shared";

import { getBackendBaseUrl } from "./runtime";

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(`${getBackendBaseUrl()}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers
      }
    });
  } catch {
    throw new Error("Could not connect to the backend.");
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;

    try {
      const payload = (await response.json()) as { detail?: string; message?: string };
      message = payload.detail ?? payload.message ?? message;
    } catch {
      const text = await response.text();
      if (text.trim().length > 0) {
        message = text;
      }
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

export const checkBackendHealth = () => request<HealthResponse>("/health");

export const listProjects = () => request<ProjectRecord[]>("/projects");

export const getModelSettings = () => request<ModelSettingsResponse>("/settings/model");

export const updateModelSettings = (payload: ModelSettingsResponse) =>
  request<ModelSettingsResponse>("/settings/model", {
    method: "PUT",
    body: JSON.stringify(payload)
  });

export const createWorkspaceProject = (payload: CreateProjectRequest) =>
  request<ProjectRecord>("/projects", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const listProjectDocuments = (projectId: string) =>
  request<DocumentRecord[]>(`/projects/${projectId}/documents`);

export const importProjectDocuments = (projectId: string, payload: ImportDocumentsRequest) =>
  request<DocumentRecord[]>(`/projects/${projectId}/documents/import`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const deleteProjectDocument = (projectId: string, documentId: string) =>
  request<void>(`/projects/${projectId}/documents/${documentId}`, {
    method: "DELETE"
  });

export const reindexProjectDocument = (projectId: string, documentId: string) =>
  request<DocumentRecord>(`/projects/${projectId}/documents/${documentId}/reindex`, {
    method: "POST"
  });

export const listProjectThreads = (projectId: string) =>
  request<ChatThreadRecord[]>(`/projects/${projectId}/threads`);

export const createProjectThread = (projectId: string, payload: CreateChatThreadRequest = {}) =>
  request<ChatThreadRecord>(`/projects/${projectId}/threads`, {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const listThreadMessages = (projectId: string, threadId: string) =>
  request<ChatMessageRecord[]>(`/projects/${projectId}/threads/${threadId}/messages`);

const parseSseChunk = (chunk: string): { event: string; data: string } | null => {
  const lines = chunk
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return null;
  }

  let eventName = "";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  if (!eventName || dataLines.length === 0) {
    return null;
  }

  return {
    event: eventName,
    data: dataLines.join("\n")
  };
};

export const streamThreadMessage = async (
  projectId: string,
  threadId: string,
  payload: SendChatMessageRequest,
  onEvent: (event: ChatStreamEvent) => void
) => {
  let response: Response;

  try {
    response = await fetch(`${getBackendBaseUrl()}/projects/${projectId}/threads/${threadId}/messages/stream`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch {
    throw new Error("Could not connect to the backend.");
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;

    try {
      const responseBody = (await response.json()) as { detail?: string; message?: string };
      message = responseBody.detail ?? responseBody.message ?? message;
    } catch {
      const text = await response.text();
      if (text.trim().length > 0) {
        message = text;
      }
    }

    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("The backend returned an empty chat stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const parsedChunk = parseSseChunk(chunk);
      if (!parsedChunk) {
        continue;
      }

      const event = JSON.parse(parsedChunk.data) as ChatStreamEvent;
      onEvent(event);
      if (event.type === "error") {
        throw new Error(event.message);
      }
    }

    if (done) {
      break;
    }
  }
};
