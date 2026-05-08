import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { NodeRole, RunStatus } from "@clawflow/protocol";
import type { ReactElement } from "react";
import { NodeHarnessBadges, type NodeHarnessBadgeSummary } from "./NodeHarnessBadges";

export interface ClawFlowNodeData extends Record<string, unknown> {
  label: string;
  nodeType: string;
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
  return (
    <div
      className={`flow-node-card role-${data.role} node-status-${data.status} ${
        selected ? "is-selected" : ""
      }`}
      data-testid={data.testId}
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

      <div className="flow-node-meta">
        <span>{data.typeLabel}</span>
        <code title={data.nodeType}>{data.nodeType}</code>
        <span>{data.roleLabel}</span>
        <code title={data.role}>{data.role}</code>
        <span>{data.runtimeLabel}</span>
        <code title={data.runtimeRef}>{data.runtimeRef}</code>
      </div>

      <NodeHarnessBadges summary={data.harnessSummary} />

      {data.contractSummary !== undefined ? (
        <div
          className={`node-contract-badges ${data.contractSummary.hasError ? "has-error" : ""} readiness-${data.contractSummary.readinessTone}`}
        >
          <span>{data.contractSummary.contractSourceLabel}</span>
          <span>{data.contractSummary.categoryLabel}</span>
          <span>{data.contractSummary.executionModeLabel}</span>
          <span>{data.contractSummary.inputSummary}</span>
          <span>{data.contractSummary.outputSummary}</span>
          <span className="node-contract-readiness">{data.contractSummary.readinessLabel}</span>
          {data.contractSummary.issueCount > 0 ? <strong>{data.contractSummary.issueCount}</strong> : null}
        </div>
      ) : null}

      {data.planSummary !== undefined ? (
        <div
          className={`node-plan-badge ${data.planSummary.hasBlockingReason ? "has-blocker" : ""} ${
            data.planSummary.isLiveStatus ? "is-live" : "is-preflight"
          }`}
        >
          <strong>{data.planSummary.stepLabel} {data.planSummary.order}</strong>
          <span>{data.planSummary.statusSourceLabel}: {data.planSummary.status}</span>
        </div>
      ) : null}

      {data.estimateSummary !== undefined ? (
        <div
          className={`node-estimate-badge ${data.estimateSummary.hasWarning ? "has-warning" : ""}`}
          data-testid={`${data.testId}-estimate-badge`}
        >
          <strong>{data.estimateSummary.titleLabel}</strong>
          <span>{data.estimateSummary.tokenLabel}</span>
          <span>{data.estimateSummary.costLabel}</span>
          <span>{data.estimateSummary.latencyLabel}</span>
          <span>{data.estimateSummary.confidenceLabel}</span>
        </div>
      ) : null}

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
