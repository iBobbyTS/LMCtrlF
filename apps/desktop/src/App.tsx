import type {
  CreateProjectRequest,
  DocumentRecord,
  DocumentStatus,
  ImportDocumentItem,
  ModelSettingsResponse,
  ProjectRecord
} from "@lmctrlf/shared";
import { useEffect, useState, type CSSProperties } from "react";

import {
  checkBackendHealth,
  createWorkspaceProject,
  deleteProjectDocument,
  getModelSettings,
  importProjectDocuments,
  listProjectDocuments,
  listProjects,
  reindexProjectDocument,
  updateModelSettings
} from "./api";
import {
  accessibilityOptions,
  defaultSelectedProviderId,
  providerProfiles,
  type AccessibilityOption,
  type ChatThread,
  type ProviderDraft
} from "./defaults";
import "./styles.css";

type AppView = "projects" | "settings" | "project-files" | "project-chat" | "project-import";
type ThreadMap = Record<string, ChatThread[]>;
type LocalFile = File & { path?: string };

const accentPalette = ["#c2410c", "#14532d", "#1d4ed8", "#7c2d12", "#0f766e"];
const chatDrawerBreakpoint = 1180;

const getIsWideChatLayout = (): boolean => {
  return window.innerWidth >= chatDrawerBreakpoint;
};

const cloneProviders = (): ProviderDraft[] => providerProfiles.map((profile) => ({ ...profile }));

const cloneAccessibility = (): AccessibilityOption[] =>
  accessibilityOptions.map((option) => ({ ...option }));

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

const cloneThreads = (): ThreadMap => ({});

const buildStarterThread = (projectId: string, threadCount: number): ChatThread => {
  const id = `${projectId}-thread-${threadCount}`;

  return {
    id,
    title: `New thread ${threadCount}`,
    updatedAt: "Just now",
    summary: "Use this space for a focused follow-up question.",
    messages: [
      {
        id: `${id}-message-1`,
        role: "assistant",
        content:
          "Ask a question about the imported documents once indexing is available. This thread stays local for now."
      }
    ]
  };
};

const resolveFilePath = (file: File): string => {
  const bridgedPath = window.lmctrlf?.getPathForFile(file) ?? "";
  if (bridgedPath.length > 0) {
    return bridgedPath;
  }

  const localPath = (file as LocalFile).path;
  return typeof localPath === "string" ? localPath : "";
};

