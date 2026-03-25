import { describe, expect, it } from "vitest";

import { CONNECTION_STATUSES, isConnectionStatus } from "./index";

describe("@lmctrlf/shared", () => {
  it("exposes the expected connection statuses", () => {
    expect(CONNECTION_STATUSES).toEqual(["idle", "loading", "success", "fail"]);
  });

  it("validates known connection statuses", () => {
    expect(isConnectionStatus("success")).toBe(true);
    expect(isConnectionStatus("unknown")).toBe(false);
    expect(isConnectionStatus(null)).toBe(false);
  });
});
