export type NodeRole =
  | "trigger"
  | "start"
  | "process"
  | "end"
  | "tool"
  | "control"
  | "output"
  | "safety"
  | "memory";

export type NodeType =
  | "manual.trigger"
  | "agent.start"
  | "agent.worker"
  | "agent.end"
  | "output.console";

export type RuntimeType =
  | "mock"
  | "openclaw"
  | "hermes"
  | "codex"
  | "claude-code"
  | "shell"
  | "mcp"
  | "http"
  | "custom";

export type RuntimeStatus = "online" | "offline" | "unknown" | "error";

export type RuntimeCapabilityKind =
  | "agent"
  | "tool"
  | "trigger"
  | "output"
  | "memory"
  | "control"
  | "safety";

export interface RuntimeCapability {
  id: string;
  name: string;
  kind: RuntimeCapabilityKind;
  description?: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface RuntimeSpec {
  id: string;
  name: string;
  type: RuntimeType;
  status: RuntimeStatus;
  endpoint?: string;
  command?: string;
  description?: string;
  capabilities: RuntimeCapability[];
  lastHealthCheckAt?: string;
  errorMessage?: string;
}

export interface RuntimeHealth {
  runtimeId: string;
  status: RuntimeStatus;
  checkedAt: string;
  latencyMs?: number;
  message?: string;
}

export type RunStatus =
  | "idle"
  | "queued"
  | "running"
  | "waiting_approval"
  | "success"
  | "failed"
  | "cancelled"
  | "skipped";

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
  level: "low" | "medium" | "high" | "critical";
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
  type: NodeType | string;
  role: NodeRole;
  label: string;
  runtimeRef?: string;
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
  | "node.input"
  | "node.started"
  | "node.output"
  | "node.completed"
  | "node.failed"
  | "agent.stream"
  | "tool.called"
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
