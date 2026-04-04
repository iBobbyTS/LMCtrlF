import { describe, expect, it } from "vitest";

import { CONNECTION_STATUSES, DOCUMENT_STATUSES, isConnectionStatus, isDocumentStatus } from "./index";

describe("@lmctrlf/shared", () => {
  it("exposes the expected connection statuses", () => {
    expect(CONNECTION_STATUSES).toEqual(["idle", "loading", "success", "fail"]);
  });

  it("validates known connection statuses", () => {
    expect(isConnectionStatus("success")).toBe(true);
    expect(isConnectionStatus("unknown")).toBe(false);
    expect(isConnectionStatus(null)).toBe(false);
  });

  it("exposes the expected document statuses", () => {
    expect(DOCUMENT_STATUSES).toEqual(["queued", "indexing", "paused", "ready", "file_changed"]);
  });

  it("validates known document statuses", () => {
    expect(isDocumentStatus("queued")).toBe(true);
    expect(isDocumentStatus("file_changed")).toBe(true);
    expect(isDocumentStatus("done")).toBe(false);
    expect(isDocumentStatus(undefined)).toBe(false);
  });
});
