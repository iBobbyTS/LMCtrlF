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
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export const CHAT_SENDER_TYPES = ["user", "assistant"] as const;

export type ChatSenderType = (typeof CHAT_SENDER_TYPES)[number];

export const isChatSenderType = (value: unknown): value is ChatSenderType => {
  return typeof value === "string" && CHAT_SENDER_TYPES.includes(value as ChatSenderType);
};

export interface ChatThreadRecord {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id: string;
  threadId: string;
  senderType: ChatSenderType;
  role: string;
  content: string;
  reasoningContent: string;
  createdAt: string;
}

export type ProviderId = "lm-studio" | "openai" | "anthropic";

export interface ProviderSettingsRecord {
  id: ProviderId;
  name: string;
  baseUrl: string;
  embeddingModel: string;
  chattingModel: string;
  apiKey: string;
}

export interface ModelSettingsResponse {
  selectedProviderId: ProviderId;
  providers: ProviderSettingsRecord[];
}

export interface UpdateModelSettingsRequest {
  selectedProviderId: ProviderId;
  providers: ProviderSettingsRecord[];
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

export interface CreateChatThreadRequest {}

export interface SendChatMessageRequest {
  content: string;
}

export type ChatStreamEvent =
  | {
      type: "reasoning.delta";
      content: string;
    }
  | {
      type: "reasoning.end";
    }
  | {
      type: "message.delta";
      content: string;
    }
  | {
      type: "message.end";
    }
  | {
      type: "completed";
      thread: ChatThreadRecord;
      userMessage: ChatMessageRecord;
      assistantMessage: ChatMessageRecord;
    }
  | {
      type: "error";
      message: string;
    };
