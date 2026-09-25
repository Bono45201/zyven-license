import {
  Activity,
  Gauge,
  KeyRound,
  Plus,
  Settings
} from "lucide-react";
import type { PageId } from "../types";

const items: Array<{ id: PageId; label: string; icon: typeof Gauge }> = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "licenses", label: "Licenses", icon: KeyRound },
  { id: "create", label: "Create License", icon: Plus },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings }
];

export default function Sidebar({
  page,
  onPage,
  connected
}: {
  page: PageId;
  onPage: (page: PageId) => void;
  connected: boolean;
}) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <img src="./assets/zyven-logo.png" className="brand-logo" alt="Zyven" />
        <div className="brand-copy">
          <strong>ZYVEN</strong>
          <span>OWNER CONSOLE</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">MANAGEMENT</div>
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={"nav-item " + (page === id ? "active" : "")}
            onClick={() => onPage(id)}
            disabled={!connected}
          >
            <Icon size={17} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className={"connection-mini " + (connected ? "online" : "")}>
          <span className="status-dot" />
          <div>
            <strong>{connected ? "Connected" : "Disconnected"}</strong>
            <span>{connected ? "Cloudflare license server" : "Owner session inactive"}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
