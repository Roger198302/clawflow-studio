import type {
  BudgetPolicy,
  ExecutionPlanStepStatus,
  FlowEdge,
  FlowEstimate,
  FlowNode,
  FlowExecutionContractPreview,
  FlowSpec,
  LinearExecutionPlan,
  NodeHarnessRef,
  NodeType,
  RiskPolicy,
  RunEvent,
  RunReadinessReport,
  RunStatus
} from "@clawflow/protocol";
import { create } from "zustand";
import { createDefaultFlow, createFlowNode } from "../flowCatalog";

const GATEWAY_HTTP_URL = import.meta.env.VITE_GATEWAY_HTTP_URL ?? "http://localhost:8787";
let executionContractPreviewRequestSequence = 0;
let linearExecutionPlanRequestSequence = 0;
let flowEstimateRequestSequence = 0;
let runReadinessRequestSequence = 0;

export type RunLogLevel = "info" | "success" | "warning" | "error";
export type RunAlertSeverity = "warning" | "error";

export interface RunLogEntry {
  id: string;
  timestamp: string;
  level: RunLogLevel;
  message: string;
  source:
    | "webui"
    | "gateway"
    | "websocket"
    | "flow-validation"
    | "flow-engine"
    | "runtime-manager"
    | "runtime-validation";
  eventType?: string;
  nodeId?: string;
  payload?: Record<string, unknown>;
}

export interface RunAlert {
  id: string;
  timestamp: string;
  severity: RunAlertSeverity;
  title: string;
  message: string;
  suggestion: string;
}

export interface RunProblemInput {
  title: string;
  message: string;
  suggestion: string;
  source: RunLogEntry["source"];
  severity?: RunAlertSeverity;
  logTitle?: string;
  logMessage?: string;
  logSuggestion?: string;
}

export interface EditableNodePatch {
  label?: string;
  runtimeRef?: string;
  harnessRef?: NodeHarnessRef | null;
  thinkingLevel?: BudgetPolicy["thinking"];
  riskLevel?: RiskPolicy["level"];
}

