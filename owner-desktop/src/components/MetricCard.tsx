import type { ReactNode } from "react";

export default function MetricCard({
  label,
  value,
  note,
  icon
}: {
  label: string;
  value: string | number;
  note: string;
  icon: ReactNode;
}) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <div className="metric-icon">{icon}</div>
      </div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">{note}</span>
    </div>
  );
}
