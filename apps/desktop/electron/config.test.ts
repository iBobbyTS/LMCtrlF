import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildBackendBaseUrl,
  getBackendLaunchCommand,
  resolveBackendBaseUrl,
  resolveBackendHost,
  resolveBackendPort,
  resolvePackagedBackendExecutable,
  resolvePackagedDatabasePath,
  resolvePackagedLanceDbPath,
  resolvePreloadEntry,
  resolveRendererEntry
} from "./config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("desktop config", () => {
  const sourceRuntimeDirectory = __dirname;
  const builtRuntimeDirectory = path.resolve(__dirname, "../dist/electron");

  it("uses sensible defaults when no runtime values are provided in development", () => {
    expect(resolveBackendBaseUrl()).toBe("http://127.0.0.1:8000");
    expect(buildBackendBaseUrl()).toBe("http://127.0.0.1:8000");
    expect(resolveBackendHost()).toBe("127.0.0.1");
    expect(resolveBackendPort()).toBe(8000);
    expect(resolvePreloadEntry(sourceRuntimeDirectory)).toBe(path.resolve(__dirname, "./preload.cjs"));
    expect(resolveRendererEntry(undefined, sourceRuntimeDirectory)).toBe(
      path.resolve(__dirname, "../static/index.html")
    );
  });

  it("prefers provided runtime values", () => {
    expect(resolveBackendBaseUrl("http://127.0.0.1:9000")).toBe("http://127.0.0.1:9000");
    expect(resolveBackendHost("http://127.0.0.1:9000")).toBe("127.0.0.1");
    expect(resolveBackendPort("http://127.0.0.1:9000")).toBe(9000);
    expect(resolveRendererEntry("http://localhost:5173", sourceRuntimeDirectory)).toBe(
      "http://localhost:5173"
    );
  });

  it("resolves built runtime assets for packaged or compiled desktop builds", () => {
    expect(resolvePreloadEntry(builtRuntimeDirectory)).toBe(
      path.resolve(builtRuntimeDirectory, "./preload.cjs")
    );
    expect(resolveRendererEntry(undefined, builtRuntimeDirectory)).toBe(
      path.resolve(builtRuntimeDirectory, "../renderer/index.html")
    );
  });

  it("builds the expected development backend launch command", () => {
    expect(getBackendLaunchCommand({ port: 8001 })).toEqual({
      command: "conda",
      args: ["run", "-n", "lmctrlf-dev", "python", "-m", "app.main"],
      cwd: path.resolve(__dirname, "../../../services/backend"),
      env: {
        LMCTRLF_BACKEND_HOST: "127.0.0.1",
        LMCTRLF_BACKEND_PORT: "8001"
      }
    });
  });

  it("builds the expected packaged backend launch command for macOS", () => {
    expect(
      getBackendLaunchCommand({
        packaged: true,
        platform: "darwin",
        port: 8100,
        resourcesPath: "/Applications/LMCtrlF.app/Contents/Resources",
        userDataPath: "/Users/example/Library/Application Support/LMCtrlF"
      })
    ).toEqual({
      command: "/Applications/LMCtrlF.app/Contents/Resources/backend/lmctrlf-backend/lmctrlf-backend",
      args: [],
      cwd: "/Applications/LMCtrlF.app/Contents/Resources/backend/lmctrlf-backend",
      env: {
        LMCTRLF_BACKEND_HOST: "127.0.0.1",
        LMCTRLF_BACKEND_PORT: "8100",
        LMCTRLF_DATABASE_PATH:
          "/Users/example/Library/Application Support/LMCtrlF/backend-data/lmctrlf.sqlite3",
        LMCTRLF_LANCEDB_PATH:
          "/Users/example/Library/Application Support/LMCtrlF/backend-data/lancedb"
      }
    });
  });

  it("builds the expected packaged backend launch command for Windows", () => {
    expect(
      getBackendLaunchCommand({
        packaged: true,
        platform: "win32",
        port: 8200,
        resourcesPath: "C:\\\\Program Files\\\\LMCtrlF\\\\resources",
        userDataPath: "C:\\\\Users\\\\example\\\\AppData\\\\Roaming\\\\LMCtrlF"
      })
    ).toEqual({
      command: path.win32.resolve(
        "C:\\Program Files\\LMCtrlF\\resources",
        "backend",
        "lmctrlf-backend",
        "lmctrlf-backend.exe"
      ),
      args: [],
      cwd: path.win32.resolve("C:\\Program Files\\LMCtrlF\\resources", "backend", "lmctrlf-backend"),
      env: {
        LMCTRLF_BACKEND_HOST: "127.0.0.1",
        LMCTRLF_BACKEND_PORT: "8200",
        LMCTRLF_DATABASE_PATH: path.win32.resolve(
          "C:\\Users\\example\\AppData\\Roaming\\LMCtrlF",
          "backend-data",
          "lmctrlf.sqlite3"
        ),
        LMCTRLF_LANCEDB_PATH: path.win32.resolve(
          "C:\\Users\\example\\AppData\\Roaming\\LMCtrlF",
          "backend-data",
          "lancedb"
        )
      }
    });
  });

  it("exposes packaged path helpers for runtime assertions", () => {
    expect(
      resolvePackagedBackendExecutable("/Applications/LMCtrlF.app/Contents/Resources", "darwin")
    ).toBe("/Applications/LMCtrlF.app/Contents/Resources/backend/lmctrlf-backend/lmctrlf-backend");
    expect(
      resolvePackagedDatabasePath("/Users/example/Library/Application Support/LMCtrlF", "darwin")
    ).toBe(
      "/Users/example/Library/Application Support/LMCtrlF/backend-data/lmctrlf.sqlite3"
    );
    expect(
      resolvePackagedLanceDbPath("/Users/example/Library/Application Support/LMCtrlF", "darwin")
    ).toBe("/Users/example/Library/Application Support/LMCtrlF/backend-data/lancedb");
    expect(
      resolvePackagedBackendExecutable("C:\\Users\\example\\AppData\\Local\\Programs\\LMCtrlF\\resources", "win32")
    ).toBe("C:\\Users\\example\\AppData\\Local\\Programs\\LMCtrlF\\resources\\backend\\lmctrlf-backend\\lmctrlf-backend.exe");
  });
});
