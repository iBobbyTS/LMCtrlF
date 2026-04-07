import { spawn, type ChildProcess } from "node:child_process";

import { app, BrowserWindow } from "electron";

import { findAvailablePort, waitForBackendHealth, waitForManagedBackendHealth } from "./backend";
import {
  buildBackendBaseUrl,
  getBackendLaunchCommand,
  resolveBackendBaseUrl,
  resolveBackendHost,
  resolveBackendPort,
  resolvePreloadEntry,
  resolveRendererEntry
} from "./config";

let backendProcess: ChildProcess | null = null;

const createWindow = async (backendBaseUrl: string): Promise<void> => {
  const preloadEntry = resolvePreloadEntry();
  const rendererEntry = resolveRendererEntry(process.env.LMCTRLF_RENDERER_URL);

  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1280,
    minHeight: 720,
    webPreferences: {
      preload: preloadEntry,
      additionalArguments: [`--backend-base-url=${backendBaseUrl}`]
    }
  });

  if (rendererEntry.startsWith("http://") || rendererEntry.startsWith("https://")) {
    await window.loadURL(rendererEntry);
    return;
  }

  await window.loadFile(rendererEntry);
};

const startBackendSidecar = async (): Promise<string> => {
  if (process.env.LMCTRLF_BACKEND_URL) {
    const backendBaseUrl = resolveBackendBaseUrl(process.env.LMCTRLF_BACKEND_URL);
    await waitForBackendHealth(backendBaseUrl);
    return backendBaseUrl;
  }

  const backendHost = resolveBackendHost();
  const preferredPort = resolveBackendPort();
  const backendPort = await findAvailablePort(backendHost, preferredPort);
  const backendBaseUrl = buildBackendBaseUrl(backendHost, backendPort);
  const launch = getBackendLaunchCommand({
    packaged: app.isPackaged,
    platform: process.platform,
    port: backendPort,
    resourcesPath: process.resourcesPath,
    userDataPath: app.getPath("userData")
  });

  backendProcess = spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    env: {
      ...process.env,
      ...launch.env
    },
    stdio: "ignore"
  });

  await waitForManagedBackendHealth(backendProcess, backendBaseUrl);
  return backendBaseUrl;
};

const stopBackendSidecar = (): void => {
  if (!backendProcess) {
    return;
  }

  backendProcess.kill();
  backendProcess = null;
};

app.whenReady().then(async () => {
  try {
    const backendBaseUrl = await startBackendSidecar();
    await createWindow(backendBaseUrl);
  } catch (error) {
    console.error("Failed to start the backend sidecar.", error);
    stopBackendSidecar();
    app.quit();
  }
});

app.on("window-all-closed", () => {
  stopBackendSidecar();

  if (process.platform !== "darwin") {
    app.quit();
  }
});
