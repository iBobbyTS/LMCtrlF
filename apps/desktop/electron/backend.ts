import { type ChildProcess } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

type WaitForBackendHealthOptions = {
  attempts?: number;
  intervalMs?: number;
};

const isPortAvailable = async (host: string, port: number): Promise<boolean> => {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.once("listening", () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(true);
      });
    });

    server.listen(port, host);
  });
};

export const findAvailablePort = async (
  host: string,
  preferredPort: number,
  maxAttempts = 20
): Promise<number> => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const port = preferredPort + attempt;

    if (await isPortAvailable(host, port)) {
      return port;
    }
  }

  throw new Error(`Could not find an available backend port starting at ${preferredPort}.`);
};

export const waitForBackendHealth = async (
  backendBaseUrl: string,
  options: WaitForBackendHealthOptions = {}
): Promise<void> => {
  const attempts = options.attempts ?? 60;
  const intervalMs = options.intervalMs ?? 500;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${backendBaseUrl}/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // The backend is not ready yet.
    }

    await delay(intervalMs);
  }

  throw new Error(`Timed out while waiting for the backend at ${backendBaseUrl}.`);
};

export const waitForManagedBackendHealth = async (
  backendProcess: ChildProcess,
  backendBaseUrl: string,
  options: WaitForBackendHealthOptions = {}
): Promise<void> => {
  const exitPromise = new Promise<never>((_, reject) => {
    backendProcess.once("exit", (code, signal) => {
      reject(
        new Error(
          `The backend process exited before becoming healthy (code=${code ?? "null"}, signal=${signal ?? "null"}).`
        )
      );
    });
    backendProcess.once("error", (error) => {
      reject(error);
    });
  });

  await Promise.race([waitForBackendHealth(backendBaseUrl, options), exitPromise]);
};
