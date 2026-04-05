import type {
  ChatMessageRecord,
  ChatThreadRecord,
  CitationRecord,
  CreateProjectRequest,
  DocumentRecord,
  DocumentStatus,
  ImportDocumentItem,
  ModelSettingsResponse,
  ProjectRecord,
  ProviderId
} from "@lmctrlf/shared";
import { useEffect, useState, type CSSProperties } from "react";

import {
  checkBackendHealth,
  createProjectThread,
  createWorkspaceProject,
  deleteProjectDocument,
  getModelSettings,
  importProjectDocuments,
  listProjectDocuments,
  listProjectThreads,
  listProjects,
  listThreadMessages,
  reindexProjectDocument,
  streamThreadMessage,
  updateModelSettings
} from "./api";
import {
  accessibilityOptions,
  defaultSelectedProviderId,
  providerProfiles,
  type AccessibilityOption,
  type ProviderDraft
} from "./defaults";
import "./styles.css";

type AppView = "projects" | "settings" | "project-files" | "project-chat" | "project-import";
type ThreadMap = Record<string, ChatThreadRecord[]>;
type MessageMap = Record<string, ChatMessageRecord[]>;
type BooleanMap = Record<string, boolean>;
type LocalFile = File & { path?: string };

interface StreamingAssistantState {
  threadId: string;
  role: string;
  content: string;
  reasoningContent: string;
  reasoningCollapsed: boolean;
  createdAt: string;
}

const accentPalette = ["#c2410c", "#14532d", "#1d4ed8", "#7c2d12", "#0f766e"];
const chatDrawerBreakpoint = 1180;

const getIsWideChatLayout = (): boolean => {
  return window.innerWidth >= chatDrawerBreakpoint;
};

const cloneProviders = (): ProviderDraft[] => providerProfiles.map((profile) => ({ ...profile }));

const cloneAccessibility = (): AccessibilityOption[] =>
  accessibilityOptions.map((option) => ({ ...option }));

const cloneThreads = (): ThreadMap => ({});
const cloneMessages = (): MessageMap => ({});
const cloneFlags = (): BooleanMap => ({});

const documentStatusLabels: Record<DocumentStatus, string> = {
  queued: "Queued",
  indexing: "Indexing",
  paused: "Paused",
  ready: "Ready",
  file_changed: "File changed"
};

const formatDocumentStatus = (document: DocumentRecord): string => {
  if (document.status === "indexing") {
    return `Indexing ${document.progress.toString().padStart(2, "0")}%`;
  }
  return documentStatusLabels[document.status];
};

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : "Something went wrong.";
};

const isBackendConnectionError = (error: unknown): boolean => {
  return getErrorMessage(error) === "Could not connect to the backend.";
};

const resolveFilePath = (file: File): string => {
  const bridgedPath = window.lmctrlf?.getPathForFile(file) ?? "";
  if (bridgedPath.length > 0) {
    return bridgedPath;
  }

  const localPath = (file as LocalFile).path;
  return typeof localPath === "string" ? localPath : "";
};

const buildTemporaryId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const renderInlineMarkdown = (text: string) => {
  const pattern = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  const nodes: Array<string | JSX.Element> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = pattern.exec(text);
  let key = 0;

  while (match) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      nodes.push(
        <a href={match[3]} key={`inline-${key}`} rel="noreferrer" target="_blank">
          {match[2]}
        </a>
      );
    } else if (match[5]) {
      nodes.push(<code key={`inline-${key}`}>{match[5]}</code>);
    } else if (match[7]) {
      nodes.push(<strong key={`inline-${key}`}>{match[7]}</strong>);
    } else if (match[9]) {
      nodes.push(<em key={`inline-${key}`}>{match[9]}</em>);
    }

    lastIndex = pattern.lastIndex;
    key += 1;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

const renderMarkdownBlocks = (markdown: string) => {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return null;
  }

  const blocks = normalized.split(/\n{2,}/);

  return blocks.map((block, blockIndex) => {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const firstLine = lines[0]?.trim() ?? "";

    if (lines.every((line) => /^[-*]\s+/.test(line.trim()))) {
      return (
        <ul key={`block-${blockIndex}`}>
          {lines.map((line, itemIndex) => (
            <li key={`item-${blockIndex}-${itemIndex}`}>
              {renderInlineMarkdown(line.trim().replace(/^[-*]\s+/, ""))}
            </li>
          ))}
        </ul>
      );
    }

    const orderedListMatches = lines.map((line) => line.trim().match(/^\d+\.\s+(.*)$/));
    if (orderedListMatches.every((item) => item)) {
      return (
        <ol key={`block-${blockIndex}`}>
          {orderedListMatches.map((item, itemIndex) => (
            <li key={`item-${blockIndex}-${itemIndex}`}>{renderInlineMarkdown(item?.[1] ?? "")}</li>
          ))}
        </ol>
      );
    }

    const headingMatch = firstLine.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];

      if (level === 1) {
        return <h1 key={`block-${blockIndex}`}>{renderInlineMarkdown(content)}</h1>;
      }
      if (level === 2) {
        return <h2 key={`block-${blockIndex}`}>{renderInlineMarkdown(content)}</h2>;
      }
      if (level === 3) {
        return <h3 key={`block-${blockIndex}`}>{renderInlineMarkdown(content)}</h3>;
      }
      if (level === 4) {
        return <h4 key={`block-${blockIndex}`}>{renderInlineMarkdown(content)}</h4>;
      }
      if (level === 5) {
        return <h5 key={`block-${blockIndex}`}>{renderInlineMarkdown(content)}</h5>;
      }
      return <h6 key={`block-${blockIndex}`}>{renderInlineMarkdown(content)}</h6>;
    }

    if (lines.length >= 2 && lines[0]?.startsWith("```") && lines.at(-1)?.trim() === "```") {
      const code = lines.slice(1, -1).join("\n");
      return (
        <pre key={`block-${blockIndex}`}>
          <code>{code}</code>
        </pre>
      );
    }

    if (lines.every((line) => line.trim().startsWith(">"))) {
      return (
        <blockquote key={`block-${blockIndex}`}>
          <p>{renderInlineMarkdown(lines.map((line) => line.trim().replace(/^>\s?/, "")).join(" "))}</p>
        </blockquote>
      );
    }

    return <p key={`block-${blockIndex}`}>{renderInlineMarkdown(lines.join(" "))}</p>;
  });
};

