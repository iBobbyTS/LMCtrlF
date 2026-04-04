import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import App from "./App";

const setWindowWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width
  });
};

type MockProject = {
  id: string;
  name: string;
  accent: string;
  createdAt: string;
  updatedAt: string;
};

type MockDocument = {
  id: string;
  projectId: string;
  name: string;
  filePath: string;
  md5: string;
  status: "queued" | "indexing" | "paused" | "ready" | "file_changed";
  createdAt: string;
  updatedAt: string;
};

const createJsonResponse = (payload: unknown, status = 200) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
};

const createFetchMock = (seed?: {
  projects?: MockProject[];
  documentsByProject?: Record<string, MockDocument[]>;
}) => {
  let projectCounter = (seed?.projects?.length ?? 0) + 1;
  let documentCounter = 1;
  const projects = [...(seed?.projects ?? [])];
  const documentsByProject = Object.fromEntries(
    Object.entries(seed?.documentsByProject ?? {}).map(([projectId, documents]) => [
      projectId,
      [...documents]
    ])
  ) as Record<string, MockDocument[]>;

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(requestUrl);
    const method = init?.method ?? "GET";

    if (url.pathname === "/projects" && method === "GET") {
      return createJsonResponse(projects);
    }

    if (url.pathname === "/projects" && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { name: string; accent: string };
      const timestamp = new Date(Date.UTC(2026, 3, 3, 12, 0, projectCounter)).toISOString();
      const project: MockProject = {
        id: `project-${projectCounter}`,
        name: body.name,
        accent: body.accent,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      projectCounter += 1;
      projects.unshift(project);
      documentsByProject[project.id] = [];
      return createJsonResponse(project, 201);
    }

    const importMatch = url.pathname.match(/^\/projects\/([^/]+)\/documents\/import$/);
    if (importMatch && method === "POST") {
      const [, projectId] = importMatch;
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        items: Array<{ name: string; filePath: string }>;
      };
      const currentDocuments = [...(documentsByProject[projectId] ?? [])];

      body.items.forEach((item) => {
        const existingIndex = currentDocuments.findIndex(
          (document) => document.filePath === item.filePath
        );

        if (existingIndex >= 0) {
          currentDocuments[existingIndex] = {
            ...currentDocuments[existingIndex],
            name: item.name,
            status: "queued",
            updatedAt: new Date(Date.UTC(2026, 3, 3, 12, 0, documentCounter)).toISOString()
          };
          return;
        }

        const timestamp = new Date(Date.UTC(2026, 3, 3, 12, 0, documentCounter)).toISOString();
        currentDocuments.unshift({
          id: `document-${documentCounter}`,
          projectId,
          name: item.name,
          filePath: item.filePath,
          md5: `md5-${documentCounter}`,
          status: "queued",
          createdAt: timestamp,
          updatedAt: timestamp
        });
        documentCounter += 1;
      });

      documentsByProject[projectId] = currentDocuments;
      return createJsonResponse(currentDocuments);
    }

    const listDocumentsMatch = url.pathname.match(/^\/projects\/([^/]+)\/documents$/);
    if (listDocumentsMatch && method === "GET") {
      const [, projectId] = listDocumentsMatch;
      return createJsonResponse(documentsByProject[projectId] ?? []);
    }

    const deleteDocumentMatch = url.pathname.match(/^\/projects\/([^/]+)\/documents\/([^/]+)$/);
    if (deleteDocumentMatch && method === "DELETE") {
      const [, projectId, documentId] = deleteDocumentMatch;
      documentsByProject[projectId] = (documentsByProject[projectId] ?? []).filter(
        (document) => document.id !== documentId
      );
      return new Response(null, { status: 204 });
    }

    return new Response("Not found", { status: 404 });
  });
};

const installBridge = () => {
  window.lmctrlf = {
    getBackendBaseUrl: () => "http://127.0.0.1:8000",
    getPathForFile: (file: File) => {
      return ((file as File & { path?: string }).path ?? "");
    }
  };
};

