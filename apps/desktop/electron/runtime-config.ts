const defaultBackendHost = "127.0.0.1";
const defaultBackendPort = 8000;

export const buildBackendBaseUrl = (host = defaultBackendHost, port = defaultBackendPort): string => {
  return `http://${host}:${port}`;
};

export const resolveBackendBaseUrl = (backendUrl?: string): string => {
  return backendUrl && backendUrl.length > 0
    ? backendUrl
    : buildBackendBaseUrl(defaultBackendHost, defaultBackendPort);
};

export const resolveBackendHost = (backendUrl?: string): string => {
  if (!backendUrl || backendUrl.length === 0) {
    return defaultBackendHost;
  }

  return new URL(backendUrl).hostname;
};

export const resolveBackendPort = (backendUrl?: string): number => {
  if (!backendUrl || backendUrl.length === 0) {
    return defaultBackendPort;
  }

  const parsed = new URL(backendUrl);

  if (parsed.port.length > 0) {
    return Number(parsed.port);
  }

  return parsed.protocol === "https:" ? 443 : 80;
};

export const resolveRuntimeBackendBaseUrl = (
  runtimeArguments: string[] = process.argv,
  backendUrl = process.env.LMCTRLF_BACKEND_URL
): string => {
  const runtimeArgument = runtimeArguments.find((value) => value.startsWith("--backend-base-url="));

  return runtimeArgument
    ? runtimeArgument.replace("--backend-base-url=", "")
    : resolveBackendBaseUrl(backendUrl);
};
