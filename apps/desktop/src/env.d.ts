interface LMCtrlFBridge {
  getBackendBaseUrl: () => string;
  getPathForFile: (file: File) => string;
}

interface Window {
  lmctrlf?: LMCtrlFBridge;
}
