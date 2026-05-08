import type {
  CapabilityProvider,
  ExecutionPlanStatus,
  ExecutionPlanUnsupportedReason,
  LinearExecutionPlan,
  LinearExecutionPlanStep,
  ExecutionPlanStepStatus,
  NodeExecutionMode
} from "@clawflow/protocol";
import { GitCommitHorizontal, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { useState, type ReactElement } from "react";
import { useFloatingPanelDrag } from "../hooks/useFloatingPanelDrag";
import { t, type I18nKey, type Locale } from "../i18n";

export interface LinearExecutionPlanPanelProps {
  locale: Locale;
  plan: LinearExecutionPlan | null;
  isLoading: boolean;
  error: string | null;
  liveStepStatuses: Record<string, ExecutionPlanStepStatus>;
  onRefresh: () => void;
}

const statusLabelKeys: Record<ExecutionPlanStatus, I18nKey> = {
  ready: "linearPlan.status.ready",
  blocked: "linearPlan.status.blocked",
  unsupported: "linearPlan.status.unsupported",
  invalid: "linearPlan.status.invalid"
};

const executionModeLabelKeys: Record<NodeExecutionMode, I18nKey> = {
  "trigger-only": "executionContract.mode.triggerOnly",
  "preview-only": "executionContract.mode.previewOnly",
  "mock-executable": "executionContract.mode.mockExecutable",
  protected: "executionContract.mode.protected",
  "runtime-required": "executionContract.mode.runtimeRequired",
  "output-only": "executionContract.mode.outputOnly",
  blocked: "executionContract.mode.blocked"
};

const providerLabelKeys: Record<CapabilityProvider, I18nKey> = {
  internal: "executionContract.provider.internal",
  runtime: "executionContract.provider.runtime",
  cli: "executionContract.provider.cli",
  mcp: "executionContract.provider.mcp",
  rag: "executionContract.provider.rag",
  comfyui: "executionContract.provider.comfyui",
  api: "executionContract.provider.api",
  browser: "executionContract.provider.browser",
  human: "executionContract.provider.human"
};

const unsupportedReasonLabelKeys: Record<ExecutionPlanUnsupportedReason, I18nKey> = {
  "branching-not-supported": "linearPlan.reason.branchingNotSupported",
  "fan-in-not-supported": "linearPlan.reason.fanInNotSupported",
  "cycle-detected": "linearPlan.reason.cycleDetected",
  "missing-trigger": "linearPlan.reason.missingTrigger",
  "multiple-triggers": "linearPlan.reason.multipleTriggers",
  "blocked-node": "linearPlan.reason.blockedNode",
  "missing-required-input": "linearPlan.reason.missingRequiredInput",
  "unknown-node": "linearPlan.reason.unknownNode",
  "invalid-edge": "linearPlan.reason.invalidEdge",
  "empty-flow": "linearPlan.reason.emptyFlow"
};

const stepStatusLabelKeys: Record<ExecutionPlanStepStatus, I18nKey> = {
  pending: "linearPlan.stepStatus.pending",
  queued: "linearPlan.stepStatus.queued",
  running: "linearPlan.stepStatus.running",
  completed: "linearPlan.stepStatus.completed",
  failed: "linearPlan.stepStatus.failed",
  skipped: "linearPlan.stepStatus.skipped",
  blocked: "linearPlan.stepStatus.blocked"
};

export function LinearExecutionPlanPanel({
  locale,
  plan,
  isLoading,
  error,
  liveStepStatuses,
  onRefresh
}: LinearExecutionPlanPanelProps): ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { panelRef, panelStyle, dragHandleProps } = useFloatingPanelDrag<HTMLElement>();

  return (
    <aside
      ref={panelRef}
      className={`linear-plan-panel ${isCollapsed ? "is-collapsed" : ""}`}
      style={panelStyle}
      aria-label={t(locale, "linearPlan.title")}
      data-testid="linear-execution-plan-panel"
    >
      <header className="linear-plan-header" data-testid="linear-execution-plan-header" {...dragHandleProps}>
        <div>
          <GitCommitHorizontal aria-hidden="true" size={16} />
          <strong>{t(locale, "linearPlan.title")}</strong>
        </div>
        <div className="floating-panel-actions">
          <button type="button" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw aria-hidden="true" size={13} />
            {t(locale, "session.refresh")}
          </button>
          <button
            type="button"
            data-testid="linear-execution-plan-toggle"
            onClick={() => setIsCollapsed((current) => !current)}
            title={isCollapsed ? t(locale, "common.restore") : t(locale, "common.minimize")}
            aria-label={isCollapsed ? t(locale, "common.restore") : t(locale, "common.minimize")}
          >
            {isCollapsed ? (
              <Maximize2 aria-hidden="true" size={13} />
            ) : (
              <Minimize2 aria-hidden="true" size={13} />
            )}
          </button>
        </div>
      </header>

      {isCollapsed ? null : (
        <>
          {error !== null ? <p className="linear-plan-error">{error}</p> : null}

          {plan === null ? (
            <p className="linear-plan-empty">
              {isLoading ? t(locale, "common.loading") : t(locale, "linearPlan.empty")}
            </p>
          ) : (
            <div className="linear-plan-body">
              <PlanSummary locale={locale} plan={plan} />
              <PlanIssues locale={locale} plan={plan} />
              <div className="linear-plan-step-list">
                {plan.steps.map((step) => (
                  <PlanStepCard
                    locale={locale}
                    step={step}
                    liveStatus={liveStepStatuses[step.nodeId]}
                    key={step.stepId}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function PlanSummary({
  locale,
  plan
}: {
  locale: Locale;
  plan: LinearExecutionPlan;
}): ReactElement {
  return (
    <section className="linear-plan-summary">
      <div className="linear-plan-status-row">
        <span>{t(locale, "linearPlan.planStatus")}</span>
        <strong className={`linear-plan-status status-${plan.status}`} data-testid="linear-plan-status">
          {t(locale, statusLabelKeys[plan.status])}
        </strong>
      </div>
      <SummaryItem label={t(locale, "linearPlan.totalSteps")} value={plan.summary.totalSteps} />
      <SummaryItem label={t(locale, "linearPlan.runnableSteps")} value={plan.summary.runnableSteps} />
      <SummaryItem label={t(locale, "linearPlan.blockedSteps")} value={plan.summary.blockedSteps} />
      <SummaryItem label={t(locale, "linearPlan.protectedSteps")} value={plan.summary.protectedSteps} />
      <SummaryItem label={t(locale, "linearPlan.mockExecutableSteps")} value={plan.summary.mockExecutableSteps} />
      <SummaryItem label={t(locale, "linearPlan.previewOnlySteps")} value={plan.summary.previewOnlySteps} />
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PlanIssues({
  locale,
  plan
}: {
  locale: Locale;
  plan: LinearExecutionPlan;
}): ReactElement | null {
  if (
    plan.unsupportedReasons.length === 0 &&
    plan.warnings.length === 0 &&
    plan.errors.length === 0
  ) {
    return null;
  }

  return (
    <section className="linear-plan-issues">
      <IssueList
        title={t(locale, "linearPlan.unsupportedReasons")}
        items={plan.unsupportedReasons.map((reason) => t(locale, unsupportedReasonLabelKeys[reason]))}
        severity="warning"
      />
      <IssueList title={t(locale, "executionContract.errors")} items={plan.errors} severity="error" />
      <IssueList title={t(locale, "executionContract.warnings")} items={plan.warnings} severity="warning" />
    </section>
  );
}

function IssueList({
  title,
  items,
  severity
}: {
  title: string;
  items: string[];
  severity: "warning" | "error";
}): ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`linear-plan-issue-group issue-${severity}`}>
      <strong>{title}</strong>
      <ul>
        {items.slice(0, 4).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function PlanStepCard({
  locale,
  step,
  liveStatus
}: {
  locale: Locale;
  step: LinearExecutionPlanStep;
  liveStatus: ExecutionPlanStepStatus | undefined;
}): ReactElement {
  const displayedStatus = liveStatus ?? step.status;
  const statusSourceLabel =
    liveStatus === undefined ? t(locale, "linearPlan.preflightStatus") : t(locale, "linearPlan.liveStatus");

  return (
    <article className={`linear-plan-step step-status-${displayedStatus}`}>
      <div className="linear-plan-step-title">
        <span>{t(locale, "linearPlan.step")} {step.order}</span>
        <strong title={step.label ?? step.nodeId}>{step.label ?? step.nodeId}</strong>
        <code>
          {statusSourceLabel}: {t(locale, stepStatusLabelKeys[displayedStatus])}
        </code>
      </div>
      <div className="linear-plan-step-meta">
        <code>{step.nodeType}</code>
        <span>{t(locale, executionModeLabelKeys[step.executionMode])}</span>
        <span>{step.provider === undefined ? t(locale, "common.notAvailable") : t(locale, providerLabelKeys[step.provider])}</span>
        {step.runtimeRef !== undefined ? <code>{step.runtimeRef}</code> : null}
      </div>
      <div className="linear-plan-step-links">
        <span>
          {t(locale, "linearPlan.upstream")}: {formatNodeIds(step.upstreamNodeIds)}
        </span>
        <span>
          {t(locale, "linearPlan.downstream")}: {formatNodeIds(step.downstreamNodeIds)}
        </span>
      </div>
      <MissingInputDiagnostics locale={locale} step={step} />
      <IssueList
        title={t(locale, "linearPlan.blockingReasons")}
        items={step.blockingReasons.map((reason) => t(locale, unsupportedReasonLabelKeys[reason]))}
        severity="error"
      />
      <IssueList title={t(locale, "executionContract.warnings")} items={step.warnings} severity="warning" />
      <IssueList title={t(locale, "executionContract.errors")} items={step.errors} severity="error" />
    </article>
  );
}

function MissingInputDiagnostics({
  locale,
  step
}: {
  locale: Locale;
  step: LinearExecutionPlanStep;
}): ReactElement | null {
  const missingInputs = step.inputMappings.filter(
    (mapping) => mapping.required === true && mapping.status === "unresolved"
  );

  if (missingInputs.length === 0) {
    return null;
  }

  return (
    <div className="linear-plan-missing-inputs">
      <strong>{t(locale, "executionContract.missingRequiredInputs")}</strong>
      <div>
        {missingInputs.map((mapping) => (
          <code key={mapping.inputPortId ?? "input"}>
            {mapping.inputPortId ?? "input"}
            {mapping.dataType === undefined ? "" : `:${mapping.dataType}`}
          </code>
        ))}
      </div>
    </div>
  );
}

function formatNodeIds(nodeIds: string[]): string {
  return nodeIds.length === 0 ? "-" : nodeIds.join(", ");
}
