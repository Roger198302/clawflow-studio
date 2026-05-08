import type {
  CostEstimate,
  EstimateConfidence,
  EstimateRange,
  EstimatorWarning,
  FlowEstimate,
  NodeEstimate,
  TokenEstimate
} from "@clawflow/protocol";
import { Activity, AlertTriangle, Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { useState, type ReactElement } from "react";
import { useFloatingPanelDrag } from "../hooks/useFloatingPanelDrag";
import { t, type I18nKey, type Locale } from "../i18n";

export interface ResourceEstimatePanelProps {
  locale: Locale;
  estimate: FlowEstimate | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const confidenceLabelKeys: Record<EstimateConfidence, I18nKey> = {
  high: "resourceEstimate.confidence.high",
  medium: "resourceEstimate.confidence.medium",
  low: "resourceEstimate.confidence.low",
  unknown: "resourceEstimate.confidence.unknown"
};

const warningLabelKeys: Record<string, I18nKey> = {
  contract_preview_warning: "estimator.warning.contractPreviewWarning",
  contract_preview_error: "estimator.warning.contractPreviewError",
  non_catalog_contract: "estimator.warning.nonCatalogContract",
  missing_required_input: "estimator.warning.missingRequiredInput",
  missing_runtime: "estimator.warning.missingRuntime",
  unknown_runtime: "estimator.warning.unknownRuntime",
  missing_model: "estimator.warning.missingModel",
  unknown_model_metadata: "estimator.warning.unknownModelMetadata",
  unknown_pricing: "estimator.warning.unknownPricing"
};

export function ResourceEstimatePanel({
  locale,
  estimate,
  isLoading,
  error,
  onRefresh
}: ResourceEstimatePanelProps): ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { panelRef, panelStyle, dragHandleProps } = useFloatingPanelDrag<HTMLElement>();

  return (
    <aside
      ref={panelRef}
      className={`resource-estimate-panel ${isCollapsed ? "is-collapsed" : ""}`}
      style={panelStyle}
      aria-label={t(locale, "resourceEstimate.title")}
      data-testid="resource-estimate-panel"
    >
      <header className="resource-estimate-header" data-testid="resource-estimate-header" {...dragHandleProps}>
        <div>
          <Activity aria-hidden="true" size={16} />
          <strong>{t(locale, "resourceEstimate.title")}</strong>
        </div>
        <div className="floating-panel-actions">
          <button type="button" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw aria-hidden="true" size={13} />
            {t(locale, "session.refresh")}
          </button>
          <button
            type="button"
            data-testid="resource-estimate-toggle"
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
          {error !== null ? <p className="resource-estimate-error">{error}</p> : null}

          {estimate === null ? (
            <p className="resource-estimate-empty">
              {isLoading ? t(locale, "resourceEstimate.loading") : t(locale, "resourceEstimate.empty")}
            </p>
          ) : (
            <div className="resource-estimate-body">
              <p className="resource-estimate-note">{t(locale, "resourceEstimate.previewOnly")}</p>
              <EstimateSummary locale={locale} estimate={estimate} />
              <EstimateCostNote locale={locale} estimate={estimate} />
              <EstimateWarnings locale={locale} warnings={estimate.warnings} />
              <strong className="resource-estimate-section-title">
                {t(locale, "resourceEstimate.nodeEstimates")}
              </strong>
              <div className="resource-estimate-node-list">
                {estimate.nodes.map((nodeEstimate) => (
                  <NodeEstimateCard locale={locale} estimate={nodeEstimate} key={nodeEstimate.nodeId} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}

function EstimateSummary({
  locale,
  estimate
}: {
  locale: Locale;
  estimate: FlowEstimate;
}): ReactElement {
  return (
    <section className="resource-estimate-summary">
      <SummaryItem
        label={t(locale, "resourceEstimate.tokens")}
        value={formatTokenTotal(locale, estimate.totals.tokens)}
        testId="resource-estimate-tokens"
      />
      <SummaryItem
        label={t(locale, "resourceEstimate.cost")}
        value={formatCost(locale, estimate.totals.cost)}
        testId="resource-estimate-cost"
      />
      <SummaryItem
        label={t(locale, "resourceEstimate.latency")}
        value={formatRange(locale, estimate.totals.latency.totalLatencyMs)}
        testId="resource-estimate-latency"
      />
      <SummaryItem
        label={t(locale, "resourceEstimate.confidence")}
        value={t(locale, confidenceLabelKeys[estimate.confidence])}
        testId="resource-estimate-confidence"
      />
      <SummaryItem
        label={t(locale, "resourceEstimate.warnings")}
        value={String(estimate.warnings.length)}
        testId="resource-estimate-warning-count"
      />
      <SummaryItem
        label={t(locale, "resourceEstimate.status")}
        value={estimate.partial ? t(locale, "resourceEstimate.partial") : t(locale, "resourceEstimate.complete")}
        testId="resource-estimate-status"
      />
    </section>
  );
}

function SummaryItem({
  label,
  value,
  testId
}: {
  label: string;
  value: string;
  testId: string;
}): ReactElement {
  return (
    <div data-testid={testId}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EstimateCostNote({
  locale,
  estimate
}: {
  locale: Locale;
  estimate: FlowEstimate;
}): ReactElement | null {
  if (estimate.totals.cost.status === "known" || estimate.totals.cost.status === "zero") {
    return null;
  }

  return (
    <p className="resource-estimate-note" data-testid="resource-estimate-cost-note">
      {estimate.totals.cost.status === "not_applicable"
        ? t(locale, "resourceEstimate.noExternalCostDetail")
        : t(locale, "resourceEstimate.unknownCostDetail")}
    </p>
  );
}

function EstimateWarnings({
  locale,
  warnings
}: {
  locale: Locale;
  warnings: EstimatorWarning[];
}): ReactElement | null {
  if (warnings.length === 0) {
    return null;
  }

  const groupedWarnings = groupWarnings(warnings);

  return (
    <section className="resource-estimate-warnings">
      <strong>
        <AlertTriangle aria-hidden="true" size={12} />
        {t(locale, "resourceEstimate.warnings")}
      </strong>
      <ul>
        {groupedWarnings.slice(0, 5).map((warning) => (
          <li key={warning.code} data-testid="resource-estimate-warning">
            <span>{formatWarning(locale, warning)}</span>
            <code>{warning.count}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NodeEstimateCard({
  locale,
  estimate
}: {
  locale: Locale;
  estimate: NodeEstimate;
}): ReactElement {
  return (
    <article className={`resource-node-estimate confidence-${estimate.confidence}`}>
      <div className="resource-node-estimate-title">
        <strong title={estimate.label ?? estimate.nodeId}>{estimate.label ?? estimate.nodeId}</strong>
        <span>{t(locale, confidenceLabelKeys[estimate.confidence])}</span>
      </div>
      <div className="resource-node-estimate-meta">
        <code>{estimate.nodeType}</code>
        <span>{formatTokenTotal(locale, estimate.tokens)}</span>
        <span>{formatCost(locale, estimate.cost)}</span>
        <span>{formatRange(locale, estimate.latency.totalLatencyMs)}</span>
      </div>
    </article>
  );
}

function groupWarnings(warnings: EstimatorWarning[]): Array<EstimatorWarning & { count: number }> {
  const grouped = new Map<string, EstimatorWarning & { count: number }>();

  for (const warning of warnings) {
    const existing = grouped.get(warning.code);

    if (existing === undefined) {
      grouped.set(warning.code, {
        ...warning,
        count: 1
      });
    } else {
      existing.count += 1;
    }
  }

  return Array.from(grouped.values());
}

function formatWarning(locale: Locale, warning: EstimatorWarning): string {
  const labelKey = warningLabelKeys[warning.code];

  return labelKey === undefined ? t(locale, "estimator.warning.generic") : t(locale, labelKey);
}

function formatTokenTotal(locale: Locale, tokens: TokenEstimate): string {
  return formatRange(
    locale,
    sumRanges([
      tokens.inputTokens,
      tokens.outputTokens,
      tokens.reasoningTokens,
      tokens.toolCallOverheadTokens,
      tokens.contextCarryoverTokens
    ])
  );
}

function formatCost(locale: Locale, cost: CostEstimate): string {
  if (cost.status === "zero") {
    return t(locale, "resourceEstimate.noExternalCost");
  }

  if (cost.status === "not_applicable") {
    return t(locale, "common.notAvailable");
  }

  if (cost.status === "unknown" || cost.totalCost === undefined || cost.totalCost.expected === undefined) {
    return t(locale, "resourceEstimate.unknown");
  }

  return formatRange(locale, cost.totalCost);
}

function formatRange(locale: Locale, range: EstimateRange): string {
  if (range.expected === undefined) {
    return t(locale, "resourceEstimate.unknown");
  }

  if (range.unit === "tokens") {
    if (range.min !== undefined && range.max !== undefined && range.min !== range.max) {
      return `${formatCompactNumber(range.min)}-${formatCompactNumber(range.max)} ${t(locale, "resourceEstimate.unit.tokens")}`;
    }

    return `${formatCompactNumber(range.expected)} ${t(locale, "resourceEstimate.unit.tokens")}`;
  }

  if (range.unit === "ms") {
    if (range.min !== undefined && range.max !== undefined && range.min !== range.max) {
      return `${formatMs(range.min)}-${formatMs(range.max)}`;
    }

    return formatMs(range.expected);
  }

  if (range.unit === "usd") {
    if (range.min !== undefined && range.max !== undefined && range.min !== range.max) {
      return `$${range.min.toFixed(4)}-$${range.max.toFixed(4)}`;
    }

    return `$${range.expected.toFixed(4)}`;
  }

  return String(range.expected);
}

function sumRanges(ranges: Array<EstimateRange | undefined>): EstimateRange {
  const definedRanges = ranges.filter((range): range is EstimateRange => range !== undefined);

  if (definedRanges.length === 0) {
    return {
      min: 0,
      expected: 0,
      max: 0,
      unit: "tokens"
    };
  }

  if (
    definedRanges.some(
      (range) => range.min === undefined || range.expected === undefined || range.max === undefined
    )
  ) {
    return {
      unit: definedRanges[0]?.unit ?? "unknown"
    };
  }

  return {
    min: definedRanges.reduce((total, range) => total + (range.min ?? 0), 0),
    expected: definedRanges.reduce((total, range) => total + (range.expected ?? 0), 0),
    max: definedRanges.reduce((total, range) => total + (range.max ?? 0), 0),
    unit: definedRanges[0]?.unit ?? "tokens"
  };
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }

  return String(Math.round(value));
}

function formatMs(value: number): string {
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}s`;
  }

  return `${Math.round(value)}ms`;
}
