import { fireEvent, render, screen } from "@testing-library/react";

import App from "./App";

describe("App", () => {
  it("renders the document management page by default", async () => {
    globalThis.fetch = vi.fn();

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Document Control Center" })).toBeInTheDocument();
    expect(screen.getByText("Drop PDF or TXT files here")).toBeInTheDocument();
    expect(screen.getByText("Privacy Notice")).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("shows the desktop navigation shell", async () => {
    render(<App />);

    expect(await screen.findByRole("link", { name: "Documents" })).toHaveClass("nav-link--active");
    expect(screen.getByRole("link", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("navigates to the chat placeholder route", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("link", { name: "Chat" }));

    expect(await screen.findByRole("heading", { name: "Chat Workspace" })).toBeInTheDocument();
    expect(
      screen.getByText("The chat page will be added in the next branch on top of this shell.")
    ).toBeInTheDocument();
  });
});
