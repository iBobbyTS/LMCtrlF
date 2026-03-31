import { render, screen } from "@testing-library/react";

import App from "./App";

describe("App", () => {
  it("renders the desktop shell heading", () => {
    window.lmctrlf = {
      getBackendBaseUrl: () => "http://127.0.0.1:8123"
    };

    render(<App />);

    expect(screen.getByRole("heading", { name: "Desktop Shell Ready" })).toBeInTheDocument();
    expect(screen.getByText("http://127.0.0.1:8123")).toBeInTheDocument();
  });
});
