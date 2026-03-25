export const getBackendBaseUrl = (): string => {
  return window.lmctrlf?.getBackendBaseUrl() ?? "http://127.0.0.1:8000";
};
