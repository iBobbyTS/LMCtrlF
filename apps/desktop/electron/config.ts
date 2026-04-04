import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultRendererEntry = path.resolve(__dirname, "../static/index.html");
const defaultPreloadEntry = path.resolve(__dirname, "./preload.cjs");
const defaultBackendHost = "127.0.0.1";
const defaultBackendPort = 8000;
const defaultBackendWorkingDirectory = path.resolve(__dirname, "../../../services/backend");

export const resolveRendererEntry = (rendererUrl?: string): string => {
  return rendererUrl && rendererUrl.length > 0 ? rendererUrl : defaultRendererEntry;
};

export const resolvePreloadEntry = (): string => {
  return defaultPreloadEntry;
};

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

export const getBackendLaunchCommand = (port = defaultBackendPort) => {
  return {
    command: "conda",
    args: ["run", "-n", "lmctrlf-dev", "python", "-m", "app.main"],
    cwd: defaultBackendWorkingDirectory,
    env: {
      LMCTRLF_BACKEND_HOST: defaultBackendHost,
      LMCTRLF_BACKEND_PORT: String(port)
    }
  };
};
