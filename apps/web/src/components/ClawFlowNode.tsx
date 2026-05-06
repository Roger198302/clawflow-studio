import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { NodeRole, RunStatus } from "@clawflow/protocol";
import type { ReactElement } from "react";

export interface ClawFlowNodeData extends Record<string, unknown> {
  label: string;
  nodeType: string;
  role: NodeRole;
  runtimeRef: string;
  status: RunStatus;
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
    <div className={`flow-node-card role-${data.role} ${selected ? "is-selected" : ""}`}>
      {canReceiveInput(data.role) ? <Handle type="target" position={Position.Left} /> : null}

      <div className="flow-node-header">
        <span className="flow-node-role-dot" aria-hidden="true" />
        <strong title={data.label}>{data.label}</strong>
        <span className={`status-pill status-${data.status}`}>{data.status}</span>
      </div>

      <div className="flow-node-meta">
        <span>type</span>
        <code title={data.nodeType}>{data.nodeType}</code>
        <span>role</span>
        <code title={data.role}>{data.role}</code>
        <span>runtime</span>
        <code title={data.runtimeRef}>{data.runtimeRef}</code>
      </div>

      {canSendOutput(data.role) ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  );
}
