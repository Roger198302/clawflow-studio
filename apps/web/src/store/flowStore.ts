import type {
  BudgetPolicy,
  FlowNode,
  FlowSpec,
  NodeType,
  RiskPolicy,
  RunEvent,
  RunStatus
} from "@clawflow/protocol";
import { create } from "zustand";
import { createDefaultFlow, createFlowNode, getCatalogItem } from "../flowCatalog";

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
}

export interface EditableNodePatch {
  label?: string;
  runtimeRef?: string;
  thinkingLevel?: BudgetPolicy["thinking"];
  riskLevel?: RiskPolicy["level"];
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
  selectNode: (nodeId: string | null) => void;
  addNode: (type: NodeType) => void;
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
  clearRun: () => void;
}

const initialFlow = createDefaultFlow();

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

function createRunLogFromEvent(event: RunEvent): RunLogEntry | null {
  if (event.type !== "run.started" && event.type !== "run.completed" && event.type !== "run.failed") {
    return null;
  }

  return {
    id: `log_${event.id}`,
    timestamp: event.timestamp,
    level: event.type === "run.failed" ? "error" : event.type === "run.completed" ? "success" : "info",
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
  const message = problem.message.startsWith(problem.title)
    ? problem.message
    : `${problem.title}: ${problem.message}`;

  return {
    id: createClientId("log"),
    timestamp: new Date().toISOString(),
    level,
    message,
    source: problem.source,
    payload: {
      suggestion: problem.suggestion
    }
  };
}

function createClientId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
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
  selectNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },
  addNode: (type) => {
    set((state) => {
      const catalogItem = getCatalogItem(type);
      const newNode = createFlowNode(
        type,
        createNodeId(type, state.flow.nodes),
        createAddPosition(state.flow.nodes),
        catalogItem.label
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
  updateNode: (nodeId, patch) => {
    set((state) => ({
      flow: touchFlow(state.flow, {
        nodes: state.flow.nodes.map((node) => {
          if (node.id !== nodeId) {
            return node;
          }

          return {
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
      const nextStatuses = updateStatusesForRunEvent(event, baseStatuses);
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
        runCompletedAt: isTerminal ? event.timestamp : state.runCompletedAt
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
      nodeStatuses: createInitialStatuses(state.flow)
    }));
  }
}));
