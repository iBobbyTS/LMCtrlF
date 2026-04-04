import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildBackendBaseUrl,
  getBackendLaunchCommand,
  resolveBackendBaseUrl,
  resolveBackendHost,
  resolveBackendPort,
  resolvePreloadEntry,
  resolveRendererEntry
} from "./config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("desktop config", () => {
  it("uses sensible defaults when no runtime values are provided", () => {
    expect(resolveBackendBaseUrl()).toBe("http://127.0.0.1:8000");
    expect(buildBackendBaseUrl()).toBe("http://127.0.0.1:8000");
    expect(resolveBackendHost()).toBe("127.0.0.1");
    expect(resolveBackendPort()).toBe(8000);
    expect(resolvePreloadEntry()).toBe(path.resolve(__dirname, "./preload.cjs"));
    expect(resolveRendererEntry()).toBe(path.resolve(__dirname, "../static/index.html"));
  });

  it("prefers provided runtime values", () => {
    expect(resolveBackendBaseUrl("http://127.0.0.1:9000")).toBe("http://127.0.0.1:9000");
    expect(resolveBackendHost("http://127.0.0.1:9000")).toBe("127.0.0.1");
    expect(resolveBackendPort("http://127.0.0.1:9000")).toBe(9000);
    expect(resolveRendererEntry("http://localhost:5173")).toBe("http://localhost:5173");
  });

  it("builds the expected backend launch command", () => {
    expect(getBackendLaunchCommand(8001)).toEqual({
      command: "conda",
      args: ["run", "-n", "lmctrlf-dev", "python", "-m", "app.main"],
      cwd: path.resolve(__dirname, "../../../services/backend"),
      env: {
        LMCTRLF_BACKEND_HOST: "127.0.0.1",
        LMCTRLF_BACKEND_PORT: "8001"
      }
    });
  });
});
