import { useEffect, useState, type CSSProperties } from "react";

import {
  accessibilityOptions,
  projectDocuments,
  projectThreads,
  projects,
  providerProfiles,
  type AccessibilityOption,
  type ChatThread,
  type ProjectDocument,
  type ProjectSummary,
  type ProviderDraft
} from "./mockData";
import "./styles.css";

type AppView = "projects" | "settings" | "project-files" | "project-chat" | "project-import";

const accentPalette = ["#c2410c", "#14532d", "#1d4ed8", "#7c2d12", "#0f766e"];
const chatDrawerBreakpoint = 1180;

const getIsWideChatLayout = (): boolean => {
  return window.innerWidth >= chatDrawerBreakpoint;
};

const cloneProjects = (): ProjectSummary[] => projects.map((project) => ({ ...project }));

const cloneDocuments = (): Record<string, ProjectDocument[]> => {
  return Object.fromEntries(
    Object.entries(projectDocuments).map(([projectId, items]) => [
      projectId,
      items.map((item) => ({ ...item }))
    ])
  );
};

const cloneThreads = (): Record<string, ChatThread[]> => {
  return Object.fromEntries(
    Object.entries(projectThreads).map(([projectId, items]) => [
      projectId,
      items.map((item) => ({
        ...item,
        messages: item.messages.map((message) => ({ ...message }))
      }))
    ])
  );
};

const cloneProviders = (): ProviderDraft[] => providerProfiles.map((profile) => ({ ...profile }));

const cloneAccessibility = (): AccessibilityOption[] =>
  accessibilityOptions.map((option) => ({ ...option }));

const formatDocumentStatus = (document: ProjectDocument): string => {
  return document.status === "Indexing"
    ? `Indexing (${document.progress ?? 0}%)`
    : document.status;
};

