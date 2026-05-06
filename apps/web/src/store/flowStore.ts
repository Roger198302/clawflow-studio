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
  runStatus: RunStatus;
  runError: string | null;
  runWarning: string | null;
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
  setRunError: (message: string) => void;
  setRunWarning: (message: string) => void;
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

export const useFlowStore = create<FlowStoreState>((set) => ({
  flow: initialFlow,
  selectedNodeId: initialFlow.nodes[0]?.id ?? null,
  nodeStatuses: createInitialStatuses(initialFlow),
  saveNotice: null,
  isExportOpen: false,
  currentRunId: null,
  runEvents: [],
  runStatus: "idle",
  runError: null,
  runWarning: null,
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
      runStatus: "queued",
      runError: null,
      runWarning: null,
      nodeStatuses: createInitialStatuses(state.flow)
    }));
  },
  acceptRunCreated: (runId) => {
    set({
      currentRunId: runId,
      runStatus: "queued",
      runError: null,
      runWarning: null
    });
  },
  appendRunEvent: (event) => {
    set((state) => {
      const resetForRunStart = event.type === "run.started";
      const baseStatuses = resetForRunStart ? createInitialStatuses(state.flow) : state.nodeStatuses;
      const nextStatuses = updateStatusesForRunEvent(event, baseStatuses);
      const nextEvents = resetForRunStart ? [event] : [...state.runEvents, event];

      return {
        currentRunId: event.runId,
        runEvents: nextEvents,
        nodeStatuses: nextStatuses,
        runStatus: updateRunStatusForEvent(event, state.runStatus),
        runError: event.type === "run.failed" ? event.message : state.runError,
        runWarning: null
      };
    });
  },
  setRunError: (message) => {
    set({
      runStatus: "failed",
      runError: message
    });
  },
  setRunWarning: (message) => {
    set({
      runWarning: message
    });
  }
}));
