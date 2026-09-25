const { app, BrowserWindow, ipcMain, safeStorage, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");

const DEFAULT_SERVER = "https://zyven-license.zyven.workers.dev";
const PRODUCTS = new Set(["ZYVEN-SOUND-TOOL", "ZYVEN-GP-TOOL"]);

let mainWindow = null;
let connection = {
  baseUrl: "",
  adminKey: ""
};

function userFile(name) {
  return path.join(app.getPath("userData"), name);
}

function readJsonFile(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(userFile(name), "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(name, value) {
  const file = userFile(name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim() || DEFAULT_SERVER;
  const url = new URL(raw);
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error("Server URL must use HTTPS.");
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

async function requestJson(baseUrl, adminKey, method, route, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const headers = {
      "Accept": "application/json",
      "X-Zyven-Admin-Key": adminKey
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(baseUrl + route, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); }
      catch { data = { message: text }; }
    }

    if (!response.ok) {
      const message =
        (data && (data.message || data.error)) ||
        (typeof data === "string" ? data : "") ||
        "Request failed (" + response.status + ").";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function adminRequest(method, route, body) {
  if (!connection.baseUrl || !connection.adminKey) {
    throw new Error("Owner console is not connected.");
  }
  if (!route.startsWith("/api/admin/")) {
    throw new Error("Blocked non-admin request.");
  }
  return requestJson(connection.baseUrl, connection.adminKey, method, route, body);
}

function appendActivity(type, title, detail = "", meta = {}) {
  const items = readJsonFile("activity.json", []);
  const next = [{
    id: crypto.randomUUID(),
    at: Date.now(),
    type,
    title,
    detail,
    meta
  }, ...items].slice(0, 200);
  writeJsonFile("activity.json", next);
  return next[0];
}

function getVault() {
  return readJsonFile("license-vault.json", { version: 1, keys: {} });
}

function saveLicenseKey(licenseId, licenseKey) {
  if (!licenseId || !licenseKey) return;
  if (!safeStorage.isEncryptionAvailable()) return;
  const vault = getVault();
  vault.keys[String(licenseId)] = safeStorage.encryptString(String(licenseKey)).toString("base64");
  writeJsonFile("license-vault.json", vault);
}

function readLicenseKey(licenseId) {
  try {
    if (!safeStorage.isEncryptionAvailable()) return "";
    const vault = getVault();
    const encoded = vault.keys[String(licenseId)];
    if (!encoded) return "";
    return safeStorage.decryptString(Buffer.from(encoded, "base64"));
  } catch {
    return "";
  }
}

function removeLicenseKey(licenseId) {
  const vault = getVault();
  if (vault.keys[String(licenseId)]) {
    delete vault.keys[String(licenseId)];
    writeJsonFile("license-vault.json", vault);
  }
}

function productRoute(product) {
  if (!product) return "";
  if (!PRODUCTS.has(product)) throw new Error("Unsupported Zyven product.");
  return "?product=" + encodeURIComponent(product);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    frame: false,
    backgroundColor: "#050505",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("window:minimize", () => mainWindow && mainWindow.minimize());
  ipcMain.handle("window:maximize-toggle", () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });
  ipcMain.handle("window:is-maximized", () => Boolean(mainWindow && mainWindow.isMaximized()));
  ipcMain.handle("window:close", () => mainWindow && mainWindow.close());

  ipcMain.handle("owner:connect", async (_event, payload) => {
    const baseUrl = normalizeBaseUrl(payload && payload.baseUrl);
    const adminKey = String(payload && payload.adminKey || "").trim();
    if (!adminKey) throw new Error("Admin key is required.");

    const healthResponse = await fetch(baseUrl + "/health", { signal: AbortSignal.timeout(12000) });
    if (!healthResponse.ok) throw new Error("Could not reach the Zyven license server.");
    const health = await healthResponse.json();

    const licenses = await requestJson(baseUrl, adminKey, "GET", "/api/admin/licenses");
    connection = { baseUrl, adminKey };
    appendActivity("connection", "Owner console connected", baseUrl);
    return { health, licenses, baseUrl };
  });

  ipcMain.handle("owner:disconnect", async () => {
    const old = connection.baseUrl;
    connection = { baseUrl: "", adminKey: "" };
    if (old) appendActivity("connection", "Owner console disconnected", old);
    return { ok: true };
  });

  ipcMain.handle("owner:list", async (_event, product) => {
    return adminRequest("GET", "/api/admin/licenses" + productRoute(product));
  });

  ipcMain.handle("owner:deleted", async (_event, product) => {
    return adminRequest("GET", "/api/admin/deleted" + productRoute(product));
  });

  ipcMain.handle("owner:create", async (_event, payload) => {
    const result = await adminRequest("POST", "/api/admin/create", payload);
    if (result && result.licenseKey && result.record && result.record.LicenseId) {
      saveLicenseKey(result.record.LicenseId, result.licenseKey);
      appendActivity(
        "create",
        "License created",
        (result.record.Customer || "Customer") + " · " + result.record.Product,
        { licenseId: result.record.LicenseId, product: result.record.Product }
      );
    }
    return result;
  });

  ipcMain.handle("owner:set-status", async (_event, licenseId, status) => {
    const next = String(status || "").toUpperCase();
    const result = await adminRequest(
      "POST",
      "/api/admin/licenses/" + encodeURIComponent(licenseId) + "/status",
      { status: next }
    );
    appendActivity("status", "License " + next.toLowerCase(), result.Customer || licenseId, {
      licenseId,
      product: result.Product
    });
    return result;
  });

  ipcMain.handle("owner:reset-device", async (_event, licenseId) => {
    const result = await adminRequest(
      "POST",
      "/api/admin/licenses/" + encodeURIComponent(licenseId) + "/reset-device"
    );
    appendActivity("device", "HWID reset", result.Customer || licenseId, {
      licenseId,
      product: result.Product
    });
    return result;
  });

  ipcMain.handle("owner:force-logout", async (_event, licenseId) => {
    const result = await adminRequest(
      "POST",
      "/api/admin/licenses/" + encodeURIComponent(licenseId) + "/logout"
    );
    appendActivity("session", "Session invalidated", licenseId, { licenseId });
    return result;
  });

  ipcMain.handle("owner:logout-all", async (_event, product) => {
    const body = product ? { product } : {};
    const result = await adminRequest("POST", "/api/admin/logout-all", body);
    appendActivity("session", "All sessions invalidated", product || "All products", {
      product: product || "ALL",
      removed: result && result.removed
    });
    return result;
  });

  ipcMain.handle("owner:set-expiry", async (_event, licenseId, expiry) => {
    const result = await adminRequest(
      "POST",
      "/api/admin/licenses/" + encodeURIComponent(licenseId) + "/expiry",
      { expiry }
    );
    appendActivity("expiry", "Expiry updated", result.Customer || licenseId, {
      licenseId,
      product: result.Product,
      expiry
    });
    return result;
  });

  ipcMain.handle("owner:delete", async (_event, licenseId) => {
    const result = await adminRequest(
      "DELETE",
      "/api/admin/licenses/" + encodeURIComponent(licenseId)
    );
    removeLicenseKey(licenseId);
    appendActivity("delete", "License permanently deleted", result.customer || licenseId, {
      licenseId,
      product: result.product
    });
    return result;
  });

  ipcMain.handle("owner:get-full-key", async (_event, licenseId) => {
    return readLicenseKey(licenseId);
  });

  ipcMain.handle("owner:copy-text", async (_event, value) => {
    clipboard.writeText(String(value || ""));
    return { ok: true };
  });

  ipcMain.handle("owner:activity", () => readJsonFile("activity.json", []));
  ipcMain.handle("owner:clear-activity", () => {
    writeJsonFile("activity.json", []);
    return { ok: true };
  });
});

app.on("window-all-closed", () => {
  connection = { baseUrl: "", adminKey: "" };
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
