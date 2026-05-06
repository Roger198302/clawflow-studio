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
import type {
  BudgetPolicy,
  FlowNode,
  FlowSpec,
  NodeRole,
  NodeType,
  RiskPolicy,
  RunEvent,
  RunStatus,
  RuntimeSpec
} from "@clawflow/protocol";
import {
  Braces,
  CircleStop,
  ClipboardList,
  Library,
  MousePointer2,
  Play,
  Plus,
  RotateCcw,
  Save,
  Server,
  SquareTerminal,
  Workflow,
  X,
  type LucideIcon
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, type ChangeEvent, type ReactElement } from "react";
import { ClawFlowNode, type ClawFlowNodeData } from "./components/ClawFlowNode";
import { DismissibleAlert } from "./components/DismissibleAlert";
import { RuntimeManagerPanel } from "./components/RuntimeManagerPanel";
import { MVP_NODE_CATALOG } from "./flowCatalog";
import { useFlowStore, type RunProblemInput } from "./store/flowStore";
import { useRuntimeStore } from "./store/runtimeStore";

const GATEWAY_HTTP_URL = import.meta.env.VITE_GATEWAY_HTTP_URL ?? "http://localhost:8787";
const STREAM_FIRST_EVENT_TIMEOUT_MS = 5_000;

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

interface NodeIoView {
  title: string;
  inputEvent: RunEvent | null;
  outputEvent: RunEvent | null;
  emptyMessage: string;
}

interface RunSummary {
  runId: string;
  status: RunStatus;
  eventCount: number;
  succeededNodeCount: number;
  failedNodeCount: number;
  durationLabel: string;
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
  const runLogs = useFlowStore((state) => state.runLogs);
  const selectedRunEventId = useFlowStore((state) => state.selectedRunEventId);
  const runStatus = useFlowStore((state) => state.runStatus);
  const runError = useFlowStore((state) => state.runError);
  const runWarning = useFlowStore((state) => state.runWarning);
  const runAlert = useFlowStore((state) => state.runAlert);
  const runStartedAt = useFlowStore((state) => state.runStartedAt);
  const runCompletedAt = useFlowStore((state) => state.runCompletedAt);
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
  const selectRunEvent = useFlowStore((state) => state.selectRunEvent);
  const reportRunError = useFlowStore((state) => state.reportRunError);
  const reportRunWarning = useFlowStore((state) => state.reportRunWarning);
  const dismissRunAlert = useFlowStore((state) => state.dismissRunAlert);
  const clearRun = useFlowStore((state) => state.clearRun);
  const runtimes = useRuntimeStore((state) => state.runtimes);
  const runtimeLoadStatus = useRuntimeStore((state) => state.runtimeLoadStatus);
  const runtimeError = useRuntimeStore((state) => state.runtimeError);
  const isRuntimeManagerOpen = useRuntimeStore((state) => state.isRuntimeManagerOpen);
  const openRuntimeManager = useRuntimeStore((state) => state.openRuntimeManager);
  const closeRuntimeManager = useRuntimeStore((state) => state.closeRuntimeManager);
  const loadRuntimes = useRuntimeStore((state) => state.loadRuntimes);
  const healthCheckAll = useRuntimeStore((state) => state.healthCheckAll);

  useEffect(() => {
    void loadRuntimes();
  }, [loadRuntimes]);

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
          runtimeRef: node.runtimeRef ?? "mock-local",
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
  const topStatusSeverity = runError !== null ? "error" : runWarning !== null ? "warning" : runStatus;
  const topStatusMessage = runError ?? runWarning ?? saveNotice ?? formatRunStatus(runStatus, currentRunId);
  const runSummary = useMemo<RunSummary>(
    () => createRunSummary(currentRunId, runStatus, runEvents, nodeStatuses, runStartedAt, runCompletedAt),
    [currentRunId, nodeStatuses, runCompletedAt, runEvents, runStartedAt, runStatus]
  );
  const nodeIoView = useMemo<NodeIoView>(
    () => createNodeIoView(runEvents, selectedNodeId, selectedNode),
    [runEvents, selectedNode, selectedNodeId]
  );
  const selectedRunEvent = useMemo(
    () => runEvents.find((event) => event.id === selectedRunEventId) ?? null,
    [runEvents, selectedRunEventId]
  );
  const runtimeOptions = useMemo(
    () => createRuntimeOptions(runtimes, selectedNode?.runtimeRef),
    [runtimes, selectedNode?.runtimeRef]
  );

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

