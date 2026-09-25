import { LogOut, MonitorCog, RefreshCw, ShieldCheck } from "lucide-react";
import type { OwnerSettings } from "../types";

export default function SettingsPage({
  settings,
  serverUrl,
  serverVersion,
  onChange,
  onDisconnect
}: {
  settings: OwnerSettings;
  serverUrl: string;
  serverVersion: string;
  onChange: (settings: OwnerSettings) => void;
  onDisconnect: () => void;
}) {
  function patch<K extends keyof OwnerSettings>(key: K, value: OwnerSettings[K]) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <div className="page-stack settings-page">
      <section className="page-heading">
        <div>
          <h1>Settings</h1>
          <p>Owner console behavior and connection details.</p>
        </div>
      </section>

      <section className="settings-grid">
        <div className="panel settings-card">
          <div className="settings-card-head">
            <RefreshCw size={18} />
            <div>
              <strong>Refresh behavior</strong>
              <span>Keep license state current without excessive requests.</span>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <strong>Auto refresh</strong>
              <span>Refresh server data while connected.</span>
            </div>
            <select
              className="settings-select"
              value={settings.autoRefreshSeconds}
              onChange={(e) => patch("autoRefreshSeconds", Number(e.target.value) as OwnerSettings["autoRefreshSeconds"])}
            >
              <option value={0}>Off</option>
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds</option>
              <option value={120}>2 minutes</option>
            </select>
          </div>
        </div>

        <div className="panel settings-card">
          <div className="settings-card-head">
            <MonitorCog size={18} />
            <div>
              <strong>Interface</strong>
              <span>Keep the same compact Zyven layout across your tools.</span>
            </div>
          </div>

          <label className="settings-row clickable">
            <div>
              <strong>Compact license rows</strong>
              <span>Reduce table spacing when managing many licenses.</span>
            </div>
            <input
              className="toggle-input"
              type="checkbox"
              checked={settings.compactRows}
              onChange={(e) => patch("compactRows", e.target.checked)}
            />
          </label>

          <label className="settings-row clickable">
            <div>
              <strong>Confirm destructive actions</strong>
              <span>Ask before permanently deleting a license or invalidating every session.</span>
            </div>
            <input
              className="toggle-input"
              type="checkbox"
              checked={settings.confirmDestructive}
              onChange={(e) => patch("confirmDestructive", e.target.checked)}
            />
          </label>
        </div>

        <div className="panel settings-card">
          <div className="settings-card-head">
            <ShieldCheck size={18} />
            <div>
              <strong>Connection security</strong>
              <span>Sensitive owner credentials stay out of persistent storage.</span>
            </div>
          </div>

          <div className="connection-details">
            <div><span>Server</span><strong className="mono">{serverUrl}</strong></div>
            <div><span>Server version</span><strong>{serverVersion || "—"}</strong></div>
            <div><span>Admin key</span><strong>Memory only · never saved</strong></div>
            <div><span>Generated full keys</span><strong>Encrypted with Electron safeStorage</strong></div>
          </div>

          <button className="secondary-button danger-soft disconnect-button" type="button" onClick={onDisconnect}>
            <LogOut size={16} />
            Disconnect owner console
          </button>
        </div>
      </section>
    </div>
  );
}
