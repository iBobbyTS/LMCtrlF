import { act, fireEvent, render, screen, within } from "@testing-library/react";

import App from "./App";

const setWindowWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width
  });
};

describe("App", () => {
  beforeEach(() => {
    setWindowWidth(1400);
  });

  it("renders the projects workspace without calling the backend", () => {
    globalThis.fetch = vi.fn();

    render(<App />);

    expect(screen.getByRole("button", { name: "Projects" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Create Project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Atlas Reader 5 files/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Margin Notes 2 files/i })).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("opens and closes the create project dialog", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));

    expect(screen.getByRole("dialog", { name: "Create Project" })).toBeInTheDocument();
    expect(screen.getByLabelText("Project name")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close create project dialog" }));

    expect(screen.queryByRole("dialog", { name: "Create Project" })).not.toBeInTheDocument();
  });

  it("creates a named project and opens an empty project workspace", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Field Notes" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.getByRole("heading", { name: "Field Notes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Projects" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "File management" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("No documents yet. Import files to start building this project.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chat" })).toHaveAttribute("aria-pressed", "false");
  });

  it("opens a project directly from the list and lets users reindex or delete documents", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Atlas Reader 5 files/i }));

    expect(document.querySelector(".project-page")).toHaveClass("project-page--locked");
    expect(document.querySelector(".table-wrapper")).toHaveClass("table-wrapper--scroll");
    expect(screen.getByRole("columnheader", { name: "File name" })).toBeInTheDocument();
    expect(screen.getByText("Indexing (64%)")).toBeInTheDocument();
    expect(screen.getByText("File changed")).toBeInTheDocument();
    expect(screen.getByText("File updated")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reindex feature-requests.txt" }));
    expect(screen.getAllByText("Queued")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Delete stakeholder-notes.pdf" }));
    expect(screen.queryByText("stakeholder-notes.pdf")).not.toBeInTheDocument();
  });

  it("switches into the chat workspace and changes threads", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Atlas Reader 5 files/i }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));

    expect(screen.queryByRole("button", { name: "Projects" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Thread" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Threads" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "File management" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Chat" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Launch summary" })).toBeInTheDocument();
    expect(document.querySelector(".chat-page")).toHaveClass("chat-page--locked");
    expect(document.querySelector(".thread-list")).toHaveClass("thread-list--scroll");
    expect(document.querySelector(".message-stream")).toHaveClass("message-stream--scroll");

    const threadList = screen.getByRole("list", { name: "Project threads" });
    fireEvent.click(within(threadList).getByRole("button", { name: /Risk review/i }));

    expect(screen.getByRole("heading", { name: "Risk review" })).toBeInTheDocument();
    expect(
      screen.getByText(/The current blockers are tied to files waiting for reindexing/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Assistant$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^You$/)).not.toBeInTheDocument();
  });

  it("renders the thread toggle as a floating button outside the chat header", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Atlas Reader 5 files/i }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));

    const floatingButton = screen.getByRole("button", { name: "Threads" });
    const toolbar = document.querySelector(".project-toolbar");

    expect(floatingButton).toHaveClass("thread-toggle-fab");
    expect(toolbar).not.toContainElement(floatingButton);
  });

  it("uses a temporary thread drawer on narrow windows and closes it after a selection", () => {
    setWindowWidth(900);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Atlas Reader 5 files/i }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));

    expect(screen.queryByRole("list", { name: "Project threads" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Threads" })).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "Threads" }));

    const threadList = screen.getByRole("list", { name: "Project threads" });
    fireEvent.click(within(threadList).getByRole("button", { name: /Risk review/i }));

    expect(screen.getByRole("heading", { name: "Risk review" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Project threads" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Threads" })).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the chat view full width in the drawer breakpoint range", () => {
    setWindowWidth(1120);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Atlas Reader 5 files/i }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));

    expect(screen.queryByRole("list", { name: "Project threads" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Threads" })).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector(".chat-layout")).toHaveClass("chat-layout--compact");
  });

  it("lets wide windows collapse and restore the pinned thread panel", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Atlas Reader 5 files/i }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));

    expect(screen.getByRole("list", { name: "Project threads" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Threads" }));
    expect(screen.queryByRole("list", { name: "Project threads" })).not.toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Threads" }));
    });

    expect(screen.getByRole("list", { name: "Project threads" })).toBeInTheDocument();
  });

  it("updates provider settings and accessibility switches", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    fireEvent.change(screen.getByLabelText("Provider"), {
      target: { value: "anthropic" }
    });

    expect(screen.getByDisplayValue("https://api.anthropic.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("claude-sonnet-4-5")).toBeInTheDocument();

    const reduceMotion = screen.getByRole("checkbox", { name: /Reduce motion/i });
    expect(reduceMotion).not.toBeChecked();

    fireEvent.click(reduceMotion);

    expect(reduceMotion).toBeChecked();
  });
});
