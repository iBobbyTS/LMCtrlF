import http from "node:http";
import net from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { findAvailablePort, waitForBackendHealth } from "./backend";

const closeServer = async (server: net.Server | http.Server): Promise<void> => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(undefined);
    });
  });
};

describe("desktop backend bootstrap", () => {
  const servers: Array<net.Server | http.Server> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop();

      if (!server) {
        continue;
      }

      await closeServer(server);
    }
  });

  it("finds the next free port when the preferred port is already in use", async () => {
    const occupiedServer = net.createServer();
    servers.push(occupiedServer);

    await new Promise((resolve, reject) => {
      occupiedServer.listen(0, "127.0.0.1", () => resolve(undefined));
      occupiedServer.once("error", reject);
    });

    const address = occupiedServer.address();

    if (!address || typeof address === "string") {
      throw new Error("Expected an IPv4 server address.");
    }

    const availablePort = await findAvailablePort("127.0.0.1", address.port, 3);
    expect(availablePort).toBeGreaterThan(address.port);
    expect(availablePort).toBeLessThanOrEqual(address.port + 2);
  });

  it("waits for the backend health endpoint to report success", async () => {
    const healthyServer = http.createServer((request, response) => {
      if (request.url === "/health") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ status: "ok" }));
        return;
      }

      response.writeHead(404);
      response.end();
    });
    servers.push(healthyServer);

    await new Promise((resolve, reject) => {
      healthyServer.listen(0, "127.0.0.1", () => resolve(undefined));
      healthyServer.once("error", reject);
    });

    const address = healthyServer.address();

    if (!address || typeof address === "string") {
      throw new Error("Expected an IPv4 server address.");
    }

    await expect(
      waitForBackendHealth(`http://127.0.0.1:${address.port}`, { attempts: 2, intervalMs: 10 })
    ).resolves.toBeUndefined();
  });
});
