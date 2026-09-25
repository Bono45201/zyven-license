import { Eye, EyeOff, LockKeyhole, Server } from "lucide-react";
import { FormEvent, useState } from "react";

export default function ConnectScreen({
  defaultServer,
  busy,
  error,
  version,
  onConnect
}: {
  defaultServer: string;
  busy: boolean;
  error: string;
  version: string;
  onConnect: (server: string, key: string) => Promise<void>;
}) {
  const [server, setServer] = useState(defaultServer);
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!key.trim() || busy) return;
    await onConnect(server, key);
    setKey("");
  }

  return (
    <div className="connect-shell">
      <div className="connect-titlebar drag-region">
        <div className="connect-brand no-drag">
          <img src="./assets/zyven-logo.png" alt="Zyven" />
          <div>
            <strong>LICENSE MANAGER</strong>
            <span>Online owner console</span>
          </div>
          <div className="version-chip">{version ? "v" + version : "v—"}</div>
        </div>
        <div className="connect-owner-label">OWNER ONLY · ADMIN KEY IS NEVER SAVED</div>
        <div className="window-controls no-drag">
          <button type="button" onClick={() => window.zyvenOwner.window.minimize()}>—</button>
          <button type="button" className="close" onClick={() => window.zyvenOwner.window.close()}>×</button>
        </div>
      </div>

      <main className="connect-stage">
        <form className="connect-card" onSubmit={submit}>
          <img src="./assets/zyven-logo.png" className="connect-logo" alt="Zyven" />
          <h1>Connect owner console</h1>
          <p>Connect directly to your Cloudflare license server.</p>

          <label className="field-label" htmlFor="server">Server URL</label>
          <div className="input-with-icon">
            <Server size={16} />
            <input
              id="server"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <label className="field-label" htmlFor="admin">Admin key</label>
          <div className="input-with-icon">
            <LockKeyhole size={16} />
            <input
              id="admin"
              type={show ? "text" : "password"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              autoFocus
            />
            <button
              className="input-action"
              type="button"
              onClick={() => setShow((value) => !value)}
              tabIndex={-1}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error ? <div className="inline-error">{error}</div> : null}

          <button className="primary-button connect-button" type="submit" disabled={busy || !key.trim()}>
            {busy ? <span className="button-spinner" /> : null}
            {busy ? "Connecting…" : "Connect"}
          </button>

          <div className="security-note">
            The admin key stays in memory only and is cleared when the application closes or disconnects.
          </div>
        </form>
      </main>
    </div>
  );
}
