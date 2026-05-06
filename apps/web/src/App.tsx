import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type OnNodesChange
} from "@xyflow/react";
import type { BudgetPolicy, NodeRole, NodeType, RiskPolicy, RunEvent } from "@clawflow/protocol";
import {
  Braces,
  CircleStop,
  ClipboardList,
  Library,
  MousePointer2,
  Play,
  Plus,
  Save,
  SquareTerminal,
  Workflow,
  X,
  type LucideIcon
} from "lucide-react";
import {
  useCallback,
  useMemo,
  useRef,
  type ChangeEvent,
  type ReactElement
} from "react";
import { ClawFlowNode, type ClawFlowNodeData } from "./components/ClawFlowNode";
import { MVP_NODE_CATALOG } from "./flowCatalog";
import { useFlowStore } from "./store/flowStore";

const GATEWAY_HTTP_URL = import.meta.env.VITE_GATEWAY_HTTP_URL ?? "http://localhost:8787";

const nodeTypes = {
  clawflowNode: ClawFlowNode
};

const nodeIcons: Record<NodeType, LucideIcon> = {
  "manual.trigger": MousePointer2,
  "agent.start": Play,
  "agent.worker": Workflow,
  "agent.end": CircleStop,
  "output.console": SquareTerminal
};

const roleLabels: Record<NodeRole, string> = {
  trigger: "Trigger",
  start: "Start",
  process: "Process",
  end: "End",
  tool: "Tool",
  control: "Control",
  output: "Output",
  safety: "Safety",
  memory: "Memory"
};

const thinkingLevels: BudgetPolicy["thinking"][] = ["none", "low", "medium", "high"];
const riskLevels: RiskPolicy["level"][] = ["low", "medium", "high", "critical"];

type CanvasNode = Node<ClawFlowNodeData, "clawflowNode">;

interface CreateRunResponse {
  runId: string;
  status: "queued";
  wsUrl: string;
}

interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

