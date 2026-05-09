import type {
  RuntimeCapability,
  RuntimeExecutionMode,
  RuntimeHealth,
  RuntimeSpec
} from "@clawflow/protocol";
import { Activity, Clipboard, FileText, RefreshCw, Server, X } from "lucide-react";
import type { ReactElement } from "react";
import { t, type I18nKey, type Locale } from "../i18n";
import type {
  GatewayProfile,
  LocalGatewayConnection,
  LocalGatewayConnectionStatus
} from "../store/runtimeStore";
import { DEFAULT_GATEWAY_PROFILE_ID } from "../store/runtimeStore";

type OpenClawTaskCopyStatus = "idle" | "success" | "error";

export interface RuntimeManagerPanelProps {
  runtimes: RuntimeSpec[];
  runtimeHealth: Record<string, RuntimeHealth>;
  locale: Locale;
  isLoading: boolean;
  error: string | null;
  localGatewayConnection: LocalGatewayConnection;
  gatewayProfiles: GatewayProfile[];
  gatewayProfileUsage: Record<string, string[]>;
  openClawTaskCopyStatus: OpenClawTaskCopyStatus;
  onClose: () => void;
  onRefresh: () => void;
  onHealthCheck: () => void;
  onAddGatewayProfile: () => string;
  onUpdateGatewayProfile: (
    profileId: string,
    patch: Partial<Pick<GatewayProfile, "name" | "baseUrl" | "healthPath">>
  ) => void;
  onDeleteGatewayProfile: (profileId: string) => void;
  onCheckGatewayProfile: (profileId: string) => void;
  onCopyOpenClawTask: () => void;
  onOpenOpenClawTaskExport: () => void;
}

