import type { LicenseRecord } from "../types";
import { isExpired } from "../lib/format";

export default function StatusPill({ record }: { record: LicenseRecord }) {
  const expired = isExpired(record.ExpiresUtc);
  const status = expired ? "EXPIRED" : String(record.Status || "UNKNOWN").toUpperCase();
  return <span className={"status-pill status-" + status.toLowerCase()}>{status}</span>;
}
