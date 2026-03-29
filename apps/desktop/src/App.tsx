import { HashRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";

import { chatMessages, citations, documents, importJobs, projects } from "./mockData";
import "./styles.css";

const navigationItems = [
  { label: "Documents", to: "/documents" },
  { label: "Chat", to: "/chat" },
  { label: "Settings", to: "/settings" }
];

const DocumentManagementPage = () => {
  return (
    <section className="page-layout" aria-labelledby="documents-heading">
      <header className="page-hero">
        <div>
          <span className="eyebrow">Workspace</span>
          <h1 id="documents-heading">Document Control Center</h1>
          <p>
            Organize imported files, prepare projects for indexing, and review privacy and
            hardware guidance before running any retrieval workflow.
          </p>
        </div>
        <div className="hero-badges">
          <span>PDF and TXT ready</span>
          <span>Desktop-first workflow</span>
        </div>
      </header>

      <section className="summary-grid" aria-label="Document management summary">
        <article className="summary-card">
          <span>Total Projects</span>
          <strong>{projects.length}</strong>
          <p>Grouped by coursework, contracts, and research topics.</p>
        </article>
        <article className="summary-card">
          <span>Imported Documents</span>
          <strong>{documents.length}</strong>
          <p>Ready for review before indexing begins.</p>
        </article>
        <article className="summary-card">
          <span>Active Jobs</span>
          <strong>{importJobs.filter((job) => job.status !== "Complete").length}</strong>
          <p>Progress indicators are visible whenever processing takes time.</p>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel panel--feature">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Import</span>
              <h2>Bring in a new document set</h2>
            </div>
            <button className="ghost-button" type="button">
              Browse Files
            </button>
          </div>
          <div className="dropzone" role="button" tabIndex={0}>
            <div className="dropzone-icon" aria-hidden="true">
              +
            </div>
            <div>
              <strong>Drop PDF or TXT files here</strong>
              <p>
                Multiple files can be added to the same project before indexing. Word and other
                formats can be introduced later.
              </p>
            </div>
          </div>
          <div className="notice-stack">
            <div className="notice notice--warning">
              <strong>Privacy Notice</strong>
              <p>
                Avoid sensitive material. Providers may apply their own terms when cloud models are
                used later.
              </p>
            </div>
            <div className="notice notice--info">
              <strong>Hardware Guidance</strong>
              <p>
                Local models perform best with a dedicated GPU and 32GB+ memory. Slower hardware
                may require longer indexing and answer times.
              </p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Projects</span>
              <h2>Active workspaces</h2>
            </div>
            <span className="panel-meta">3 tracked</span>
          </div>
          <ul className="project-list">
            {projects.map((project) => (
              <li key={project.name} className="project-card">
                <div>
                  <strong>{project.name}</strong>
                  <p>{project.description}</p>
                </div>
                <span>{project.documents} docs</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel panel--wide">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Library</span>
              <h2>Imported documents</h2>
            </div>
            <span className="panel-meta">Desktop only</span>
          </div>
          <table className="document-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Project</th>
                <th>Status</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.name}>
                  <td>{document.name}</td>
                  <td>{document.type}</td>
                  <td>{document.project}</td>
                  <td>
                    <span className={`status-pill status-pill--${document.status.toLowerCase()}`}>
                      {document.status}
                    </span>
                  </td>
                  <td>{document.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Queue</span>
              <h2>Indexing progress</h2>
            </div>
            <span className="panel-meta">Visible for long-running work</span>
          </div>
          <ul className="job-list">
            {importJobs.map((job) => (
              <li key={job.name} className="job-item">
                <div className="job-copy">
                  <strong>{job.name}</strong>
                  <span>{job.status}</span>
                </div>
                <div className="job-progress">
                  <div className="job-progress-bar">
                    <span style={{ width: `${job.progress}%` }} />
                  </div>
                  <small>{job.progress}%</small>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </section>
  );
};

const PlaceholderPage = ({ title, description }: { title: string; description: string }) => {
  return (
    <section className="placeholder-page" aria-labelledby={`${title}-heading`}>
      <span className="eyebrow">Next Branch</span>
      <h1 id={`${title}-heading`}>{title}</h1>
      <p>{description}</p>
    </section>
  );
};

const ChatPage = () => {
  return (
    <section className="page-layout" aria-labelledby="chat-heading">
      <header className="page-hero page-hero--compact">
        <div>
          <span className="eyebrow">Query Workspace</span>
          <h1 id="chat-heading">Grounded Chat Review</h1>
          <p>
            Ask questions about imported material, inspect cited evidence, and keep the source
            context visible while drafting answers.
          </p>
        </div>
        <div className="hero-badges">
          <span>Context-aware</span>
          <span>Citation-first</span>
        </div>
      </header>

      <section className="chat-layout">
        <article className="panel chat-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Conversation</span>
              <h2>Answer drafting workspace</h2>
            </div>
            <span className="panel-meta">Project: Software Design Course</span>
          </div>
          <div className="context-banner">
            <strong>Focused documents</strong>
            <p>
              Assignment3_ENSF400_L02_Group01.pdf and Course_Project_Rubric.txt are pinned for the
              current session.
            </p>
          </div>
          <div className="message-thread" aria-label="Chat transcript">
            {chatMessages.map((message) => (
              <article
                key={message.id}
                className={`message-bubble message-bubble--${message.role.toLowerCase()}`}
              >
                <span className="message-role">{message.role}</span>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
          <div className="composer-card">
            <label className="composer-label" htmlFor="chat-input">
              Ask a follow-up question
            </label>
            <textarea
              id="chat-input"
              className="composer-input"
              defaultValue="What are the three required desktop pages and which one has the highest implementation priority?"
            />
            <div className="composer-footer">
              <span>Response progress and streaming states will appear here later.</span>
              <button className="ghost-button" type="button">
                Send
              </button>
            </div>
          </div>
        </article>

        <aside className="chat-sidebar">
          <article className="panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Evidence</span>
                <h2>Referenced passages</h2>
              </div>
              <span className="panel-meta">Top matches</span>
            </div>
            <ul className="citation-list">
              {citations.map((citation) => (
                <li key={citation.id} className="citation-card">
                  <strong>{citation.title}</strong>
                  <span>{citation.source}</span>
                  <p>{citation.snippet}</p>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Safety</span>
                <h2>Answer accuracy</h2>
              </div>
            </div>
            <div className="notice-stack">
              <div className="notice notice--warning">
                <strong>Model responses may be inaccurate</strong>
                <p>Always verify the original source text before finalizing a conclusion.</p>
              </div>
              <div className="notice notice--info">
                <strong>Progress visibility</strong>
                <p>Search, retrieval, and response progress should remain visible during long tasks.</p>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </section>
  );
};

const AppShell = () => {
  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="brand-block">
          <span className="brand-mark">LMCtrlF</span>
          <p>Local document intelligence for long-form reading and grounded answers.</p>
        </div>
        <nav aria-label="Primary">
          <ul className="nav-list">
            {navigationItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="shell-main">
        <header className="shell-topbar">
          <div>
            <span className="eyebrow">Desktop App</span>
            <h2>Assignment UI Preview</h2>
          </div>
          <div className="topbar-meta">
            <span>Dark mode ready</span>
            <span>Progress aware</span>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<Navigate replace to="/documents" />} />
          <Route path="/documents" element={<DocumentManagementPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route
            path="/settings"
            element={
              <PlaceholderPage
                title="Configuration Center"
                description="The configuration page will be added after the chat page branch."
              />
            }
          />
        </Routes>
      </div>
    </div>
  );
};

const App = () => {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
};

export default App;
