interface LMCtrlFBridge {
  getBackendBaseUrl: () => string;
}

interface Window {
  lmctrlf?: LMCtrlFBridge;
}
