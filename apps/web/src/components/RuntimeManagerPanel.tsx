import type { RuntimeSpec } from "@clawflow/protocol";
import { Activity, RefreshCw, Server, X } from "lucide-react";
import type { ReactElement } from "react";

export interface RuntimeManagerPanelProps {
  runtimes: RuntimeSpec[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onHealthCheck: () => void;
}

export function RuntimeManagerPanel({
  runtimes,
  isLoading,
  error,
  onClose,
  onRefresh,
  onHealthCheck
}: RuntimeManagerPanelProps): ReactElement {
  return (
    <aside className="runtime-manager-panel" aria-label="Runtime Manager">
      <div className="runtime-manager-header">
        <div>
          <Server aria-hidden="true" size={18} />
          <span>
            <strong>Runtime Manager</strong>
            <small>{runtimes.length} registered runtimes</small>
          </span>
        </div>
        <div className="runtime-manager-actions">
          <button type="button" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw aria-hidden="true" size={14} />
            Refresh
          </button>
          <button type="button" onClick={onHealthCheck} disabled={isLoading}>
            <Activity aria-hidden="true" size={14} />
            Health Check
          </button>
          <button type="button" title="Close Runtime Manager" onClick={onClose}>
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      </div>

      <div className="runtime-manager-body">
        {error !== null ? (
          <div className="runtime-manager-error" role="status">
            <strong>Gateway unavailable</strong>
            <span>{error}</span>
          </div>
        ) : null}

        <div className="runtime-card-list">
          {runtimes.length === 0 && error === null ? (
            <p className="runtime-empty">No runtimes loaded yet.</p>
          ) : null}

          {runtimes.map((runtime) => (
            <RuntimeCard key={runtime.id} runtime={runtime} />
          ))}
        </div>
      </div>
    </aside>
  );
}

function RuntimeCard({ runtime }: { runtime: RuntimeSpec }): ReactElement {
  return (
    <article className={`runtime-card runtime-status-${runtime.status}`}>
      <div className="runtime-card-header">
        <div>
          <strong>{runtime.name}</strong>
          <code>{runtime.id}</code>
        </div>
        <span className={`runtime-status-badge runtime-status-${runtime.status}`}>{runtime.status}</span>
      </div>

      <div className="runtime-meta-grid">
        <span>Type</span>
        <code>{runtime.type}</code>
        <span>Endpoint</span>
        <code>{runtime.endpoint ?? "-"}</code>
        <span>Command</span>
        <code>{runtime.command ?? "-"}</code>
        <span>Capabilities</span>
        <code>{runtime.capabilities.length}</code>
        <span>Last Health</span>
        <code>{runtime.lastHealthCheckAt === undefined ? "-" : formatRuntimeTime(runtime.lastHealthCheckAt)}</code>
        <span>Error</span>
        <code title={runtime.errorMessage ?? "-"}>{runtime.errorMessage ?? "-"}</code>
      </div>

      <div className="runtime-description">{runtime.description ?? "No description."}</div>

      <div className="runtime-capability-list">
        {runtime.capabilities.map((capability) => (
          <span className={`runtime-capability risk-${capability.riskLevel}`} key={capability.id}>
            <code>{capability.id}</code>
            <small>{capability.kind}</small>
          </span>
        ))}
      </div>
    </article>
  );
}

function formatRuntimeTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}
