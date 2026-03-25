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
