import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import electronPath from "electron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const viteEntry = path.resolve(projectRoot, "node_modules/vite/bin/vite.js");

const rendererUrl = "http://127.0.0.1:5173";

const viteProcess = spawn(process.execPath, [viteEntry, "--host", "127.0.0.1", "--port", "5173"], {
  cwd: projectRoot,
  stdio: "inherit"
});

const waitForRenderer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(rendererUrl);

      if (response.ok) {
        return;
      }
    } catch {
      // The server is not ready yet.
    }

    await delay(500);
  }

  throw new Error("Timed out while waiting for the Vite dev server.");
};

const stopProcess = (processHandle) => {
  if (!processHandle || processHandle.killed) {
    return;
  }

  processHandle.kill();
};

try {
  await waitForRenderer();

  const electronProcess = spawn(electronPath, ["./electron/main.ts"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      LMCTRLF_RENDERER_URL: rendererUrl,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--import=tsx"].filter(Boolean).join(" ")
    },
    stdio: "inherit"
  });

  const shutdown = () => {
    stopProcess(electronProcess);
    stopProcess(viteProcess);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  electronProcess.on("exit", (code) => {
    stopProcess(viteProcess);
    process.exit(code ?? 0);
  });
} catch (error) {
  stopProcess(viteProcess);
  throw error;
}
