import type { HarnessCompatibilityResult, HarnessRiskLevel } from "@clawflow/protocol";
import type { ReactElement } from "react";

export interface NodeHarnessBadgeSummary {
  label: string;
  riskLabel: string;
  riskLevel: HarnessRiskLevel;
  fitLabel: string;
  fit: HarnessCompatibilityResult["fit"];
  executionModeLabel: string;
  protectedDryRunLabel: string;
  protectedDryRun: boolean;
}

export function NodeHarnessBadges({
  summary
}: {
  summary: NodeHarnessBadgeSummary | undefined;
}): ReactElement | null {
  if (summary === undefined) {
    return null;
  }

  return (
    <div className="node-harness-badges" aria-label={summary.label}>
      <span className="harness-chip harness-chip-primary" title={summary.label}>
        {summary.label}
      </span>
      <span className={`harness-chip risk-chip risk-${summary.riskLevel}`}>{summary.riskLabel}</span>
      <span className={`harness-chip fit-chip fit-${summary.fit}`}>{summary.fitLabel}</span>
      <span className="harness-chip mode-chip">{summary.executionModeLabel}</span>
      {summary.protectedDryRun ? (
        <span className="harness-chip protected-chip">{summary.protectedDryRunLabel}</span>
      ) : null}
    </div>
  );
}
