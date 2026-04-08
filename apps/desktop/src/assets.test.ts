import { describe, expect, it } from "vitest";

import { resolvePublicAssetPath } from "./assets";

describe("renderer asset paths", () => {
  it("keeps dev server assets rooted when the renderer base URL is /", () => {
    expect(resolvePublicAssetPath("dragndroparrow.png", "/")).toBe("/dragndroparrow.png");
  });

  it("keeps packaged assets relative when the renderer base URL is ./", () => {
    expect(resolvePublicAssetPath("dragndroparrow.png", "./")).toBe("./dragndroparrow.png");
  });

  it("preserves nested base paths for non-root deployments", () => {
    expect(resolvePublicAssetPath("/dragndroparrow.png", "/desktop/")).toBe(
      "/desktop/dragndroparrow.png"
    );
  });
});
