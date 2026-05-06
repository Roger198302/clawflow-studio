import { AlertTriangle, X } from "lucide-react";
import type { ReactElement } from "react";
import type { RunAlertSeverity } from "../store/flowStore";

export interface DismissibleAlertProps {
  severity: RunAlertSeverity;
  title: string;
  message: string;
  suggestion: string;
  onClose: () => void;
}

export function DismissibleAlert({
  severity,
  title,
  message,
  suggestion,
  onClose
}: DismissibleAlertProps): ReactElement {
  return (
    <aside className={`dismissible-alert alert-${severity}`} role="status" aria-live="polite">
      <AlertTriangle aria-hidden="true" size={18} />
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
        <small>{suggestion}</small>
      </div>
      <button type="button" title="Dismiss error" onClick={onClose}>
        <X aria-hidden="true" size={16} />
      </button>
    </aside>
  );
}