export interface EditableEdgeConnection {
  source: string | null;
  target: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface FlowStoreState {
  flow: FlowSpec;
  selectedNodeId: string | null;
  nodeStatuses: Record<string, RunStatus>;
  saveNotice: string | null;
  isExportOpen: boolean;
  currentRunId: string | null;
  runEvents: RunEvent[];
  runLogs: RunLogEntry[];
  selectedRunEventId: string | null;
  runStatus: RunStatus;
  runError: string | null;
  runWarning: string | null;
  runAlert: RunAlert | null;
  runStartedAt: string | null;
  runCompletedAt: string | null;
  executionContractPreview: FlowExecutionContractPreview | null;
  executionContractPreviewLoading: boolean;
  executionContractPreviewError: string | null;
  linearExecutionPlan: LinearExecutionPlan | null;
  linearExecutionPlanLoading: boolean;
  linearExecutionPlanError: string | null;
  flowEstimate: FlowEstimate | null;
  flowEstimateLoading: boolean;
  flowEstimateError: string | null;
  runReadinessReport: RunReadinessReport | null;
  runReadinessLoading: boolean;
  runReadinessError: string | null;
  livePlanStepStatuses: Record<string, ExecutionPlanStepStatus>;
  selectNode: (nodeId: string | null) => void;
  addNode: (type: NodeType, position?: FlowNode["position"]) => void;
  duplicateNode: (nodeId: string) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (connection: EditableEdgeConnection) => void;
  removeEdges: (edgeIds: string[]) => void;
  reconnectEdge: (edgeId: string, connection: EditableEdgeConnection) => void;
  updateNode: (nodeId: string, patch: EditableNodePatch) => void;
  updateNodePosition: (nodeId: string, position: FlowNode["position"]) => void;
  markFlowSaved: () => void;
  toggleExport: () => void;
  closeExport: () => void;
  prepareRun: () => void;
  acceptRunCreated: (runId: string) => void;
  appendRunEvent: (event: RunEvent) => void;
  selectRunEvent: (eventId: string | null) => void;
  reportRunError: (problem: RunProblemInput) => void;
  reportRunWarning: (problem: RunProblemInput) => void;
  dismissRunAlert: () => void;
  requestExecutionContractPreview: (flow: FlowSpec) => Promise<FlowExecutionContractPreview | null>;
  requestLinearExecutionPlan: (flow: FlowSpec) => Promise<LinearExecutionPlan | null>;
  requestFlowEstimate: (flow: FlowSpec) => Promise<FlowEstimate | null>;
  requestRunReadinessReport: (flow: FlowSpec) => Promise<RunReadinessReport | null>;
  clearRun: () => void;
}

const initialFlow = createDefaultFlow();
const DEFAULT_SOURCE_HANDLE = "out";
const DEFAULT_TARGET_HANDLE = "in";

function createInitialStatuses(flow: FlowSpec): Record<string, RunStatus> {
  return Object.fromEntries(flow.nodes.map((node) => [node.id, "idle" satisfies RunStatus]));
}

function touchFlow(flow: FlowSpec, patch: Partial<FlowSpec>): FlowSpec {
  return {
    ...flow,
    ...patch,
    updatedAt: new Date().toISOString()
  };
}

function normalizeSourceHandle(handle: string | null | undefined): string {
  return handle?.trim() === "" || handle === null || handle === undefined
    ? DEFAULT_SOURCE_HANDLE
    : handle;
}

function normalizeTargetHandle(handle: string | null | undefined): string {
  return handle?.trim() === "" || handle === null || handle === undefined
    ? DEFAULT_TARGET_HANDLE
    : handle;
}

function createFlowEdge(
  connection: EditableEdgeConnection,
  existingEdges: FlowEdge[],
  preferredId?: string
): FlowEdge | null {
  if (connection.source === null || connection.target === null) {
    return null;
  }

  if (connection.source === connection.target) {
    return null;
  }

  const sourceHandle = normalizeSourceHandle(connection.sourceHandle);
  const targetHandle = normalizeTargetHandle(connection.targetHandle);

  return {
    id:
      preferredId ??
      createEdgeId(connection.source, sourceHandle, connection.target, targetHandle, existingEdges),
    source: connection.source,
    target: connection.target,
    sourceHandle,
    targetHandle
  };
}

function createEdgeId(
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
  existingEdges: FlowEdge[]
): string {
  const baseId = `edge.${sanitizeEdgeIdPart(source)}.${sanitizeEdgeIdPart(sourceHandle)}.${sanitizeEdgeIdPart(
    target
  )}.${sanitizeEdgeIdPart(targetHandle)}`;
  const existingIds = new Set(existingEdges.map((edge) => edge.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  let candidate = `${baseId}.${suffix}`;

  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${baseId}.${suffix}`;
  }

  return candidate;
}

function sanitizeEdgeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function hasEquivalentEdge(edges: FlowEdge[], candidate: FlowEdge): boolean {
  return edges.some(
    (edge) =>
      edge.source === candidate.source &&
      edge.target === candidate.target &&
      normalizeSourceHandle(edge.sourceHandle) === normalizeSourceHandle(candidate.sourceHandle) &&
      normalizeTargetHandle(edge.targetHandle) === normalizeTargetHandle(candidate.targetHandle)
  );
}

function createNodeId(type: NodeType, existingNodes: FlowNode[]): string {
  const baseId = `node.${type}`;
  const sameTypeCount = existingNodes.filter((node) => node.type === type).length;

  if (sameTypeCount === 0) {
    return baseId;
  }

  return `${baseId}.${sameTypeCount + 1}`;
}

function createAddPosition(existingNodes: FlowNode[]): FlowNode["position"] {
  const offset = existingNodes.length * 34;

  return {
    x: 120 + offset,
    y: 320 + offset
  };
}

function updateStatusesForRunEvent(
  event: RunEvent,
  currentStatuses: Record<string, RunStatus>
): Record<string, RunStatus> {
  if (event.nodeId === undefined) {
    return currentStatuses;
  }

  if (event.type === "node.started") {
    return {
      ...currentStatuses,
      [event.nodeId]: "running"
    };
  }

  if (event.type === "node.completed") {
    return {
      ...currentStatuses,
      [event.nodeId]: "success"
    };
  }

  if (event.type === "node.failed") {
    return {
      ...currentStatuses,
      [event.nodeId]: "failed"
    };
  }

  return currentStatuses;
}

function updateRunStatusForEvent(event: RunEvent, currentStatus: RunStatus): RunStatus {
  if (event.type === "run.started") {
    return "running";
  }

  if (event.type === "run.completed") {
    return "success";
  }

  if (event.type === "run.failed") {
    return "failed";
  }

  return currentStatus;
}

function updateLivePlanStepStatusesForRunEvent(
  event: RunEvent,
  currentStatuses: Record<string, ExecutionPlanStepStatus>
): Record<string, ExecutionPlanStepStatus> {
  if (event.nodeId === undefined) {
    return currentStatuses;
  }

  if (event.type === "execution.step.queued") {
    return {
      ...currentStatuses,
      [event.nodeId]: "queued"
    };
  }

  if (event.type === "execution.step.started") {
    return {
      ...currentStatuses,
      [event.nodeId]: "running"
    };
  }

  if (event.type === "execution.step.completed") {
    return {
      ...currentStatuses,
      [event.nodeId]: "completed"
    };
  }

  if (event.type === "execution.step.blocked") {
    return {
      ...currentStatuses,
      [event.nodeId]: "blocked"
    };
  }

  if (event.type === "node.failed") {
    return {
      ...currentStatuses,
      [event.nodeId]: "failed"
    };
  }

  return currentStatuses;
}

function createRunLogFromEvent(event: RunEvent): RunLogEntry | null {
  const loggableEvents: RunEvent["type"][] = [
    "run.started",
    "run.completed",
    "run.failed",
    "execution.plan.created",
    "execution.plan.completed",
    "execution.step.blocked"
  ];

  if (!loggableEvents.includes(event.type)) {
    return null;
  }

  const level: RunLogLevel =
    event.type === "run.failed" || event.type === "execution.step.blocked"
      ? "error"
      : event.type === "run.completed" || event.type === "execution.plan.completed"
        ? "success"
        : "info";

  return {
    id: `log_${event.id}`,
    timestamp: event.timestamp,
    level,
    message: event.message,
    source: "flow-engine",
    eventType: event.type,
    payload: event.payload
  };
}

function createProblemAlert(problem: RunProblemInput): RunAlert {
  return {
    id: createClientId("alert"),
    timestamp: new Date().toISOString(),
    severity: problem.severity ?? "error",
    title: problem.title,
    message: problem.message,
    suggestion: problem.suggestion
  };
}

function createProblemLog(problem: RunProblemInput, level: RunLogLevel): RunLogEntry {
  const title = problem.logTitle ?? problem.title;
  const detail = problem.logMessage ?? problem.message;
  const suggestion = problem.logSuggestion ?? problem.suggestion;
  const message = detail.startsWith(title) ? detail : `${title}: ${detail}`;

  return {
    id: createClientId("log"),
    timestamp: new Date().toISOString(),
    level,
    message,
    source: problem.source,
    payload: {
      suggestion
    }
  };
}

function createClientId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function isFlowExecutionContractPreview(value: unknown): value is FlowExecutionContractPreview {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<FlowExecutionContractPreview>;

  return (
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.warnings) &&
    Array.isArray(candidate.errors) &&
    typeof candidate.summary === "object" &&
    candidate.summary !== null &&
    typeof candidate.summary.totalNodes === "number"
  );
}

function isLinearExecutionPlan(value: unknown): value is LinearExecutionPlan {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<LinearExecutionPlan>;

  return (
    typeof candidate.status === "string" &&
    Array.isArray(candidate.steps) &&
    Array.isArray(candidate.warnings) &&
    Array.isArray(candidate.errors) &&
    Array.isArray(candidate.unsupportedReasons) &&
    typeof candidate.summary === "object" &&
    candidate.summary !== null &&
    typeof candidate.summary.totalSteps === "number"
  );
}

function isFlowEstimate(value: unknown): value is FlowEstimate {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<FlowEstimate>;

  return (
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.warnings) &&
    typeof candidate.confidence === "string" &&
    typeof candidate.totals === "object" &&
    candidate.totals !== null
  );
}

function isRunReadinessReport(value: unknown): value is RunReadinessReport {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RunReadinessReport>;

  return (
    typeof candidate.status === "string" &&
    Array.isArray(candidate.issues) &&
    typeof candidate.sources === "object" &&
    candidate.sources !== null
  );
}

function readPreviewErrorMessage(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const error = (value as { error?: { message?: unknown } }).error;

  return typeof error?.message === "string" ? error.message : undefined;
}

export const useFlowStore = create<FlowStoreState>((set) => ({
  flow: initialFlow,
  selectedNodeId: initialFlow.nodes[0]?.id ?? null,
  nodeStatuses: createInitialStatuses(initialFlow),
  saveNotice: null,
  isExportOpen: false,
  currentRunId: null,
  runEvents: [],
  runLogs: [],
  selectedRunEventId: null,
  runStatus: "idle",
  runError: null,
  runWarning: null,
  runAlert: null,
  runStartedAt: null,
  runCompletedAt: null,
  executionContractPreview: null,
  executionContractPreviewLoading: false,
  executionContractPreviewError: null,
  linearExecutionPlan: null,
  linearExecutionPlanLoading: false,
  linearExecutionPlanError: null,
  flowEstimate: null,
  flowEstimateLoading: false,
  flowEstimateError: null,
  runReadinessReport: null,
  runReadinessLoading: false,
  runReadinessError: null,
  livePlanStepStatuses: {},
  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },
  addNode: (type, position) => {
    set((state) => {
      const newNode = createFlowNode(
        type,
        createNodeId(type, state.flow.nodes),
        position ?? createAddPosition(state.flow.nodes)
      );

      return {
        flow: touchFlow(state.flow, {
          nodes: [...state.flow.nodes, newNode]
        }),
        selectedNodeId: newNode.id,
        nodeStatuses: {
          ...state.nodeStatuses,
          [newNode.id]: "idle"
        }
      };
    });
  },
  duplicateNode: (nodeId) => {
    set((state) => {
      const sourceNode = state.flow.nodes.find((node) => node.id === nodeId);

      if (sourceNode === undefined) {
        return state;
      }

      const duplicateNode: FlowNode = {
        ...sourceNode,
        id: createNodeId(sourceNode.type as NodeType, state.flow.nodes),
        position: {
          x: sourceNode.position.x + 42,
          y: sourceNode.position.y + 42
        }
      };

      return {
        flow: touchFlow(state.flow, {
          nodes: [...state.flow.nodes, duplicateNode]
        }),
        selectedNodeId: duplicateNode.id,
        nodeStatuses: {
          ...state.nodeStatuses,
          [duplicateNode.id]: "idle"
        }
      };
    });
  },
  removeNode: (nodeId) => {
    set((state) => {
      const nextNodes = state.flow.nodes.filter((node) => node.id !== nodeId);

      if (nextNodes.length === state.flow.nodes.length) {
        return state;
      }

      const nextNodeStatuses = { ...state.nodeStatuses };
      const nextLivePlanStepStatuses = { ...state.livePlanStepStatuses };
      delete nextNodeStatuses[nodeId];
      delete nextLivePlanStepStatuses[nodeId];

      return {
        flow: touchFlow(state.flow, {
          nodes: nextNodes,
          edges: state.flow.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
        }),
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        nodeStatuses: nextNodeStatuses,
        livePlanStepStatuses: nextLivePlanStepStatuses
      };
    });
  },
  addEdge: (connection) => {
    set((state) => {
      const edge = createFlowEdge(connection, state.flow.edges);

      if (edge === null || hasEquivalentEdge(state.flow.edges, edge)) {
        return state;
      }

      return {
        flow: touchFlow(state.flow, {
          edges: [...state.flow.edges, edge]
        })
      };
    });
  },
  removeEdges: (edgeIds) => {
    if (edgeIds.length === 0) {
      return;
    }

    set((state) => {
      const edgeIdSet = new Set(edgeIds);
      const nextEdges = state.flow.edges.filter((edge) => !edgeIdSet.has(edge.id));

      if (nextEdges.length === state.flow.edges.length) {
        return state;
      }

      return {
        flow: touchFlow(state.flow, {
          edges: nextEdges
        })
      };
    });
  },
  reconnectEdge: (edgeId, connection) => {
    set((state) => {
      const existingEdge = state.flow.edges.find((edge) => edge.id === edgeId);

      if (existingEdge === undefined) {
        return state;
      }

      const otherEdges = state.flow.edges.filter((edge) => edge.id !== edgeId);
      const nextEdge = createFlowEdge(connection, otherEdges, edgeId);

      if (nextEdge === null || hasEquivalentEdge(otherEdges, nextEdge)) {
        return state;
      }

      return {
        flow: touchFlow(state.flow, {
          edges: [...otherEdges, nextEdge]
        })
      };
    });
  },
  updateNode: (nodeId, patch) => {
    set((state) => ({
      flow: touchFlow(state.flow, {
        nodes: state.flow.nodes.map((node) => {
          if (node.id !== nodeId) {
            return node;
          }

          const nextNode: FlowNode = {
            ...node,
            label: patch.label ?? node.label,
            runtimeRef: patch.runtimeRef ?? node.runtimeRef,
            budgetPolicy:
              patch.thinkingLevel === undefined
                ? node.budgetPolicy
                : {
                    ...node.budgetPolicy,
                    thinking: patch.thinkingLevel
                  },
            riskPolicy:
              patch.riskLevel === undefined
                ? node.riskPolicy
                : {
                    ...node.riskPolicy,
                    level: patch.riskLevel
                  }
          };

          if (patch.harnessRef !== undefined) {
            nextNode.harnessRef = patch.harnessRef ?? undefined;
          }

          return nextNode;
        })
      })
    }));
  },
  updateNodePosition: (nodeId, position) => {
    set((state) => ({
      flow: touchFlow(state.flow, {
        nodes: state.flow.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                position
              }
            : node
        )
      })
    }));
  },
  markFlowSaved: () => {
    set({
      saveNotice: `Saved at ${new Date().toLocaleTimeString()}`
    });
  },
  toggleExport: () => {
    set((state) => ({ isExportOpen: !state.isExportOpen }));
  },
  closeExport: () => {
    set({ isExportOpen: false });
  },
  prepareRun: () => {
    set((state) => ({
      currentRunId: null,
      runEvents: [],
      runLogs: [],
      selectedRunEventId: null,
      runStatus: "queued",
      runError: null,
      runWarning: null,
      runAlert: null,
      runStartedAt: null,
      runCompletedAt: null,
      livePlanStepStatuses: {},
      nodeStatuses: createInitialStatuses(state.flow)
    }));
  },
  acceptRunCreated: (runId) => {
    set({
      currentRunId: runId,
      runStatus: "queued",
      runError: null,
      runWarning: null,
      runAlert: null
    });
  },
  appendRunEvent: (event) => {
    set((state) => {
      const resetForRunStart = event.type === "run.started";
      const baseStatuses = resetForRunStart ? createInitialStatuses(state.flow) : state.nodeStatuses;
      const basePlanStepStatuses = resetForRunStart ? {} : state.livePlanStepStatuses;
      const nextStatuses = updateStatusesForRunEvent(event, baseStatuses);
      const nextPlanStepStatuses = updateLivePlanStepStatusesForRunEvent(event, basePlanStepStatuses);
      const nextEvents = resetForRunStart ? [event] : [...state.runEvents, event];
      const runLog = createRunLogFromEvent(event);
      const nextLogs = resetForRunStart
        ? runLog === null
          ? []
          : [runLog]
        : runLog === null
          ? state.runLogs
          : [...state.runLogs, runLog];
      const nextRunStatus = updateRunStatusForEvent(event, state.runStatus);
      const isTerminal = event.type === "run.completed" || event.type === "run.failed";
      const alert =
        event.type === "run.failed"
          ? createProblemAlert({
              title: "Run failed",
              message: event.message,
              suggestion: "Review the failing RunEvent payload, fix the flow, then run again.",
              source: "flow-engine",
              severity: "error"
            })
          : state.runAlert;

      return {
        currentRunId: event.runId,
        runEvents: nextEvents,
        runLogs: nextLogs,
        nodeStatuses: nextStatuses,
        selectedRunEventId: state.selectedRunEventId ?? event.id,
        runStatus: nextRunStatus,
        runError: event.type === "run.failed" ? event.message : state.runError,
        runWarning: null,
        runAlert: alert,
        runStartedAt: event.type === "run.started" ? event.timestamp : state.runStartedAt,
        runCompletedAt: isTerminal ? event.timestamp : state.runCompletedAt,
        livePlanStepStatuses: nextPlanStepStatuses
      };
    });
  },
  selectRunEvent: (eventId) => {
    set({ selectedRunEventId: eventId });
  },
  reportRunError: (problem) => {
    const normalizedProblem = {
      ...problem,
      severity: "error" as const
    };
    set((state) => ({
      runStatus: "failed",
      runError: problem.message,
      runWarning: null,
      runAlert: createProblemAlert(normalizedProblem),
      runLogs: [...state.runLogs, createProblemLog(normalizedProblem, "error")],
      runCompletedAt: new Date().toISOString()
    }));
  },
  reportRunWarning: (problem) => {
    const normalizedProblem = {
      ...problem,
      severity: "warning" as const
    };
    set((state) => ({
      runStatus:
        state.runStatus === "queued" || state.runStatus === "running" ? "failed" : state.runStatus,
      runWarning: problem.message,
      runAlert: createProblemAlert(normalizedProblem),
      runLogs: [...state.runLogs, createProblemLog(normalizedProblem, "warning")],
      runCompletedAt: new Date().toISOString()
    }));
  },
  dismissRunAlert: () => {
    set({ runAlert: null });
  },
  requestExecutionContractPreview: async (flow) => {
    executionContractPreviewRequestSequence += 1;
    const requestSequence = executionContractPreviewRequestSequence;

    set({
      executionContractPreviewLoading: true,
      executionContractPreviewError: null
    });

    try {
      const response = await fetch(`${GATEWAY_HTTP_URL}/api/flows/execution-contract-preview`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ flow })
      });
      const body = (await response.json().catch(() => ({}))) as unknown;

      if (!response.ok) {
        throw new Error(readPreviewErrorMessage(body) ?? `Gateway returned HTTP ${response.status}.`);
      }

      if (!isFlowExecutionContractPreview(body)) {
        throw new Error("Gateway returned an invalid execution contract preview.");
      }

      if (requestSequence === executionContractPreviewRequestSequence) {
        set({
          executionContractPreview: body,
          executionContractPreviewLoading: false,
          executionContractPreviewError: null
        });
      }

      return body;
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : "Unable to create execution contract preview.";
      const message =
        rawMessage === "Failed to fetch" || rawMessage.includes("fetch")
          ? `Gateway unavailable: unable to preview execution contracts from ${GATEWAY_HTTP_URL}. Please make sure pnpm dev:gateway is running.`
          : `Execution contract preview error: ${rawMessage}`;

      if (requestSequence === executionContractPreviewRequestSequence) {
        set({
          executionContractPreview: null,
          executionContractPreviewLoading: false,
          executionContractPreviewError: message
        });
      }

      return null;
    }
  },
  requestLinearExecutionPlan: async (flow) => {
    linearExecutionPlanRequestSequence += 1;
    const requestSequence = linearExecutionPlanRequestSequence;

    set({
      linearExecutionPlanLoading: true,
      linearExecutionPlanError: null
    });

    try {
      const response = await fetch(`${GATEWAY_HTTP_URL}/api/flows/linear-execution-plan`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ flow })
      });
      const body = (await response.json().catch(() => ({}))) as unknown;

      if (!response.ok) {
        throw new Error(readPreviewErrorMessage(body) ?? `Gateway returned HTTP ${response.status}.`);
      }

      if (!isLinearExecutionPlan(body)) {
        throw new Error("Gateway returned an invalid linear execution plan.");
      }

      if (requestSequence === linearExecutionPlanRequestSequence) {
        set({
          linearExecutionPlan: body,
          linearExecutionPlanLoading: false,
          linearExecutionPlanError: null
        });
      }

      return body;
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : "Unable to create linear execution plan.";
      const message =
        rawMessage === "Failed to fetch" || rawMessage.includes("fetch")
          ? `Gateway unavailable: unable to preview linear execution plan from ${GATEWAY_HTTP_URL}. Please make sure pnpm dev:gateway is running.`
          : `Linear execution plan error: ${rawMessage}`;

      if (requestSequence === linearExecutionPlanRequestSequence) {
        set({
          linearExecutionPlan: null,
          linearExecutionPlanLoading: false,
          linearExecutionPlanError: message
        });
      }

      return null;
    }
  },
  requestFlowEstimate: async (flow) => {
    flowEstimateRequestSequence += 1;
    const requestSequence = flowEstimateRequestSequence;

    set({
      flowEstimateLoading: true,
      flowEstimateError: null
    });

    try {
      const response = await fetch(`${GATEWAY_HTTP_URL}/api/flows/estimate`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ flow })
      });
      const body = (await response.json().catch(() => ({}))) as unknown;

      if (!response.ok) {
        throw new Error(readPreviewErrorMessage(body) ?? `Gateway returned HTTP ${response.status}.`);
      }

      if (!isFlowEstimate(body)) {
        throw new Error("Gateway returned an invalid resource estimate.");
      }

      if (requestSequence === flowEstimateRequestSequence) {
        set({
          flowEstimate: body,
          flowEstimateLoading: false,
          flowEstimateError: null
        });
      }

      return body;
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : "Unable to create resource estimate.";
      const message =
        rawMessage === "Failed to fetch" || rawMessage.includes("fetch")
          ? `Gateway unavailable: unable to estimate flow resources from ${GATEWAY_HTTP_URL}. Please make sure pnpm dev:gateway is running.`
          : `Resource estimate error: ${rawMessage}`;

      if (requestSequence === flowEstimateRequestSequence) {
        set({
          flowEstimate: null,
          flowEstimateLoading: false,
          flowEstimateError: message
        });
      }

      return null;
    }
  },
  requestRunReadinessReport: async (flow) => {
    runReadinessRequestSequence += 1;
    const requestSequence = runReadinessRequestSequence;

    set({
      runReadinessLoading: true,
      runReadinessError: null
    });

    try {
      const response = await fetch(`${GATEWAY_HTTP_URL}/api/flows/run-readiness`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ flow })
      });
      const body = (await response.json().catch(() => ({}))) as unknown;

      if (!response.ok) {
        throw new Error(readPreviewErrorMessage(body) ?? `Gateway returned HTTP ${response.status}.`);
      }

      if (!isRunReadinessReport(body)) {
        throw new Error("Gateway returned an invalid run readiness report.");
      }

      if (requestSequence === runReadinessRequestSequence) {
        set({
          runReadinessReport: body,
          runReadinessLoading: false,
          runReadinessError: null
        });
      }

      return body;
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : "Unable to create run readiness report.";
      const message =
        rawMessage === "Failed to fetch" || rawMessage.includes("fetch")
          ? `Gateway unavailable: unable to preview run readiness from ${GATEWAY_HTTP_URL}. Please make sure pnpm dev:gateway is running.`
          : `Run readiness error: ${rawMessage}`;

      if (requestSequence === runReadinessRequestSequence) {
        set({
          runReadinessReport: null,
          runReadinessLoading: false,
          runReadinessError: message
        });
      }

      return null;
    }
  },
  clearRun: () => {
    set((state) => ({
      currentRunId: null,
      runEvents: [],
      runLogs: [],
      selectedRunEventId: null,
      runStatus: "idle",
      runError: null,
      runWarning: null,
      runAlert: null,
      runStartedAt: null,
      runCompletedAt: null,
      livePlanStepStatuses: {},
      nodeStatuses: createInitialStatuses(state.flow)
    }));
  }
}));
