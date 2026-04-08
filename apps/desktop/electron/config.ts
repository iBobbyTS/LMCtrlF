import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildBackendBaseUrl,
  resolveBackendBaseUrl,
  resolveBackendHost,
  resolveBackendPort
} from "./runtime-config";

export {
  buildBackendBaseUrl,
  resolveBackendBaseUrl,
  resolveBackendHost,
  resolveBackendPort,
  resolveRuntimeBackendBaseUrl
} from "./runtime-config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultBackendHost = "127.0.0.1";
const defaultBackendPort = 8000;
const defaultBackendWorkingDirectory = path.resolve(__dirname, "../../../services/backend");

type BackendLaunchOptions = {
  packaged?: boolean;
  platform?: NodeJS.Platform;
  port?: number;
  resourcesPath?: string;
  userDataPath?: string;
};

const isBuiltRuntimeDirectory = (runtimeDirectory: string): boolean => {
  return (
    path.basename(runtimeDirectory) === "electron" &&
    path.basename(path.dirname(runtimeDirectory)) === "dist"
  );
};

const getPathModule = (platform: NodeJS.Platform) => {
  return platform === "win32" ? path.win32 : path.posix;
};

const resolveRuntimeRendererEntry = (runtimeDirectory: string): string => {
  if (isBuiltRuntimeDirectory(runtimeDirectory)) {
    return path.resolve(runtimeDirectory, "../renderer/index.html");
  }

  return path.resolve(runtimeDirectory, "../static/index.html");
};

export const resolveRendererEntry = (rendererUrl?: string, runtimeDirectory = __dirname): string => {
  return rendererUrl && rendererUrl.length > 0
    ? rendererUrl
    : resolveRuntimeRendererEntry(runtimeDirectory);
};

export const resolvePreloadEntry = (runtimeDirectory = __dirname): string => {
  return path.resolve(runtimeDirectory, "./preload.cjs");
};

export const resolvePackagedBackendExecutable = (
  resourcesPath: string,
  platform: NodeJS.Platform = process.platform
): string => {
  const executableName = platform === "win32" ? "lmctrlf-backend.exe" : "lmctrlf-backend";
  const platformPath = getPathModule(platform);
  return platformPath.resolve(resourcesPath, "backend", "lmctrlf-backend", executableName);
};

export const resolvePackagedDatabasePath = (
  userDataPath: string,
  platform: NodeJS.Platform = process.platform
): string => {
  return getPathModule(platform).resolve(userDataPath, "backend-data", "lmctrlf.sqlite3");
};

export const resolvePackagedLanceDbPath = (
  userDataPath: string,
  platform: NodeJS.Platform = process.platform
): string => {
  return getPathModule(platform).resolve(userDataPath, "backend-data", "lancedb");
};

export const getBackendLaunchCommand = ({
  packaged = false,
  platform = process.platform,
  port = defaultBackendPort,
  resourcesPath,
  userDataPath
}: BackendLaunchOptions = {}) => {
  if (packaged) {
    if (!resourcesPath || !userDataPath) {
      throw new Error("Packaged backend launches require both resourcesPath and userDataPath.");
    }

    const executablePath = resolvePackagedBackendExecutable(resourcesPath, platform);
    const platformPath = getPathModule(platform);

    return {
      command: executablePath,
      args: [],
      cwd: platformPath.dirname(executablePath),
      env: {
        LMCTRLF_BACKEND_HOST: defaultBackendHost,
        LMCTRLF_BACKEND_PORT: String(port),
        LMCTRLF_DATABASE_PATH: resolvePackagedDatabasePath(userDataPath, platform),
        LMCTRLF_LANCEDB_PATH: resolvePackagedLanceDbPath(userDataPath, platform)
      }
    };
  }

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
