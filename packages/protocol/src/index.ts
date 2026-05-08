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

export type RuntimeExecutionMode = "mock" | "protected" | "unavailable";

export interface RuntimePlanMetadata {
  executionMode: RuntimeExecutionMode;
  protectedDryRun: boolean;
  runtimes: Array<{
    runtimeId: string;
    executionMode: RuntimeExecutionMode;
  }>;
}

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
  executionMode: RuntimeExecutionMode;
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
  executionMode: RuntimeExecutionMode;
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

export type RuntimeAdapterStatus = RuntimeStatus;

export interface AgentInvokeInput {
  runtimeId: string;
  nodeId?: string;
  agentId?: string;
  prompt?: string;
  input?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface AgentInvokeResult {
  runtimeId: string;
  nodeId?: string;
  output: Record<string, unknown>;
  raw?: unknown;
}

export interface ToolInvokeInput {
  runtimeId: string;
  nodeId?: string;
  toolName: string;
  input?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface ToolInvokeResult {
  runtimeId: string;
  nodeId?: string;
  toolName: string;
  output: Record<string, unknown>;
  raw?: unknown;
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

export type HarnessKind =
  | "chat"
  | "browser"
  | "code"
  | "research"
  | "file"
  | "comfyui"
  | "approval"
  | "critic"
  | "multi_agent"
  | "custom";

export type HarnessRiskLevel = "low" | "medium" | "high" | "critical";

export type HarnessExecutionMode = "mock" | "dry_run" | "protected" | "live";

export type HarnessCapability =
  | "text_generation"
  | "reasoning"
  | "web_search"
  | "browser_control"
  | "file_read"
  | "file_write"
  | "shell_exec"
  | "code_edit"
  | "code_run"
  | "image_generation"
  | "video_generation"
  | "workflow_api"
  | "human_approval"
  | "memory"
  | "multi_agent_coordination"
  | "critique";

export interface HarnessToolRequirement {
  capability: HarnessCapability;
  required: boolean;
  description?: string;
}

export interface HarnessRuntimeFit {
  runtimeId: string;
  fit: "best" | "good" | "partial" | "unsupported";
  reason?: string;
  allowedExecutionModes: HarnessExecutionMode[];
}

export interface NodeHarnessProfile {
  id: string;
  kind: HarnessKind;
  label: string;
  description?: string;
  riskLevel: HarnessRiskLevel;
  requiredCapabilities: HarnessToolRequirement[];
  recommendedCapabilities?: HarnessToolRequirement[];
  compatibleRuntimes: HarnessRuntimeFit[];
  defaultExecutionMode: HarnessExecutionMode;
}

export interface NodeHarnessRef {
  harnessId: string;
  executionMode?: HarnessExecutionMode;
}

export interface HarnessCompatibilityResult {
  harnessId: string;
  runtimeId?: string;
  fit: "best" | "good" | "partial" | "unsupported" | "unknown";
  riskLevel: HarnessRiskLevel;
  effectiveExecutionMode: HarnessExecutionMode;
  reasons: string[];
  missingCapabilities: HarnessCapability[];
  protectedDryRun: boolean;
}

export interface FlowNode {
  id: string;
  type: NodeType | string;
  role: NodeRole;
  label: string;
  runtimeRef?: string;
  agent?: AgentSpec;
  harness?: HarnessSpec;
  harnessRef?: NodeHarnessRef;
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

export type NodeCategory =
  | "trigger"
  | "agent"
  | "capability"
  | "knowledge"
  | "control"
  | "output"
  | "utility";

export type CapabilityProvider =
  | "internal"
  | "runtime"
  | "cli"
  | "mcp"
  | "rag"
  | "comfyui"
  | "api"
  | "browser"
  | "human";

export type NodeDataType =
  | "text"
  | "json"
  | "image"
  | "video"
  | "file"
  | "event"
  | "artifact"
  | "any";

export type PortDataType = NodeDataType;

export type NodeInputResolutionSource = "upstream" | "session" | "constant" | "user";

export interface NodePortDefinition {
  id: string;
  label: string;
  labelKey?: string;
  dataType: NodeDataType;
  required?: boolean;
  recommended?: boolean;
  multiple?: boolean;
  description?: string;
  descriptionKey?: string;
  schema?: Record<string, unknown>;
  examples?: unknown[];
}

export interface NodeInputDefinition extends NodePortDefinition {
  resolutionSource?: NodeInputResolutionSource;
  defaultValue?: unknown;
}

export interface NodeOutputDefinition extends NodePortDefinition {
  artifactKind?: string;
  previewable?: boolean;
}

export type NodeExecutionMode =
  | "trigger-only"
  | "preview-only"
  | "mock-executable"
  | "protected"
  | "runtime-required"
  | "output-only"
  | "blocked";

export type NodeRiskLevel = "safe" | "medium" | "dangerous";

export interface NodeCapabilityContract {
  provider: CapabilityProvider;
  providerCapabilityId?: string;
  /** @deprecated Use providerCapabilityId for node/provider contract capabilities. */
  capabilityId?: string;
  runtimeRef?: string;
  riskLevel: NodeRiskLevel;
  requiresApproval?: boolean;
  description?: string;
}

export type NodeContractSource = "catalog" | "placeholder" | "inferred";

export interface RuntimeCompatibilityDefinition {
  runtimeId?: string;
  runtimeType?: RuntimeType;
  supportedRuntimeTypes?: RuntimeType[];
  requiredCapabilities?: string[];
  recommendedCapabilities?: string[];
  allowedExecutionModes: NodeExecutionMode[];
  defaultExecutionMode?: NodeExecutionMode;
  protectedByDefault?: boolean;
  unavailableReasonKey?: string;
}

export interface NodeEstimateHints {
  inputTokenEstimate?: number;
  outputTokenEstimate?: number;
  latencyMs?: number;
  costMultiplier?: number;
  contextWindowTokens?: number;
}

export type EstimateUnit = "tokens" | "ms" | "usd" | "count" | "bytes" | "unknown";

export type CostEstimateStatus = "known" | "zero" | "unknown" | "not_applicable";

export type EstimateConfidence = "high" | "medium" | "low" | "unknown";

export type EstimatorSource =
  | "node-catalog"
  | "runtime-registry"
  | "model-metadata"
  | "user-input"
  | "session-context"
  | "static-default"
  | "inferred";

export interface EstimateRange {
  min?: number;
  expected?: number;
  max?: number;
  unit: EstimateUnit;
}

export interface EstimatorWarning {
  code: string;
  messageKey: string;
  details?: Record<string, unknown>;
  nodeId?: string;
  source?: EstimatorSource;
}

export interface TokenEstimate {
  inputTokens: EstimateRange;
  outputTokens: EstimateRange;
  reasoningTokens?: EstimateRange;
  toolCallOverheadTokens?: EstimateRange;
  contextCarryoverTokens?: EstimateRange;
}

export interface CostEstimate {
  status: CostEstimateStatus;
  inputCost?: EstimateRange;
  outputCost?: EstimateRange;
  reasoningCost?: EstimateRange;
  toolCost?: EstimateRange;
  totalCost?: EstimateRange;
  currency?: string;
}

export interface LatencyEstimate {
  queueLatencyMs?: EstimateRange;
  modelLatencyMs?: EstimateRange;
  toolLatencyMs?: EstimateRange;
  totalLatencyMs: EstimateRange;
}

export interface NodeEstimate {
  nodeId: string;
  nodeType: string;
  label?: string;
  runtimeRef?: string;
  modelRef?: string;
  contractSource?: NodeContractSource;
  confidence: EstimateConfidence;
  tokenConfidence: EstimateConfidence;
  costConfidence: EstimateConfidence;
  latencyConfidence: EstimateConfidence;
  sources: EstimatorSource[];
  tokens: TokenEstimate;
  cost: CostEstimate;
  latency: LatencyEstimate;
  warnings: EstimatorWarning[];
  partial: boolean;
}

export interface FlowEstimate {
  flowId?: string;
  confidence: EstimateConfidence;
  tokenConfidence: EstimateConfidence;
  costConfidence: EstimateConfidence;
  latencyConfidence: EstimateConfidence;
  nodes: NodeEstimate[];
  totals: {
    tokens: TokenEstimate;
    cost: CostEstimate;
    latency: LatencyEstimate;
  };
  warnings: EstimatorWarning[];
  partial: boolean;
}

export type RunReadinessStatus = "ready" | "warning" | "blocked";

export type RunReadinessIssueSeverity = "info" | "warning" | "error";

export interface RunReadinessIssue {
  code: string;
  severity: RunReadinessIssueSeverity;
  messageKey: string;
  nodeId?: string;
  details?: Record<string, unknown>;
}

export interface RunReadinessReport {
  flowId?: string;
  status: RunReadinessStatus;
  issues: RunReadinessIssue[];
  sources: {
    diagnostics: boolean;
    executionPlan: boolean;
    resourceEstimate: boolean;
  };
  summary?: {
    totalIssues: number;
    infoIssues: number;
    warningIssues: number;
    errorIssues: number;
    diagnosticIssueCount: number;
    executionPlanStatus?: ExecutionPlanStatus;
    executionPlanIssueCount: number;
    resourceEstimateWarningCount: number;
    resourceEstimateConfidence?: EstimateConfidence;
    resourceEstimateCostStatus?: CostEstimateStatus;
  };
}

export interface NodeTypeDefinition {
  type: NodeType | string;
  category: NodeCategory;
  role: NodeRole;
  labelKey: string;
  descriptionKey?: string;
  groupKey: string;
  icon?: string;
  inputs: NodeInputDefinition[];
  outputs: NodeOutputDefinition[];
  provider: CapabilityProvider;
  providerCapabilityId?: string;
  defaultRuntimeRef?: string;
  defaultHarnessId?: string;
  riskLevel: NodeRiskLevel;
  defaultExecutionMode?: NodeExecutionMode;
  allowedExecutionModes: NodeExecutionMode[];
  runtimeCompatibility: RuntimeCompatibilityDefinition[];
  estimateHints?: NodeEstimateHints;
  experimental?: boolean;
}

export interface NodeExecutionContract {
  nodeId: string;
  nodeType: string;
  label?: string;
  category: NodeCategory;
  contractSource?: NodeContractSource;
  inputs: NodeInputDefinition[];
  outputs: NodeOutputDefinition[];
  executionMode: NodeExecutionMode;
  capability?: NodeCapabilityContract;
  missingRequiredInputs: string[];
  warnings: string[];
  errors: string[];
  isExecutable: boolean;
  isPreviewable: boolean;
}

export interface PortCompatibilityIssue {
  sourceNodeId: string;
  sourcePortId?: string;
  sourceDataType: PortDataType;
  targetNodeId: string;
  targetPortId?: string;
  targetDataType: PortDataType;
  severity: "warning" | "error";
  message: string;
}

export interface FlowExecutionContractPreview {
  flowId?: string;
  nodes: NodeExecutionContract[];
  warnings: string[];
  errors: string[];
  summary: {
    totalNodes: number;
    executableNodes: number;
    blockedNodes: number;
    previewOnlyNodes: number;
    triggerNodes: number;
    outputNodes: number;
    riskCounts: {
      safe: number;
      medium: number;
      dangerous: number;
    };
  };
  portCompatibilityIssues?: PortCompatibilityIssue[];
}

export type ExecutionPlanStatus = "ready" | "blocked" | "unsupported" | "invalid";

export type ExecutionPlanStepStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "blocked";

export type ExecutionPlanUnsupportedReason =
  | "branching-not-supported"
  | "fan-in-not-supported"
  | "cycle-detected"
  | "missing-trigger"
  | "multiple-triggers"
  | "blocked-node"
  | "missing-required-input"
  | "unknown-node"
  | "invalid-edge"
  | "empty-flow";

export interface StepInputMapping {
  inputPortId?: string;
  sourceNodeId?: string;
  sourcePortId?: string;
  sourceStepId?: string;
  dataType?: PortDataType;
  strategy: "trigger" | "single-upstream-output" | "constant" | "unresolved";
  required?: boolean;
  status: "resolved" | "unresolved" | "warning";
}

export interface StepOutputMapping {
  outputPortId?: string;
  targetNodeIds: string[];
  dataType?: PortDataType;
  strategy: "pass-through" | "terminal" | "unmapped";
}

export interface LinearExecutionPlanStep {
  stepId: string;
  order: number;
  nodeId: string;
  nodeType: string;
  label?: string;
  category: NodeCategory;
  executionMode: NodeExecutionMode;
  provider?: CapabilityProvider;
  runtimeRef?: string;
  riskLevel?: NodeRiskLevel;
  upstreamNodeIds: string[];
  downstreamNodeIds: string[];
  inputMappings: StepInputMapping[];
  outputMappings: StepOutputMapping[];
  status: ExecutionPlanStepStatus;
  blockingReasons: ExecutionPlanUnsupportedReason[];
  warnings: string[];
  errors: string[];
}

export interface LinearExecutionPlanSummary {
  totalSteps: number;
  runnableSteps: number;
  blockedSteps: number;
  outputSteps: number;
  triggerSteps: number;
  protectedSteps: number;
  mockExecutableSteps: number;
  previewOnlySteps: number;
}

export interface LinearExecutionPlan {
  flowId?: string;
  status: ExecutionPlanStatus;
  steps: LinearExecutionPlanStep[];
  warnings: string[];
  errors: string[];
  unsupportedReasons: ExecutionPlanUnsupportedReason[];
  summary: LinearExecutionPlanSummary;
  contractPreview?: FlowExecutionContractPreview;
}

export type SessionStatus =
  | "idle"
  | "running"
  | "paused"
  | "waiting_for_user"
  | "completed"
  | "failed"
  | "cancelled";

export type SessionTurnRole = "user" | "assistant" | "system" | "runtime";

export type SessionStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type SessionInterventionKind =
  | "pause"
  | "resume"
  | "cancel"
  | "retry_step"
  | "skip_step"
  | "edit_step_input"
  | "add_constraint"
  | "approve"
  | "reject";

export type SessionInterventionStatus = "recorded" | "applied" | "ignored" | "failed";

export interface FlowSession {
  id: string;
  flowId: string;
  title: string;
  status: SessionStatus;
  currentRunId?: string;
  currentNodeId?: string;
  runtimePlan?: RuntimePlanMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface SessionTurn {
  id: string;
  sessionId: string;
  role: SessionTurnRole;
  content: string;
  nodeId?: string;
  runId?: string;
  runtimeId?: string;
  protectedDryRun?: boolean;
  createdAt: string;
}

export interface SessionStep {
  id: string;
  sessionId: string;
  runId?: string;
  nodeId?: string;
  title?: string;
  status: SessionStepStatus;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  runtimeId?: string;
  protectedDryRun?: boolean;
  compatibility?: HarnessCompatibilityResult;
  createdAt: string;
  updatedAt: string;
}

export interface SessionIntervention {
  id: string;
  sessionId: string;
  kind: SessionInterventionKind;
  status: SessionInterventionStatus;
  runId?: string;
  nodeId?: string;
  stepId?: string;
  content?: string;
  payload?: unknown;
  createdAt: string;
  appliedAt?: string;
  reason?: string;
}

export interface CreateSessionRequest {
  flowId: string;
  title?: string;
}

export interface AppendSessionTurnRequest {
  role?: SessionTurnRole;
  content: string;
  nodeId?: string;
  runId?: string;
}

export interface RunFlowRequest {
  flow: FlowSpec;
  sessionId?: string;
}

export interface SessionControlRequest {
  reason?: string;
}

export interface RetrySessionStepRequest {
  stepId?: string;
  nodeId?: string;
  reason?: string;
  editedInput?: unknown;
}

export interface SkipSessionStepRequest {
  stepId?: string;
  nodeId?: string;
  reason?: string;
}

export interface EditSessionStepInputRequest {
  stepId?: string;
  nodeId?: string;
  input: unknown;
  reason?: string;
}

export interface AddSessionConstraintRequest {
  content: string;
  nodeId?: string;
  stepId?: string;
}

export interface SessionDetail {
  session: FlowSession;
  turns: SessionTurn[];
  steps: SessionStep[];
  interventions?: SessionIntervention[];
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
  | "approval.requested"
  | "execution.plan.created"
  | "execution.step.queued"
  | "execution.step.started"
  | "execution.step.completed"
  | "execution.step.blocked"
  | "execution.plan.completed";

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
