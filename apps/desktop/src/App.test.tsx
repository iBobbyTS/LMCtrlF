import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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
  progress: number;
  createdAt: string;
  updatedAt: string;
};

type MockThread = {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
};

type MockMessage = {
  id: string;
  threadId: string;
  senderType: "user" | "assistant";
  role: string;
  content: string;
  reasoningContent: string;
  citations: Array<{
    documentId: string;
    documentName: string;
    pageNumber: number;
    chunkIndex: number;
    snippet: string;
    score: number | null;
  }>;
  createdAt: string;
};

type MockSettings = {
  selectedProviderId: "lm-studio" | "openai" | "anthropic";
  providers: Array<{
    id: "lm-studio" | "openai" | "anthropic";
    name: string;
    baseUrl: string;
    embeddingModel: string;
    chattingModel: string;
    apiKey: string;
  }>;
};

type MockChatEvent =
  | {
      type: "reasoning.delta";
      content: string;
    }
  | {
      type: "reasoning.end";
    }
  | {
      type: "message.delta";
      content: string;
    }
  | {
      type: "message.end";
    }
  | {
      type: "completed";
      thread: MockThread;
      userMessage: MockMessage;
      assistantMessage: MockMessage;
    }
  | {
      type: "error";
      message: string;
    };

const createJsonResponse = (payload: unknown, status = 200) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
};

const createSseResponse = (events: MockChatEvent[]) => {
  const payload = events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    .join("");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream"
    }
  });
};