export function RuntimeManagerPanel({
  runtimes,
  runtimeHealth,
  locale,
  isLoading,
  error,
  localGatewayConnection,
  gatewayProfiles,
  gatewayProfileUsage,
  openClawTaskCopyStatus,
  onClose,
  onRefresh,
  onHealthCheck,
  onAddGatewayProfile,
  onUpdateGatewayProfile,
  onDeleteGatewayProfile,
  onCheckGatewayProfile,
  onCopyOpenClawTask,
  onOpenOpenClawTaskExport
}: RuntimeManagerPanelProps): ReactElement {
  return (
    <aside
      className="runtime-manager-panel"
      aria-label={t(locale, "runtimeManager.aria")}
      data-testid="runtime-manager-panel"
    >
      <div className="runtime-manager-header">
        <div>
          <Server aria-hidden="true" size={18} />
          <span>
            <strong>{t(locale, "runtimeManager.title")}</strong>
            <small>
              {runtimes.length} {t(locale, "runtimeManager.registeredRuntimes")}
            </small>
          </span>
        </div>
        <div className="runtime-manager-actions">
          <button type="button" data-testid="runtime-manager-refresh-button" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw aria-hidden="true" size={14} />
            {t(locale, "runtimeManager.refresh")}
          </button>
          <button
            type="button"
            data-testid="runtime-manager-health-check-button"
            onClick={onHealthCheck}
            disabled={isLoading}
          >
            <Activity aria-hidden="true" size={14} />
            {t(locale, "runtimeManager.healthCheck")}
          </button>
          <button type="button" title={t(locale, "runtimeManager.closeTitle")} onClick={onClose}>
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      </div>

      <div className="runtime-manager-body">
        {error !== null ? (
          <div className="runtime-manager-error" role="status">
            <strong>{t(locale, "runtimeManager.gatewayUnavailable")}</strong>
            <span>{error}</span>
          </div>
        ) : null}

        <section className="gateway-profiles-panel" data-testid="gateway-profiles-panel">
          <div className="gateway-profiles-title">
            <span>
              <strong>{t(locale, "gatewayProfiles.title")}</strong>
              <small>{t(locale, "gatewayProfiles.uiPreferenceOnly")}</small>
            </span>
            <button type="button" data-testid="gateway-profile-add-button" onClick={onAddGatewayProfile}>
              {t(locale, "gatewayProfiles.add")}
            </button>
          </div>
          <div className="gateway-profile-list">
            {gatewayProfiles.map((profile) => {
              const isDefaultProfile = profile.id === DEFAULT_GATEWAY_PROFILE_ID;

              return (
              <article className="gateway-profile-card" data-testid={`gateway-profile-${profile.id}`} key={profile.id}>
                <div className="gateway-profile-card-header">
                  <strong>{profile.name}</strong>
                  <span className={`gateway-profile-status status-${profile.status}`}>
                    {t(locale, getGatewayProfileStatusKey(profile.status))}
                  </span>
                </div>
                <label>
                  <span>{t(locale, "gatewayProfiles.profileName")}</span>
                  <input
                    value={profile.name}
                    data-testid={`gateway-profile-name-${profile.id}`}
                    onChange={(event) =>
                      onUpdateGatewayProfile(profile.id, {
                        name: event.target.value
                      })
                    }
                  />
                </label>
                <div className="gateway-profile-kind">
                  <span>{t(locale, "gatewayProfiles.kind")}</span>
                  <code>{profile.kind}</code>
                </div>
                <label>
                  <span>{t(locale, "gatewayQuickConnect.gatewayUrl")}</span>
                  <input
                    value={profile.baseUrl}
                    data-testid={`gateway-profile-base-url-${profile.id}`}
                    onChange={(event) =>
                      onUpdateGatewayProfile(profile.id, {
                        baseUrl: event.target.value
                      })
                    }
                  />
                </label>
                <label>
                  <span>{t(locale, "gatewayQuickConnect.healthPath")}</span>
                  <input
                    value={profile.healthPath}
                    data-testid={`gateway-profile-health-path-${profile.id}`}
                    onChange={(event) =>
                      onUpdateGatewayProfile(profile.id, {
                        healthPath: event.target.value
                      })
                    }
                  />
                </label>
                <div className="gateway-profile-actions">
                  <button
                    type="button"
                    data-testid={`gateway-profile-check-${profile.id}`}
                    onClick={() => onCheckGatewayProfile(profile.id)}
                    disabled={profile.status === "checking" || isLoading}
                  >
                    {profile.status === "checking"
                      ? t(locale, "gatewayQuickConnect.checking")
                      : t(locale, "runtimeManager.healthCheck")}
                  </button>
                  <button
                    type="button"
                    data-testid={`gateway-profile-delete-${profile.id}`}
                    onClick={() => onDeleteGatewayProfile(profile.id)}
                    disabled={isDefaultProfile}
                    title={
                      isDefaultProfile
                        ? t(locale, "gatewayProfiles.cannotDeleteDefault")
                        : t(locale, "gatewayProfiles.delete")
                    }
                  >
                    {t(locale, "gatewayProfiles.delete")}
                  </button>
                  <span>{t(locale, "runtimeManager.openClawProtectedBoundary")}</span>
                </div>
                {isDefaultProfile ? (
                  <small className="gateway-profile-note" data-testid={`gateway-profile-default-note-${profile.id}`}>
                    {t(locale, "gatewayProfiles.cannotDeleteDefault")}
                  </small>
                ) : null}
                <div className="gateway-profile-usage" data-testid={`gateway-profile-usage-${profile.id}`}>
                  <strong>{t(locale, "gatewayProfiles.usedBy")}</strong>
                  <span>
                    {(gatewayProfileUsage[profile.id] ?? []).length === 0
                      ? t(locale, "gatewayProfiles.noAgentsUsing")
                      : gatewayProfileUsage[profile.id].join(", ")}
                  </span>
                </div>
              </article>
              );
            })}
          </div>
        </section>

        <div className="runtime-card-list">
          {runtimes.length === 0 && error === null ? (
            <p className="runtime-empty">{t(locale, "runtimeManager.empty")}</p>
          ) : null}

          {runtimes.map((runtime) => (
            <RuntimeCard
              key={runtime.id}
              runtime={runtime}
              health={runtimeHealth[runtime.id]}
              locale={locale}
              localGatewayConnection={localGatewayConnection}
              openClawTaskCopyStatus={openClawTaskCopyStatus}
              onCopyOpenClawTask={onCopyOpenClawTask}
              onOpenOpenClawTaskExport={onOpenOpenClawTaskExport}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

function RuntimeCard({
  runtime,
  health,
  locale,
  localGatewayConnection,
  openClawTaskCopyStatus,
  onCopyOpenClawTask,
  onOpenOpenClawTaskExport
}: {
  runtime: RuntimeSpec;
  health: RuntimeHealth | undefined;
  locale: Locale;
  localGatewayConnection: LocalGatewayConnection;
  openClawTaskCopyStatus: OpenClawTaskCopyStatus;
  onCopyOpenClawTask: () => void;
  onOpenOpenClawTaskExport: () => void;
}): ReactElement {
  const status = health?.status ?? runtime.status;
  const lastHealthCheckAt = health?.checkedAt ?? runtime.lastHealthCheckAt;
  const message = health?.message ?? runtime.errorMessage ?? t(locale, "common.notAvailable");
  const isOpenClaw = runtime.id === "openclaw-local" || runtime.type === "openclaw";
  const openClawStatus = createOpenClawDogfoodStatus(status);

  return (
    <article
      className={`runtime-card runtime-status-${status}`}
      data-testid={`runtime-card-${runtime.id}`}
    >
      <div className="runtime-card-header">
        <div>
          <strong>{runtime.name}</strong>
          <code>{runtime.id}</code>
        </div>
        <span
          className={`runtime-status-badge runtime-status-${status}`}
          data-testid={`runtime-status-${runtime.id}`}
        >
          {status}
        </span>
      </div>

      {isOpenClaw ? (
        <section className="openclaw-dogfood-card" data-testid="openclaw-boundary-copy">
          <div>
            <strong data-testid="openclaw-dogfood-status">
              {t(locale, openClawStatus.labelKey)}
            </strong>
            <span>{t(locale, openClawStatus.detailKey)}</span>
          </div>
          <p>{t(locale, "runtimeManager.openClawProtectedBoundary")}</p>
          {localGatewayConnection.status !== "idle" ? (
            <dl className="openclaw-gateway-summary" data-testid="openclaw-gateway-summary">
              <div>
                <dt>{t(locale, "gatewayQuickConnect.gatewayUrl")}</dt>
                <dd>{localGatewayConnection.baseUrl}</dd>
              </div>
              <div>
                <dt>{t(locale, "gatewayQuickConnect.healthPath")}</dt>
                <dd>{localGatewayConnection.healthPath}</dd>
              </div>
            </dl>
          ) : null}
          <div className="openclaw-dogfood-actions">
            <button
              type="button"
              data-testid="openclaw-copy-task-button"
              onClick={onCopyOpenClawTask}
            >
              <Clipboard aria-hidden="true" size={14} />
              {t(locale, "runtimeManager.openClawCopyTask")}
            </button>
            <button
              type="button"
              data-testid="openclaw-export-task-button"
              onClick={onOpenOpenClawTaskExport}
            >
              <FileText aria-hidden="true" size={14} />
              {t(locale, "runtimeManager.openClawExportTask")}
            </button>
            <span data-testid="openclaw-copy-task-status">
              {openClawTaskCopyStatus === "success"
                ? t(locale, "runtimeManager.openClawCopySuccess")
                : openClawTaskCopyStatus === "error"
                  ? t(locale, "runtimeManager.openClawCopyError")
                  : t(locale, "runtimeManager.openClawCopyHint")}
            </span>
          </div>
        </section>
      ) : null}

      <div className="runtime-meta-grid">
        <span>{t(locale, "runtimeManager.type")}</span>
        <code>{runtime.type}</code>
        <span>{t(locale, "runtimeManager.executionMode")}</span>
        <code data-testid={`runtime-execution-mode-${runtime.id}`}>
          {formatExecutionMode(locale, runtime.executionMode)}
        </code>
        <span>{t(locale, "runtimeManager.endpoint")}</span>
        <code>{runtime.endpoint ?? t(locale, "common.notAvailable")}</code>
        <span>{t(locale, "runtimeManager.command")}</span>
        <code>{runtime.command ?? t(locale, "common.notAvailable")}</code>
        <span>{t(locale, "runtimeManager.capabilities")}</span>
        <code>{runtime.capabilities.length}</code>
        <span>{t(locale, "runtimeManager.lastHealth")}</span>
        <code>
          {lastHealthCheckAt === undefined
            ? t(locale, "common.notAvailable")
            : formatRuntimeTime(lastHealthCheckAt, locale)}
        </code>
        <span>{t(locale, "runtimeManager.message")}</span>
        <code title={message} data-testid={`runtime-message-${runtime.id}`}>
          {message}
        </code>
      </div>

      <div className="runtime-description">
        {runtime.description ?? t(locale, "runtimeManager.noDescription")}
      </div>

      <div className="runtime-capability-list">
        {runtime.capabilities.map((capability) => (
          <span
            className={`runtime-capability risk-${capability.riskLevel} execution-mode-${capability.executionMode}`}
            key={capability.id}
            title={formatCapabilityDescription(locale, capability)}
          >
            <code>{capability.id}</code>
            <strong>{formatCapabilityLabel(locale, capability)}</strong>
            <small>{formatExecutionMode(locale, capability.executionMode)}</small>
          </span>
        ))}
      </div>
    </article>
  );
}

function createOpenClawDogfoodStatus(status: RuntimeHealth["status"]): {
  labelKey: I18nKey;
  detailKey: I18nKey;
} {
  if (status === "online") {
    return {
      labelKey: "runtimeManager.openClawConnected",
      detailKey: "runtimeManager.openClawConnectedDetail"
    };
  }

  if (status === "offline" || status === "error") {
    return {
      labelKey: "runtimeManager.openClawUnavailable",
      detailKey: "runtimeManager.openClawUnavailableDetail"
    };
  }

  return {
    labelKey: "runtimeManager.openClawProtected",
    detailKey: "runtimeManager.openClawProtectedDetail"
  };
}

function getGatewayProfileStatusKey(status: LocalGatewayConnectionStatus): I18nKey {
  if (status === "checking") {
    return "gatewayQuickConnect.checking";
  }

  if (status === "connected") {
    return "gatewayQuickConnect.connected";
  }

  if (status === "unavailable") {
    return "gatewayQuickConnect.unavailable";
  }

  if (status === "protected") {
    return "gatewayQuickConnect.protected";
  }

  return "gatewayQuickConnect.idle";
}

function formatRuntimeTime(timestamp: string, locale: Locale): string {
  return new Date(timestamp).toLocaleTimeString(locale);
}

const executionModeLabelKeys: Record<RuntimeExecutionMode, I18nKey> = {
  mock: "executionMode.mock",
  protected: "executionMode.protected",
  unavailable: "executionMode.unavailable"
};

const capabilityLabelKeys: Record<string, I18nKey> = {
  "manual.trigger": "capability.manualTrigger.label",
  "agent.chat": "capability.agentChat.label",
  "agent.start": "capability.agentStart.label",
  "agent.worker": "capability.agentWorker.label",
  "agent.end": "capability.agentEnd.label",
  "output.console": "capability.outputConsole.label",
  "tool.call": "capability.toolCall.label",
  "gateway.events": "capability.gatewayEvents.label",
  "canvas.view": "capability.canvasView.label",
  "browser.control": "capability.browserControl.label",
  "memory.search": "capability.memorySearch.label",
  "skill.run": "capability.skillRun.label",
  "tool.shell": "capability.toolShell.label"
};

const capabilityDescriptionKeys: Record<string, I18nKey> = {
  "manual.trigger": "capability.manualTrigger.description",
  "agent.chat": "capability.agentChat.description",
  "agent.start": "capability.agentStart.description",
  "agent.worker": "capability.agentWorker.description",
  "agent.end": "capability.agentEnd.description",
  "output.console": "capability.outputConsole.description",
  "tool.call": "capability.toolCall.description",
  "gateway.events": "capability.gatewayEvents.description",
  "canvas.view": "capability.canvasView.description",
  "browser.control": "capability.browserControl.description",
  "memory.search": "capability.memorySearch.description",
  "skill.run": "capability.skillRun.description",
  "tool.shell": "capability.toolShell.description"
};

function formatExecutionMode(locale: Locale, mode: RuntimeExecutionMode): string {
  return t(locale, executionModeLabelKeys[mode]);
}

function formatCapabilityLabel(locale: Locale, capability: RuntimeCapability): string {
  const labelKey = capabilityLabelKeys[capability.id];
  return labelKey === undefined ? capability.name : t(locale, labelKey);
}

function formatCapabilityDescription(locale: Locale, capability: RuntimeCapability): string {
  const descriptionKey = capabilityDescriptionKeys[capability.id];
  return descriptionKey === undefined
    ? capability.description ?? capability.name
    : t(locale, descriptionKey);
}
