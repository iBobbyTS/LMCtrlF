export interface HealthResponse {
  status: "ok";
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export const CONNECTION_STATUSES = ["idle", "loading", "success", "fail"] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const isConnectionStatus = (value: unknown): value is ConnectionStatus => {
  return typeof value === "string" && CONNECTION_STATUSES.includes(value as ConnectionStatus);
};

export const DOCUMENT_STATUSES = ["queued", "indexing", "paused", "ready", "file_changed"] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const isDocumentStatus = (value: unknown): value is DocumentStatus => {
  return typeof value === "string" && DOCUMENT_STATUSES.includes(value as DocumentStatus);
};

export interface ProjectRecord {
  id: string;
  name: string;
  accent: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  projectId: string;
  name: string;
  filePath: string;
  md5: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  accent: string;
}

export interface ImportDocumentItem {
  name: string;
  filePath: string;
}

export interface ImportDocumentsRequest {
  items: ImportDocumentItem[];
}
