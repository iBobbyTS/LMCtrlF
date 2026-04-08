import { contextBridge, webUtils } from "electron";

import { resolveRuntimeBackendBaseUrl } from "./runtime-config";

const backendBaseUrl = resolveRuntimeBackendBaseUrl();

contextBridge.exposeInMainWorld("lmctrlf", {
  getBackendBaseUrl: () => backendBaseUrl,
  getPathForFile: (file: File) => webUtils.getPathForFile(file)
});