const createFetchMock = (seed?: {
  projects?: MockProject[];
  documentsByProject?: Record<string, MockDocument[]>;
  documentSequencesByProject?: Record<string, MockDocument[][]>;
  threadsByProject?: Record<string, MockThread[]>;
  messagesByThread?: Record<string, MockMessage[]>;
  chatEventSequencesByThread?: Record<string, MockChatEvent[][]>;
  healthSequence?: Array<"ok" | "offline">;
  settings?: MockSettings;
  offlinePaths?: string[];
}) => {
  let projectCounter = (seed?.projects?.length ?? 0) + 1;
  let documentCounter = 1;
  let threadCounter = 1;
  let messageCounter = 1;
  const healthSequence = [...(seed?.healthSequence ?? ["ok"])];
  const offlinePaths = new Set(seed?.offlinePaths ?? []);
  let settings: MockSettings = seed?.settings ?? {
    selectedProviderId: "lm-studio",
    providers: [
      {
        id: "lm-studio",
        name: "LM Studio",
        baseUrl: "http://127.0.0.1:1234/v1",
        embeddingModel: "text-embedding-embeddinggemma-300m",
        chattingModel: "google/gemma-4-26b-a4b",
        apiKey: "lm-studio"
      },
      {
        id: "openai",
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        embeddingModel: "text-embedding-3-small",
        chattingModel: "gpt-5-mini",
        apiKey: "sk-live-••••••••"
      },
      {
        id: "anthropic",
        name: "Anthropic",
        baseUrl: "https://api.anthropic.com",
        embeddingModel: "text-embedding-embeddinggemma-300m",
        chattingModel: "claude-sonnet-4-5",
        apiKey: "sk-ant-••••••••"
      }
    ]
  };
  const projects = [...(seed?.projects ?? [])];
  const documentsByProject = Object.fromEntries(
    Object.entries(seed?.documentsByProject ?? {}).map(([projectId, documents]) => [
      projectId,
      [...documents]
    ])
  ) as Record<string, MockDocument[]>;
  const documentSequencesByProject = Object.fromEntries(
    Object.entries(seed?.documentSequencesByProject ?? {}).map(([projectId, sequence]) => [
      projectId,
      sequence.map((documents) => [...documents])
    ])
  ) as Record<string, MockDocument[][]>;
  const threadsByProject = Object.fromEntries(
    Object.entries(seed?.threadsByProject ?? {}).map(([projectId, threads]) => [projectId, [...threads]])
  ) as Record<string, MockThread[]>;
  const messagesByThread = Object.fromEntries(
    Object.entries(seed?.messagesByThread ?? {}).map(([threadId, messages]) => [threadId, [...messages]])
  ) as Record<string, MockMessage[]>;
  const chatEventSequencesByThread = Object.fromEntries(
    Object.entries(seed?.chatEventSequencesByThread ?? {}).map(([threadId, sequence]) => [
      threadId,
      sequence.map((events) => [...events])
    ])
  ) as Record<string, MockChatEvent[][]>;

  const getSelectedProvider = () => {
    return (
      settings.providers.find((provider) => provider.id === settings.selectedProviderId) ??
      settings.providers[0]
    );
  };

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(requestUrl);
    const method = init?.method ?? "GET";

    if (offlinePaths.has(url.pathname)) {
      throw new TypeError("Failed to fetch");
    }

    if (url.pathname === "/health" && method === "GET") {
      const nextHealthState =
        healthSequence.length > 1 ? healthSequence.shift() ?? "ok" : (healthSequence[0] ?? "ok");

      if (nextHealthState === "offline") {
        throw new TypeError("Failed to fetch");
      }

      return createJsonResponse({ status: "ok" });
    }

    if (url.pathname === "/projects" && method === "GET") {
      return createJsonResponse(projects);
    }

    if (url.pathname === "/settings/model" && method === "GET") {
      return createJsonResponse(settings);
    }

    if (url.pathname === "/settings/model" && method === "PUT") {
      settings = JSON.parse(String(init?.body ?? "{}")) as MockSettings;
      return createJsonResponse(settings);
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
      threadsByProject[project.id] = [];
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
            progress: 0,
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
          progress: 0,
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
      const sequence = documentSequencesByProject[projectId];
      if (sequence && sequence.length > 0) {
        const nextDocuments = sequence.length > 1 ? sequence.shift() ?? [] : sequence[0] ?? [];
        documentsByProject[projectId] = [...nextDocuments];
      }
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

    const reindexDocumentMatch = url.pathname.match(/^\/projects\/([^/]+)\/documents\/([^/]+)\/reindex$/);
    if (reindexDocumentMatch && method === "POST") {
      const [, projectId, documentId] = reindexDocumentMatch;
      const currentDocument = (documentsByProject[projectId] ?? []).find(
        (document) => document.id === documentId
      );
      if (!currentDocument) {
        return new Response("Not found", { status: 404 });
      }

      const updatedDocument: MockDocument = {
        ...currentDocument,
        status: "queued",
        progress: 0,
        updatedAt: new Date(Date.UTC(2026, 3, 3, 12, 0, documentCounter)).toISOString()
      };
      documentCounter += 1;
      documentsByProject[projectId] = (documentsByProject[projectId] ?? []).map((document) =>
        document.id === documentId ? updatedDocument : document
      );
      return createJsonResponse(updatedDocument);
    }

    const listThreadsMatch = url.pathname.match(/^\/projects\/([^/]+)\/threads$/);
    if (listThreadsMatch && method === "GET") {
      const [, projectId] = listThreadsMatch;
      return createJsonResponse(threadsByProject[projectId] ?? []);
    }

    if (listThreadsMatch && method === "POST") {
      const [, projectId] = listThreadsMatch;
      const threadCount = (threadsByProject[projectId] ?? []).length + 1;
      const timestamp = new Date(Date.UTC(2026, 3, 3, 12, 0, threadCounter)).toISOString();
      const thread: MockThread = {
        id: `thread-${threadCounter}`,
        projectId,
        title: `New thread ${threadCount}`,
        summary: "",
        createdAt: timestamp,
        updatedAt: timestamp
      };
      threadCounter += 1;
      threadsByProject[projectId] = [thread, ...(threadsByProject[projectId] ?? [])];
      messagesByThread[thread.id] = [];
      return createJsonResponse(thread, 201);
    }

    const listMessagesMatch = url.pathname.match(/^\/projects\/([^/]+)\/threads\/([^/]+)\/messages$/);
    if (listMessagesMatch && method === "GET") {
      const [, , threadId] = listMessagesMatch;
      return createJsonResponse(messagesByThread[threadId] ?? []);
    }

    const streamMessagesMatch = url.pathname.match(
      /^\/projects\/([^/]+)\/threads\/([^/]+)\/messages\/stream$/
    );
    if (streamMessagesMatch && method === "POST") {
      const [, projectId, threadId] = streamMessagesMatch;
      const body = JSON.parse(String(init?.body ?? "{}")) as { content: string };
      const selectedProvider = getSelectedProvider();

      if (settings.selectedProviderId !== "lm-studio") {
        return createJsonResponse(
          { detail: `${selectedProvider.name} chat is not implemented yet.` },
          501
        );
      }

      const sequence = chatEventSequencesByThread[threadId];
      const timestamp = new Date(Date.UTC(2026, 3, 3, 12, 0, messageCounter)).toISOString();
      const defaultUserMessage: MockMessage = {
        id: `message-${messageCounter}`,
        threadId,
        senderType: "user",
        role: "User",
        content: body.content,
        reasoningContent: "",
        citations: [],
        createdAt: timestamp
      };
      messageCounter += 1;
      const defaultAssistantMessage: MockMessage = {
        id: `message-${messageCounter}`,
        threadId,
        senderType: "assistant",
        role: selectedProvider.chattingModel,
        content: "Thanks for the question.",
        reasoningContent: "Thinking through the answer.",
        citations: [],
        createdAt: new Date(Date.UTC(2026, 3, 3, 12, 0, messageCounter)).toISOString()
      };
      messageCounter += 1;
      const currentThread = (threadsByProject[projectId] ?? []).find((thread) => thread.id === threadId);
      const updatedThread: MockThread = currentThread
        ? {
            ...currentThread,
            title: currentThread.title === "New thread 1" ? "Launch Notes" : currentThread.title,
            summary: defaultAssistantMessage.content,
            updatedAt: defaultAssistantMessage.createdAt
          }
        : {
            id: threadId,
            projectId,
            title: "Launch Notes",
            summary: defaultAssistantMessage.content,
            createdAt: timestamp,
            updatedAt: defaultAssistantMessage.createdAt
          };

      const events =
        sequence && sequence.length > 0
          ? sequence.length > 1
            ? sequence.shift() ?? []
            : sequence[0] ?? []
          : [
              { type: "reasoning.delta", content: "Thinking through the answer." },
              { type: "reasoning.end" },
              { type: "message.delta", content: "Thanks for the question." },
              { type: "message.end" },
              {
                type: "completed",
                thread: updatedThread,
                userMessage: defaultUserMessage,
                assistantMessage: defaultAssistantMessage
              }
            ];

      const completedEvent = events.find((event) => event.type === "completed");
      if (completedEvent && completedEvent.type === "completed") {
        threadsByProject[projectId] = [
          completedEvent.thread,
          ...(threadsByProject[projectId] ?? []).filter(
            (thread) => thread.id !== completedEvent.thread.id
          )
        ];
        messagesByThread[threadId] = [
          ...(messagesByThread[threadId] ?? []).filter(
            (message) =>
              message.id !== completedEvent.userMessage.id &&
              message.id !== completedEvent.assistantMessage.id
          ),
          completedEvent.userMessage,
          completedEvent.assistantMessage
        ];
      }

      return createSseResponse(events);
    }

    return new Response("Not found", { status: 404 });
  });
};