  const handleRefreshRuntimes = useCallback(() => {
    void loadRuntimes();
  }, [loadRuntimes]);

  const handleRuntimeHealthCheck = useCallback(() => {
    void healthCheckAll();
  }, [healthCheckAll]);

  const closeActiveSocket = useCallback(() => {
    if (activeSocketRef.current !== null) {
      const socketToClose = activeSocketRef.current;
      activeSocketRef.current = null;
      socketToClose.close();
    }
  }, []);

  const handleRunFlow = useCallback(async () => {
    closeActiveSocket();

    const availableRuntimes = await ensureRuntimeListForRun(runtimes, loadRuntimes);
    const runtimeValidationProblem = validateRuntimeRefsForRun(
      flow,
      availableRuntimes.runtimes,
      availableRuntimes.error
    );

    if (runtimeValidationProblem !== null) {
      clearRun();
      reportRunError(runtimeValidationProblem);
      return;
    }

    const validationProblem = validateFlowForRun(flow);

    if (validationProblem !== null) {
      clearRun();
      reportRunError(validationProblem);
      return;
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
        reportRunError(createGatewayRejectedProblem(response.status, body.error?.message));
        return;
      }

      if (typeof body.runId !== "string" || typeof body.wsUrl !== "string") {
        reportRunError({
          title: "Gateway response invalid",
          message: "Gateway accepted the run but did not return a valid runId or WebSocket URL.",
          suggestion: "Restart the local gateway, then run the flow again.",
          source: "gateway"
        });
        return;
      }

      acceptRunCreated(body.runId);

      const socket = new WebSocket(createWebSocketUrl(body.wsUrl));
      activeSocketRef.current = socket;
      let streamIssueReported = false;
      let hasReceivedEvent = false;

      const streamTimeout = window.setTimeout(() => {
        if (
          activeSocketRef.current === socket &&
          !hasReceivedEvent &&
          !isTerminalRunStatus(useFlowStore.getState().runStatus)
        ) {
          reportStreamIssue();
        }
      }, STREAM_FIRST_EVENT_TIMEOUT_MS);

      const reportStreamIssue = (): void => {
        if (streamIssueReported || isTerminalRunStatus(useFlowStore.getState().runStatus)) {
          return;
        }

        streamIssueReported = true;
        reportRunWarning({
          title: "RunEvent stream interrupted",
          message: "RunEvent stream disconnected before the run completed.",
          suggestion: "Check whether the gateway is still running, then run the flow again.",
          source: "websocket",
          severity: "warning"
        });
      };

      socket.onmessage = (messageEvent: MessageEvent<string>) => {
        hasReceivedEvent = true;
        window.clearTimeout(streamTimeout);
        const payload = parseSocketPayload(messageEvent.data);

        if (isRunEvent(payload)) {
          appendRunEvent(payload);

          if (payload.type === "run.completed" || payload.type === "run.failed") {
            activeSocketRef.current = null;
            socket.close();
          }

          return;
        }

        const errorMessage = extractSocketError(payload);

        if (errorMessage !== null) {
          reportRunError({
            title: "RunEvent stream error",
            message: errorMessage,
            suggestion: "Check the gateway runId and run the flow again.",
            source: "websocket"
          });
        }
      };

      socket.onerror = () => {
        window.clearTimeout(streamTimeout);

        if (activeSocketRef.current === socket) {
          reportStreamIssue();
        }
      };

      socket.onclose = () => {
        window.clearTimeout(streamTimeout);

        if (activeSocketRef.current === socket) {
          reportStreamIssue();
          activeSocketRef.current = null;
        }
      };
    } catch (error: unknown) {
      reportRunError(createGatewayUnavailableProblem(error));
    }
  }, [
    acceptRunCreated,
    appendRunEvent,
    clearRun,
    closeActiveSocket,
    flow,
    loadRuntimes,
    prepareRun,
    reportRunError,
    reportRunWarning,
    runtimes
  ]);

  const handleClearRun = useCallback(() => {
    closeActiveSocket();
    clearRun();
  }, [clearRun, closeActiveSocket]);

  const handleLabelChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (selectedNode !== null) {
        updateNode(selectedNode.id, { label: event.target.value });
      }
    },
    [selectedNode, updateNode]
  );

  const handleRuntimeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
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

        <div className={`top-status top-status-${topStatusSeverity}`} aria-live="polite">
          {topStatusMessage}
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
          <button type="button" title="Open Runtime Manager" onClick={openRuntimeManager}>
            <Server aria-hidden="true" size={16} />
            Runtimes
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

      {runAlert !== null ? (
        <DismissibleAlert
          severity={runAlert.severity}
          title={runAlert.title}
          message={runAlert.message}
          suggestion={runAlert.suggestion}
          onClose={dismissRunAlert}
        />
      ) : null}

      {isRuntimeManagerOpen ? (
        <RuntimeManagerPanel
          runtimes={runtimes}
          isLoading={runtimeLoadStatus === "loading"}
          error={runtimeError}
          onClose={closeRuntimeManager}
          onRefresh={handleRefreshRuntimes}
          onHealthCheck={handleRuntimeHealthCheck}
        />
      ) : null}

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
                <select
                  value={selectedNode.runtimeRef ?? ""}
                  onChange={handleRuntimeChange}
                  disabled={runtimeLoadStatus === "loading" && runtimeOptions.length === 0}
                >
                  {selectedNode.role === "trigger" ? <option value="">No runtime</option> : null}
                  {runtimeOptions.map((runtime) => (
                    <option key={runtime.id} value={runtime.id}>
                      {runtime.name} / {runtime.id} / {runtime.status}
                    </option>
                  ))}
                </select>
              </label>
              <div className="runtime-select-summary">
                {runtimeError !== null ? (
                  <span className="field-error-text">{runtimeError}</span>
                ) : (
                  <span>
                    {formatRuntimeSelection(selectedNode.runtimeRef, runtimes) ??
                      "Runtime registry has not loaded yet."}
                  </span>
                )}
              </div>
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
          <div className="run-summary" aria-label="Run summary">
            <strong className={`run-status run-status-${runSummary.status}`}>{runSummary.status}</strong>
            <code title={runSummary.runId}>{runSummary.runId}</code>
            <span>{runSummary.eventCount} events</span>
            <span>{runSummary.succeededNodeCount} success</span>
            <span>{runSummary.failedNodeCount} failed</span>
            <span>{runSummary.durationLabel}</span>
          </div>
          <button type="button" className="clear-run-button" onClick={handleClearRun}>
            <RotateCcw aria-hidden="true" size={14} />
            Clear Logs
          </button>
        </div>

        <div className="run-inspector-grid">
          <section className="run-panel run-logs-panel" aria-label="Logs">
            <div className="run-panel-title">
              <h3>Logs</h3>
              <span>{runLogs.length}</span>
            </div>

            {runLogs.length === 0 ? (
              <p className="run-empty-text">No run logs yet.</p>
            ) : (
              <div className="run-log-list">
                {runLogs.map((log) => (
                  <article className={`run-log-row log-${log.level}`} key={log.id}>
                    <time>{formatTimestamp(log.timestamp)}</time>
                    <strong>{log.level}</strong>
                    <span title={log.message}>{log.message}</span>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="run-panel run-node-io-panel" aria-label="Node IO">
            <div className="run-panel-title">
              <h3>Node IO</h3>
              <span>{nodeIoView.title}</span>
            </div>

            {nodeIoView.inputEvent === null && nodeIoView.outputEvent === null ? (
              <p className="run-empty-text">{nodeIoView.emptyMessage}</p>
            ) : (
              <div className="node-io-content">
                <NodeIoBlock title="Input" event={nodeIoView.inputEvent} />
                <NodeIoBlock title="Output" event={nodeIoView.outputEvent} />
              </div>
            )}
          </section>

          <section className="run-panel run-events-panel" aria-label="Events">
            <div className="run-panel-title">
              <h3>Events</h3>
              <span>{runEvents.length}</span>
            </div>

            {runEvents.length === 0 ? (
              <p className="run-empty-text">No RunEvent stream has started.</p>
            ) : (
              <div className="event-workspace">
                <div className="event-list" role="list">
                  {runEvents.map((event) => {
                    const isRelated = selectedNodeId !== null && event.nodeId === selectedNodeId;
                    const isSelected = event.id === selectedRunEventId;

                    return (
                      <button
                        className={`event-row ${isSelected ? "is-selected" : ""} ${
                          isRelated ? "is-related" : ""
                        }`}
                        type="button"
                        key={event.id}
                        onClick={() => selectRunEvent(event.id)}
                      >
                        <code>#{event.sequence}</code>
                        <code>{event.type}</code>
                        <code>{event.nodeId ?? "-"}</code>
                        <span className={`status-text status-text-${event.status}`}>{event.status}</span>
                        <span title={event.message}>{event.message}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="event-payload-detail">
                  {selectedRunEvent === null ? (
                    <p className="run-empty-text">Select an event to inspect its payload.</p>
                  ) : (
                    <>
                      <div className="event-detail-header">
                        <strong>{selectedRunEvent.type}</strong>
                        <span>{formatTimestamp(selectedRunEvent.timestamp)}</span>
                      </div>
                      <pre>{prettyJson(selectedRunEvent.payload ?? {})}</pre>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function NodeIoBlock({
  title,
  event
}: {
  title: "Input" | "Output";
  event: RunEvent | null;
}): ReactElement {
  if (event === null) {
    return (
      <section className="io-block io-empty">
        <h4>{title}</h4>
        <p>No {title.toLowerCase()} captured.</p>
      </section>
    );
  }

  return (
    <section className="io-block">
      <div>
        <h4>{title}</h4>
        <span>
          {event.nodeId ?? "-"} / {formatTimestamp(event.timestamp)}
        </span>
      </div>
      <pre>{prettyJson(event.payload ?? {})}</pre>
    </section>
  );
}

function createWebSocketUrl(wsUrl: string): string {
  if (wsUrl.startsWith("ws://") || wsUrl.startsWith("wss://")) {
    return wsUrl;
  }

  const gatewayUrl = new URL(GATEWAY_HTTP_URL);
  const protocol = gatewayUrl.protocol === "https:" ? "wss:" : "ws:";

  if (wsUrl.startsWith("http://") || wsUrl.startsWith("https://")) {
    const parsedUrl = new URL(wsUrl);
    const parsedProtocol = parsedUrl.protocol === "https:" ? "wss:" : "ws:";
    return `${parsedProtocol}//${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;
  }

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

async function ensureRuntimeListForRun(
  runtimes: RuntimeSpec[],
  loadRuntimes: () => Promise<RuntimeSpec[]>
): Promise<{ runtimes: RuntimeSpec[]; error: string | null }> {
  if (runtimes.length > 0) {
    return { runtimes, error: null };
  }

  const loadedRuntimes = await loadRuntimes();

  if (loadedRuntimes.length > 0) {
    return { runtimes: loadedRuntimes, error: null };
  }

  return {
    runtimes: [],
    error:
      useRuntimeStore.getState().runtimeError ??
      "Runtime registry is empty. Please make sure pnpm dev:gateway is running."
  };
}

function validateRuntimeRefsForRun(
  flow: FlowSpec,
  runtimes: RuntimeSpec[],
  runtimeError: string | null
): RunProblemInput | null {
  if (runtimeError !== null && runtimes.length === 0) {
    return {
      title: "Gateway unavailable",
      message: runtimeError,
      suggestion: "Please start the local gateway with pnpm dev:gateway and try again.",
      source: "gateway"
    };
  }

  if (runtimes.length === 0) {
    return {
      title: "Runtime registry unavailable",
      message: "No Runtime registry entries are available for validation.",
      suggestion: "Open Runtime Manager, refresh runtimes, then run the flow again.",
      source: "runtime-validation"
    };
  }

  const runtimesById = new Map(runtimes.map((runtime) => [runtime.id, runtime]));
  const executableNodes = flow.nodes.filter(requiresRuntimeForMvpRun);

  for (const node of executableNodes) {
    const runtimeRef = node.runtimeRef?.trim();

    if (runtimeRef === undefined || runtimeRef === "") {
      return {
        title: "Runtime selection required",
        message: `Node "${node.label}" does not have a Runtime selected.`,
        suggestion: "Select mock-local in the node Inspector before running the flow.",
        source: "runtime-validation"
      };
    }

    if (!runtimesById.has(runtimeRef)) {
      return {
        title: "Runtime not found",
        message: `Runtime ${runtimeRef} is not registered in the current Runtime Manager.`,
        suggestion: "Refresh Runtime Manager, then select an available Runtime.",
        source: "runtime-validation"
      };
    }

    if (runtimeRef !== "mock-local") {
      return {
        title: "Runtime not enabled in MVP",
        message: `Runtime ${runtimeRef} is registered but execution is not enabled in MVP.`,
        suggestion: "Select mock-local for agent, tool, and output nodes to run this MVP flow.",
        source: "runtime-validation"
      };
    }
  }

  return null;
}

function requiresRuntimeForMvpRun(node: FlowNode): boolean {
  if (node.role === "trigger") {
    return false;
  }

  return (
    node.role === "start" ||
    node.role === "process" ||
    node.role === "end" ||
    node.role === "tool" ||
    node.role === "output" ||
    node.type.startsWith("agent.") ||
    node.type.startsWith("output.")
  );
}

function validateFlowForRun(flow: FlowSpec): RunProblemInput | null {
  if (flow.nodes.length === 0) {
    return createFlowValidationProblem(
      "The current flow does not contain any nodes.",
      "Add a Manual Trigger, connect it to the workflow, and make sure the flow ends with an Output node."
    );
  }

  const triggerNodes = flow.nodes.filter((node) => node.role === "trigger");
  const outputNodes = flow.nodes.filter((node) => node.role === "output");

  if (triggerNodes.length === 0 || outputNodes.length === 0) {
    return createFlowValidationProblem(
      "The current flow is missing a required Trigger or Output node.",
      "Add a Manual Trigger, connect it to the workflow, and make sure the flow ends with an Output node."
    );
  }

  if (flow.edges.length === 0) {
    return createFlowValidationProblem(
      "The current flow has no executable path because it does not contain any edges.",
      "Connect the Manual Trigger to the next node, then connect the workflow to an Output node."
    );
  }

  if (!hasReachableOutput(flow, triggerNodes, outputNodes)) {
    return createFlowValidationProblem(
      "The current flow has no executable path from a Trigger node to an Output node.",
      "Connect the Manual Trigger through the workflow and end at a Console Output node."
    );
  }

  return null;
}

function createFlowValidationProblem(message: string, suggestion: string): RunProblemInput {
  return {
    title: "Flow validation failed",
    message,
    suggestion,
    source: "flow-validation"
  };
}

function hasReachableOutput(
  flow: FlowSpec,
  triggerNodes: FlowNode[],
  outputNodes: FlowNode[]
): boolean {
  const outputIds = new Set(outputNodes.map((node) => node.id));
  const outgoingEdges = new Map<string, string[]>();

  for (const edge of flow.edges) {
    const targets = outgoingEdges.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoingEdges.set(edge.source, targets);
  }

  const queue = triggerNodes.map((node) => node.id);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (nodeId === undefined || visited.has(nodeId)) {
      continue;
    }

    if (outputIds.has(nodeId)) {
      return true;
    }

    visited.add(nodeId);
    queue.push(...(outgoingEdges.get(nodeId) ?? []));
  }

  return false;
}

function createGatewayUnavailableProblem(error: unknown): RunProblemInput {
  const rawMessage = error instanceof Error ? error.message : "Unable to connect to the gateway.";
  const isFetchFailure = rawMessage === "Failed to fetch" || rawMessage.includes("fetch");
  const message = isFetchFailure
    ? `Gateway unavailable: unable to connect to ${GATEWAY_HTTP_URL}. Please make sure pnpm dev:gateway is running.`
    : `Gateway unavailable: ${rawMessage}`;

  return {
    title: "Gateway unavailable",
    message,
    suggestion: "Please start the local gateway with pnpm dev:gateway and try again.",
    source: "gateway"
  };
}

function createGatewayRejectedProblem(status: number, message: string | undefined): RunProblemInput {
  return {
    title: "Gateway rejected the run",
    message: message ?? `Gateway returned HTTP ${status} while creating the run.`,
    suggestion: "Review the flow, make sure the local gateway is healthy, then run again.",
    source: "gateway"
  };
}

function isTerminalRunStatus(status: RunStatus): boolean {
  return status === "success" || status === "failed" || status === "cancelled" || status === "skipped";
}

function createRunSummary(
  runId: string | null,
  runStatus: RunStatus,
  runEvents: RunEvent[],
  nodeStatuses: Record<string, RunStatus>,
  startedAt: string | null,
  completedAt: string | null
): RunSummary {
  const succeededNodeCount = Object.values(nodeStatuses).filter((status) => status === "success").length;
  const failedNodeCount = Object.values(nodeStatuses).filter((status) => status === "failed").length;
  const durationLabel =
    startedAt === null
      ? "duration -"
      : `duration ${formatDurationMs(
          new Date(completedAt ?? new Date().toISOString()).getTime() - new Date(startedAt).getTime()
        )}`;

  return {
    runId: runId ?? "no run",
    status: runStatus,
    eventCount: runEvents.length,
    succeededNodeCount,
    failedNodeCount,
    durationLabel
  };
}

function createNodeIoView(
  runEvents: RunEvent[],
  selectedNodeId: string | null,
  selectedNode: FlowNode | null
): NodeIoView {
  const ioEvents = runEvents.filter((event) => event.type === "node.input" || event.type === "node.output");
  const scopedEvents =
    selectedNodeId === null ? ioEvents : ioEvents.filter((event) => event.nodeId === selectedNodeId);
  const latestInput = findLatestEvent(scopedEvents, "node.input");
  const latestOutput = findLatestEvent(scopedEvents, "node.output");

  if (selectedNodeId !== null && latestInput === null && latestOutput === null) {
    return {
      title: selectedNode?.label ?? selectedNodeId,
      inputEvent: null,
      outputEvent: null,
      emptyMessage: "No input or output has been captured for the selected node."
    };
  }

  return {
    title: selectedNodeId === null ? "Latest global IO" : selectedNode?.label ?? selectedNodeId,
    inputEvent: latestInput,
    outputEvent: latestOutput,
    emptyMessage: "No node input or output captured."
  };
}

function findLatestEvent(runEvents: RunEvent[], type: RunEvent["type"]): RunEvent | null {
  for (let index = runEvents.length - 1; index >= 0; index -= 1) {
    const event = runEvents[index];

    if (event.type === type) {
      return event;
    }
  }

  return null;
}

function createRuntimeOptions(runtimes: RuntimeSpec[], currentRuntimeRef: string | undefined): RuntimeSpec[] {
  if (
    currentRuntimeRef === undefined ||
    currentRuntimeRef === "" ||
    runtimes.some((runtime) => runtime.id === currentRuntimeRef)
  ) {
    return runtimes;
  }

  return [
    ...runtimes,
    {
      id: currentRuntimeRef,
      name: `${currentRuntimeRef} (not loaded)`,
      type: "custom",
      status: "unknown",
      capabilities: [],
      errorMessage: "Runtime is not present in the loaded registry."
    }
  ];
}

function formatRuntimeSelection(runtimeRef: string | undefined, runtimes: RuntimeSpec[]): string | null {
  if (runtimeRef === undefined || runtimeRef === "") {
    return "No Runtime selected for this node.";
  }

  const runtime = runtimes.find((candidate) => candidate.id === runtimeRef);

  if (runtime === undefined) {
    return `Selected Runtime: ${runtimeRef}. Runtime details are not loaded.`;
  }

  return `Selected Runtime: ${runtime.name} / ${runtime.type} / ${runtime.status}`;
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}

function formatDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "-";
  }

  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1_000).toFixed(1)}s`;
}

function formatRunStatus(status: string, runId: string | null): string {
  if (runId === null) {
    return `Run: ${status}`;
  }

  return `Run: ${status} / ${runId}`;
}

function prettyJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2);
}