export function App(): ReactElement {
  const activeSocketRef = useRef<WebSocket | null>(null);
  const flow = useFlowStore((state) => state.flow);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const nodeStatuses = useFlowStore((state) => state.nodeStatuses);
  const saveNotice = useFlowStore((state) => state.saveNotice);
  const isExportOpen = useFlowStore((state) => state.isExportOpen);
  const currentRunId = useFlowStore((state) => state.currentRunId);
  const runEvents = useFlowStore((state) => state.runEvents);
  const runStatus = useFlowStore((state) => state.runStatus);
  const runError = useFlowStore((state) => state.runError);
  const runWarning = useFlowStore((state) => state.runWarning);
  const selectNode = useFlowStore((state) => state.selectNode);
  const addNode = useFlowStore((state) => state.addNode);
  const updateNode = useFlowStore((state) => state.updateNode);
  const updateNodePosition = useFlowStore((state) => state.updateNodePosition);
  const markFlowSaved = useFlowStore((state) => state.markFlowSaved);
  const toggleExport = useFlowStore((state) => state.toggleExport);
  const closeExport = useFlowStore((state) => state.closeExport);
  const prepareRun = useFlowStore((state) => state.prepareRun);
  const acceptRunCreated = useFlowStore((state) => state.acceptRunCreated);
  const appendRunEvent = useFlowStore((state) => state.appendRunEvent);
  const setRunError = useFlowStore((state) => state.setRunError);
  const setRunWarning = useFlowStore((state) => state.setRunWarning);

  const selectedNode = useMemo(
    () => flow.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [flow.nodes, selectedNodeId]
  );

  const canvasNodes = useMemo<CanvasNode[]>(
    () =>
      flow.nodes.map((node) => ({
        id: node.id,
        type: "clawflowNode",
        position: node.position,
        data: {
          label: node.label,
          nodeType: node.type,
          role: node.role,
          runtimeRef: node.runtimeRef ?? "mock",
          status: nodeStatuses[node.id] ?? "idle"
        },
        selected: node.id === selectedNodeId
      })),
    [flow.nodes, nodeStatuses, selectedNodeId]
  );

  const canvasEdges = useMemo<Edge[]>(
    () =>
      flow.edges.map((edge) => ({
        ...edge,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#756e62"
        },
        interactionWidth: 18,
        style: {
          stroke: "#756e62",
          strokeWidth: 1.6
        }
      })),
    [flow.edges]
  );

  const flowJson = useMemo(() => JSON.stringify(flow, null, 2), [flow]);
  const isRunActive = runStatus === "queued" || runStatus === "running";

  const handleNodesChange = useCallback<OnNodesChange<CanvasNode>>(
    (changes) => {
      for (const change of changes) {
        if (change.type === "position" && change.position !== undefined) {
          updateNodePosition(change.id, change.position);
        }
      }
    },
    [updateNodePosition]
  );

  const handleSaveFlow = useCallback(() => {
    console.log("ClawFlow FlowSpec", flow);
    markFlowSaved();
  }, [flow, markFlowSaved]);

  const handleRunFlow = useCallback(async () => {
    if (activeSocketRef.current !== null) {
      const socketToClose = activeSocketRef.current;
      activeSocketRef.current = null;
      socketToClose.close();
    }

    prepareRun();

    try {
      const response = await fetch(`${GATEWAY_HTTP_URL}/api/runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(flow)
      });

      const body = (await response.json().catch(() => ({}))) as CreateRunResponse & ErrorResponse;

      if (!response.ok) {
        throw new Error(body.error?.message ?? `Gateway returned HTTP ${response.status}.`);
      }

      if (typeof body.runId !== "string" || typeof body.wsUrl !== "string") {
        throw new Error("Gateway response did not include runId and wsUrl.");
      }

      acceptRunCreated(body.runId);

      const socket = new WebSocket(createWebSocketUrl(body.wsUrl));
      activeSocketRef.current = socket;

      socket.onmessage = (messageEvent: MessageEvent<string>) => {
        const payload = parseSocketPayload(messageEvent.data);

        if (isRunEvent(payload)) {
          appendRunEvent(payload);
          return;
        }

        const errorMessage = extractSocketError(payload);

        if (errorMessage !== null) {
          setRunError(errorMessage);
        }
      };

      socket.onerror = () => {
        if (activeSocketRef.current === socket) {
          setRunWarning("WebSocket connection error while listening for run events.");
        }
      };

      socket.onclose = () => {
        if (activeSocketRef.current === socket) {
          setRunWarning("WebSocket disconnected while listening for run events.");
          activeSocketRef.current = null;
        }
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Gateway is unavailable or returned an unreadable error.";
      setRunError(message);
    }
  }, [acceptRunCreated, appendRunEvent, flow, prepareRun, setRunError, setRunWarning]);

  const handleLabelChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (selectedNode !== null) {
        updateNode(selectedNode.id, { label: event.target.value });
      }
    },
    [selectedNode, updateNode]
  );

  const handleRuntimeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (selectedNode !== null) {
        updateNode(selectedNode.id, { runtimeRef: event.target.value });
      }
    },
    [selectedNode, updateNode]
  );

  const handleThinkingChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      if (selectedNode !== null) {
        updateNode(selectedNode.id, {
          thinkingLevel: event.target.value as BudgetPolicy["thinking"]
        });
      }
    },
    [selectedNode, updateNode]
  );

  const handleRiskChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      if (selectedNode !== null) {
        updateNode(selectedNode.id, {
          riskLevel: event.target.value as RiskPolicy["level"]
        });
      }
    },
    [selectedNode, updateNode]
  );

  return (
    <div className="studio-shell">
      <header className="top-bar">
        <div className="brand-lockup">
          <Workflow aria-hidden="true" size={20} />
          <div>
            <strong>ClawFlow Studio</strong>
            <span>{flow.name}</span>
          </div>
        </div>

        <div className="top-status" aria-live="polite">
          {runError ?? runWarning ?? saveNotice ?? formatRunStatus(runStatus, currentRunId)}
        </div>

        <nav className="top-actions" aria-label="Workspace actions">
          <button type="button" title="Save flow" onClick={handleSaveFlow}>
            <Save aria-hidden="true" size={16} />
            Save Flow
          </button>
          <button type="button" title="Export flow JSON" onClick={toggleExport}>
            <Braces aria-hidden="true" size={16} />
            Export JSON
          </button>
          <button
            type="button"
            className="run-action"
            title="Run mock flow"
            onClick={handleRunFlow}
            disabled={isRunActive}
          >
            <Play aria-hidden="true" size={16} />
            {isRunActive ? "Running" : "Run"}
          </button>
        </nav>
      </header>

      <aside className="node-library" aria-label="Node library">
        <div className="pane-title">
          <Library aria-hidden="true" size={16} />
          <span>Node Library</span>
        </div>

        <div className="node-list">
          {MVP_NODE_CATALOG.map((node) => {
            const Icon = nodeIcons[node.type];

            return (
              <button
                key={node.type}
                className={`node-list-item role-${node.role}`}
                type="button"
                onClick={() => addNode(node.type)}
              >
                <Icon aria-hidden="true" size={18} />
                <span>
                  <strong>{node.label}</strong>
                  <small>
                    {node.type} / {roleLabels[node.role]}
                  </small>
                </span>
                <Plus aria-hidden="true" className="node-add-icon" size={16} />
              </button>
            );
          })}
        </div>
      </aside>

      <main className="canvas-pane" aria-label="Flow canvas">
        <ReactFlow
          nodes={canvasNodes}
          edges={canvasEdges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onNodeClick={(_, node) => selectNode(node.id)}
          onPaneClick={() => selectNode(null)}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          minZoom={0.45}
          maxZoom={1.5}
        >
          <Background color="#34312d" gap={18} size={1} />
          <Controls position="bottom-left" />
          <MiniMap pannable zoomable />
        </ReactFlow>

        {isExportOpen ? (
          <aside className="export-panel" aria-label="Flow JSON export">
            <div className="export-panel-header">
              <div>
                <strong>Flow JSON</strong>
                <span>{flow.nodes.length} nodes</span>
              </div>
              <button type="button" title="Close JSON export" onClick={closeExport}>
                <X aria-hidden="true" size={16} />
              </button>
            </div>
            <pre>{flowJson}</pre>
          </aside>
        ) : null}
      </main>

      <aside className="inspector-pane" aria-label="Inspector">
        <div className="pane-title">
          <ClipboardList aria-hidden="true" size={16} />
          <span>Inspector</span>
        </div>

        {selectedNode === null ? (
          <section className="inspector-empty">
            <strong>No Node Selected</strong>
            <span>Select a node on the canvas to edit its configuration.</span>
          </section>
        ) : (
          <div className="inspector-scroll">
            <section className="inspector-card">
              <h2>Node</h2>
              <div className="field-stack">
                <label className="field-control">
                  <span>Label</span>
                  <input value={selectedNode.label} onChange={handleLabelChange} />
                </label>
                <div className="readonly-grid">
                  <span>Type</span>
                  <code title={selectedNode.type}>{selectedNode.type}</code>
                  <span>Role</span>
                  <code title={selectedNode.role}>{roleLabels[selectedNode.role]}</code>
                  <span>Status</span>
                  <code title={nodeStatuses[selectedNode.id] ?? "idle"}>
                    {nodeStatuses[selectedNode.id] ?? "idle"}
                  </code>
                </div>
              </div>
            </section>

            <section className="inspector-card">
              <h2>Runtime</h2>
              <label className="field-control">
                <span>Runtime Ref</span>
                <input value={selectedNode.runtimeRef ?? ""} onChange={handleRuntimeChange} />
              </label>
            </section>

            <section className="inspector-card">
              <h2>Policies</h2>
              <div className="field-stack">
                <label className="field-control">
                  <span>Thinking Level</span>
                  <select value={selectedNode.budgetPolicy.thinking} onChange={handleThinkingChange}>
                    {thinkingLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-control">
                  <span>Risk Level</span>
                  <select value={selectedNode.riskPolicy.level} onChange={handleRiskChange}>
                    {riskLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          </div>
        )}
      </aside>

      <section className="run-inspector" aria-label="Run inspector">
        <div className="pane-title run-title">
          <span>
            <Braces aria-hidden="true" size={16} />
            Run Inspector
          </span>
          <strong className={`run-status run-status-${runStatus}`}>{runStatus}</strong>
        </div>

        {runEvents.length === 0 ? (
          <div className="run-empty-layout">
            <section>
              <h3>Logs</h3>
              <p>No run logs yet.</p>
            </section>
            <section>
              <h3>Node IO</h3>
              <p>No node input or output captured.</p>
            </section>
            <section>
              <h3>Events</h3>
              <p>No RunEvent stream has started.</p>
            </section>
          </div>
        ) : (
          <div className="run-event-table" role="table" aria-label="Run events">
            <div className="run-event-row run-event-head" role="row">
              <span role="columnheader">Time</span>
              <span role="columnheader">Event</span>
              <span role="columnheader">Node</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Message</span>
              <span role="columnheader">Payload</span>
            </div>

            {runEvents.map((event) => (
              <div className="run-event-row" role="row" key={event.id}>
                <span role="cell">{formatTimestamp(event.timestamp)}</span>
                <code role="cell">{event.type}</code>
                <code role="cell">{event.nodeId ?? "-"}</code>
                <span role="cell" className={`status-text status-text-${event.status}`}>
                  {event.status}
                </span>
                <span role="cell" title={event.message}>
                  {event.message}
                </span>
                <code role="cell" title={summarizePayload(event.payload, 600)}>
                  {summarizePayload(event.payload, 120)}
                </code>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function createWebSocketUrl(wsUrl: string): string {
  const gatewayUrl = new URL(GATEWAY_HTTP_URL);
  const protocol = gatewayUrl.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${gatewayUrl.host}${wsUrl}`;
}

function parseSocketPayload(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function isRunEvent(value: unknown): value is RunEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RunEvent>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.runId === "string" &&
    typeof candidate.flowId === "string" &&
    typeof candidate.type === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.sequence === "number" &&
    typeof candidate.timestamp === "string"
  );
}

function extractSocketError(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return "WebSocket received an unreadable message.";
  }

  const candidate = value as ErrorResponse;

  return candidate.error?.message ?? null;
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

function formatRunStatus(status: string, runId: string | null): string {
  if (runId === null) {
    return `Run: ${status}`;
  }

  return `Run: ${status} / ${runId}`;
}

function summarizePayload(payload: Record<string, unknown> | undefined, maxLength: number): string {
  if (payload === undefined) {
    return "-";
  }

  const serialized = JSON.stringify(payload);

  if (serialized.length <= maxLength) {
    return serialized;
  }

  return `${serialized.slice(0, maxLength - 1)}...`;
}
