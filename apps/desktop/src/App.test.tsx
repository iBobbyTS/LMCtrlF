import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import App from "./App";

describe("App", () => {
  it("renders the default connection button", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Test Python Connection" })).toBeInTheDocument();
  });

  it("shows a success state when the backend is reachable", async () => {
    window.lmctrlf = {
      getBackendBaseUrl: () => "http://127.0.0.1:8123"
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" })
    } as Response);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Test Python Connection" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Success" })).toHaveClass("connection-button--success");
    });
  });

  it("shows a fail state when the backend check fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Test Python Connection" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Fail" })).toHaveClass("connection-button--fail");
    });
  });
});
