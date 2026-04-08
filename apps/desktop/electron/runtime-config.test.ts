import { describe, expect, it } from "vitest";

import { resolveRuntimeBackendBaseUrl } from "./runtime-config";

describe("desktop runtime config", () => {
  it("prefers the backend base URL injected through Electron runtime arguments", () => {
    expect(
      resolveRuntimeBackendBaseUrl(
        ["--inspect=5858", "--backend-base-url=http://127.0.0.1:8123"],
        "http://127.0.0.1:9000"
      )
    ).toBe("http://127.0.0.1:8123");
  });

  it("falls back to the environment backend URL when no runtime argument is present", () => {
    expect(resolveRuntimeBackendBaseUrl(["--inspect=5858"], "http://127.0.0.1:9000")).toBe(
      "http://127.0.0.1:9000"
    );
  });

  it("falls back to the default localhost backend URL when no overrides are present", () => {
    expect(resolveRuntimeBackendBaseUrl(["--inspect=5858"], undefined)).toBe("http://127.0.0.1:8000");
  });
});
