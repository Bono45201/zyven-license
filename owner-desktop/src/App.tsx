import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import ConnectScreen from "./components/ConnectScreen";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Dashboard from "./pages/Dashboard";
import LicensesPage from "./pages/Licenses";
import CreateLicensePage from "./pages/CreateLicense";
import ActivityPage from "./pages/Activity";
import SettingsPage from "./pages/Settings";
import type {
  ActivityEntry,
  CreateLicensePayload,
  CreateLicenseResult,
  DeletedLicense,
  HealthPayload,
  LicenseRecord,
  LicenseStatus,
  OwnerSettings,
  PageId,
  ProductScope
} from "./types";
import { normalizeError } from "./lib/format";

const DEFAULT_SERVER = "https://zyven-license.zyven.workers.dev";
const DEFAULT_SETTINGS: OwnerSettings = {
  autoRefreshSeconds: 30,
  compactRows: false,
  confirmDestructive: true
};

function loadSettings(): OwnerSettings {
  try {
    const raw = localStorage.getItem("zyven-owner-settings-v1");
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadServer() {
  return localStorage.getItem("zyven-owner-server") || DEFAULT_SERVER;
}

type Toast = {
  id: number;
  type: "success" | "error";
  title: string;
  message?: string;
};

export default function App() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [page, setPage] = useState<PageId>("dashboard");
  const [scope, setScope] = useState<ProductScope>("");
  const [records, setRecords] = useState<LicenseRecord[]>([]);
  const [deleted, setDeleted] = useState<DeletedLicense[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [serverUrl, setServerUrl] = useState(loadServer);
  const [version, setVersion] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [settings, setSettings] = useState<OwnerSettings>(loadSettings);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    window.zyvenOwner.getVersion().then(setVersion).catch(() => setVersion("2.0.0"));
  }, []);

  const notify = useCallback((type: Toast["type"], title: string, message?: string) => {
    const id = ++toastId.current;
    setToasts((current) => [...current, { id, type, title, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, type === "error" ? 5200 : 3200);
  }, []);

  const refreshActivity = useCallback(async () => {
    const items = await window.zyvenOwner.activity();
    setActivity(items);
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!connected) return;
    if (!silent) setRefreshing(true);
    try {
      const [nextRecords, nextDeleted] = await Promise.all([
        window.zyvenOwner.list(""),
        window.zyvenOwner.deleted("")
      ]);
      setRecords(nextRecords || []);
      setDeleted(nextDeleted || []);
      await refreshActivity();
    } catch (error) {
      notify("error", "Refresh failed", normalizeError(error));
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [connected, notify, refreshActivity]);

  useEffect(() => {
    if (!connected || !settings.autoRefreshSeconds) return;
    const id = window.setInterval(
      () => refresh(true),
      settings.autoRefreshSeconds * 1000
    );
    return () => window.clearInterval(id);
  }, [connected, refresh, settings.autoRefreshSeconds]);

  async function connect(baseUrl: string, adminKey: string) {
    setConnecting(true);
    setConnectError("");
    try {
      const result = await window.zyvenOwner.connect({ baseUrl, adminKey });
      setRecords(result.licenses || []);
      setHealth(result.health || null);
      setServerUrl(result.baseUrl);
      localStorage.setItem("zyven-owner-server", result.baseUrl);
      setConnected(true);
      setPage("dashboard");
      setScope("");
      const [deletedRows, entries] = await Promise.all([
        window.zyvenOwner.deleted(""),
        window.zyvenOwner.activity()
      ]);
      setDeleted(deletedRows || []);
      setActivity(entries || []);
      notify("success", "Owner console connected", result.health?.version ? "Server " + result.health.version : undefined);
    } catch (error) {
      setConnectError(normalizeError(error));
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    await window.zyvenOwner.disconnect();
    setConnected(false);
    setRecords([]);
    setDeleted([]);
    setHealth(null);
    setPage("dashboard");
    setScope("");
    notify("success", "Owner console disconnected");
  }

  async function createLicense(payload: CreateLicensePayload): Promise<CreateLicenseResult> {
    setCreating(true);
    try {
      const result = await window.zyvenOwner.createLicense(payload);
      await refresh(true);
      notify("success", "License created", result.record.Customer + " · " + result.record.Product);
      return result;
    } catch (error) {
      notify("error", "Could not create license", normalizeError(error));
      throw error;
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(record: LicenseRecord, status: LicenseStatus) {
    try {
      const updated = await window.zyvenOwner.setStatus(record.LicenseId, status);
      setRecords((current) => current.map((item) => item.LicenseId === updated.LicenseId ? updated : item));
      await refreshActivity();
      notify("success", "License " + status.toLowerCase(), updated.Customer || updated.LicenseId);
    } catch (error) {
      notify("error", "Status update failed", normalizeError(error));
      throw error;
    }
  }

  async function resetDevice(record: LicenseRecord) {
    try {
      const updated = await window.zyvenOwner.resetDevice(record.LicenseId);
      setRecords((current) => current.map((item) => item.LicenseId === updated.LicenseId ? updated : item));
      await refreshActivity();
      notify("success", "HWID reset", updated.Customer || updated.LicenseId);
    } catch (error) {
      notify("error", "HWID reset failed", normalizeError(error));
      throw error;
    }
  }

  async function forceLogout(record: LicenseRecord) {
    try {
      await window.zyvenOwner.forceLogout(record.LicenseId);
      await refresh(true);
      notify("success", "Session invalidated", record.Customer || record.LicenseId);
    } catch (error) {
      notify("error", "Force logout failed", normalizeError(error));
      throw error;
    }
  }

  async function logoutAll() {
    const label = scope || "all products";
    if (settings.confirmDestructive) {
      const ok = window.confirm("Force logout every active session for " + label + "?");
      if (!ok) return;
    }
    try {
      const result = await window.zyvenOwner.logoutAll(scope);
      await refresh(true);
      notify("success", "Sessions invalidated", String(result.removed || 0) + " live session(s) removed.");
    } catch (error) {
      notify("error", "Force logout failed", normalizeError(error));
    }
  }

  async function setExpiry(record: LicenseRecord, expiry: string) {
    try {
      const updated = await window.zyvenOwner.setExpiry(record.LicenseId, expiry);
      setRecords((current) => current.map((item) => item.LicenseId === updated.LicenseId ? updated : item));
      await refreshActivity();
      notify("success", "Expiry updated", updated.Customer || updated.LicenseId);
    } catch (error) {
      notify("error", "Expiry update failed", normalizeError(error));
      throw error;
    }
  }

  async function deleteLicense(record: LicenseRecord) {
    try {
      await window.zyvenOwner.deleteLicense(record.LicenseId);
      await refresh(true);
      notify("success", "License deleted", record.Customer || record.LicenseId);
    } catch (error) {
      notify("error", "Delete failed", normalizeError(error));
      throw error;
    }
  }

  async function getFullKey(record: LicenseRecord) {
    try {
      return await window.zyvenOwner.getFullKey(record.LicenseId);
    } catch (error) {
      notify("error", "Could not read local key vault", normalizeError(error));
      return "";
    }
  }

  async function copy(value: string) {
    try {
      await window.zyvenOwner.copyText(value);
      notify("success", "Copied to clipboard");
    } catch (error) {
      notify("error", "Copy failed", normalizeError(error));
    }
  }

  async function clearActivity() {
    if (settings.confirmDestructive && !window.confirm("Clear the local Owner activity log?")) return;
    await window.zyvenOwner.clearActivity();
    await refreshActivity();
    notify("success", "Activity log cleared");
  }

  function changeSettings(next: OwnerSettings) {
    setSettings(next);
    localStorage.setItem("zyven-owner-settings-v1", JSON.stringify(next));
  }

  const title = useMemo(() => {
    if (page === "dashboard") return ["Dashboard", "License overview"];
    if (page === "licenses") return ["Licenses", "Manage server records"];
    if (page === "create") return ["Create License", "Generate signed keys"];
    if (page === "activity") return ["Activity", "Owner action history"];
    return ["Settings", "Owner console preferences"];
  }, [page]);

  if (!connected) {
    return (
      <>
        <ConnectScreen
          defaultServer={serverUrl}
          busy={connecting}
          error={connectError}
          version={version}
          onConnect={connect}
        />
        <ToastStack items={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
      </>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onPage={setPage} connected={connected} />
      <div className="app-main">
        <Topbar
          title={title[0]}
          subtitle={title[1]}
          product={scope}
          onProduct={setScope}
          onRefresh={() => refresh(false)}
          refreshing={refreshing}
          version={version}
        />

        <main className="page-content">
          {page === "dashboard" ? (
            <Dashboard
              records={records}
              scope={scope}
              onPage={setPage}
              onRefresh={() => refresh(false)}
              onLogoutAll={logoutAll}
            />
          ) : null}

          {page === "licenses" ? (
            <LicensesPage
              records={records}
              deleted={deleted}
              scope={scope}
              compact={settings.compactRows}
              confirmDestructive={settings.confirmDestructive}
              onRefresh={() => refresh(false)}
              onSetStatus={setStatus}
              onResetDevice={resetDevice}
              onForceLogout={forceLogout}
              onSetExpiry={setExpiry}
              onDelete={deleteLicense}
              onGetFullKey={getFullKey}
              onCopy={copy}
            />
          ) : null}

          {page === "create" ? (
            <CreateLicensePage
              scope={scope}
              busy={creating}
              onCreate={createLicense}
              onCopy={copy}
            />
          ) : null}

          {page === "activity" ? (
            <ActivityPage
              entries={activity}
              onRefresh={refreshActivity}
              onClear={clearActivity}
            />
          ) : null}

          {page === "settings" ? (
            <SettingsPage
              settings={settings}
              serverUrl={serverUrl}
              serverVersion={health?.version || ""}
              onChange={changeSettings}
              onDisconnect={disconnect}
            />
          ) : null}
        </main>
      </div>

      <ToastStack items={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </div>
  );
}

function ToastStack({
  items,
  onDismiss
}: {
  items: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="toast-stack">
      {items.map((item) => (
        <div className={"toast " + item.type} key={item.id}>
          <div className="toast-icon">
            {item.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          </div>
          <div className="toast-copy">
            <strong>{item.title}</strong>
            {item.message ? <span>{item.message}</span> : null}
          </div>
          <button type="button" onClick={() => onDismiss(item.id)}><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
