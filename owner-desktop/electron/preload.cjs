const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zyvenOwner", {
  getVersion: () => ipcRenderer.invoke("app:version"),
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximizeToggle: () => ipcRenderer.invoke("window:maximize-toggle"),
    isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
    close: () => ipcRenderer.invoke("window:close")
  },
  connect: (payload) => ipcRenderer.invoke("owner:connect", payload),
  disconnect: () => ipcRenderer.invoke("owner:disconnect"),
  list: (product) => ipcRenderer.invoke("owner:list", product || ""),
  deleted: (product) => ipcRenderer.invoke("owner:deleted", product || ""),
  createLicense: (payload) => ipcRenderer.invoke("owner:create", payload),
  setStatus: (licenseId, status) => ipcRenderer.invoke("owner:set-status", licenseId, status),
  resetDevice: (licenseId) => ipcRenderer.invoke("owner:reset-device", licenseId),
  forceLogout: (licenseId) => ipcRenderer.invoke("owner:force-logout", licenseId),
  logoutAll: (product) => ipcRenderer.invoke("owner:logout-all", product || ""),
  setExpiry: (licenseId, expiry) => ipcRenderer.invoke("owner:set-expiry", licenseId, expiry),
  deleteLicense: (licenseId) => ipcRenderer.invoke("owner:delete", licenseId),
  getFullKey: (licenseId) => ipcRenderer.invoke("owner:get-full-key", licenseId),
  copyText: (value) => ipcRenderer.invoke("owner:copy-text", value),
  activity: () => ipcRenderer.invoke("owner:activity"),
  clearActivity: () => ipcRenderer.invoke("owner:clear-activity")
});
