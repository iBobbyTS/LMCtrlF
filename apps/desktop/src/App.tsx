import { getBackendBaseUrl } from "./runtime";
import "./styles.css";

const App = () => {
  const backendBaseUrl = getBackendBaseUrl();

  return (
    <main className="app-shell">
      <section className="app-card">
        <span className="app-eyebrow">LMCtrlF</span>
        <h1>Desktop Shell Ready</h1>
        <p>The Python connection smoke test screen will be added in the next commit.</p>
        <dl className="app-metadata">
          <div>
            <dt>Backend URL</dt>
            <dd>{backendBaseUrl}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
};

export default App;