const App = () => {
  const [view, setView] = useState<AppView>("projects");
  const [projectList, setProjectList] = useState<ProjectSummary[]>(cloneProjects);
  const [documentsByProject, setDocumentsByProject] = useState<Record<string, ProjectDocument[]>>(() => {
    const saved = localStorage.getItem("documentsByProject");
    return saved ? JSON.parse(saved) : cloneDocuments();
  });
  const [threadsByProject, setThreadsByProject] =
    useState<Record<string, ChatThread[]>>(cloneThreads);
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const [selectedThreadId, setSelectedThreadId] = useState(projectThreads[projects[0]?.id ?? ""]?.[0]?.id ?? "");
  const [projectSeed, setProjectSeed] = useState(projects.length + 1);
  const [providerList, setProviderList] = useState<ProviderDraft[]>(cloneProviders);
  const [selectedProviderId, setSelectedProviderId] = useState(providerProfiles[0]?.id ?? "lm-studio");
  const [accessibilityList, setAccessibilityList] =
    useState<AccessibilityOption[]>(cloneAccessibility);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [pendingProjectName, setPendingProjectName] = useState("");
  const [isWideChatLayout, setIsWideChatLayout] = useState(getIsWideChatLayout);
  const [isThreadPanelOpen, setIsThreadPanelOpen] = useState(getIsWideChatLayout);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);


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
    localStorage.setItem("documentsByProject", JSON.stringify(documentsByProject));
  }, [documentsByProject]);

  const selectedProject =
    projectList.find((project) => project.id === selectedProjectId) ?? projectList[0];
  const selectedDocuments = selectedProject ? documentsByProject[selectedProject.id] ?? [] : [];
  const selectedThreads = selectedProject ? threadsByProject[selectedProject.id] ?? [] : [];
  const selectedThread = selectedThreads.find((thread) => thread.id === selectedThreadId) ?? selectedThreads[0];
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

  const handleCreateProject = (projectName: string) => {
    const name = projectName.trim();

    if (!name) {
      return;
    }

    const id = `project-${projectSeed}`;
    const starterThread: ChatThread = {
      id: `${id}-thread-1`,
      title: "Getting started",
      updatedAt: "Just now",
      summary: "Capture your first questions after importing documents.",
      messages: [
        {
          id: `${id}-message-1`,
          role: "assistant",
          content:
            "This project is empty. Drag in PDFs or text files, then come back here to start a grounded conversation."
        }
      ]
    };

    setProjectList((current) => [
      {
        id,
        name,
        tagline: "A fresh workspace for new source material.",
        accent: accentPalette[(projectSeed - 1) % accentPalette.length],
        updatedAt: "Created just now",
        shelfLabel: "New project"
      },
      ...current
    ]);
    setDocumentsByProject((current) => ({ ...current, [id]: [] }));
    setThreadsByProject((current) => ({ ...current, [id]: [starterThread] }));
    setSelectedProjectId(id);
    setSelectedThreadId(starterThread.id);
    setProjectSeed((current) => current + 1);
    setIsCreateProjectDialogOpen(false);
    setPendingProjectName("");
    setView("project-files");
  };

  const handleDeleteDocument = (documentId: string) => {
    if (!selectedProject) {
      return;
    }

    setDocumentsByProject((current) => ({
      ...current,
      [selectedProject.id]: (current[selectedProject.id] ?? []).filter(
        (document) => document.id !== documentId
      )
    }));
  };

  const handleReindexDocument = (documentId: string) => {
    if (!selectedProject) {
      return;
    }

    setDocumentsByProject((current) => ({
      ...current,
      [selectedProject.id]: (current[selectedProject.id] ?? []).map((document) =>
        document.id === documentId
          ? {
              ...document,
              status: "Queued",
              progress: undefined
            }
          : document
      )
    }));
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
    const nextThread: ChatThread = {
      id: `${selectedProject.id}-thread-${nextCount}`,
      title: `New thread ${nextCount}`,
      updatedAt: "Just now",
      summary: "Use this space for a focused follow-up question.",
      messages: [
        {
          id: `${selectedProject.id}-thread-${nextCount}-message-1`,
          role: "assistant",
          content:
            "Ask for a summary, compare two files, or outline what still needs indexing before you trust the answer."
        }
      ]
    };

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

  const handleUpdateProviderField = (field: "baseUrl" | "model" | "apiKey", value: string) => {
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

  const renderProjectsView = () => {
    return (
      <section className="projects-home">
        <div className="projects-home__toolbar">
          <button className="primary-action" onClick={handleOpenCreateProjectDialog} type="button">
            Create Project
          </button>
        </div>

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

        <section className="project-body">
          <section className="table-card table-card--scroll-shell">
            <div className="file-management-toolbar">
              <button className="secondary-action" type="button"
              onClick={() => handleSelectProjectView("project-import")}>
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
                          <span className={`status-pill status-pill--${document.status.toLowerCase().replaceAll(" ", "-")}`}>
                            {formatDocumentStatus(document)}
                          </span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              aria-label={`Delete ${document.name}`}
                              className="ghost-action ghost-action--danger"
                              onClick={() => handleDeleteDocument(document.id)}
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

  const renderChatView = () => {
    if (!selectedProject || !selectedThread) {
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

              <div className="thread-list thread-list--scroll" role="list" aria-label="Project threads">
                {selectedThreads.map((thread) => (
                  <button
                    aria-pressed={thread.id === selectedThread.id}
                    className={`thread-item ${thread.id === selectedThread.id ? "thread-item--active" : ""}`}
                    key={thread.id}
                    onClick={() => handleSelectThread(thread.id)}
                    type="button"
                  >
                    <span className="thread-item__title">{thread.title}</span>
                  </button>
                ))}
              </div>
            </aside>
          ) : null}

          <section className="conversation-panel conversation-panel--scroll-shell">
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

              <div className="thread-list thread-list--scroll" role="list" aria-label="Project threads">
                {selectedThreads.map((thread) => (
                  <button
                    aria-pressed={thread.id === selectedThread.id}
                    className={`thread-item ${thread.id === selectedThread.id ? "thread-item--active" : ""}`}
                    key={thread.id}
                    onClick={() => handleSelectThread(thread.id)}
                    type="button"
                  >
                    <span className="thread-item__title">{thread.title}</span>
                  </button>
                ))}
              </div>
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
              <span>Model</span>
              <input
                onChange={(event) => handleUpdateProviderField("model", event.target.value)}
                type="text"
                value={selectedProvider.model}
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
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = () => {
      setIsDragging(false);
    };

    if (!selectedProject) return null;

    const processFiles = (fileList: FileList | null) => {
      if (!fileList || !selectedProject) return;

      const newFiles = Array.from(fileList);
      setFiles((prev) => {
        const combined = [...prev, ...newFiles];

        const unique = combined.filter(
          (file, index, self) =>
            index === self.findIndex((f) => f.name === file.name)
        );

        return unique;
      });
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(e.dataTransfer.files);
    };

    const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files);
    };

    const handleImportFiles = () => {
      if (!selectedProject || files.length === 0) return;

      files.forEach((file) => {
        const newDocument: ProjectDocument = {
          id: `${selectedProject.id}-doc-${Date.now()}-${file.name}`,
          name: file.name,
          status: "Queued",
          progress: 0
        };

        // Add to project
        setDocumentsByProject((current) => ({
          ...current,
          [selectedProject.id]: [
            newDocument,
            ...(current[selectedProject.id] ?? [])
          ]
        }));

        // Simulate indexing
        setTimeout(() => {
          setDocumentsByProject((current) => ({
            ...current,
            [selectedProject.id]: current[selectedProject.id].map((doc) =>
              doc.id === newDocument.id
                ? { ...doc, status: "Indexing", progress: 50 }
                : doc
            )
          }));
        }, 1000);

        setTimeout(() => {
          setDocumentsByProject((current) => ({
            ...current,
            [selectedProject.id]: current[selectedProject.id].map((doc) =>
              doc.id === newDocument.id
                ? { ...doc, status: "Ready", progress: undefined }
                : doc
            )
          }));
        }, 2500);
      });

      // Clear selected files after import
      setFiles([]);
      setView("project-files");
    };

    const handleRemoveFile = (indexToRemove: number) => {
      setFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
    };

    return (
      <section className="project-page">
        <header className="project-toolbar">
          <button className="ghost-action" onClick={() => setView("project-files")}>
            Back
          </button>
          <h1>Import Files</h1>
        </header>

        <div className="import-card" id="import-section">
          <h2 className="upload-title">Upload Files</h2>

          <div className="import-drop-area">
            <label
              className={`dropzone ${isDragging ? "dropzone--dragging" : ""}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                type="file"
                hidden
                multiple
                onChange={handleSelect}
                accept=".pdf"
              />

              {files.length === 0 ? (
                <div className="dropzone__empty-state">
                  <p className="dropzone__text">Drag and drop files or click the arrow</p>

                  <img
                    src="/dragndroparrow.png"
                    alt="Upload"
                    className="dropzone__image"
                  />

                  <p className="dropzone__text">
                    Accepted Formats: PDF
                  </p>
                </div>
              ) : (
                <ul className="dropzone__file-list">
                  {files.slice(0, 5).map((file, i) => (
                    <li key={i} className="dropzone__file-item">
                      <span className="file-name">{file.name}</span>
                      <button
                        className="file-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation(); // prevents triggering file picker
                          handleRemoveFile(i);
                        }}
                        type="button"
                      >
                        ✕
                      </button>
                    </li>
                  ))}

                  {files.length > 5 && (
                    <li className="dropzone__more">
                      +{files.length - 5} more
                    </li>
                  )}
                </ul>
              )}
            </label>
          </div>

          <div className="import-btn-container">
              <button className="ghost-action"
              onClick={handleImportFiles}
              disabled={files.length === 0}
              type="button">
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
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
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
                disabled={pendingProjectName.trim().length === 0}
                onClick={() => handleCreateProject(pendingProjectName)}
                type="button"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
};

export default App;
