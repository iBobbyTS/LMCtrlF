import type {
  CreateProjectRequest,
  DocumentRecord,
  HealthResponse,
  ImportDocumentsRequest,
  ModelSettingsResponse,
  ProjectRecord
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