const installBridge = () => {
  window.lmctrlf = {
    getBackendBaseUrl: () => "http://127.0.0.1:8000",
    getPathForFile: (file: File) => {
      return (file as File & { path?: string }).path ?? "";
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
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8000/health");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://127.0.0.1:8000/settings/model");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("http://127.0.0.1:8000/projects");
  });

  it("shows a retry-only backend unreachable dialog when startup health checks fail", async () => {
    const fetchMock = createFetchMock({ healthSequence: ["offline"] });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    const dialog = await screen.findByRole("dialog", { name: "Backend Unreachable" });
    expect(within(dialog).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(within(dialog).queryAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText("No projects yet")).not.toBeInTheDocument();
  });

  it("reuses the backend unreachable dialog when a later startup request cannot reach the backend", async () => {
    const fetchMock = createFetchMock({ offlinePaths: ["/settings/model"] });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    const dialog = await screen.findByRole("dialog", { name: "Backend Unreachable" });
    expect(within(dialog).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(within(dialog).queryAllByRole("button")).toHaveLength(1);
    expect(within(dialog).getByText("Could not connect to the backend.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("retries workspace loading after the backend becomes reachable again", async () => {
    const seedProject: MockProject = {
      id: "project-1",
      name: "Field Notes",
      accent: "#c2410c",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:00:00.000Z"
    };
    const fetchMock = createFetchMock({
      healthSequence: ["offline", "ok"],
      projects: [seedProject],
      documentsByProject: { "project-1": [] }
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("button", { name: /Field Notes 0 files/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Backend Unreachable" })).not.toBeInTheDocument();
    });
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
    expect(screen.getByRole("dialog", { name: "Import files?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I Understand & Import" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Import files?" })).not.toBeInTheDocument();
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
      progress: 0,
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

  it("creates a backend-backed thread and shows the saved empty chat state", async () => {
    const seedProject: MockProject = {
      id: "project-1",
      name: "Field Notes",
      accent: "#c2410c",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:00:00.000Z"
    };
    const fetchMock = createFetchMock({
      projects: [seedProject],
      documentsByProject: { "project-1": [] },
      threadsByProject: { "project-1": [] }
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Field Notes 0 files/i }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));

    expect(screen.getByRole("heading", { name: "No threads yet" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New Thread" }));

    expect(await screen.findByRole("heading", { name: "New thread 1" })).toBeInTheDocument();
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("streams a chat reply, stores the model role, and exposes thread summary on hover", async () => {
    const seedProject: MockProject = {
      id: "project-1",
      name: "Field Notes",
      accent: "#c2410c",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:00:00.000Z"
    };
    const seedThread: MockThread = {
      id: "thread-1",
      projectId: "project-1",
      title: "New thread 1",
      summary: "",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:00:00.000Z"
    };
    const completedThread: MockThread = {
      ...seedThread,
      title: "Launch Notes",
      summary: "Launch blockers are the pending review and the missing budget sign-off.",
      updatedAt: "2026-04-03T12:05:00.000Z"
    };
    const userMessage: MockMessage = {
      id: "message-user-1",
      threadId: "thread-1",
      senderType: "user",
      role: "User",
      content: "What are the blockers?",
      reasoningContent: "",
      citations: [],
      createdAt: "2026-04-03T12:04:00.000Z"
    };
    const assistantMessage: MockMessage = {
      id: "message-assistant-1",
      threadId: "thread-1",
      senderType: "assistant",
      role: "google/gemma-4-26b-a4b",
      content: "Launch blockers are the pending review and the missing budget sign-off.",
      reasoningContent: "I should summarize the blockers clearly.",
      citations: [
        {
          documentId: "document-1",
          documentName: "launch-overview.pdf",
          pageNumber: 2,
          chunkIndex: 1,
          snippet: "Budget approval is still pending before launch.",
          score: 0.12
        }
      ],
      createdAt: "2026-04-03T12:05:00.000Z"
    };
    const fetchMock = createFetchMock({
      projects: [seedProject],
      documentsByProject: { "project-1": [] },
      threadsByProject: { "project-1": [seedThread] },
      messagesByThread: { "thread-1": [] },
      chatEventSequencesByThread: {
        "thread-1": [
          [
            { type: "reasoning.delta", content: "I should summarize the blockers clearly." },
            { type: "reasoning.end" },
            { type: "message.delta", content: assistantMessage.content },
            { type: "message.end" },
            {
              type: "completed",
              thread: completedThread,
              userMessage,
              assistantMessage
            }
          ]
        ]
      }
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Field Notes 0 files/i }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));

    expect(await screen.findByRole("heading", { name: "New thread 1" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Loading conversation")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole("textbox")).not.toBeDisabled();
    });
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "What are the blockers?" }
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send" })).not.toBeDisabled();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      await Promise.resolve();
    });

    expect(await screen.findByText("What are the blockers?")).toBeInTheDocument();
    expect(await screen.findByText("google/gemma-4-26b-a4b")).toBeInTheDocument();
    expect(
      await screen.findByText("Launch blockers are the pending review and the missing budget sign-off.")
    ).toBeInTheDocument();
    expect(await screen.findByText("Sources")).toBeInTheDocument();
    expect(await screen.findByText("[1] launch-overview.pdf · page 2")).toBeInTheDocument();
    expect(await screen.findByText("Budget approval is still pending before launch.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show thinking process" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Launch Notes" })).toHaveAttribute(
      "title",
      completedThread.summary
    );
  });

  it("renders assistant responses as markdown without affecting user text", async () => {
    const seedProject: MockProject = {
      id: "project-1",
      name: "Field Notes",
      accent: "#c2410c",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:00:00.000Z"
    };
    const seedThread: MockThread = {
      id: "thread-1",
      projectId: "project-1",
      title: "Launch Notes",
      summary: "Summary",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:05:00.000Z"
    };
    const userMessage: MockMessage = {
      id: "message-user-1",
      threadId: "thread-1",
      senderType: "user",
      role: "User",
      content: "Keep this plain text",
      reasoningContent: "",
      citations: [],
      createdAt: "2026-04-03T12:04:00.000Z"
    };
    const assistantMessage: MockMessage = {
      id: "message-assistant-1",
      threadId: "thread-1",
      senderType: "assistant",
      role: "google/gemma-4-26b-a4b",
      content: "# Blockers\n\n**Budget approval** is pending.\n\n- Review\n- Budget",
      reasoningContent: "",
      citations: [],
      createdAt: "2026-04-03T12:05:00.000Z"
    };
    const fetchMock = createFetchMock({
      projects: [seedProject],
      documentsByProject: { "project-1": [] },
      threadsByProject: { "project-1": [seedThread] },
      messagesByThread: { "thread-1": [userMessage, assistantMessage] }
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Field Notes 0 files/i }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));

    const assistantBubble = await screen.findByText("google/gemma-4-26b-a4b");

    expect(await screen.findByText("Keep this plain text")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Blockers" })).toBeInTheDocument();
    expect(screen.getByText("Budget approval")).toBeInTheDocument();
    expect(within(assistantBubble.closest("article") as HTMLElement).getByRole("list")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Budget")).toBeInTheDocument();
  });

  it("defaults saved reasoning to collapsed when reopening a thread", async () => {
    const seedProject: MockProject = {
      id: "project-1",
      name: "Field Notes",
      accent: "#c2410c",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:00:00.000Z"
    };
    const seedThread: MockThread = {
      id: "thread-1",
      projectId: "project-1",
      title: "Launch Notes",
      summary: "Summary",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:05:00.000Z"
    };
    const assistantMessage: MockMessage = {
      id: "message-assistant-1",
      threadId: "thread-1",
      senderType: "assistant",
      role: "google/gemma-4-26b-a4b",
      content: "The blockers are budget and review.",
      reasoningContent: "I should mention budget first.",
      citations: [],
      createdAt: "2026-04-03T12:05:00.000Z"
    };
    const fetchMock = createFetchMock({
      projects: [seedProject],
      documentsByProject: { "project-1": [] },
      threadsByProject: { "project-1": [seedThread] },
      messagesByThread: { "thread-1": [assistantMessage] }
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Field Notes 0 files/i }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));

    expect(await screen.findByRole("button", { name: "Show thinking process" })).toBeInTheDocument();
    expect(screen.queryByText("I should mention budget first.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show thinking process" }));
    expect(await screen.findByText("I should mention budget first.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "File management" }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));

    expect(await screen.findByRole("button", { name: "Show thinking process" })).toBeInTheDocument();
    expect(screen.queryByText("I should mention budget first.")).not.toBeInTheDocument();
  });

  it("disables chat sending for non-lm-studio providers", async () => {
    const seedProject: MockProject = {
      id: "project-1",
      name: "Field Notes",
      accent: "#c2410c",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:00:00.000Z"
    };
    const seedThread: MockThread = {
      id: "thread-1",
      projectId: "project-1",
      title: "New thread 1",
      summary: "",
      createdAt: "2026-04-03T12:00:00.000Z",
      updatedAt: "2026-04-03T12:00:00.000Z"
    };
    const fetchMock = createFetchMock({
      projects: [seedProject],
      documentsByProject: { "project-1": [] },
      threadsByProject: { "project-1": [seedThread] },
      messagesByThread: { "thread-1": [] },
      settings: {
        selectedProviderId: "openai",
        providers: [
          {
            id: "lm-studio",
            name: "LM Studio",
            baseUrl: "http://127.0.0.1:1234/v1",
            embeddingModel: "text-embedding-embeddinggemma-300m",
            chattingModel: "google/gemma-4-26b-a4b",
            apiKey: "lm-studio"
          },
          {
            id: "openai",
            name: "OpenAI",
            baseUrl: "https://api.openai.com/v1",
            embeddingModel: "text-embedding-3-small",
            chattingModel: "gpt-5-mini",
            apiKey: "sk-test"
          },
          {
            id: "anthropic",
            name: "Anthropic",
            baseUrl: "https://api.anthropic.com",
            embeddingModel: "text-embedding-embeddinggemma-300m",
            chattingModel: "claude-sonnet-4-5",
            apiKey: "sk-ant-test"
          }
        ]
      }
    });
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Field Notes 0 files/i }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));

    expect(await screen.findByDisplayValue("")).toBeDisabled();
    expect(screen.getByText("OpenAI (not implemented yet)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
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
    expect(screen.getByDisplayValue("text-embedding-embeddinggemma-300m")).toBeInTheDocument();
    expect(screen.getByDisplayValue("claude-sonnet-4-5")).toBeInTheDocument();

    const reduceMotion = screen.getByRole("checkbox", { name: /Reduce motion/i });
    expect(reduceMotion).not.toBeChecked();

    fireEvent.click(reduceMotion);

    expect(reduceMotion).toBeChecked();
  });

  it("persists embedding and chatting model settings through the backend", async () => {
    const fetchMock = createFetchMock();
    globalThis.fetch = fetchMock as typeof fetch;

    render(<App />);

    await screen.findByText("No projects yet");
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    fireEvent.change(screen.getByLabelText("Embedding model"), {
      target: { value: "custom-embedding-model" }
    });
    fireEvent.change(screen.getByLabelText("Chatting model"), {
      target: { value: "custom-chat-model" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:8000/settings/model",
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  it("shows a confirmation dialog when embedding model changes before saving", async () => {
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

  await screen.findByRole("button", { name: /Field Notes 0 files/i });
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));

  fireEvent.change(screen.getByLabelText("Embedding model"), {
    target: { value: "custom-embedding-model" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

  expect(
    await screen.findByRole("dialog", { name: "Embedding model changed" })
  ).toBeInTheDocument();
});

it("reverts embedding model changes without saving", async () => {
  const fetchMock = createFetchMock();
  globalThis.fetch = fetchMock as typeof fetch;

  render(<App />);

  await screen.findByText("No projects yet");
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));

  const embeddingInput = screen.getByLabelText("Embedding model") as HTMLInputElement;
  const originalValue = embeddingInput.value;

  fireEvent.change(embeddingInput, { target: { value: "custom-embedding-model" } });
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

  expect(await screen.findByRole("dialog", { name: "Embedding model changed" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Revert" }));

  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Embedding model changed" })).not.toBeInTheDocument();
  });

  expect((screen.getByLabelText("Embedding model") as HTMLInputElement).value).toBe(originalValue);

  const settingsPutCalls = fetchMock.mock.calls.filter(
    (call) =>
      call[0] === "http://127.0.0.1:8000/settings/model" &&
      (call[1] as RequestInit | undefined)?.method === "PUT"
  );
  expect(settingsPutCalls).toHaveLength(0);
});

it("continues embedding model changes by saving and reindexing existing documents", async () => {
  const seedProject: MockProject = {
    id: "project-1",
    name: "Field Notes",
    accent: "#c2410c",
    createdAt: "2026-04-03T12:00:00.000Z",
    updatedAt: "2026-04-03T12:00:00.000Z"
  };

  const readyDocument: MockDocument = {
    id: "document-1",
    projectId: "project-1",
    name: "launch-overview.pdf",
    filePath: "/tmp/launch-overview.pdf",
    md5: "md5-1",
    status: "ready",
    progress: 100,
    createdAt: "2026-04-03T12:00:00.000Z",
    updatedAt: "2026-04-03T12:00:00.000Z"
  };

  const fetchMock = createFetchMock({
    projects: [seedProject],
    documentsByProject: { "project-1": [readyDocument] }
  });
  globalThis.fetch = fetchMock as typeof fetch;

  render(<App />);

  await screen.findByRole("button", { name: /Field Notes 1 files/i });
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));

  fireEvent.change(screen.getByLabelText("Embedding model"), {
    target: { value: "custom-embedding-model" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

  expect(await screen.findByRole("dialog", { name: "Embedding model changed" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/settings/model",
      expect.objectContaining({ method: "PUT" })
    );
  });

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/projects/project-1/documents/document-1/reindex",
      expect.objectContaining({ method: "POST" })
    );
  });
});


  it(
    "polls indexing progress until a document becomes ready",
    async () => {
      const seedProject: MockProject = {
        id: "project-1",
        name: "Field Notes",
        accent: "#c2410c",
        createdAt: "2026-04-03T12:00:00.000Z",
        updatedAt: "2026-04-03T12:00:00.000Z"
      };
      const queuedDocument: MockDocument = {
        id: "document-1",
        projectId: "project-1",
        name: "launch-overview.pdf",
        filePath: "/tmp/launch-overview.pdf",
        md5: "md5-1",
        status: "queued",
        progress: 0,
        createdAt: "2026-04-03T12:00:00.000Z",
        updatedAt: "2026-04-03T12:00:00.000Z"
      };
      const indexingDocument: MockDocument = {
        ...queuedDocument,
        status: "indexing",
        progress: 42,
        updatedAt: "2026-04-03T12:01:00.000Z"
      };
      const readyDocument: MockDocument = {
        ...queuedDocument,
        status: "ready",
        progress: 100,
        updatedAt: "2026-04-03T12:02:00.000Z"
      };
      const fetchMock = createFetchMock({
        projects: [seedProject],
        documentsByProject: { "project-1": [queuedDocument] },
        documentSequencesByProject: {
          "project-1": [[queuedDocument], [indexingDocument], [readyDocument]]
        }
      });
      globalThis.fetch = fetchMock as typeof fetch;

      render(<App />);

      fireEvent.click(await screen.findByRole("button", { name: /Field Notes 1 files/i }));
      expect(await screen.findByText("Queued")).toBeInTheDocument();
      expect(await screen.findByText("Indexing 42%", {}, { timeout: 3000 })).toBeInTheDocument();
      expect(await screen.findByText("Ready", {}, { timeout: 3000 })).toBeInTheDocument();
    },
    10000
  );

  it("reindexes a document through the backend", async () => {
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
      status: "file_changed",
      progress: 0,
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
    expect(await screen.findByText("File changed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reindex launch-overview.pdf" }));

    await waitFor(() => {
      expect(screen.getByText("Queued")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://127.0.0.1:8000/projects/project-1/documents/document-1/reindex",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
