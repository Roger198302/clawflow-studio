export type NodeRole =
  | "manual-trigger"
  | "start-agent"
  | "worker-agent"
  | "end-agent"
  | "console-output";

export type RuntimeType = "mock" | "openclaw" | "hermes" | "shell";

export type RunStatus =
  | "idle"
  | "queued"
  | "running"
  | "waiting-for-approval"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface ContextPolicy {
  mode: "none" | "selected" | "upstream" | "custom";
  includeRunHistory: boolean;
  maxTokens?: number;
  selectedKeys?: string[];
}

export interface BudgetPolicy {
  thinking: "none" | "low" | "medium" | "high";
  maxTokens?: number;
  timeoutMs?: number;
  maxCostUsd?: number;
}

export interface RiskPolicy {
  level: "low" | "medium" | "high";
  requiresApproval: boolean;
  approvalReason?: string;
}

export interface AgentSpec {
  id: string;
  name: string;
  objective: string;
  outputFormat: "text" | "json" | "structured";
}

export interface HarnessSpec {
  id: string;
  name: string;
  capability: string;
  permissions: string[];
}

export interface FlowNode {
  id: string;
  type: string;
  role: NodeRole;
  label: string;
  runtime: RuntimeType;
  agent?: AgentSpec;
  harness?: HarnessSpec;
  contextPolicy: ContextPolicy;
  budgetPolicy: BudgetPolicy;
  riskPolicy: RiskPolicy;
  position: {
    x: number;
    y: number;
  };
  data?: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface FlowSpec {
  schemaVersion: "0.1";
  id: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: string;
  updatedAt: string;
}

export type RunEventType =
  | "run.created"
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "run.cancelled"
  | "node.started"
  | "node.output"
  | "node.completed"
  | "node.failed"
  | "approval.requested";

export interface RunEvent {
  id: string;
  runId: string;
  flowId: string;
  nodeId?: string;
  sequence: number;
  timestamp: string;
  type: RunEventType;
  status: RunStatus;
  message: string;
  payload?: Record<string, unknown>;
}
