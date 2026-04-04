const { contextBridge, webUtils } = require("electron");

const defaultBackendBaseUrl = "http://127.0.0.1:8000";
const runtimeArgument = process.argv.find((value) => value.startsWith("--backend-base-url="));
const backendBaseUrl = runtimeArgument
  ? runtimeArgument.replace("--backend-base-url=", "")
  : process.env.LMCTRLF_BACKEND_URL || defaultBackendBaseUrl;

contextBridge.exposeInMainWorld("lmctrlf", {
  getBackendBaseUrl: () => backendBaseUrl,
  getPathForFile: (file) => webUtils.getPathForFile(file)
});
