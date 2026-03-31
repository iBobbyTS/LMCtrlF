import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { getBackendLaunchCommand, resolveBackendBaseUrl, resolveRendererEntry } from "./config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("desktop config", () => {
  it("uses sensible defaults when no runtime values are provided", () => {
    expect(resolveBackendBaseUrl()).toBe("http://127.0.0.1:8000");
    expect(resolveRendererEntry()).toBe(path.resolve(__dirname, "../static/index.html"));
  });

  it("prefers provided runtime values", () => {
    expect(resolveBackendBaseUrl("http://127.0.0.1:9000")).toBe("http://127.0.0.1:9000");
    expect(resolveRendererEntry("http://localhost:5173")).toBe("http://localhost:5173");
  });

  it("builds the expected backend launch command", () => {
    expect(getBackendLaunchCommand()).toEqual({
      command: "conda",
      args: ["run", "-n", "lmctrlf-dev", "python", "-m", "app.main"],
      cwd: path.resolve(__dirname, "../../../services/backend")
    });
  });
});
