import { X } from "lucide-react";
import type { ReactNode } from "react";

export default function Modal({
  open,
  title,
  description,
  children,
  onClose,
  width = 520
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  width?: number;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ width }}>
        <div className="modal-head">
          <div>
            <strong>{title}</strong>
            {description ? <span>{description}</span> : null}
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
