import {
  Ban,
  Check,
  Clipboard,
  Copy,
  Eye,
  KeyRound,
  LogOut,
  MonitorOff,
  Pause,
  Search,
  ShieldCheck,
  Trash2,
  Undo2
} from "lucide-react";
import { useMemo, useState } from "react";
import Modal from "../components/Modal";
import StatusPill from "../components/StatusPill";
import type { DeletedLicense, LicenseRecord, LicenseStatus, ProductScope } from "../types";
import {
  expiryText,
  formatDateUnix,
  maskFingerprint,
  productName,
  sessionText
} from "../lib/format";

type ViewMode = "active" | "deleted";

export default function LicensesPage({
  records,
  deleted,
  scope,
  compact,
  confirmDestructive,
  onRefresh,
  onSetStatus,
  onResetDevice,
  onForceLogout,
  onSetExpiry,
  onDelete,
  onGetFullKey,
  onCopy
}: {
  records: LicenseRecord[];
  deleted: DeletedLicense[];
  scope: ProductScope;
  compact: boolean;
  confirmDestructive: boolean;
  onRefresh: () => Promise<void> | void;
  onSetStatus: (record: LicenseRecord, status: LicenseStatus) => Promise<void>;
  onResetDevice: (record: LicenseRecord) => Promise<void>;
  onForceLogout: (record: LicenseRecord) => Promise<void>;
  onSetExpiry: (record: LicenseRecord, expiry: string) => Promise<void>;
  onDelete: (record: LicenseRecord) => Promise<void>;
  onGetFullKey: (record: LicenseRecord) => Promise<string>;
  onCopy: (value: string) => Promise<void>;
}) {
  const [view, setView] = useState<ViewMode>("active");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState("");
  const [keyModal, setKeyModal] = useState<{ open: boolean; key: string; customer: string }>({
    open: false,
    key: "",
    customer: ""
  });
  const [expiryModal, setExpiryModal] = useState<{ open: boolean; record: LicenseRecord | null; value: string }>({
    open: false,
    record: null,
    value: "LIFETIME"
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((record) => {
      if (scope && record.Product !== scope) return false;
      if (status && String(record.Status).toUpperCase() !== status) return false;
      if (!q) return true;
      return [
        record.Customer,
        record.LicenseId,
        record.Product,
        record.DeviceId,
        record.Plan,
        record.Fingerprint
      ].some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [records, scope, status, query]);

  const filteredDeleted = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deleted.filter((record) => {
      if (scope && record.Product !== scope) return false;
      if (!q) return true;
      return [record.Customer, record.LicenseId, record.Product, record.Fingerprint]
        .some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [deleted, scope, query]);

  const selected = records.find((record) => record.LicenseId === selectedId) || filtered[0] || null;

  async function run(label: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    try {
      await action();
    } finally {
      setBusy("");
    }
  }

  async function showFullKey(record: LicenseRecord) {
    await run("key", async () => {
      const key = await onGetFullKey(record);
      setKeyModal({
        open: true,
        key,
        customer: record.Customer || "Zyven User"
      });
    });
  }

  function destructiveMessage(record: LicenseRecord) {
    return "Permanently delete " + (record.Customer || record.LicenseId) + "? This cannot be undone.";
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <h1>Licenses</h1>
          <p>Search, inspect and control every Zyven license from one place.</p>
        </div>
      </section>

      <section className="panel licenses-panel">
        <div className="license-toolbar">
          <div className="segmented">
            <button type="button" className={view === "active" ? "active" : ""} onClick={() => setView("active")}>
              Active records
              <span>{records.filter((x) => !scope || x.Product === scope).length}</span>
            </button>
            <button type="button" className={view === "deleted" ? "active" : ""} onClick={() => setView("deleted")}>
              Deleted
              <span>{deleted.filter((x) => !scope || x.Product === scope).length}</span>
            </button>
          </div>

          <div className="toolbar-spacer" />

          {view === "active" ? (
            <div className="select-wrap mini">
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All status</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="REVOKED">Revoked</option>
              </select>
            </div>
          ) : null}

          <div className="search-box">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer, key ID, HWID…"
            />
          </div>
        </div>

        {view === "deleted" ? (
          <div className="table-wrap">
            <table className={"data-table selectable " + (compact ? "compact" : "")}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>License ID</th>
                  <th>Fingerprint</th>
                  <th>Deleted</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeleted.length ? filteredDeleted.map((item) => (
                  <tr key={item.LicenseId}>
                    <td><div className="cell-primary">{item.Customer || "Zyven User"}</div></td>
                    <td>{productName(item.Product)}</td>
                    <td className="mono">{item.LicenseId}</td>
                    <td className="mono muted">{maskFingerprint(item.Fingerprint)}</td>
                    <td>{formatDateUnix(item.DeletedUtc, true)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5}><div className="empty-row">No permanently deleted licenses found.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="license-layout">
            <div className="license-list">
              <div className="table-wrap">
                <table className={"data-table selectable " + (compact ? "compact" : "")}>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Product</th>
                      <th>Status</th>
                      <th>Session</th>
                      <th>Expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length ? filtered.map((item) => (
                      <tr
                        key={item.LicenseId}
                        className={(selected && selected.LicenseId === item.LicenseId) ? "selected" : ""}
                        onClick={() => setSelectedId(item.LicenseId)}
                      >
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
                      </tr>
                    )) : (
                      <tr><td colSpan={5}><div className="empty-row">No licenses match the current filters.</div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="license-detail">
              {selected ? (
                <>
                  <div className="detail-header">
                    <div className="detail-key-icon"><KeyRound size={19} /></div>
                    <div>
                      <strong>{selected.Customer || "Zyven User"}</strong>
                      <span>{productName(selected.Product)}</span>
                    </div>
                    <StatusPill record={selected} />
                  </div>

                  <div className="detail-grid">
                    <div><span>License ID</span><strong className="mono">{selected.LicenseId}</strong></div>
                    <div><span>Plan</span><strong>{selected.Plan || "Lifetime"}</strong></div>
                    <div><span>Device / HWID</span><strong className="mono">{selected.DeviceId || "AUTO"}</strong></div>
                    <div><span>Session</span><strong>{sessionText(selected)}</strong></div>
                    <div><span>Expiry</span><strong>{expiryText(selected.ExpiresUtc)}</strong></div>
                    <div><span>Created</span><strong>{formatDateUnix(selected.CreatedUtc, true)}</strong></div>
                    <div><span>Last seen</span><strong>{formatDateUnix(selected.LastSeenUtc, true)}</strong></div>
                    <div><span>Fingerprint</span><strong className="mono">{maskFingerprint(selected.Fingerprint)}</strong></div>
                  </div>

                  <div className="detail-section-title">KEY</div>
                  <div className="action-grid two">
                    <button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={() => showFullKey(selected)}>
                      <Eye size={15} /> Show full key
                    </button>
                    <button className="secondary-button" type="button" onClick={() => onCopy(selected.LicenseId)}>
                      <Copy size={15} /> Copy ID
                    </button>
                  </div>

                  <div className="detail-section-title">STATUS</div>
                  <div className="action-grid three">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={Boolean(busy) || selected.Status === "ACTIVE"}
                      onClick={() => run("status", () => onSetStatus(selected, "ACTIVE"))}
                    >
                      <Check size={15} /> Activate
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={Boolean(busy) || selected.Status === "PAUSED"}
                      onClick={() => run("status", () => onSetStatus(selected, "PAUSED"))}
                    >
                      <Pause size={15} /> Pause
                    </button>
                    <button
                      className="secondary-button danger-soft"
                      type="button"
                      disabled={Boolean(busy) || selected.Status === "REVOKED"}
                      onClick={() => run("status", () => onSetStatus(selected, "REVOKED"))}
                    >
                      <Ban size={15} /> Revoke
                    </button>
                  </div>

                  <div className="detail-section-title">DEVICE & SESSION</div>
                  <div className="action-grid two">
                    <button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={() => run("hwid", () => onResetDevice(selected))}>
                      <Undo2 size={15} /> Reset HWID
                    </button>
                    <button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={() => run("logout", () => onForceLogout(selected))}>
                      <MonitorOff size={15} /> Force logout
                    </button>
                  </div>

                  <div className="detail-section-title">EXPIRY</div>
                  <button
                    className="secondary-button full"
                    type="button"
                    onClick={() => setExpiryModal({
                      open: true,
                      record: selected,
                      value: selected.ExpiresUtc ? new Date(selected.ExpiresUtc * 1000).toISOString().slice(0, 10) : "LIFETIME"
                    })}
                  >
                    <ShieldCheck size={15} /> Set expiry
                  </button>

                  <div className="danger-zone">
                    <div>
                      <strong>Permanent deletion</strong>
                      <span>Deletes the server record and prevents reuse of this exact key.</span>
                    </div>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => {
                        if (confirmDestructive && !window.confirm(destructiveMessage(selected))) return;
                        run("delete", () => onDelete(selected));
                      }}
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </>
              ) : (
                <div className="detail-empty">
                  <Clipboard size={22} />
                  <strong>Select a license</strong>
                  <span>License details and owner controls appear here.</span>
                </div>
              )}
            </aside>
          </div>
        )}
      </section>

      <Modal
        open={keyModal.open}
        title="Full license key"
        description={keyModal.customer}
        onClose={() => setKeyModal({ open: false, key: "", customer: "" })}
      >
        {keyModal.key ? (
          <>
            <div className="generated-key-box mono">{keyModal.key}</div>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => onCopy(keyModal.key)}>
                <Copy size={15} /> Copy key
              </button>
              <button className="primary-button" type="button" onClick={() => setKeyModal({ open: false, key: "", customer: "" })}>
                Done
              </button>
            </div>
          </>
        ) : (
          <div className="vault-missing">
            <KeyRound size={22} />
            <strong>Full key is not stored on this PC</strong>
            <span>The server intentionally stores only a fingerprint. Full keys are available for licenses created with this Owner application on this Windows account.</span>
          </div>
        )}
      </Modal>

      <Modal
        open={expiryModal.open}
        title="Set license expiry"
        description={expiryModal.record ? expiryModal.record.Customer : ""}
        onClose={() => setExpiryModal({ open: false, record: null, value: "LIFETIME" })}
      >
        <label className="field-label">Expiry</label>
        <input
          className="text-input"
          value={expiryModal.value}
          onChange={(e) => setExpiryModal((prev) => ({ ...prev, value: e.target.value }))}
          placeholder="LIFETIME or yyyy-MM-dd"
        />
        <div className="field-help">Use <strong>LIFETIME</strong> or a date such as 2027-12-31.</div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={() => setExpiryModal((prev) => ({ ...prev, value: "LIFETIME" }))}>
            Lifetime
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!expiryModal.record || Boolean(busy)}
            onClick={() => {
              if (!expiryModal.record) return;
              run("expiry", async () => {
                await onSetExpiry(expiryModal.record!, expiryModal.value.trim());
                setExpiryModal({ open: false, record: null, value: "LIFETIME" });
              });
            }}
          >
            Save expiry
          </button>
        </div>
      </Modal>
    </div>
  );
}