const createElectronFile = (name: string, path: string, content = "file-content") => {
  const file = new File([content], name, { type: "application/pdf" });
  Object.defineProperty(file, "path", {
    configurable: true,
    value: path
  });
  return file;
};

describe("App", () => {
  beforeEach(() => {
    setWindowWidth(1400);
    installBridge();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an empty project state from the backend", async () => {
    const fetchMock = createFetchMock();
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Project" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8000/projects");
  });

  it("creates a project through the backend and opens its empty workspace", async () => {
    const fetchMock = createFetchMock();
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    await screen.findByText("No projects yet");

    fireEvent.click(screen.getByRole("button", { name: "Create Project" }));
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Field Notes" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("heading", { name: "Field Notes" })).toBeInTheDocument();
    expect(screen.getByText("No documents yet. Import files to start building this project.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/projects",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("imports a document via the warning dialog and shows queued status", async () => {
    const seedProject: MockProject = {
      id: "project-1",
      name: "Field Notes",
      accent: "#c2410c",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:00:00.000Z"
    };
    const fetchMock = createFetchMock({
      projects: [seedProject],
      documentsByProject: { "project-1": [] }
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Field Notes 0 files/i }));
    fireEvent.click(screen.getByRole("button", { name: "Import Files" }));

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = createElectronFile("launch-overview.pdf", "/tmp/launch-overview.pdf");
    fireEvent.change(input, {
      target: { files: [file] }
    });

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(screen.getByRole("dialog", { name: "WARNING" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I Understand & Import" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "WARNING" })).not.toBeInTheDocument();
    });

    expect(screen.getByText("launch-overview.pdf")).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it("deletes a backend-backed document from the file table", async () => {
    const seedProject: MockProject = {
      id: "project-1",
      name: "Field Notes",
      accent: "#c2410c",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:00:00.000Z"
    };
    const seedDocument: MockDocument = {
      id: "document-1",
      projectId: "project-1",
      name: "launch-overview.pdf",
      filePath: "/tmp/launch-overview.pdf",
      md5: "md5-1",
      status: "queued",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:00:00.000Z"
    };
    const fetchMock = createFetchMock({
      projects: [seedProject],
      documentsByProject: { "project-1": [seedDocument] }
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Field Notes 1 files/i }));
    expect(await screen.findByText("launch-overview.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete launch-overview.pdf" }));

    await waitFor(() => {
      expect(screen.queryByText("launch-overview.pdf")).not.toBeInTheDocument();
    });
  });

  it("shows an empty chat state and lets users create a local thread", async () => {
    const seedProject: MockProject = {
      id: "project-1",
      name: "Field Notes",
      accent: "#c2410c",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:00:00.000Z"
    };
    const fetchMock = createFetchMock({
      projects: [seedProject],
      documentsByProject: { "project-1": [] }
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Field Notes 0 files/i }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));

    expect(screen.getByRole("heading", { name: "No threads yet" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New Thread" }));

    expect(await screen.findByRole("heading", { name: "New thread 1" })).toBeInTheDocument();
  });

  it("shows an error when a selected file has no resolvable local path", async () => {
    const seedProject: MockProject = {
      id: "project-1",
      name: "Field Notes",
      accent: "#c2410c",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:00:00.000Z"
    };
    const fetchMock = createFetchMock({
      projects: [seedProject],
      documentsByProject: { "project-1": [] }
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Field Notes 0 files/i }));
    fireEvent.click(screen.getByRole("button", { name: "Import Files" }));

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["file-content"], "orphan.pdf", { type: "application/pdf" })] }
    });

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "I Understand & Import" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not resolve a local path for orphan.pdf."
    );
  });

  it("updates provider settings and accessibility switches locally", async () => {
    const fetchMock = createFetchMock();
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    await screen.findByText("No projects yet");
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
