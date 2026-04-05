import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultRendererEntry = path.resolve(__dirname, "../static/index.html");
const defaultPreloadEntry = path.resolve(__dirname, "./preload.cjs");
const defaultBackendBaseUrl = "http://127.0.0.1:8000";
const defaultBackendWorkingDirectory = path.resolve(__dirname, "../../../services/backend");

export const resolveRendererEntry = (rendererUrl?: string): string => {
  return rendererUrl && rendererUrl.length > 0 ? rendererUrl : defaultRendererEntry;
};

export const resolvePreloadEntry = (): string => {
  return defaultPreloadEntry;
};

export const resolveBackendBaseUrl = (backendUrl?: string): string => {
  return backendUrl && backendUrl.length > 0 ? backendUrl : defaultBackendBaseUrl;
};

export const getBackendLaunchCommand = () => {
  return {
    command: "conda",
    args: ["run", "-n", "lmctrlf-dev", "python", "-m", "app.main"],
    cwd: defaultBackendWorkingDirectory
  };
};
