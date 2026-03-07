const { contextBridge, ipcRenderer } = require("electron");

function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld("electronAPI", {
  getAppState: () => invoke("app:getAppState"),
  scanReference: () => invoke("app:scanReference"),
  getProfiles: () => invoke("app:getProfiles"),
  getLogs: () => invoke("app:getLogs"),
  clearLogs: () => invoke("app:clearLogs"),
  getSettings: () => invoke("app:getSettings"),
  setSettings: (settings) => invoke("app:setSettings", settings),
  setActiveProfile: (profileId) => invoke("app:setActiveProfile", profileId),
  restartAnalysis: () => invoke("app:restartAnalysis"),
  openReferenceFolder: () => invoke("app:openReferenceFolder"),
  getDpiBypassState: () => invoke("app:getDpiBypassState"),
  setBypassEnabled: (enabled) => invoke("app:setBypassEnabled", enabled),
  getDiagnostics: () => invoke("app:getDiagnostics"),
  getReferenceSummary: () => invoke("app:getReferenceSummary"),
  getIpLists: () => invoke("app:getIpLists"),

  minimizeWindow: () => invoke("window:minimize"),
  maximizeWindow: () => invoke("window:maximize"),
  closeWindow: () => invoke("window:close"),
  isMaximized: () => invoke("window:is-maximized"),

  // Backward-compatible aliases used by renderer
  minimize: () => {
    void invoke("window:minimize");
  },
  maximize: () => {
    void invoke("window:maximize");
  },
  close: () => {
    void invoke("window:close");
  },

  openMini: () => {
    ipcRenderer.send("window:open-mini");
  },
  miniMinimize: () => {
    ipcRenderer.send("mini:minimize");
  },
  miniClose: () => {
    ipcRenderer.send("mini:close");
  },

  onStateUpdated: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("app:stateUpdated", listener);
    return () => ipcRenderer.removeListener("app:stateUpdated", listener);
  },
});