const buildPendingUserMessage = (threadId: string, content: string): ChatMessageRecord => {
  return {
    id: buildTemporaryId("pending-user"),
    threadId,
    senderType: "user",
    role: "User",
    content,
    reasoningContent: "",
    citations: [],
    createdAt: new Date().toISOString()
  };
};

const buildStreamingAssistantState = (threadId: string, role: string): StreamingAssistantState => {
  return {
    threadId,
    role,
    content: "",
    reasoningContent: "",
    reasoningCollapsed: false,
    createdAt: new Date().toISOString()
  };
};

const upsertThread = (
  current: ChatThreadRecord[],
  nextThread: ChatThreadRecord
): ChatThreadRecord[] => {
  return [nextThread, ...current.filter((thread) => thread.id !== nextThread.id)];
};

const mergeCompletedMessages = (
  current: ChatMessageRecord[],
  userMessage: ChatMessageRecord,
  assistantMessage: ChatMessageRecord
): ChatMessageRecord[] => {
  const withoutDuplicates = current.filter(
    (message) => message.id !== userMessage.id && message.id !== assistantMessage.id
  );
  return [...withoutDuplicates, userMessage, assistantMessage].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );
};

const App = () => {
  const [view, setView] = useState<AppView>("projects");
  const [projectList, setProjectList] = useState<ProjectRecord[]>([]);
  const [documentsByProject, setDocumentsByProject] = useState<Record<string, DocumentRecord[]>>({});
  const [threadsByProject, setThreadsByProject] = useState<ThreadMap>(cloneThreads);
  const [messagesByThread, setMessagesByThread] = useState<MessageMap>(cloneMessages);
  const [loadedThreadProjects, setLoadedThreadProjects] = useState<BooleanMap>(cloneFlags);
  const [loadedMessagesByThread, setLoadedMessagesByThread] = useState<BooleanMap>(cloneFlags);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [providerList, setProviderList] = useState<ProviderDraft[]>(cloneProviders);
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>(
    providerProfiles[0]?.id ?? defaultSelectedProviderId
  );
  const [accessibilityList, setAccessibilityList] =
    useState<AccessibilityOption[]>(cloneAccessibility);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [pendingProjectName, setPendingProjectName] = useState("");
  const [isWideChatLayout, setIsWideChatLayout] = useState(getIsWideChatLayout);
  const [isThreadPanelOpen, setIsThreadPanelOpen] = useState(getIsWideChatLayout);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [backendDialogMessage, setBackendDialogMessage] = useState("");
  const [workspaceError, setWorkspaceError] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingModelSettings, setIsSavingModelSettings] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [composerValue, setComposerValue] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<ChatMessageRecord | null>(null);
  const [streamingAssistant, setStreamingAssistant] = useState<StreamingAssistantState | null>(null);
  const [expandedReasoningByMessageId, setExpandedReasoningByMessageId] =
    useState<BooleanMap>(cloneFlags);

  const handleWorkspaceError = (error: unknown) => {
    const message = getErrorMessage(error);

    if (isBackendConnectionError(error)) {
      setWorkspaceError("");
      setBackendDialogMessage(message);
      return;
    }

    setBackendDialogMessage("");
    setWorkspaceError(message);
  };

  const syncProjectDocuments = async (projectId: string): Promise<DocumentRecord[]> => {
    const nextDocuments = await listProjectDocuments(projectId);
    setBackendDialogMessage("");
    setDocumentsByProject((current) => ({
      ...current,
      [projectId]: nextDocuments
    }));
    return nextDocuments;
  };

  const syncProjectThreads = async (projectId: string): Promise<ChatThreadRecord[]> => {
    const nextThreads = await listProjectThreads(projectId);
    setBackendDialogMessage("");
    setThreadsByProject((current) => ({
      ...current,
      [projectId]: nextThreads
    }));
    setLoadedThreadProjects((current) => ({
      ...current,
      [projectId]: true
    }));
    return nextThreads;
  };

  const syncThreadMessages = async (
    projectId: string,
    threadId: string
  ): Promise<ChatMessageRecord[]> => {
    const nextMessages = await listThreadMessages(projectId, threadId);
    setBackendDialogMessage("");
    setMessagesByThread((current) => ({
      ...current,
      [threadId]: nextMessages
    }));
    setLoadedMessagesByThread((current) => ({
      ...current,
      [threadId]: true
    }));
    return nextMessages;
  };

  const loadWorkspace = async () => {
    setIsLoadingWorkspace(true);
    setWorkspaceError("");

    try {
      await checkBackendHealth();
    } catch (error) {
      setBackendDialogMessage(getErrorMessage(error));
      setProjectList([]);
      setDocumentsByProject({});
      setThreadsByProject(cloneThreads());
      setMessagesByThread(cloneMessages());
      setLoadedThreadProjects(cloneFlags());
      setLoadedMessagesByThread(cloneFlags());
      setSelectedProjectId("");
      setSelectedThreadId("");
      setPendingUserMessage(null);
      setStreamingAssistant(null);
      setExpandedReasoningByMessageId(cloneFlags());
      setIsLoadingWorkspace(false);
      return;
    }

    setBackendDialogMessage("");

    try {
      const [settings, nextProjects] = await Promise.all([getModelSettings(), listProjects()]);
      const nextDocuments = await Promise.all(
        nextProjects.map(async (project) => [project.id, await listProjectDocuments(project.id)] as const)
      );

      setProviderList(settings.providers);
      setSelectedProviderId(settings.selectedProviderId);
      setProjectList(nextProjects);
      setDocumentsByProject(Object.fromEntries(nextDocuments));
      setThreadsByProject(Object.fromEntries(nextProjects.map((project) => [project.id, []])));
      setMessagesByThread({});
      setLoadedThreadProjects({});
      setLoadedMessagesByThread({});
      setPendingUserMessage(null);
      setStreamingAssistant(null);
      setExpandedReasoningByMessageId({});
    } catch (error) {
      handleWorkspaceError(error);

      if (!isBackendConnectionError(error)) {
        setProjectList([]);
        setDocumentsByProject({});
        setThreadsByProject(cloneThreads());
        setMessagesByThread(cloneMessages());
        setLoadedThreadProjects(cloneFlags());
        setLoadedMessagesByThread(cloneFlags());
        setSelectedProjectId("");
        setSelectedThreadId("");
        setPendingUserMessage(null);
        setStreamingAssistant(null);
        setExpandedReasoningByMessageId(cloneFlags());
      }
    } finally {
      setIsLoadingWorkspace(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsWideChatLayout(getIsWideChatLayout());
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, []);

  useEffect(() => {
    if (projectList.length === 0) {
      setSelectedProjectId("");
      setSelectedThreadId("");

      if (view !== "projects" && view !== "settings") {
        setView("projects");
      }
      return;
    }

    if (!projectList.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projectList[0]?.id ?? "");
    }
  }, [projectList, selectedProjectId, view]);

  useEffect(() => {
    if (view !== "project-chat" || !selectedProjectId || loadedThreadProjects[selectedProjectId]) {
      return;
    }

    void syncProjectThreads(selectedProjectId).catch((error) => {
      handleWorkspaceError(error);
    });
  }, [loadedThreadProjects, selectedProjectId, view]);

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedThreadId("");
      return;
    }

    const projectThreads = threadsByProject[selectedProjectId] ?? [];
    if (projectThreads.length === 0) {
      setSelectedThreadId("");
      return;
    }

    if (!projectThreads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(projectThreads[0]?.id ?? "");
    }
  }, [selectedProjectId, selectedThreadId, threadsByProject]);

  useEffect(() => {
    if (view !== "project-chat" || !selectedProjectId || !selectedThreadId) {
      return;
    }

    if (loadedMessagesByThread[selectedThreadId]) {
      return;
    }

    void syncThreadMessages(selectedProjectId, selectedThreadId).catch((error) => {
      handleWorkspaceError(error);
    });
  }, [loadedMessagesByThread, selectedProjectId, selectedThreadId, view]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    const selectedProjectDocuments = documentsByProject[selectedProjectId] ?? [];
    const hasActiveIndexing = selectedProjectDocuments.some(
      (document) => document.status === "queued" || document.status === "indexing"
    );

    if (!hasActiveIndexing) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void syncProjectDocuments(selectedProjectId).catch((error) => {
        handleWorkspaceError(error);
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [documentsByProject, selectedProjectId]);

  useEffect(() => {
    setExpandedReasoningByMessageId({});
  }, [selectedThreadId, view]);

  const selectedProject =
    projectList.find((project) => project.id === selectedProjectId) ?? projectList[0] ?? null;
  const selectedDocuments = selectedProject ? documentsByProject[selectedProject.id] ?? [] : [];
  const selectedThreads = selectedProject ? threadsByProject[selectedProject.id] ?? [] : [];
  const selectedThread =
    selectedThreads.find((thread) => thread.id === selectedThreadId) ?? selectedThreads[0] ?? null;
  const selectedThreadMessages = selectedThread ? messagesByThread[selectedThread.id] ?? [] : [];
  const selectedProvider =
    providerList.find((provider) => provider.id === selectedProviderId) ?? providerList[0];
  const isChatProviderImplemented = selectedProvider?.id === "lm-studio";
  const isLoadingSelectedThreadMessages = selectedThread
    ? !loadedMessagesByThread[selectedThread.id]
    : false;
  const showTabs = view === "projects" || view === "settings";

  const renderMessages = selectedThread
    ? [
        ...selectedThreadMessages,
        ...(pendingUserMessage && pendingUserMessage.threadId === selectedThread.id
          ? [pendingUserMessage]
          : []),
        ...(streamingAssistant && streamingAssistant.threadId === selectedThread.id
          ? [
              {
                id: "streaming-assistant",
                threadId: selectedThread.id,
                senderType: "assistant" as const,
                role: streamingAssistant.role,
                content: streamingAssistant.content,
                reasoningContent: streamingAssistant.reasoningContent,
                citations: [],
                createdAt: streamingAssistant.createdAt
              }
            ]
          : [])
      ]
    : [];

  const handleSelectTopLevel = (target: "projects" | "settings") => {
    setView(target);
  };

  const handleOpenProject = (projectId: string = selectedProjectId) => {
    setSelectedProjectId(projectId);
    setView("project-files");
  };

  const handleOpenCreateProjectDialog = () => {
    setPendingProjectName("");
    setIsCreateProjectDialogOpen(true);
  };

  const handleCloseCreateProjectDialog = () => {
    setPendingProjectName("");
    setIsCreateProjectDialogOpen(false);
  };

  const handleCreateProject = async (projectName: string) => {
    const name = projectName.trim();

    if (!name) {
      return;
    }

    setIsCreatingProject(true);
    setWorkspaceError("");

    try {
      const payload: CreateProjectRequest = {
        name,
        accent: accentPalette[projectList.length % accentPalette.length]
      };
      const project = await createWorkspaceProject(payload);

      setBackendDialogMessage("");
      setProjectList((current) => [project, ...current]);
      setDocumentsByProject((current) => ({ ...current, [project.id]: [] }));
      setThreadsByProject((current) => ({ ...current, [project.id]: [] }));
      setMessagesByThread((current) => ({ ...current }));
      setLoadedThreadProjects((current) => ({ ...current, [project.id]: true }));
      setSelectedProjectId(project.id);
      setSelectedThreadId("");
      setIsCreateProjectDialogOpen(false);
      setPendingProjectName("");
      setView("project-files");
    } catch (error) {
      handleWorkspaceError(error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!selectedProject) {
      return;
    }

    try {
      setWorkspaceError("");
      await deleteProjectDocument(selectedProject.id, documentId);
      setBackendDialogMessage("");
      setDocumentsByProject((current) => ({
        ...current,
        [selectedProject.id]: (current[selectedProject.id] ?? []).filter(
          (document) => document.id !== documentId
        )
      }));
    } catch (error) {
      handleWorkspaceError(error);
    }
  };

  const handleReindexDocument = async (documentId: string) => {
    if (!selectedProject) {
      return;
    }

    try {
      setWorkspaceError("");
      const document = await reindexProjectDocument(selectedProject.id, documentId);
      setBackendDialogMessage("");
      setDocumentsByProject((current) => ({
        ...current,
        [selectedProject.id]: (current[selectedProject.id] ?? []).map((entry) =>
          entry.id === document.id ? document : entry
        )
      }));
    } catch (error) {
      handleWorkspaceError(error);
    }
  };

  const handleSelectProjectView = (target: "project-files" | "project-chat" | "project-import") => {
    if (!selectedProject) {
      return;
    }

    if (target === "project-chat") {
      setIsThreadPanelOpen(isWideChatLayout);
    }

    setView(target);
  };

  const handleCreateThread = async () => {
    if (!selectedProject || isCreatingThread || isSendingMessage) {
      return;
    }

    try {
      setIsCreatingThread(true);
      setWorkspaceError("");
      const thread = await createProjectThread(selectedProject.id);
      setBackendDialogMessage("");
      setThreadsByProject((current) => ({
        ...current,
        [selectedProject.id]: upsertThread(current[selectedProject.id] ?? [], thread)
      }));
      setLoadedThreadProjects((current) => ({
        ...current,
        [selectedProject.id]: true
      }));
      setMessagesByThread((current) => ({
        ...current,
        [thread.id]: []
      }));
      setLoadedMessagesByThread((current) => ({
        ...current,
        [thread.id]: true
      }));
      setSelectedThreadId(thread.id);
      setComposerValue("");
      setStreamingAssistant(null);
      setPendingUserMessage(null);
    } catch (error) {
      handleWorkspaceError(error);
    } finally {
      setIsCreatingThread(false);
    }
  };

  const handleToggleThreadPanel = () => {
    setIsThreadPanelOpen((current) => !current);
  };

  const handleSelectThread = (threadId: string) => {
    if (isSendingMessage) {
      return;
    }

    setSelectedThreadId(threadId);
    setComposerValue("");
    setPendingUserMessage(null);
    setStreamingAssistant(null);

    if (!isWideChatLayout) {
      setIsThreadPanelOpen(false);
    }
  };

  const handleUpdateProviderField = (
    field: "baseUrl" | "embeddingModel" | "chattingModel" | "apiKey",
    value: string
  ) => {
    setProviderList((current) =>
      current.map((provider) =>
        provider.id === selectedProviderId
          ? {
              ...provider,
              [field]: value
            }
          : provider
      )
    );
  };

  const handleSaveModelSettings = async () => {
    const payload: ModelSettingsResponse = {
      selectedProviderId,
      providers: providerList
    };

    try {
      setIsSavingModelSettings(true);
      setWorkspaceError("");
      const saved = await updateModelSettings(payload);
      setBackendDialogMessage("");
      setProviderList(saved.providers);
      setSelectedProviderId(saved.selectedProviderId);
    } catch (error) {
      handleWorkspaceError(error);
    } finally {
      setIsSavingModelSettings(false);
    }
  };

  const handleToggleAccessibility = (optionId: string) => {
    setAccessibilityList((current) =>
      current.map((option) =>
        option.id === optionId
          ? {
              ...option,
              enabled: !option.enabled
            }
          : option
      )
    );
  };

  const handleImportFiles = async () => {
    if (!selectedProject || files.length === 0) {
      return;
    }

    setIsImporting(true);
    setWorkspaceError("");

    try {
      const items: ImportDocumentItem[] = files.map((file) => {
        const filePath = resolveFilePath(file);
        if (filePath.length === 0) {
          throw new Error(`Could not resolve a local path for ${file.name}.`);
        }

        return {
          name: file.name,
          filePath
        };
      });

      const nextDocuments = await importProjectDocuments(selectedProject.id, { items });
      setBackendDialogMessage("");
      setDocumentsByProject((current) => ({
        ...current,
        [selectedProject.id]: nextDocuments
      }));
      setFiles([]);
      setIsImportDialogOpen(false);
      setView("project-files");
    } catch (error) {
      handleWorkspaceError(error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleRetryBackend = () => {
    void loadWorkspace();
  };

  const handleToggleReasoning = (messageId: string) => {
    if (streamingAssistant && messageId === "streaming-assistant") {
      setStreamingAssistant((current) =>
        current
          ? {
              ...current,
              reasoningCollapsed: !current.reasoningCollapsed
            }
          : current
      );
      return;
    }

    setExpandedReasoningByMessageId((current) => ({
      ...current,
      [messageId]: !current[messageId]
    }));
  };

  const handleSendMessage = async () => {
    if (
      !selectedProject ||
      !selectedThread ||
      !selectedProvider ||
      !isChatProviderImplemented ||
      isSendingMessage
    ) {
      return;
    }

    const content = composerValue.trim();
    if (!content) {
      return;
    }

    const optimisticUserMessage = buildPendingUserMessage(selectedThread.id, content);
    setComposerValue("");
    setWorkspaceError("");
    setPendingUserMessage(optimisticUserMessage);
    setStreamingAssistant(buildStreamingAssistantState(selectedThread.id, selectedProvider.chattingModel));
    setIsSendingMessage(true);

    try {
      await streamThreadMessage(selectedProject.id, selectedThread.id, { content }, (event) => {
        if (event.type === "reasoning.delta") {
          setStreamingAssistant((current) =>
            current && current.threadId === selectedThread.id
              ? {
                  ...current,
                  reasoningContent: `${current.reasoningContent}${event.content}`,
                  reasoningCollapsed: false
                }
              : current
          );
          return;
        }

        if (event.type === "reasoning.end") {
          setStreamingAssistant((current) =>
            current && current.threadId === selectedThread.id
              ? {
                  ...current,
                  reasoningCollapsed: true
                }
              : current
          );
          return;
        }

        if (event.type === "message.delta") {
          setStreamingAssistant((current) =>
            current && current.threadId === selectedThread.id
              ? {
                  ...current,
                  content: `${current.content}${event.content}`
                }
              : current
          );
          return;
        }

        if (event.type === "completed") {
          setBackendDialogMessage("");
          setThreadsByProject((current) => ({
            ...current,
            [selectedProject.id]: upsertThread(current[selectedProject.id] ?? [], event.thread)
          }));
          setMessagesByThread((current) => ({
            ...current,
            [selectedThread.id]: mergeCompletedMessages(
              (current[selectedThread.id] ?? []).filter(
                (message) => message.id !== optimisticUserMessage.id
              ),
              event.userMessage,
              event.assistantMessage
            )
          }));
          setLoadedMessagesByThread((current) => ({
            ...current,
            [selectedThread.id]: true
          }));
          setPendingUserMessage(null);
          setStreamingAssistant(null);
        }
      });
    } catch (error) {
      let syncedUserMessage = false;

      try {
        await Promise.all([
          syncProjectThreads(selectedProject.id),
          syncThreadMessages(selectedProject.id, selectedThread.id)
        ]);
        syncedUserMessage = true;
      } catch {
        // Ignore sync failures here and let the shared error handler surface the original error.
      }

      if (syncedUserMessage) {
        setPendingUserMessage(null);
      }

      handleWorkspaceError(error);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const renderWorkspaceError = () => {
    if (!workspaceError) {
      return null;
    }

    return (
      <div className="status-banner" role="alert">
        {workspaceError}
      </div>
    );
  };

  const renderBackendDialog = () => {
    if (!backendDialogMessage) {
      return null;
    }

    return (
      <div className="dialog-backdrop" role="presentation">
        <div
          aria-describedby="backend-dialog-description"
          aria-labelledby="backend-dialog-title"
          aria-modal="true"
          className="dialog-card"
          role="dialog"
        >
          <h2 id="backend-dialog-title">Backend Unreachable</h2>
          <p id="backend-dialog-description">{backendDialogMessage}</p>
          <div className="dialog-actions">
            <button className="primary-action" onClick={handleRetryBackend} type="button">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderProjectsView = () => {
    return (
      <section className="projects-home">
        {renderWorkspaceError()}

        <div className="projects-home__toolbar">
          <button className="primary-action" onClick={handleOpenCreateProjectDialog} type="button">
            Create Project
          </button>
        </div>

        {isLoadingWorkspace ? (
          <section className="empty-panel">
            <h2>Loading projects</h2>
            <p>Reading the local project database.</p>
          </section>
        ) : null}

        {!isLoadingWorkspace && !backendDialogMessage && projectList.length === 0 ? (
          <section className="empty-panel">
            <h2>No projects yet</h2>
            <p>Create a project to start importing documents.</p>
          </section>
        ) : null}

        {!isLoadingWorkspace && projectList.length > 0 ? (
          <div className="project-list" role="list" aria-label="Projects">
            {projectList.map((project) => {
              const count = documentsByProject[project.id]?.length ?? 0;

              return (
                <button
                  className="project-tile"
                  key={project.id}
                  onClick={() => handleOpenProject(project.id)}
                  style={{ "--project-accent": project.accent } as CSSProperties}
                  type="button"
                >
                  <span className="project-tile__name">{project.name}</span>
                  <span className="project-tile__count">{count} files</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>
    );
  };

  const renderProjectView = () => {
    if (!selectedProject) {
      return null;
    }

    return (
      <section className="project-page project-page--locked">
        <header className="project-toolbar">
          <button className="ghost-action" onClick={() => setView("projects")} type="button">
            Back
          </button>

          <div className="project-toolbar__center">
            <div className="project-toolbar__title">
              <h1>{selectedProject.name}</h1>
            </div>

            <div className="project-tabs" aria-label="Project navigation">
              <button
                aria-pressed={view === "project-files"}
                className={`project-tabs__button ${view === "project-files" ? "project-tabs__button--active" : ""}`}
                onClick={() => handleSelectProjectView("project-files")}
                type="button"
              >
                File management
              </button>
              <button
                aria-pressed={view === "project-chat"}
                className={`project-tabs__button ${view === "project-chat" ? "project-tabs__button--active" : ""}`}
                onClick={() => handleSelectProjectView("project-chat")}
                type="button"
              >
                Chat
              </button>
            </div>
          </div>
        </header>

        {renderWorkspaceError()}

        <section className="project-body">
          <section className="table-card table-card--scroll-shell">
            <div className="file-management-toolbar">
              <button
                className="secondary-action"
                onClick={() => handleSelectProjectView("project-import")}
                type="button"
              >
                Import Files
              </button>
            </div>

            <div className="table-wrapper table-wrapper--scroll">
              <table className="file-table">
                <thead>
                  <tr>
                    <th scope="col">File name</th>
                    <th scope="col">Status</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDocuments.length > 0 ? (
                    selectedDocuments.map((document) => (
                      <tr key={document.id}>
                        <td>{document.name}</td>
                        <td>
                          <span className={`status-pill status-pill--${document.status.replaceAll("_", "-")}`}>
                            {formatDocumentStatus(document)}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              aria-label={`Delete ${document.name}`}
                              className="ghost-action ghost-action--danger"
                              onClick={() => void handleDeleteDocument(document.id)}
                              type="button"
                            >
                              Delete
                            </button>
                            <button
                              aria-label={`Reindex ${document.name}`}
                              className="ghost-action"
                              onClick={() => handleReindexDocument(document.id)}
                              type="button"
                            >
                              Reindex
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="empty-table" colSpan={3}>
                        No documents yet. Import files to start building this project.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </section>
    );
  };

  const renderThreadList = () => {
    if (selectedThreads.length === 0) {
      return (
        <p className="thread-list__empty">
          No threads yet. Create one when you are ready to start a conversation.
        </p>
      );
    }

    return (
      <div className="thread-list thread-list--scroll" role="list" aria-label="Project threads">
        {selectedThreads.map((thread) => (
          <button
            aria-pressed={thread.id === selectedThread?.id}
            className={`thread-item ${thread.id === selectedThread?.id ? "thread-item--active" : ""}`}
            disabled={isSendingMessage}
            key={thread.id}
            onClick={() => handleSelectThread(thread.id)}
            title={thread.summary || undefined}
            type="button"
          >
            <span className="thread-item__title">{thread.title}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderReasoningBlock = (
    messageId: string,
    reasoningContent: string,
    isCollapsed: boolean
  ) => {
    if (!reasoningContent.trim()) {
      return null;
    }

    return (
      <div className="message-reasoning">
        <button
          aria-expanded={!isCollapsed}
          className="message-reasoning__toggle"
          onClick={() => handleToggleReasoning(messageId)}
          type="button"
        >
          {isCollapsed ? "Show thinking process" : "Hide thinking process"}
        </button>
        {!isCollapsed ? (
          <div className="message-reasoning__body">
            <span className="message-reasoning__label">Thinking process:</span>
            <p>{reasoningContent}</p>
          </div>
        ) : null}
      </div>
    );
  };

  const renderCitations = (citations: CitationRecord[]) => {
    if (citations.length === 0) {
      return null;
    }

    return (
      <div className="message-citations">
        <span className="message-citations__label">Sources</span>
        <ul className="message-citations__list">
          {citations.map((citation, index) => (
            <li className="message-citations__item" key={`${citation.documentId}-${citation.pageNumber}-${citation.chunkIndex}-${index}`}>
              <span className="message-citations__title">
                [{index + 1}] {citation.documentName} · page {citation.pageNumber}
              </span>
              <p>{citation.snippet}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderMessageContent = (message: ChatMessageRecord) => {
    if (message.senderType === "assistant") {
      return <div className="message-bubble__markdown">{renderMarkdownBlocks(message.content)}</div>;
    }

    return <p>{message.content}</p>;
  };

  const renderChatView = () => {
    if (!selectedProject) {
      return null;
    }

    return (
      <section className="chat-page chat-page--locked">
        <button
          aria-expanded={isThreadPanelOpen}
          className="ghost-action thread-toggle-fab"
          onClick={handleToggleThreadPanel}
          type="button"
        >
          Threads
        </button>

        <header className="project-toolbar">
          <button
            className="ghost-action"
            disabled={isSendingMessage}
            onClick={() => setView("projects")}
            type="button"
          >
            Back
          </button>

          <div className="project-toolbar__title">
            <h1>{selectedProject.name}</h1>
          </div>

          <div className="project-tabs" aria-label="Project navigation">
            <button
              aria-pressed={false}
              className="project-tabs__button"
              disabled={isSendingMessage}
              onClick={() => handleSelectProjectView("project-files")}
              type="button"
            >
              File management
            </button>
            <button
              aria-pressed
              className="project-tabs__button project-tabs__button--active"
              onClick={() => handleSelectProjectView("project-chat")}
              type="button"
            >
              Chat
            </button>
          </div>
        </header>

        {renderWorkspaceError()}

        <div
          className={`chat-layout ${!isWideChatLayout ? "chat-layout--compact" : ""} ${isWideChatLayout && !isThreadPanelOpen ? "chat-layout--expanded" : ""}`}
        >
          {isWideChatLayout && isThreadPanelOpen ? (
            <aside className="thread-sidebar thread-sidebar--scroll-shell">
              <div className="thread-sidebar__header">
                <button
                  className="secondary-action secondary-action--compact"
                  disabled={isCreatingThread || isSendingMessage}
                  onClick={() => void handleCreateThread()}
                  type="button"
                >
                  New Thread
                </button>
              </div>

              {renderThreadList()}
            </aside>
          ) : null}

          <section className="conversation-panel conversation-panel--scroll-shell">
            {selectedThread ? (
              <>
                <header className="conversation-panel__header">
                  <div>
                    <h2>{selectedThread.title}</h2>
                  </div>
                </header>

                <div className="message-stream message-stream--scroll">
                  {isLoadingSelectedThreadMessages ? (
                    <section className="empty-panel">
                      <h2>Loading conversation</h2>
                      <p>Reading the saved chat history for this thread.</p>
                    </section>
                  ) : renderMessages.length > 0 ? (
                    renderMessages.map((message) => {
                      const isStreamingMessage = message.id === "streaming-assistant";
                      const reasoningCollapsed = isStreamingMessage
                        ? (streamingAssistant?.reasoningCollapsed ?? true)
                        : !expandedReasoningByMessageId[message.id];

                      return (
                        <article
                          className={`message-bubble message-bubble--${message.senderType}`}
                          key={message.id}
                        >
                          <span className="message-bubble__role">{message.role}</span>
                          {renderReasoningBlock(
                            message.id,
                            message.reasoningContent,
                            reasoningCollapsed
                          )}
                          {renderMessageContent(message)}
                          {message.senderType === "assistant" ? renderCitations(message.citations) : null}
                        </article>
                      );
                    })
                  ) : (
                    <section className="empty-panel">
                      <h2>No messages yet</h2>
                      <p>Start the conversation when you are ready.</p>
                    </section>
                  )}
                </div>

                <footer className="composer-card">
                  <textarea
                    className="composer-card__input"
                    disabled={!isChatProviderImplemented || isSendingMessage}
                    id="chat-composer"
                    onChange={(event) => setComposerValue(event.target.value)}
                    placeholder={
                      isChatProviderImplemented
                        ? "Ask a question about your project."
                        : `${selectedProvider?.name ?? "Selected provider"} (not implemented yet)`
                    }
                    rows={4}
                    value={composerValue}
                  />
                  <div className="composer-card__footer">
                    <span>
                      {isChatProviderImplemented
                        ? "Threads stay grouped by project."
                        : `${selectedProvider?.name ?? "This provider"} (not implemented yet)`}
                    </span>
                    <button
                      className="primary-action"
                      disabled={
                        !isChatProviderImplemented ||
                        isSendingMessage ||
                        composerValue.trim().length === 0
                      }
                      onClick={() => void handleSendMessage()}
                      type="button"
                    >
                      Send
                    </button>
                  </div>
                </footer>
              </>
            ) : (
              <div className="empty-panel">
                <h2>No threads yet</h2>
                <p>Create a saved thread to start a conversation for this project.</p>
              </div>
            )}
          </section>
        </div>

        {!isWideChatLayout && isThreadPanelOpen ? (
          <div className="thread-drawer" role="dialog" aria-label="Thread drawer">
            <button
              aria-label="Close thread drawer"
              className="thread-drawer__backdrop"
              onClick={handleToggleThreadPanel}
              type="button"
            />
            <aside className="thread-sidebar thread-sidebar--drawer thread-sidebar--scroll-shell">
              <div className="thread-sidebar__header">
                <button
                  className="secondary-action secondary-action--compact"
                  disabled={isCreatingThread || isSendingMessage}
                  onClick={() => void handleCreateThread()}
                  type="button"
                >
                  New Thread
                </button>
              </div>

              {renderThreadList()}
            </aside>
          </div>
        ) : null}
      </section>
    );
  };

  const renderSettingsView = () => {
    if (!selectedProvider) {
      return null;
    }

    return (
      <section className="settings-page">
        <section className="settings-card">
          <h1>Model settings</h1>

          <form className="settings-form" id="settings-form">
            <label className="form-field">
              <span>Provider</span>
              <select
                onChange={(event) => setSelectedProviderId(event.target.value as ProviderDraft["id"])}
                value={selectedProviderId}
              >
                {providerList.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Base URL (required)</span>
              <input
                
                onChange={(event) => handleUpdateProviderField("baseUrl", event.target.value)}
                type="text"
                value={selectedProvider.baseUrl}
              />
            </label>

            <label className="form-field">
              <span>Embedding model (required)</span>
              <input
                
                onChange={(event) => handleUpdateProviderField("embeddingModel", event.target.value)}
                type="text"
                value={selectedProvider.embeddingModel}
              />
            </label>

            <label className="form-field">
              <span>Chatting model (required)</span>
              <input
                
                onChange={(event) => handleUpdateProviderField("chattingModel", event.target.value)}
                type="text"
                value={selectedProvider.chattingModel}
              />
            </label>

            <label className="form-field">
              <span>API key</span>
              <input
                onChange={(event) => handleUpdateProviderField("apiKey", event.target.value)}
                type="password"
                value={selectedProvider.apiKey}
              />
            </label>

            <div className="settings-actions">
              <button
                className="primary-action"
                disabled={isSavingModelSettings}
                onClick={() => void handleSaveModelSettings()}
                type="button"
              >
                Save settings
              </button>
            </div>
          </form>
        </section>

        <section className="settings-card">
          <h1>Accessibility</h1>

          <div className="switch-list">
            {accessibilityList.map((option) => (
              <label className="switch-row" key={option.id}>
                <span className="switch-row__copy">
                  <span className="switch-row__label">{option.label}</span>
                  <span className="switch-row__description">{option.description}</span>
                </span>
                <span className="switch-control">
                  <input
                    checked={option.enabled}
                    onChange={() => handleToggleAccessibility(option.id)}
                    type="checkbox"
                  />
                  <span className="switch-control__track" />
                </span>
              </label>
            ))}
          </div>
        </section>
      </section>
    );
  };

  const renderImportView = () => {
    if (!selectedProject) {
      return null;
    }

    return (
      <section className="project-page project-page--locked">
        <header className="project-toolbar">
          <button className="ghost-action" onClick={() => handleSelectProjectView("project-files")} type="button">
            Back
          </button>

          <div className="project-toolbar__title">
            <h1>{selectedProject.name}</h1>
          </div>
        </header>

        {renderWorkspaceError()}

        <section className="project-body">
          <section className="import-shell">
            <div
              className={`import-dropzone ${isDragging ? "import-dropzone--active" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setIsDragging(false);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                const droppedFiles = Array.from(event.dataTransfer.files ?? []);
                setFiles(droppedFiles);
              }}
            >
              <img alt="" className="import-dropzone__icon" src="/dragndroparrow.png" />
              <p>Drag PDF files here or choose them from disk.</p>
              <label className="secondary-action">
                Select Files
                <input
                  accept="application/pdf"
                  multiple
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                  type="file"
                />
              </label>
            </div>

            <div className="import-selection">
              <h2>Selected files</h2>
              {files.length > 0 ? (
                <ul>
                  {files.map((file) => (
                    <li key={`${file.name}-${file.size}`}>{file.name}</li>
                  ))}
                </ul>
              ) : (
                <p>No files selected yet.</p>
              )}
            </div>

            <div className="import-actions">
              <button
                className="primary-action"
                disabled={files.length === 0 || isImporting}
                onClick={() => setIsImportDialogOpen(true)}
                type="button"
              >
                Import
              </button>
            </div>
          </section>
        </section>
      </section>
    );
  };

  return (
    <main className={`workspace-shell ${showTabs ? "" : "workspace-shell--immersive"}`}>
      {showTabs ? (
        <>
          <header className="top-tabs" aria-label="Primary navigation">
            <button
              aria-pressed={view === "projects"}
              className={`top-tabs__button ${view === "projects" ? "top-tabs__button--active" : ""}`}
              onClick={() => handleSelectTopLevel("projects")}
              type="button"
            >
              Projects
            </button>
            <button
              aria-pressed={view === "settings"}
              className={`top-tabs__button ${view === "settings" ? "top-tabs__button--active" : ""}`}
              onClick={() => handleSelectTopLevel("settings")}
              type="button"
            >
              Settings
            </button>
          </header>

          <section className="page-frame">
            {view === "projects" ? renderProjectsView() : null}
            {view === "settings" ? renderSettingsView() : null}
          </section>
        </>
      ) : null}

      {!showTabs ? (
        <>
          {view === "project-files" ? renderProjectView() : null}
          {view === "project-chat" ? renderChatView() : null}
          {view === "project-import" ? renderImportView() : null}
        </>
      ) : null}

      {isCreateProjectDialogOpen ? (
        <div className="dialog-backdrop" role="presentation">
          <div
            aria-describedby="create-project-description"
            aria-labelledby="create-project-title"
            aria-modal="true"
            className="dialog-card"
            role="dialog"
          >
            <h2 id="create-project-title">Create Project</h2>
            <p id="create-project-description">Pick a name for the workspace you want to build.</p>

            <label className="form-field" htmlFor="project-name">
              <span>Project name</span>
              <input
                autoFocus
                id="project-name"
                onChange={(event) => setPendingProjectName(event.target.value)}
                value={pendingProjectName}
              />
            </label>

            <div className="dialog-actions">
              <button className="ghost-action" onClick={handleCloseCreateProjectDialog} type="button">
                Cancel
              </button>
              <button
                className="primary-action"
                disabled={isCreatingProject || pendingProjectName.trim().length === 0}
                onClick={() => void handleCreateProject(pendingProjectName)}
                type="button"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isImportDialogOpen ? (
        <div className="dialog-backdrop" role="presentation">
          <div
            aria-describedby="import-warning-description"
            aria-labelledby="import-warning-title"
            aria-modal="true"
            className="dialog-card"
            role="dialog"
          >
            <h2 id="import-warning-title">Import files?</h2>
            <p id="import-warning-description">
              The current importer stores file paths locally and begins indexing immediately after the
              records are created.
            </p>

            <div className="dialog-actions">
              <button className="ghost-action" onClick={() => setIsImportDialogOpen(false)} type="button">
                Cancel
              </button>
              <button
                className="primary-action"
                disabled={isImporting}
                onClick={() => void handleImportFiles()}
                type="button"
              >
                I Understand &amp; Import
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {renderBackendDialog()}
    </main>
  );
};

export default App;
