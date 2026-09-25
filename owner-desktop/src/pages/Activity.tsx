import {
  Activity as ActivityIcon,
  Ban,
  Clock3,
  KeyRound,
  LogIn,
  MonitorOff,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Unplug
} from "lucide-react";
import type { ActivityEntry } from "../types";
import { formatDateMs } from "../lib/format";

function iconFor(type: string) {
  if (type === "create") return <KeyRound size={16} />;
  if (type === "status") return <Ban size={16} />;
  if (type === "session") return <MonitorOff size={16} />;
  if (type === "device") return <RotateCcw size={16} />;
  if (type === "expiry") return <ShieldCheck size={16} />;
  if (type === "delete") return <Trash2 size={16} />;
  if (type === "connection") return <LogIn size={16} />;
  return <ActivityIcon size={16} />;
}

export default function ActivityPage({
  entries,
  onRefresh,
  onClear
}: {
  entries: ActivityEntry[];
  onRefresh: () => Promise<void> | void;
  onClear: () => Promise<void> | void;
}) {
  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <h1>Activity</h1>
          <p>Real owner actions performed from this application. No fake server history.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" type="button" onClick={onRefresh}>
            <RotateCcw size={15} />
            Refresh
          </button>
          <button className="secondary-button danger-soft" type="button" onClick={onClear}>
            <Trash2 size={15} />
            Clear local log
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <strong>Owner activity</strong>
            <span>Stored locally without admin keys or customer license keys.</span>
          </div>
        </div>

        <div className="activity-list">
          {entries.length ? entries.map((entry) => (
            <div className="activity-row" key={entry.id}>
              <div className={"activity-icon type-" + entry.type}>{iconFor(entry.type)}</div>
              <div className="activity-copy">
                <strong>{entry.title}</strong>
                <span>{entry.detail || "Owner action completed."}</span>
              </div>
              <div className="activity-time">
                <Clock3 size={13} />
                {formatDateMs(entry.at)}
              </div>
            </div>
          )) : (
            <div className="activity-empty">
              <Unplug size={24} />
              <strong>No activity yet</strong>
              <span>Create or manage a license and the real action will appear here.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
