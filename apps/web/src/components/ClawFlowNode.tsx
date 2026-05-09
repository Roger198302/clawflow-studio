import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { NodeRole, RunStatus } from "@clawflow/protocol";
import type { ReactElement } from "react";
import { NodeHarnessBadges, type NodeHarnessBadgeSummary } from "./NodeHarnessBadges";

const NODE_COMPANION_SLOT_ENABLED = false;

export type EffectiveNodeDisplayMode = "compact" | "standard" | "detailed" | "trace";

export interface ClawFlowNodeData extends Record<string, unknown> {
  label: string;
  nodeType: string;
  displayMode: EffectiveNodeDisplayMode;
  role: NodeRole;
  roleLabel: string;
  runtimeRef: string;
  status: RunStatus;
  testId: string;
  typeLabel: string;
  runtimeLabel: string;
  harnessSummary?: NodeHarnessBadgeSummary;
  contractSummary?: NodeExecutionContractBadgeSummary;
  planSummary?: NodeLinearPlanBadgeSummary;
  estimateSummary?: NodeResourceEstimateBadgeSummary;
  companion?: NodeCompanionPresentation;
}

export interface NodeCompanionPresentation {
  petEnabled: boolean;
  petId?: string;
  petMood:
    | "idle"
    | "queued"
    | "running"
    | "waiting"
    | "success"
    | "warning"
    | "failed"
    | "protected"
    | "mock";
  petAnchor: "top-right" | "bottom-right" | "inline";
}

export interface NodeExecutionContractBadgeSummary {
  categoryLabel: string;
  executionModeLabel: string;
  providerLabel: string;
  contractSourceLabel: string;
  readinessLabel: string;
  readinessTone: "ready" | "warning" | "blocked";
  inputSummary: string;
  outputSummary: string;
  issueCount: number;
  hasError: boolean;
}

export interface NodeLinearPlanBadgeSummary {
  stepLabel: string;
  order: number;
  status: string;
  statusSourceLabel: string;
  isLiveStatus: boolean;
  hasBlockingReason: boolean;
}

export interface NodeResourceEstimateBadgeSummary {
  titleLabel: string;
  tokenLabel: string;
  costLabel: string;
  latencyLabel: string;
  confidenceLabel: string;
  hasWarning: boolean;
}

type ClawFlowCanvasNode = Node<ClawFlowNodeData, "clawflowNode">;

function canReceiveInput(role: NodeRole): boolean {
  return role !== "trigger";
}

function canSendOutput(role: NodeRole): boolean {
  return role !== "output";
}

