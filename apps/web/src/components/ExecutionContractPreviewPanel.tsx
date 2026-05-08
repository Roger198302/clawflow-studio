import type {
  CapabilityProvider,
  FlowExecutionContractPreview,
  NodeCategory,
  NodeExecutionContract,
  NodeExecutionMode,
  NodeRiskLevel,
  PortCompatibilityIssue
} from "@clawflow/protocol";
import { AlertTriangle, Maximize2, Minimize2, RefreshCw, ShieldCheck } from "lucide-react";
import { useState, type ReactElement } from "react";
import { useFloatingPanelDrag } from "../hooks/useFloatingPanelDrag";
import { t, type I18nKey, type Locale } from "../i18n";

export interface ExecutionContractPreviewPanelProps {
  locale: Locale;
  preview: FlowExecutionContractPreview | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const categoryLabelKeys: Record<NodeCategory, I18nKey> = {
  trigger: "executionContract.category.trigger",
  agent: "executionContract.category.agent",
  capability: "executionContract.category.capability",
  knowledge: "executionContract.category.knowledge",
  control: "executionContract.category.control",
  output: "executionContract.category.output",
  utility: "executionContract.category.utility"
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

const executionModeLabelKeys: Record<NodeExecutionMode, I18nKey> = {
  "trigger-only": "executionContract.mode.triggerOnly",
  "preview-only": "executionContract.mode.previewOnly",
  "mock-executable": "executionContract.mode.mockExecutable",
  protected: "executionContract.mode.protected",
  "runtime-required": "executionContract.mode.runtimeRequired",
  "output-only": "executionContract.mode.outputOnly",
  blocked: "executionContract.mode.blocked"
};

const riskLabelKeys: Record<NodeRiskLevel, I18nKey> = {
  safe: "executionContract.risk.safe",
  medium: "executionContract.risk.medium",
  dangerous: "executionContract.risk.dangerous"
};

export function ExecutionContractPreviewPanel({
  locale,
  preview,
  isLoading,
  error,
  onRefresh
}: ExecutionContractPreviewPanelProps): ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { panelRef, panelStyle, dragHandleProps } = useFloatingPanelDrag<HTMLElement>();

  return (
    <aside
      ref={panelRef}
      className={`execution-preview-panel ${isCollapsed ? "is-collapsed" : ""}`}
      style={panelStyle}
      aria-label={t(locale, "executionContract.title")}
      data-testid="execution-contract-preview-panel"
    >
      <header
        className="execution-preview-header"
        data-testid="execution-contract-preview-header"
        {...dragHandleProps}
      >
        <div>
          <ShieldCheck aria-hidden="true" size={16} />
          <strong>{t(locale, "executionContract.title")}</strong>
        </div>
        <div className="floating-panel-actions">
          <button type="button" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw aria-hidden="true" size={13} />
            {t(locale, "session.refresh")}
          </button>
          <button
            type="button"
            data-testid="execution-contract-preview-toggle"
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
          {error !== null ? <p className="execution-preview-error">{error}</p> : null}

          {preview === null ? (
            <p className="execution-preview-empty">
              {isLoading ? t(locale, "common.loading") : t(locale, "executionContract.empty")}
            </p>
          ) : (
            <div className="execution-preview-body">
              <PreviewSummary locale={locale} preview={preview} />
              <PreviewIssues locale={locale} preview={preview} />
              <div className="execution-node-contract-list">
                {preview.nodes.map((contract) => (
                  <NodeContractCard locale={locale} contract={contract} key={contract.nodeId} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function PreviewSummary({
  locale,
  preview
}: {
  locale: Locale;
  preview: FlowExecutionContractPreview;
}): ReactElement {
  return (
    <section className="execution-preview-summary">
      <SummaryItem label={t(locale, "executionContract.totalNodes")} value={preview.summary.totalNodes} />
      <SummaryItem label={t(locale, "executionContract.executable")} value={preview.summary.executableNodes} />
      <SummaryItem label={t(locale, "executionContract.blocked")} value={preview.summary.blockedNodes} />
      <SummaryItem label={t(locale, "executionContract.previewOnly")} value={preview.summary.previewOnlyNodes} />
      <SummaryItem label={t(locale, "executionContract.triggerNodes")} value={preview.summary.triggerNodes} />
      <SummaryItem label={t(locale, "executionContract.outputNodes")} value={preview.summary.outputNodes} />
      <SummaryItem label={t(locale, "executionContract.risk.safe")} value={preview.summary.riskCounts.safe} />
      <SummaryItem label={t(locale, "executionContract.risk.medium")} value={preview.summary.riskCounts.medium} />
      <SummaryItem
        label={t(locale, "executionContract.risk.dangerous")}
        value={preview.summary.riskCounts.dangerous}
      />
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

function PreviewIssues({
  locale,
  preview
}: {
  locale: Locale;
  preview: FlowExecutionContractPreview;
}): ReactElement | null {
  if (
    preview.warnings.length === 0 &&
    preview.errors.length === 0 &&
    (preview.portCompatibilityIssues?.length ?? 0) === 0
  ) {
    return null;
  }

  return (
    <section className="execution-preview-issues">
      <IssueList
        title={t(locale, "executionContract.errors")}
        items={preview.errors}
        severity="error"
      />
      <IssueList
        title={t(locale, "executionContract.warnings")}
        items={preview.warnings}
        severity="warning"
      />
      <PortIssueList locale={locale} issues={preview.portCompatibilityIssues ?? []} />
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
    <div className={`execution-issue-group issue-${severity}`}>
      <strong>{title}</strong>
      <ul>
        {items.slice(0, 4).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function PortIssueList({
  locale,
  issues
}: {
  locale: Locale;
  issues: PortCompatibilityIssue[];
}): ReactElement | null {
  if (issues.length === 0) {
    return null;
  }

  return (
    <div className="execution-issue-group issue-warning">
      <strong>{t(locale, "executionContract.portCompatibility")}</strong>
      <ul>
        {issues.slice(0, 4).map((issue) => (
          <li key={`${issue.sourceNodeId}-${issue.targetNodeId}-${issue.message}`}>
            {issue.sourceNodeId} {"->"} {issue.targetNodeId}: {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function NodeContractCard({
  locale,
  contract
}: {
  locale: Locale;
  contract: NodeExecutionContract;
}): ReactElement {
  return (
    <article className={`execution-node-contract risk-${contract.capability?.riskLevel ?? "safe"}`}>
      <div className="execution-node-contract-title">
        <strong title={contract.label ?? contract.nodeId}>{contract.label ?? contract.nodeId}</strong>
        <span className={`contract-mode mode-${contract.executionMode}`}>
          {formatExecutionMode(locale, contract.executionMode)}
        </span>
        <span className={`contract-readiness ${resolveReadinessClass(contract)}`}>
          {formatReadiness(locale, contract)}
        </span>
      </div>
      <div className="execution-node-contract-meta">
        <span className={`contract-source source-${contract.contractSource ?? "inferred"}`}>
          {formatContractSource(locale, contract)}
        </span>
        <code>{contract.nodeType}</code>
        <span>{formatCategory(locale, contract.category)}</span>
        <span>{formatProvider(locale, contract.capability?.provider)}</span>
        <span className={`risk-chip risk-${contract.capability?.riskLevel ?? "safe"}`}>
          {formatRisk(locale, contract.capability?.riskLevel ?? "safe")}
        </span>
      </div>
      {contract.capability?.runtimeRef !== undefined ? (
        <div className="execution-node-contract-runtime">
          <span>{t(locale, "executionContract.runtime")}</span>
          <code>{contract.capability.runtimeRef}</code>
        </div>
      ) : null}
      <ContractPorts locale={locale} contract={contract} />
      {contract.missingRequiredInputs.length > 0 ? (
        <ContractIssueInline
          label={t(locale, "executionContract.missingInputs")}
          items={contract.missingRequiredInputs}
          severity="error"
        />
      ) : null}
      <ContractIssueInline
        label={t(locale, "executionContract.warnings")}
        items={contract.warnings}
        severity="warning"
      />
      <ContractIssueInline
        label={t(locale, "executionContract.errors")}
        items={contract.errors}
        severity="error"
      />
    </article>
  );
}

function ContractPorts({
  locale,
  contract
}: {
  locale: Locale;
  contract: NodeExecutionContract;
}): ReactElement {
  const requiredInputs = contract.inputs.filter((input) => input.required === true);
  const recommendedInputs = contract.inputs.filter(
    (input) => input.required !== true && input.recommended === true
  );
  const optionalInputs = contract.inputs.filter(
    (input) => input.required !== true && input.recommended !== true
  );

  return (
    <div className="execution-node-contract-ports">
      <PortGroup
        label={t(locale, "executionContract.requiredInputs")}
        emptyLabel={t(locale, "common.notAvailable")}
        ports={requiredInputs}
        tone="required"
      />
      <PortGroup
        label={t(locale, "executionContract.recommendedInputs")}
        emptyLabel={t(locale, "common.notAvailable")}
        ports={recommendedInputs}
        tone="recommended"
      />
      <PortGroup
        label={t(locale, "executionContract.optionalInputs")}
        emptyLabel={t(locale, "common.notAvailable")}
        ports={optionalInputs}
        tone="optional"
      />
      <PortGroup
        label={t(locale, "executionContract.outputs")}
        emptyLabel={t(locale, "common.notAvailable")}
        ports={contract.outputs}
        tone="output"
      />
    </div>
  );
}

function PortGroup({
  label,
  emptyLabel,
  ports,
  tone
}: {
  label: string;
  emptyLabel: string;
  ports: Array<{ id: string; label: string; dataType: string }>;
  tone: "required" | "recommended" | "optional" | "output";
}): ReactElement {
  return (
    <div className={`contract-port-group port-${tone}`}>
      <span>{label}</span>
      <div>
        {ports.length === 0 ? (
          <em>{emptyLabel}</em>
        ) : (
          ports.map((port) => (
            <code key={port.id} title={`${port.label} (${port.dataType})`}>
              {port.id}:{port.dataType}
            </code>
          ))
        )}
      </div>
    </div>
  );
}

function ContractIssueInline({
  label,
  items,
  severity
}: {
  label: string;
  items: string[];
  severity: "warning" | "error";
}): ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`contract-inline-issues issue-${severity}`}>
      <AlertTriangle aria-hidden="true" size={12} />
      <span>{label}</span>
      <p>{items.join("; ")}</p>
    </div>
  );
}

function formatCategory(locale: Locale, category: NodeCategory): string {
  return t(locale, categoryLabelKeys[category]);
}

function formatProvider(locale: Locale, provider: CapabilityProvider | undefined): string {
  return provider === undefined ? t(locale, "common.notAvailable") : t(locale, providerLabelKeys[provider]);
}

function formatExecutionMode(locale: Locale, executionMode: NodeExecutionMode): string {
  return t(locale, executionModeLabelKeys[executionMode]);
}

function formatRisk(locale: Locale, riskLevel: NodeRiskLevel): string {
  return t(locale, riskLabelKeys[riskLevel]);
}

function formatContractSource(locale: Locale, contract: NodeExecutionContract): string {
  if (contract.contractSource === "catalog") {
    return t(locale, "executionContract.catalogContract");
  }

  if (contract.contractSource === "placeholder") {
    return t(locale, "executionContract.placeholderContract");
  }

  return t(locale, "executionContract.inferredContract");
}

function formatReadiness(locale: Locale, contract: NodeExecutionContract): string {
  if (contract.executionMode === "blocked" || contract.errors.length > 0) {
    return t(locale, "executionContract.blocked");
  }

  if (contract.isExecutable) {
    return t(locale, "executionContract.executable");
  }

  return contract.isPreviewable
    ? t(locale, "executionContract.previewOnly")
    : t(locale, "common.notAvailable");
}

function resolveReadinessClass(contract: NodeExecutionContract): string {
  if (contract.executionMode === "blocked" || contract.errors.length > 0) {
    return "is-blocked";
  }

  return contract.isExecutable ? "is-executable" : "is-preview-only";
}
