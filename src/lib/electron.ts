// ---------------------------------------------------------------------------
// Safe accessors for window.electronAPI.
// All functions are no-ops when running outside Electron (browser preview).
// ---------------------------------------------------------------------------

export const isElectron = (): boolean =>
  typeof window !== "undefined" && typeof window.electronAPI !== "undefined";

const api = () => window.electronAPI;

// Window controls
export const minimize = (): void => {
  if (!isElectron()) return;
  if (typeof api()!.minimize === "function") {
    api()!.minimize();
    return;
  }
  if (typeof api()!.minimizeWindow === "function") {
    void api()!.minimizeWindow();
  }
};

export const maximize = (): void => {
  if (!isElectron()) return;
  if (typeof api()!.maximize === "function") {
    api()!.maximize();
    return;
  }
  if (typeof api()!.maximizeWindow === "function") {
    void api()!.maximizeWindow();
  }
};

export const closeWindow = (): void => {
  if (!isElectron()) return;
  if (typeof api()!.close === "function") {
    api()!.close();
    return;
  }
  if (typeof api()!.closeWindow === "function") {
    void api()!.closeWindow();
  }
};

export const openMini = (): void => {
  if (!isElectron()) return;
  if (typeof api()!.openMini === "function") {
    api()!.openMini();
  }
};

export const miniMinimize = (): void => {
  if (!isElectron()) return;
  if (typeof api()!.miniMinimize === "function") {
    api()!.miniMinimize();
  }
};

export const miniClose = (): void => {
  if (!isElectron()) return;
  if (typeof api()!.miniClose === "function") {
    api()!.miniClose();
  }
};

export const isMaximized = async (): Promise<boolean> => {
  if (!isElectron()) return false;
  if (typeof api()!.isMaximized === "function") {
    return api()!.isMaximized();
  }
  return false;
};

// Proxy management
export const proxyStart = (
  altId: string,
  config: NonNullable<Window["electronAPI"]>["proxyStart"] extends (
    a: string,
    c: infer C
  ) => any
    ? C
    : never
) => {
  if (!isElectron()) return Promise.resolve({ success: false, error: "Not in Electron" });
  return api()!.proxyStart(altId, config);
};

export const proxyStop = (altId: string) => {
  if (!isElectron()) return Promise.resolve({ success: false, error: "Not in Electron" });
  return api()!.proxyStop(altId);
};

export const proxyStatus = (altId: string) => {
  if (!isElectron()) return Promise.resolve({ running: false });
  return api()!.proxyStatus(altId);
};

// Shell
export const openExternal = (url: string) => {
  if (!isElectron()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return Promise.resolve({ success: true });
  }
  return api()!.openExternal(url);
};
