import {
  Activity,
  CircleCheck,
  KeyRound,
  MonitorCheck,
  PauseCircle,
  Plus,
  RefreshCw,
  ShieldAlert
} from "lucide-react";
import MetricCard from "../components/MetricCard";
import StatusPill from "../components/StatusPill";
import type { LicenseRecord, PageId, ProductScope } from "../types";
import { expiryText, formatDateUnix, productName, productScopeRecords, sessionText, isExpired } from "../lib/format";

export default function Dashboard({
  records,
  scope,
  onPage,
  onRefresh,
  onLogoutAll
}: {
  records: LicenseRecord[];
  scope: ProductScope;
  onPage: (page: PageId) => void;
  onRefresh: () => void;
  onLogoutAll: () => void;
}) {
  const scoped = productScopeRecords(records, scope);
  const active = scoped.filter((x) =>
    String(x.Status).toUpperCase() === "ACTIVE" && !isExpired(x.ExpiresUtc)
  ).length;
  const online = scoped.filter((x) => Number(x.ActiveSessions || 0) > 0).length;
  const paused = scoped.filter((x) => String(x.Status).toUpperCase() === "PAUSED").length;
  const revoked = scoped.filter((x) => String(x.Status).toUpperCase() === "REVOKED").length;
  const expired = scoped.filter((x) => isExpired(x.ExpiresUtc)).length;
  const recent = [...scoped].sort((a, b) => Number(b.CreatedUtc) - Number(a.CreatedUtc)).slice(0, 7);

  const sound = records.filter((x) => x.Product === "ZYVEN-SOUND-TOOL");
  const gp = records.filter((x) => x.Product === "ZYVEN-GP-TOOL");

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <h1>Owner Dashboard</h1>
          <p>Live license overview for every Zyven product.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" type="button" onClick={onRefresh}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="primary-button" type="button" onClick={() => onPage("create")}>
            <Plus size={16} />
            Create license
          </button>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          label="TOTAL LICENSES"
          value={scoped.length}
          note={scope ? productName(scope) : "Across all Zyven products"}
          icon={<KeyRound size={18} />}
        />
        <MetricCard
          label="ACTIVE"
          value={active}
          note="Currently usable licenses"
          icon={<CircleCheck size={18} />}
        />
        <MetricCard
          label="ONLINE"
          value={online}
          note="Live authenticated sessions"
          icon={<MonitorCheck size={18} />}
        />
        <MetricCard
          label="RESTRICTED"
          value={paused + revoked + expired}
          note={paused + " paused · " + revoked + " revoked · " + expired + " expired"}
          icon={<ShieldAlert size={18} />}
        />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <strong>Products</strong>
              <span>License distribution and live sessions.</span>
            </div>
          </div>
          <div className="product-summary-grid">
            <div className="product-summary-card">
              <div className="product-summary-head">
                <div className="product-mark">S</div>
                <div>
                  <strong>Zyven Sound Tool</strong>
                  <span>ZYVEN-SOUND-TOOL</span>
                </div>
              </div>
              <div className="product-summary-stats">
                <div><strong>{sound.length}</strong><span>Licenses</span></div>
                <div><strong>{sound.filter((x) => x.ActiveSessions > 0).length}</strong><span>Online</span></div>
                <div><strong>{sound.filter((x) => x.Status === "ACTIVE" && !isExpired(x.ExpiresUtc)).length}</strong><span>Active</span></div>
              </div>
            </div>

            <div className="product-summary-card">
              <div className="product-summary-head">
                <div className="product-mark">G</div>
                <div>
                  <strong>Zyven GP Tool</strong>
                  <span>ZYVEN-GP-TOOL</span>
                </div>
              </div>
              <div className="product-summary-stats">
                <div><strong>{gp.length}</strong><span>Licenses</span></div>
                <div><strong>{gp.filter((x) => x.ActiveSessions > 0).length}</strong><span>Online</span></div>
                <div><strong>{gp.filter((x) => x.Status === "ACTIVE" && !isExpired(x.ExpiresUtc)).length}</strong><span>Active</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel quick-panel">
          <div className="panel-header">
            <div>
              <strong>Quick actions</strong>
              <span>Owner-only server controls.</span>
            </div>
          </div>
          <button className="quick-action" type="button" onClick={() => onPage("create")}>
            <Plus size={17} />
            <div><strong>Create license</strong><span>Generate a new signed Zyven key.</span></div>
          </button>
          <button className="quick-action" type="button" onClick={() => onPage("activity")}>
            <Activity size={17} />
            <div><strong>Open activity</strong><span>Review real actions from this Owner app.</span></div>
          </button>
          <button className="quick-action danger-soft" type="button" onClick={onLogoutAll}>
            <PauseCircle size={17} />
            <div>
              <strong>Force logout {scope ? productName(scope) : "all products"}</strong>
              <span>Invalidate active sessions without revoking licenses.</span>
            </div>
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header row">
          <div>
            <strong>Recent licenses</strong>
            <span>Newest server records in the selected product scope.</span>
          </div>
          <button className="text-button" type="button" onClick={() => onPage("licenses")}>View all</button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Product</th>
                <th>Status</th>
                <th>Session</th>
                <th>Expiry</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recent.length ? recent.map((item) => (
                <tr key={item.LicenseId}>
                  <td>
                    <div className="cell-primary">{item.Customer || "Zyven User"}</div>
                    <div className="cell-secondary mono">{item.LicenseId}</div>
                  </td>
                  <td>{productName(item.Product)}</td>
                  <td><StatusPill record={item} /></td>
                  <td>
                    <span className={"session-label " + (item.ActiveSessions > 0 ? "online" : "")}>
                      <span className="status-dot" /> {sessionText(item)}
                    </span>
                  </td>
                  <td>{expiryText(item.ExpiresUtc)}</td>
                  <td>{formatDateUnix(item.CreatedUtc)}</td>
                </tr>
              )) : (
                <tr><td colSpan={6}><div className="empty-row">No licenses in this scope.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