const App = () => {
  const [view, setView] = useState<AppView>("projects");
  const [projectList, setProjectList] = useState<ProjectRecord[]>([]);
  const [documentsByProject, setDocumentsByProject] = useState<Record<string, DocumentRecord[]>>({});
  const [threadsByProject, setThreadsByProject] = useState<ThreadMap>(cloneThreads);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [providerList, setProviderList] = useState<ProviderDraft[]>(cloneProviders);
  const [selectedProviderId, setSelectedProviderId] = useState(
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

  const syncProjectDocuments = async (projectId: string): Promise<DocumentRecord[]> => {
    const nextDocuments = await listProjectDocuments(projectId);
    setDocumentsByProject((current) => ({
      ...current,
      [projectId]: nextDocuments
    }));
    return nextDocuments;
  };

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
      setSelectedProjectId("");
      setSelectedThreadId("");
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
      setThreadsByProject((current) =>
        Object.fromEntries(nextProjects.map((project) => [project.id, current[project.id] ?? []]))
      );
    } catch (error) {
      handleWorkspaceError(error);

      if (!isBackendConnectionError(error)) {
        setProjectList([]);
        setDocumentsByProject({});
        setThreadsByProject(cloneThreads());
        setSelectedProjectId("");
        setSelectedThreadId("");
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

  const selectedProject =
    projectList.find((project) => project.id === selectedProjectId) ?? projectList[0] ?? null;
  const selectedDocuments = selectedProject ? documentsByProject[selectedProject.id] ?? [] : [];
  const selectedThreads = selectedProject ? threadsByProject[selectedProject.id] ?? [] : [];
  const selectedThread = selectedThreads.find((thread) => thread.id === selectedThreadId) ?? selectedThreads[0] ?? null;
  const selectedProvider =
    providerList.find((provider) => provider.id === selectedProviderId) ?? providerList[0];

  const showTabs = view === "projects" || view === "settings";

  const handleSelectTopLevel = (target: "projects" | "settings") => {
    setView(target);
  };

  const handleOpenProject = (projectId: string = selectedProjectId) => {
    const nextThreads = threadsByProject[projectId] ?? [];
    setSelectedProjectId(projectId);
    setSelectedThreadId(nextThreads[0]?.id ?? "");
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

      setProjectList((current) => [project, ...current]);
      setDocumentsByProject((current) => ({ ...current, [project.id]: [] }));
      setThreadsByProject((current) => ({ ...current, [project.id]: [] }));
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

    const firstThread = threadsByProject[selectedProject.id]?.[0];
    if (target === "project-chat") {
      setSelectedThreadId((current) => current || firstThread?.id || "");
      setIsThreadPanelOpen(isWideChatLayout);
    }

    setView(target);
  };

  const handleCreateThread = () => {
    if (!selectedProject) {
      return;
    }

    const nextCount = (threadsByProject[selectedProject.id] ?? []).length + 1;
    const nextThread = buildStarterThread(selectedProject.id, nextCount);

    setThreadsByProject((current) => ({
      ...current,
      [selectedProject.id]: [nextThread, ...(current[selectedProject.id] ?? [])]
    }));
    setSelectedThreadId(nextThread.id);
  };

  const handleToggleThreadPanel = () => {
    setIsThreadPanelOpen((current) => !current);
  };

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);

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
            key={thread.id}
            onClick={() => handleSelectThread(thread.id)}
            type="button"
          >
            <span className="thread-item__title">{thread.title}</span>
          </button>
        ))}
      </div>
    );
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
          <button className="ghost-action" onClick={() => setView("projects")} type="button">
            Back
          </button>

          <div className="project-toolbar__title">
            <h1>{selectedProject.name}</h1>
          </div>

          <div className="project-tabs" aria-label="Project navigation">
            <button
              aria-pressed={false}
              className="project-tabs__button"
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
                  onClick={handleCreateThread}
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
                  {selectedThread.messages.map((message) => (
                    <article
                      className={`message-bubble message-bubble--${message.role}`}
                      key={message.id}
                    >
                      <p>{message.content}</p>
                    </article>
                  ))}
                </div>

                <footer className="composer-card">
                  <textarea
                    className="composer-card__input"
                    id="chat-composer"
                    placeholder="Summarize the files that still need reindexing."
                    rows={4}
                  />
                  <div className="composer-card__footer">
                    <span>Threads stay grouped by project.</span>
                    <button className="primary-action" type="button">
                      Send
                    </button>
                  </div>
                </footer>
              </>
            ) : (
              <div className="empty-panel">
                <h2>No threads yet</h2>
                <p>Create a local thread to sketch questions while the backend indexing flow is still pending.</p>
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
                  onClick={handleCreateThread}
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

          <div className="settings-form">
            <label className="form-field">
              <span>Provider</span>
              <select
                onChange={(event) =>
                  setSelectedProviderId(event.target.value as ProviderDraft["id"])
                }
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
              <span>Base URL</span>
              <input
                onChange={(event) => handleUpdateProviderField("baseUrl", event.target.value)}
                type="text"
                value={selectedProvider.baseUrl}
              />
            </label>

            <label className="form-field">
              <span>Embedding model</span>
              <input
                onChange={(event) =>
                  handleUpdateProviderField("embeddingModel", event.target.value)
                }
                type="text"
                value={selectedProvider.embeddingModel}
              />
            </label>

            <label className="form-field">
              <span>Chatting model</span>
              <input
                onChange={(event) =>
                  handleUpdateProviderField("chattingModel", event.target.value)
                }
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
          </div>
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
    const handleDragOver = (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = () => {
      setIsDragging(false);
    };

    if (!selectedProject) {
      return null;
    }

    const processFiles = (fileList: FileList | null) => {
      if (!fileList) {
        return;
      }

      const nextFiles = Array.from(fileList);
      setFiles((current) => {
        const combined = [...current, ...nextFiles];

        return combined.filter((file, index, self) => {
          const key = resolveFilePath(file) || file.name;
          return index === self.findIndex((candidate) => (resolveFilePath(candidate) || candidate.name) === key);
        });
      });
    };

    const handleDrop = (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      processFiles(event.dataTransfer.files);
    };

    const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(event.target.files);
    };

    const handleRemoveFile = (indexToRemove: number) => {
      setFiles((current) => current.filter((_, index) => index !== indexToRemove));
    };

    return (
      <section className="project-page">
        <header className="project-toolbar">
          <button className="ghost-action" onClick={() => setView("project-files")} type="button">
            Back
          </button>
          <h1>Import Files</h1>
        </header>

        {renderWorkspaceError()}

        <div className="import-card" id="import-section">
          <h2 className="upload-title">Upload Files</h2>

          <div className="import-drop-area">
            <label
              className={`dropzone ${isDragging ? "dropzone--dragging" : ""}`}
              onDrop={handleDrop}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
            >
              <input
                accept=".pdf"
                hidden
                multiple
                onChange={handleSelect}
                type="file"
              />

              {files.length === 0 ? (
                <div className="dropzone__empty-state">
                  <p className="dropzone__text">Drag and drop files or click the arrow</p>

                  <img
                    alt="Upload"
                    className="dropzone__image"
                    src="/dragndroparrow.png"
                  />

                  <p className="dropzone__text">Accepted Formats: PDF</p>
                </div>
              ) : (
                <ul className="dropzone__file-list">
                  {files.slice(0, 5).map((file, index) => (
                    <li className="dropzone__file-item" key={`${file.name}-${index}`}>
                      <span className="file-name">{file.name}</span>
                      <button
                        className="file-remove-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRemoveFile(index);
                        }}
                        type="button"
                      >
                        X
                      </button>
                    </li>
                  ))}

                  {files.length > 5 ? (
                    <li className="dropzone__more">+{files.length - 5} more</li>
                  ) : null}
                </ul>
              )}
            </label>
          </div>

          <div className="import-btn-container">
            <button
              className="primary-action"
              disabled={files.length === 0 || isImporting}
              onClick={() => setIsImportDialogOpen(true)}
              type="button"
            >
              Import
            </button>
          </div>
        </div>
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
            {view === "projects" ? renderProjectsView() : renderSettingsView()}
          </section>
        </>
      ) : null}

      {view === "project-files" ? renderProjectView() : null}
      {view === "project-chat" ? renderChatView() : null}
      {view === "project-import" ? renderImportView() : null}

      {isCreateProjectDialogOpen ? (
        <div className="dialog-backdrop" role="dialog" aria-labelledby="create-project-title" aria-modal="true">
          <div className="dialog-card">
            <button
              aria-label="Close create project dialog"
              className="dialog-close"
              onClick={handleCloseCreateProjectDialog}
              type="button"
            >
              x
            </button>

            <h2 className="dialog-title" id="create-project-title">
              Create Project
            </h2>

            <label className="form-field" htmlFor="project-name">
              <span>Project name</span>
              <input
                autoFocus
                id="project-name"
                onChange={(event) => setPendingProjectName(event.target.value)}
                type="text"
                value={pendingProjectName}
              />
            </label>

            <div className="dialog-actions">
              <button
                className="primary-action"
                disabled={pendingProjectName.trim().length === 0 || isCreatingProject}
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
        <div
          aria-labelledby="import-warning-title"
          aria-modal="true"
          className="dialog-backdrop"
          role="dialog"
        >
          <div className="dialog-card">
            <button
              aria-label="Close import dialog"
              className="dialog-close"
              onClick={() => setIsImportDialogOpen(false)}
              type="button"
            >
              x
            </button>

            <h2 className="dialog-title" id="import-warning-title">
              WARNING
            </h2>

            <p className="dialog-text">
              The uploaded documents may be processed by a Large Language Model (LLM).
              This may involve sending data to external services.
            </p>

            <p className="dialog-text dialog-text--warning">
              Do NOT upload sensitive or personal information.
            </p>

            <div className="dialog-actions">
              <button
                className="ghost-action"
                onClick={() => setIsImportDialogOpen(false)}
                type="button"
              >
                Cancel
              </button>

              <button
                className="primary-action"
                disabled={isImporting}
                onClick={() => void handleImportFiles()}
                type="button"
              >
                I Understand & Import
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {backendDialogMessage ? (
        <div
          aria-labelledby="backend-unreachable-title"
          aria-modal="true"
          className="dialog-backdrop"
          role="dialog"
        >
          <div className="dialog-card">
            <h2 className="dialog-title" id="backend-unreachable-title">
              Backend Unreachable
            </h2>

            <p className="dialog-text">
              The desktop app could not reach the local backend. Start the backend and try again.
            </p>

            <p className="dialog-text dialog-text--warning">{backendDialogMessage}</p>

            <div className="dialog-actions">
              <button
                className="primary-action"
                disabled={isLoadingWorkspace}
                onClick={() => void loadWorkspace()}
                type="button"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
};

export default App;
