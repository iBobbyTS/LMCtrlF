import { contextBridge } from "electron";

import { resolveBackendBaseUrl } from "./config";

const runtimeArgument = process.argv.find((value) => value.startsWith("--backend-base-url="));
const backendBaseUrl = runtimeArgument
  ? runtimeArgument.replace("--backend-base-url=", "")
  : resolveBackendBaseUrl(process.env.LMCTRLF_BACKEND_URL);

contextBridge.exposeInMainWorld("lmctrlf", {
  getBackendBaseUrl: () => backendBaseUrl
});