export function ClawFlowNode({ data, selected }: NodeProps<ClawFlowCanvasNode>): ReactElement {
  const isCompactMode = data.displayMode === "compact";
  const isStandardMode = data.displayMode === "standard";
  const isDetailedMode = data.displayMode === "detailed";
  const isTraceMode = data.displayMode === "trace";
  const issueCount = data.contractSummary?.issueCount ?? 0;

  return (
    <div
      className={`flow-node-card role-${data.role} node-status-${data.status} node-density-${data.displayMode} ${
        selected ? "is-selected" : ""
      }`}
      data-testid={data.testId}
      data-node-display-mode={data.displayMode}
    >
      {canReceiveInput(data.role) ? (
        <Handle
          id="in"
          type="target"
          position={Position.Left}
          data-testid={`${data.testId}-target-handle`}
        />
      ) : null}

      <div className="flow-node-header">
        <span className="flow-node-role-dot" aria-hidden="true" />
        <strong title={data.label}>{data.label}</strong>
        <span className={`status-pill status-${data.status}`}>{data.status}</span>
      </div>

      {isCompactMode ? (
        <div className="node-compact-meta" data-testid={`${data.testId}-compact-meta`}>
          <span title={data.nodeType}>{data.nodeType}</span>
          <span>{data.role}</span>
          {issueCount > 0 ? <strong>{issueCount}</strong> : null}
        </div>
      ) : null}

      {isTraceMode ? (
        <div className="node-trace-status" data-testid={`${data.testId}-trace-status`}>
          <strong>{data.status}</strong>
          <span>
            {data.planSummary === undefined
              ? data.role
              : `${data.planSummary.statusSourceLabel}: ${data.planSummary.status}`}
          </span>
        </div>
      ) : null}

      {isStandardMode || isDetailedMode ? (
        <div className="flow-node-meta" data-testid={`${data.testId}-meta`}>
          <span>{data.typeLabel}</span>
          <code title={data.nodeType}>{data.nodeType}</code>
          <span>{data.roleLabel}</span>
          <code title={data.role}>{data.role}</code>
          <span>{data.runtimeLabel}</span>
          <code title={data.runtimeRef}>{data.runtimeRef}</code>
        </div>
      ) : null}

      {isStandardMode || isDetailedMode ? <NodeHarnessBadges summary={data.harnessSummary} /> : null}

      {(isStandardMode || isDetailedMode) && data.contractSummary !== undefined ? (
        <div
          className={`node-contract-badges ${data.contractSummary.hasError ? "has-error" : ""} readiness-${data.contractSummary.readinessTone}`}
          data-testid={`${data.testId}-contract-badges`}
        >
          <span>{data.contractSummary.contractSourceLabel}</span>
          <span>{data.contractSummary.categoryLabel}</span>
          {isDetailedMode ? <span>{data.contractSummary.providerLabel}</span> : null}
          <span>{data.contractSummary.executionModeLabel}</span>
          <span>{data.contractSummary.inputSummary}</span>
          <span>{data.contractSummary.outputSummary}</span>
          <span className="node-contract-readiness">{data.contractSummary.readinessLabel}</span>
          {data.contractSummary.issueCount > 0 ? <strong>{data.contractSummary.issueCount}</strong> : null}
        </div>
      ) : null}

      {(isCompactMode || isStandardMode || isDetailedMode || isTraceMode) &&
      data.planSummary !== undefined ? (
        <div
          className={`node-plan-badge ${data.planSummary.hasBlockingReason ? "has-blocker" : ""} ${
            data.planSummary.isLiveStatus ? "is-live" : "is-preflight"
          }`}
        >
          <strong>{data.planSummary.stepLabel} {data.planSummary.order}</strong>
          <span>{data.planSummary.statusSourceLabel}: {data.planSummary.status}</span>
        </div>
      ) : null}

      {(isStandardMode || isDetailedMode) && data.estimateSummary !== undefined ? (
        <div
          className={`node-estimate-badge ${isDetailedMode ? "is-detailed" : "is-standard"} ${
            data.estimateSummary.hasWarning ? "has-warning" : ""
          }`}
          data-testid={`${data.testId}-estimate-badge`}
        >
          <strong>{data.estimateSummary.titleLabel}</strong>
          <span>{data.estimateSummary.tokenLabel}</span>
          <span>{data.estimateSummary.costLabel}</span>
          {isDetailedMode ? (
            <>
              <span>{data.estimateSummary.latencyLabel}</span>
              <span>{data.estimateSummary.confidenceLabel}</span>
            </>
          ) : null}
        </div>
      ) : null}

      {NODE_COMPANION_SLOT_ENABLED && data.companion?.petEnabled === true ? (
        <div
          className={`node-companion-slot pet-mood-${data.companion.petMood} pet-anchor-${data.companion.petAnchor}`}
          data-testid={`${data.testId}-companion-slot`}
          aria-hidden="true"
        />
      ) : (
        <div
          className="node-companion-slot is-reserved"
          data-testid={`${data.testId}-companion-slot`}
          hidden
          aria-hidden="true"
        />
      )}

      {canSendOutput(data.role) ? (
        <Handle
          id="out"
          type="source"
          position={Position.Right}
          data-testid={`${data.testId}-source-handle`}
        />
      ) : null}
    </div>
  );
}
