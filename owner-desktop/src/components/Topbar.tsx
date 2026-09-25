import { ChevronDown, RefreshCw } from "lucide-react";
import type { ProductScope } from "../types";

export default function Topbar({
  title,
  subtitle,
  product,
  onProduct,
  onRefresh,
  refreshing,
  version
}: {
  title: string;
  subtitle: string;
  product: ProductScope;
  onProduct: (value: ProductScope) => void;
  onRefresh: () => void;
  refreshing: boolean;
  version: string;
}) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>

      <div className="topbar-center">
        <span className="owner-only">OWNER ONLY · ADMIN KEY IS NEVER SAVED</span>
      </div>

      <div className="topbar-actions no-drag">
        <div className="select-wrap compact">
          <select value={product} onChange={(e) => onProduct(e.target.value as ProductScope)}>
            <option value="">All products</option>
            <option value="ZYVEN-SOUND-TOOL">Sound Tool</option>
            <option value="ZYVEN-GP-TOOL">GP Tool</option>
          </select>
          <ChevronDown size={15} />
        </div>
        <button className="icon-button" type="button" onClick={onRefresh} title="Refresh">
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
        </button>
        <div className="version-chip">{version ? "v" + version : "v—"}</div>
        <div className="window-controls">
          <button type="button" onClick={() => window.zyvenOwner.window.minimize()} aria-label="Minimize">—</button>
          <button type="button" onClick={() => window.zyvenOwner.window.maximizeToggle()} aria-label="Maximize">□</button>
          <button type="button" className="close" onClick={() => window.zyvenOwner.window.close()} aria-label="Close">×</button>
        </div>
      </div>
    </header>
  );
}
