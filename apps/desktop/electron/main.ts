import { spawn, type ChildProcess } from "node:child_process";

import { app, BrowserWindow } from "electron";

import { getBackendLaunchCommand, resolveBackendBaseUrl, resolveRendererEntry } from "./config";

let backendProcess: ChildProcess | null = null;

const createWindow = async (): Promise<void> => {
  const backendBaseUrl = resolveBackendBaseUrl(process.env.LMCTRLF_BACKEND_URL);
  const rendererEntry = resolveRendererEntry(process.env.LMCTRLF_RENDERER_URL);

  const window = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: new URL("./preload.js", import.meta.url).pathname,
      additionalArguments: [`--backend-base-url=${backendBaseUrl}`]
    }
  });

  if (rendererEntry.startsWith("http://") || rendererEntry.startsWith("https://")) {
    await window.loadURL(rendererEntry);
    return;
  }

  await window.loadFile(rendererEntry);
};

const startBackendSidecar = (): void => {
  if (app.isPackaged || process.env.LMCTRLF_BACKEND_URL) {
    return;
  }

  const launch = getBackendLaunchCommand();
  backendProcess = spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    env: process.env,
    stdio: "ignore"
  });
};

const stopBackendSidecar = (): void => {
  if (!backendProcess) {
    return;
  }

  backendProcess.kill();
  backendProcess = null;
};

app.whenReady().then(async () => {
  startBackendSidecar();
  await createWindow();
});

app.on("window-all-closed", () => {
  stopBackendSidecar();

  if (process.platform !== "darwin") {
    app.quit();
  }
});
