import { useState } from "react";

import type { HealthResponse, ConnectionStatus } from "@lmctrlf/shared";

import { getBackendBaseUrl } from "./runtime";
import "./styles.css";

const App = () => {
  const [status, setStatus] = useState<ConnectionStatus>("idle");

  const handleClick = async () => {
    setStatus("loading");

    try {
      const response = await fetch(`${getBackendBaseUrl()}/health`);
      const payload = (await response.json()) as HealthResponse;

      if (!response.ok || payload.status !== "ok") {
        throw new Error("The backend health check did not return the expected payload.");
      }

      setStatus("success");
    } catch {
      setStatus("fail");
    }
  };

  const label =
    status === "success"
      ? "Success"
      : status === "fail"
        ? "Fail"
        : status === "loading"
          ? "Testing..."
          : "Test Python Connection";

  return (
    <main className="app-shell app-shell--centered">
      <button
        className={`connection-button connection-button--${status}`}
        onClick={handleClick}
        type="button"
      >
        {label}
      </button>
    </main>
  );
};

export default App;
