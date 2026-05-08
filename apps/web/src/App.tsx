import {
  Background,
  Controls,
  ConnectionMode,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange
} from "@xyflow/react";
import type {
  BudgetPolicy,
  CapabilityProvider,
  EstimateRange,
  FlowExecutionContractPreview,
  FlowEstimate,
  ExecutionPlanStepStatus,
  FlowNode,
  FlowSpec,
  LinearExecutionPlan,
  LinearExecutionPlanStep,
  NodeCategory,
  NodeExecutionContract,
  NodeExecutionMode,
  NodeEstimate,
  NodeHarnessRef,
  NodeRole,
  NodeType,
  RiskPolicy,
  RunEvent,
  RunReadinessIssue,
  RunReadinessReport,
  RunReadinessStatus,
  RunStatus,
  RuntimeSpec
} from "@clawflow/protocol";
import {
  evaluateHarnessCompatibility,
  getHarnessProfile
} from "@clawflow/runtime-registry/harnesses";
import {
  Braces,
  CircleStop,
  ClipboardList,
  Languages,
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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement
} from "react";
import { ClawFlowNode, type ClawFlowNodeData } from "./components/ClawFlowNode";
import { DismissibleAlert } from "./components/DismissibleAlert";
import { ExecutionContractPreviewPanel } from "./components/ExecutionContractPreviewPanel";
import { HarnessInspector } from "./components/HarnessInspector";
import { LinearExecutionPlanPanel } from "./components/LinearExecutionPlanPanel";
import { ResourceEstimatePanel } from "./components/ResourceEstimatePanel";
import { RuntimeManagerPanel } from "./components/RuntimeManagerPanel";
import { SessionConsole } from "./components/SessionConsole";
import { getCatalogDescription, getCatalogLabel, MVP_NODE_CATALOG } from "./flowCatalog";
import {
  formatHarnessExecutionMode,
  formatHarnessFit,
  formatHarnessLabel,
  formatHarnessRisk
} from "./harnessUi";
import { t, type I18nKey, type Locale } from "./i18n";
import { useFlowStore, type RunProblemInput } from "./store/flowStore";
import { useLocaleStore } from "./store/localeStore";
import { useRuntimeStore } from "./store/runtimeStore";
import { useSessionStore } from "./store/sessionStore";

const GATEWAY_HTTP_URL = import.meta.env.VITE_GATEWAY_HTTP_URL ?? "http://localhost:8787";
const STREAM_FIRST_EVENT_TIMEOUT_MS = 5_000;

const nodeTypes = {
  clawflowNode: ClawFlowNode
};

const DEFAULT_SOURCE_HANDLE = "out";
const DEFAULT_TARGET_HANDLE = "in";
const PREVIEW_REFRESH_DEBOUNCE_MS = 220;
const WORKSPACE_VIEW_MODE_STORAGE_KEY = "clawflow.workspaceViewMode";
const workspaceViewModes = ["default", "focus", "run-monitor", "debug"] as const;
type WorkspaceViewMode = (typeof workspaceViewModes)[number];

const workspaceViewModeLabelKeys: Record<WorkspaceViewMode, I18nKey> = {
  default: "workspaceView.default",
  focus: "workspaceView.focus",
  "run-monitor": "workspaceView.runMonitor",
  debug: "workspaceView.debug"
};

const nodeIcons: Record<NodeType, LucideIcon> = {
  "manual.trigger": MousePointer2,
  "agent.start": Play,
  "agent.worker": Workflow,
  "agent.end": CircleStop,
  "output.console": SquareTerminal
};

const roleLabelKeys: Record<NodeRole, I18nKey> = {
  trigger: "role.trigger",
  start: "role.start",
  process: "role.process",
  end: "role.end",
  tool: "role.tool",
  control: "role.control",
  output: "role.output",
  safety: "role.safety",
  memory: "role.memory"
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

interface WorkspaceVisibility {
  nodeLibrary: boolean;
  sessionConsole: boolean;
  contractPreview: boolean;
  linearPlan: boolean;
  resourceEstimate: boolean;
  inspector: boolean;
  runInspector: boolean;
}

function isWorkspaceViewMode(value: string | null): value is WorkspaceViewMode {
  return workspaceViewModes.some((mode) => mode === value);
}

function loadStoredWorkspaceViewMode(): WorkspaceViewMode {
  const storedValue = window.localStorage.getItem(WORKSPACE_VIEW_MODE_STORAGE_KEY);

  return isWorkspaceViewMode(storedValue) ? storedValue : "default";
}

function storeWorkspaceViewMode(mode: WorkspaceViewMode): void {
  window.localStorage.setItem(WORKSPACE_VIEW_MODE_STORAGE_KEY, mode);
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

function createWorkspaceVisibility(mode: WorkspaceViewMode): WorkspaceVisibility {
  switch (mode) {
    case "focus":
      return {
        nodeLibrary: false,
        sessionConsole: false,
        contractPreview: false,
        linearPlan: false,
        resourceEstimate: false,
        inspector: false,
        runInspector: false
      };
    case "run-monitor":
      return {
        nodeLibrary: false,
        sessionConsole: true,
        contractPreview: false,
        linearPlan: false,
        resourceEstimate: false,
        inspector: false,
        runInspector: true
      };
    case "debug":
      return {
        nodeLibrary: false,
        sessionConsole: true,
        contractPreview: true,
        linearPlan: false,
        resourceEstimate: false,
        inspector: true,
        runInspector: false
      };
    case "default":
      return {
        nodeLibrary: true,
        sessionConsole: true,
        contractPreview: true,
        linearPlan: true,
        resourceEstimate: true,
        inspector: true,
        runInspector: true
      };
  }
}

export function App(): ReactElement {
  const activeSocketRef = useRef<WebSocket | null>(null);
  const [workspaceViewMode, setWorkspaceViewModeState] = useState<WorkspaceViewMode>(
    loadStoredWorkspaceViewMode
  );
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const flow = useFlowStore((state) => state.flow);
  const diagnosticsFlowRef = useRef(flow);
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
  const executionContractPreview = useFlowStore((state) => state.executionContractPreview);
  const executionContractPreviewLoading = useFlowStore(
    (state) => state.executionContractPreviewLoading
  );
  const executionContractPreviewError = useFlowStore(
    (state) => state.executionContractPreviewError
  );
  const linearExecutionPlan = useFlowStore((state) => state.linearExecutionPlan);
  const linearExecutionPlanLoading = useFlowStore((state) => state.linearExecutionPlanLoading);
  const linearExecutionPlanError = useFlowStore((state) => state.linearExecutionPlanError);
  const flowEstimate = useFlowStore((state) => state.flowEstimate);
  const flowEstimateLoading = useFlowStore((state) => state.flowEstimateLoading);
  const flowEstimateError = useFlowStore((state) => state.flowEstimateError);
  const runReadinessReport = useFlowStore((state) => state.runReadinessReport);
  const runReadinessLoading = useFlowStore((state) => state.runReadinessLoading);
  const runReadinessError = useFlowStore((state) => state.runReadinessError);
  const livePlanStepStatuses = useFlowStore((state) => state.livePlanStepStatuses);
  const selectNode = useFlowStore((state) => state.selectNode);
  const addNode = useFlowStore((state) => state.addNode);
  const addEdge = useFlowStore((state) => state.addEdge);
  const removeEdges = useFlowStore((state) => state.removeEdges);
  const reconnectEdge = useFlowStore((state) => state.reconnectEdge);
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
  const requestExecutionContractPreview = useFlowStore(
    (state) => state.requestExecutionContractPreview
  );
  const requestLinearExecutionPlan = useFlowStore((state) => state.requestLinearExecutionPlan);
  const requestFlowEstimate = useFlowStore((state) => state.requestFlowEstimate);
  const requestRunReadinessReport = useFlowStore((state) => state.requestRunReadinessReport);
  const clearRun = useFlowStore((state) => state.clearRun);
  const runtimes = useRuntimeStore((state) => state.runtimes);
  const runtimeHealth = useRuntimeStore((state) => state.runtimeHealth);
  const runtimeLoadStatus = useRuntimeStore((state) => state.runtimeLoadStatus);
  const runtimeError = useRuntimeStore((state) => state.runtimeError);
  const isRuntimeManagerOpen = useRuntimeStore((state) => state.isRuntimeManagerOpen);
  const openRuntimeManager = useRuntimeStore((state) => state.openRuntimeManager);
  const closeRuntimeManager = useRuntimeStore((state) => state.closeRuntimeManager);
  const loadRuntimes = useRuntimeStore((state) => state.loadRuntimes);
  const healthCheckAll = useRuntimeStore((state) => state.healthCheckAll);
  const loadSession = useSessionStore((state) => state.loadSession);
  const runActiveSession = useSessionStore((state) => state.runActiveSession);

  useEffect(() => {
    void loadRuntimes();
  }, [loadRuntimes]);

  useEffect(() => {
    diagnosticsFlowRef.current = flow;
  }, [flow]);

  const flowDiagnosticsKey = useMemo(() => createFlowDiagnosticsKey(flow), [flow]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const latestFlow = diagnosticsFlowRef.current;
      void requestExecutionContractPreview(latestFlow);
      void requestLinearExecutionPlan(latestFlow);
      void requestFlowEstimate(latestFlow);
      void requestRunReadinessReport(latestFlow);
    }, PREVIEW_REFRESH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [
    flowDiagnosticsKey,
    requestExecutionContractPreview,
    requestFlowEstimate,
    requestLinearExecutionPlan,
    requestRunReadinessReport
  ]);

  const selectedNode = useMemo(
    () => flow.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [flow.nodes, selectedNodeId]
  );

  const canvasNodes = useMemo<CanvasNode[]>(
    () => {
      const contractsByNodeId = createContractsByNodeId(executionContractPreview);
      const planStepsByNodeId = createPlanStepsByNodeId(linearExecutionPlan);
      const estimatesByNodeId = createEstimatesByNodeId(flowEstimate);

      return flow.nodes.map((node) => ({
        id: node.id,
        type: "clawflowNode",
        position: node.position,
        data: {
          label: node.label,
          nodeType: node.type,
          role: node.role,
          roleLabel: t(locale, "nodeCard.role"),
          runtimeRef: node.runtimeRef ?? "mock-local",
          status: nodeStatuses[node.id] ?? "idle",
          testId: getNodeTestId(node),
          typeLabel: t(locale, "nodeCard.type"),
          runtimeLabel: t(locale, "nodeCard.runtime"),
          harnessSummary: createNodeHarnessSummary(locale, node, runtimes),
          contractSummary: createNodeContractSummary(locale, contractsByNodeId.get(node.id)),
          planSummary: createNodePlanSummary(
            locale,
            planStepsByNodeId.get(node.id),
            livePlanStepStatuses[node.id]
          ),
          estimateSummary: createNodeEstimateSummary(locale, estimatesByNodeId.get(node.id))
        },
        selected: node.id === selectedNodeId
      }));
    },
    [
      executionContractPreview,
      flowEstimate,
      flow.nodes,
      linearExecutionPlan,
      livePlanStepStatuses,
      locale,
      nodeStatuses,
      runtimes,
      selectedNodeId
    ]
  );

  const canvasEdges = useMemo<Edge[]>(
    () =>
      flow.edges.map((edge) => ({
        ...edge,
        sourceHandle: edge.sourceHandle ?? DEFAULT_SOURCE_HANDLE,
        targetHandle: edge.targetHandle ?? DEFAULT_TARGET_HANDLE,
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
  const topStatusMessage = runError ?? runWarning ?? saveNotice ?? formatRunStatus(locale, runStatus, currentRunId);
  const runSummary = useMemo<RunSummary>(
    () => createRunSummary(locale, currentRunId, runStatus, runEvents, nodeStatuses, runStartedAt, runCompletedAt),
    [currentRunId, locale, nodeStatuses, runCompletedAt, runEvents, runStartedAt, runStatus]
  );
  const nodeIoView = useMemo<NodeIoView>(
    () => createNodeIoView(locale, runEvents, selectedNodeId, selectedNode),
    [locale, runEvents, selectedNode, selectedNodeId]
  );
  const selectedRunEvent = useMemo(
    () => runEvents.find((event) => event.id === selectedRunEventId) ?? null,
    [runEvents, selectedRunEventId]
  );
  const runtimeOptions = useMemo(
    () => createRuntimeOptions(locale, runtimes, selectedNode?.runtimeRef),
    [locale, runtimes, selectedNode?.runtimeRef]
  );
  const workspaceVisibility = useMemo(
    () => createWorkspaceVisibility(workspaceViewMode),
    [workspaceViewMode]
  );

  const setWorkspaceViewMode = useCallback((mode: WorkspaceViewMode) => {
    setWorkspaceViewModeState(mode);
    storeWorkspaceViewMode(mode);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.key === "Escape" &&
        workspaceViewMode !== "default" &&
        !isTextEditingTarget(event.target)
      ) {
        setWorkspaceViewMode("default");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setWorkspaceViewMode, workspaceViewMode]);

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

  const handleEdgesChange = useCallback<OnEdgesChange<Edge>>(
    (changes) => {
      const removedEdgeIds = changes
        .filter(isEdgeRemoveChange)
        .map((change) => change.id);

      removeEdges(removedEdgeIds);
    },
    [removeEdges]
  );

  const handleConnect = useCallback<OnConnect>(
    (connection) => {
      addEdge(connection);
    },
    [addEdge]
  );

  const handleReconnect = useCallback(
    (edge: Edge, connection: Connection) => {
      reconnectEdge(edge.id, connection);
    },
    [reconnectEdge]
  );

  const handleSaveFlow = useCallback(() => {
    markFlowSaved();
  }, [markFlowSaved]);

  const handleRefreshRuntimes = useCallback(() => {
    void loadRuntimes();
  }, [loadRuntimes]);

  const handleRuntimeHealthCheck = useCallback(() => {
    void healthCheckAll();
  }, [healthCheckAll]);

  const handleRefreshExecutionContractPreview = useCallback(() => {
    void requestExecutionContractPreview(flow);
  }, [flow, requestExecutionContractPreview]);

  const handleRefreshLinearExecutionPlan = useCallback(() => {
    void requestLinearExecutionPlan(flow);
  }, [flow, requestLinearExecutionPlan]);

  const handleRefreshFlowEstimate = useCallback(() => {
    void requestFlowEstimate(flow);
  }, [flow, requestFlowEstimate]);

  const handleLocaleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setLocale(event.target.value as Locale);
    },
    [setLocale]
  );

  const handleWorkspaceViewModeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setWorkspaceViewMode(event.target.value as WorkspaceViewMode);
    },
    [setWorkspaceViewMode]
  );

  const closeActiveSocket = useCallback(() => {
    if (activeSocketRef.current !== null) {
      const socketToClose = activeSocketRef.current;
      activeSocketRef.current = null;
      socketToClose.close();
    }
  }, []);

  const refreshActiveSessionSnapshot = useCallback(() => {
    const sessionId = useSessionStore.getState().activeSessionId;

    if (sessionId !== null) {
      void loadSession(sessionId);
    }
  }, [loadSession]);

  const openRunEventStream = useCallback(
    (body: CreateRunResponse, shouldRefreshSession: boolean) => {
      acceptRunCreated(body.runId);

      const socket = new WebSocket(createWebSocketUrl(body.wsUrl));
      activeSocketRef.current = socket;
      let streamIssueReported = false;
      let hasReceivedEvent = false;

      const reportStreamIssue = (): void => {
        if (streamIssueReported || isTerminalRunStatus(useFlowStore.getState().runStatus)) {
          return;
        }

        streamIssueReported = true;
        reportRunWarning({
          title: t(locale, "error.streamInterrupted.title"),
          message: t(locale, "error.streamInterrupted.message"),
          suggestion: t(locale, "error.streamInterrupted.suggestion"),
          source: "websocket",
          severity: "warning",
          logTitle: "RunEvent stream interrupted",
          logMessage: "RunEvent stream disconnected before the run completed.",
          logSuggestion: "Check whether the gateway is still running, then run the flow again."
        });

        if (shouldRefreshSession) {
          refreshActiveSessionSnapshot();
        }
      };

      const streamTimeout = window.setTimeout(() => {
        if (
          activeSocketRef.current === socket &&
          !hasReceivedEvent &&
          !isTerminalRunStatus(useFlowStore.getState().runStatus)
        ) {
          reportStreamIssue();
        }
      }, STREAM_FIRST_EVENT_TIMEOUT_MS);

      socket.onmessage = (messageEvent: MessageEvent<string>) => {
        hasReceivedEvent = true;
        window.clearTimeout(streamTimeout);
        const payload = parseSocketPayload(messageEvent.data);

        if (isRunEvent(payload)) {
          appendRunEvent(payload);

          if (shouldRefreshSession) {
            refreshActiveSessionSnapshot();
          }

          if (payload.type === "run.completed" || payload.type === "run.failed") {
            activeSocketRef.current = null;
            socket.close();
          }

          return;
        }

        const errorMessage = extractSocketError(payload);

        if (errorMessage !== null) {
          reportRunError({
            title: t(locale, "error.streamError.title"),
            message: errorMessage,
            suggestion: t(locale, "error.streamError.suggestion"),
            source: "websocket",
            logTitle: "RunEvent stream error",
            logMessage: errorMessage,
            logSuggestion: "Check the gateway runId and run the flow again."
          });

          if (shouldRefreshSession) {
            refreshActiveSessionSnapshot();
          }
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
    },
    [
      acceptRunCreated,
      appendRunEvent,
      locale,
      refreshActiveSessionSnapshot,
      reportRunError,
      reportRunWarning
    ]
  );

  const handleRunFlow = useCallback(async () => {
    closeActiveSocket();

    const availableRuntimes = await ensureRuntimeListForRun(runtimes, loadRuntimes);
    const runtimeValidationProblem = validateRuntimeRefsForRun(
      locale,
      flow,
      availableRuntimes.runtimes,
      availableRuntimes.error
    );

    if (runtimeValidationProblem !== null) {
      clearRun();
      reportRunError(runtimeValidationProblem);
      return;
    }

    const validationProblem = validateFlowForRun(locale, flow);

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
        reportRunError(createGatewayRejectedProblem(locale, response.status, body.error?.message));
        return;
      }

      if (typeof body.runId !== "string" || typeof body.wsUrl !== "string") {
        reportRunError({
          title: t(locale, "error.gatewayResponseInvalid.title"),
          message: t(locale, "error.gatewayResponseInvalid.message"),
          suggestion: t(locale, "error.gatewayResponseInvalid.suggestion"),
          source: "gateway",
          logTitle: "Gateway response invalid",
          logMessage: "Gateway accepted the run but did not return a valid runId or WebSocket URL.",
          logSuggestion: "Restart the local gateway, then run the flow again."
        });
        return;
      }

      openRunEventStream(body, false);
    } catch (error: unknown) {
      reportRunError(createGatewayUnavailableProblem(locale, error));
    }
  }, [
    clearRun,
    closeActiveSocket,
    flow,
    loadRuntimes,
    locale,
    openRunEventStream,
    prepareRun,
    reportRunError,
    runtimes
  ]);

  const handleRunSession = useCallback(async () => {
    closeActiveSocket();

    if (useSessionStore.getState().activeSessionId === null) {
      clearRun();
      reportRunError({
        title: t(locale, "session.noActiveSession"),
        message: t(locale, "session.createToStart"),
        suggestion: t(locale, "session.createToStart"),
        source: "webui"
      });
      return;
    }

    const availableRuntimes = await ensureRuntimeListForRun(runtimes, loadRuntimes);
    const runtimeValidationProblem = validateRuntimeRefsForRun(
      locale,
      flow,
      availableRuntimes.runtimes,
      availableRuntimes.error
    );

    if (runtimeValidationProblem !== null) {
      clearRun();
      reportRunError(runtimeValidationProblem);
      return;
    }

    const validationProblem = validateFlowForRun(locale, flow);

    if (validationProblem !== null) {
      clearRun();
      reportRunError(validationProblem);
      return;
    }

    prepareRun();

    const response = await runActiveSession(flow);

    if (response === null) {
      const sessionError =
        useSessionStore.getState().sessionError ?? "Gateway did not create a Session run.";

      reportRunError({
        title: t(locale, "error.gatewayRejected.title"),
        message: sessionError,
        suggestion: t(locale, "error.gatewayRejected.suggestion"),
        source: "gateway",
        logTitle: "Session run rejected",
        logMessage: sessionError,
        logSuggestion: "Check the active Session and local gateway, then run again."
      });
      return;
    }

    openRunEventStream(response, true);
  }, [
    clearRun,
    closeActiveSocket,
    flow,
    loadRuntimes,
    locale,
    openRunEventStream,
    prepareRun,
    reportRunError,
    runActiveSession,
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

  const handleHarnessChange = useCallback(
    (harnessRef: NodeHarnessRef | null) => {
      if (selectedNode !== null) {
        updateNode(selectedNode.id, { harnessRef });
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
    <div
      className={`studio-shell workspace-mode-${workspaceViewMode}`}
      data-testid="studio-shell"
      data-workspace-mode={workspaceViewMode}
    >
      <header className="top-bar" data-testid="top-bar">
        <div className="brand-lockup" data-testid="brand-lockup">
          <Workflow aria-hidden="true" size={20} />
          <div>
            <strong>{t(locale, "app.name")}</strong>
            <span>{flow.name}</span>
          </div>
        </div>

        <div className={`top-status top-status-${topStatusSeverity}`} aria-live="polite" data-testid="top-status">
          {topStatusMessage}
        </div>

        <RunReadinessPreview
          locale={locale}
          report={runReadinessReport}
          isLoading={runReadinessLoading}
          error={runReadinessError}
        />

        <nav className="top-actions" aria-label={t(locale, "top.workspaceActions")} data-testid="workspace-actions">
          <label
            className="view-mode-switcher"
            title={t(locale, "workspaceView.title")}
            data-testid="view-mode-control"
          >
            <span>{t(locale, "workspaceView.label")}</span>
            <select
              value={workspaceViewMode}
              onChange={handleWorkspaceViewModeChange}
              aria-label={t(locale, "workspaceView.title")}
              data-testid="view-mode-select"
            >
              {workspaceViewModes.map((mode) => (
                <option key={mode} value={mode}>
                  {t(locale, workspaceViewModeLabelKeys[mode])}
                </option>
              ))}
            </select>
          </label>
          <label className="language-switcher" title={t(locale, "top.language")}>
            <Languages aria-hidden="true" size={15} />
            <select
              value={locale}
              onChange={handleLocaleChange}
              aria-label={t(locale, "top.language")}
            >
              <option value="en">{t(locale, "language.english")}</option>
              <option value="zh-CN">{t(locale, "language.zhCN")}</option>
            </select>
          </label>
          <button type="button" title={t(locale, "top.saveFlowTitle")} onClick={handleSaveFlow}>
            <Save aria-hidden="true" size={16} />
            {t(locale, "top.saveFlow")}
          </button>
          <button type="button" title={t(locale, "top.exportJsonTitle")} onClick={toggleExport}>
            <Braces aria-hidden="true" size={16} />
            {t(locale, "top.exportJson")}
          </button>
          <button type="button" title={t(locale, "top.runtimesTitle")} onClick={openRuntimeManager}>
            <Server aria-hidden="true" size={16} />
            {t(locale, "top.runtimes")}
          </button>
          <div className="run-action-group" data-testid="run-button-context">
            <button
              type="button"
              className="run-action"
              data-testid="run-button"
              title={t(locale, "top.runTitle")}
              onClick={handleRunFlow}
              disabled={isRunActive}
            >
              <Play aria-hidden="true" size={16} />
              {isRunActive ? t(locale, "top.running") : t(locale, "top.run")}
            </button>
            <span data-testid="pre-run-summary">
              {formatPreRunSummary(locale, runReadinessReport, runReadinessLoading, runReadinessError)}
            </span>
          </div>
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
          runtimeHealth={runtimeHealth}
          locale={locale}
          isLoading={runtimeLoadStatus === "loading"}
          error={runtimeError}
          onClose={closeRuntimeManager}
          onRefresh={handleRefreshRuntimes}
          onHealthCheck={handleRuntimeHealthCheck}
        />
      ) : null}

      {workspaceVisibility.nodeLibrary ? (
        <aside className="node-library" aria-label={t(locale, "nodeLibrary.aria")} data-testid="node-library">
          <div className="pane-title">
            <Library aria-hidden="true" size={16} />
            <span>{t(locale, "nodeLibrary.title")}</span>
          </div>

          <div className="node-list">
            {MVP_NODE_CATALOG.map((node) => {
              const Icon = nodeIcons[node.type];

              return (
                <button
                  key={node.type}
                  className={`node-list-item role-${node.role}`}
                  data-testid={`node-library-item-${node.type.replaceAll(".", "-")}`}
                  type="button"
                  title={getCatalogDescription(node.type, locale)}
                  onClick={() => addNode(node.type)}
                >
                  <Icon aria-hidden="true" size={18} />
                  <span>
                    <strong>{getCatalogLabel(node.type, locale)}</strong>
                    <small>
                      {node.type} / {getRoleLabel(locale, node.role)}
                    </small>
                  </span>
                  <Plus aria-hidden="true" className="node-add-icon" size={16} />
                </button>
              );
            })}
          </div>
        </aside>
      ) : null}

      <main className="canvas-pane" aria-label={t(locale, "canvas.aria")} data-testid="clawflow-canvas">
        {workspaceVisibility.sessionConsole ? (
          <SessionConsole
            locale={locale}
            flow={flow}
            isRunActive={isRunActive}
            onRunSession={handleRunSession}
          />
        ) : null}
        {workspaceVisibility.contractPreview ? (
          <ExecutionContractPreviewPanel
            locale={locale}
            preview={executionContractPreview}
            isLoading={executionContractPreviewLoading}
            error={executionContractPreviewError}
            onRefresh={handleRefreshExecutionContractPreview}
          />
        ) : null}
        {workspaceVisibility.linearPlan ? (
          <LinearExecutionPlanPanel
            locale={locale}
            plan={linearExecutionPlan}
            isLoading={linearExecutionPlanLoading}
            error={linearExecutionPlanError}
            liveStepStatuses={livePlanStepStatuses}
            onRefresh={handleRefreshLinearExecutionPlan}
          />
        ) : null}
        {workspaceVisibility.resourceEstimate ? (
          <ResourceEstimatePanel
            locale={locale}
            estimate={flowEstimate}
            isLoading={flowEstimateLoading}
            error={flowEstimateError}
            onRefresh={handleRefreshFlowEstimate}
          />
        ) : null}
        <ReactFlow
          data-testid="react-flow-canvas"
          nodes={canvasNodes}
          edges={canvasEdges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onReconnect={handleReconnect}
          onNodeClick={(_, node) => selectNode(node.id)}
          onPaneClick={() => selectNode(null)}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          nodesDraggable
          nodesConnectable
          edgesReconnectable
          elementsSelectable
          deleteKeyCode={["Backspace", "Delete"]}
          minZoom={0.45}
          maxZoom={1.5}
        >
          <Background color="#34312d" gap={18} size={1} />
          <Controls position="bottom-left" />
          <MiniMap pannable zoomable />
        </ReactFlow>

        {isExportOpen ? (
          <aside className="export-panel" aria-label={t(locale, "export.aria")}>
            <div className="export-panel-header">
              <div>
                <strong>{t(locale, "export.title")}</strong>
                <span>
                  {flow.nodes.length} {t(locale, "common.nodes")}
                </span>
              </div>
              <button type="button" title={t(locale, "export.closeTitle")} onClick={closeExport}>
                <X aria-hidden="true" size={16} />
              </button>
            </div>
            <pre>{flowJson}</pre>
          </aside>
        ) : null}
      </main>

      {workspaceVisibility.inspector ? (
        <aside className="inspector-pane" aria-label={t(locale, "inspector.aria")} data-testid="inspector-pane">
          <div className="pane-title">
            <ClipboardList aria-hidden="true" size={16} />
            <span>{t(locale, "inspector.title")}</span>
          </div>

          {selectedNode === null ? (
            <section className="inspector-empty">
              <strong>{t(locale, "inspector.emptyTitle")}</strong>
              <span>{t(locale, "inspector.emptyBody")}</span>
            </section>
          ) : (
            <div className="inspector-scroll">
              <section className="inspector-card">
                <h2>{t(locale, "inspector.node")}</h2>
                <div className="field-stack">
                  <label className="field-control">
                    <span>{t(locale, "inspector.label")}</span>
                    <input value={selectedNode.label} onChange={handleLabelChange} />
                  </label>
                  <div className="readonly-grid">
                    <span>{t(locale, "inspector.type")}</span>
                    <code title={selectedNode.type}>{selectedNode.type}</code>
                    <span>{t(locale, "inspector.role")}</span>
                    <code title={selectedNode.role}>{getRoleLabel(locale, selectedNode.role)}</code>
                    <span>{t(locale, "inspector.status")}</span>
                    <code title={nodeStatuses[selectedNode.id] ?? "idle"}>
                      {nodeStatuses[selectedNode.id] ?? "idle"}
                    </code>
                  </div>
                </div>
              </section>

              <section className="inspector-card">
                <h2>{t(locale, "inspector.runtime")}</h2>
                <label className="field-control">
                  <span>{t(locale, "inspector.runtimeRef")}</span>
                  <select
                    value={selectedNode.runtimeRef ?? ""}
                    onChange={handleRuntimeChange}
                    disabled={runtimeLoadStatus === "loading" && runtimeOptions.length === 0}
                  >
                    {selectedNode.role === "trigger" ? (
                      <option value="">{t(locale, "inspector.noRuntime")}</option>
                    ) : null}
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
                      {formatRuntimeSelection(locale, selectedNode.runtimeRef, runtimes) ??
                        t(locale, "inspector.runtimeRegistryNotLoaded")}
                    </span>
                  )}
                </div>
              </section>

              <HarnessInspector
                locale={locale}
                node={selectedNode}
                runtimes={runtimes}
                onChange={handleHarnessChange}
              />

              <section className="inspector-card">
                <h2>{t(locale, "inspector.policies")}</h2>
                <div className="field-stack">
                  <label className="field-control">
                    <span>{t(locale, "inspector.thinkingLevel")}</span>
                    <select value={selectedNode.budgetPolicy.thinking} onChange={handleThinkingChange}>
                      {thinkingLevels.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-control">
                    <span>{t(locale, "inspector.riskLevel")}</span>
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
      ) : null}

      {workspaceVisibility.runInspector ? (
        <section
          className="run-inspector"
          aria-label={t(locale, "runInspector.aria")}
          data-testid="run-inspector"
        >
        <div className="pane-title run-title">
          <span>
            <Braces aria-hidden="true" size={16} />
            {t(locale, "runInspector.title")}
          </span>
          <div className="run-summary" aria-label={t(locale, "runInspector.summaryAria")}>
            <strong className={`run-status run-status-${runSummary.status}`}>{runSummary.status}</strong>
            <code title={runSummary.runId}>{runSummary.runId}</code>
            <span>
              {runSummary.eventCount} {t(locale, "runInspector.eventsCount")}
            </span>
            <span>
              {runSummary.succeededNodeCount} {t(locale, "runInspector.successCount")}
            </span>
            <span>
              {runSummary.failedNodeCount} {t(locale, "runInspector.failedCount")}
            </span>
            <span>{runSummary.durationLabel}</span>
          </div>
          <button type="button" className="clear-run-button" onClick={handleClearRun}>
            <RotateCcw aria-hidden="true" size={14} />
            {t(locale, "runInspector.clearLogs")}
          </button>
        </div>

        <div className="run-inspector-grid">
          <section className="run-panel run-logs-panel" aria-label={t(locale, "runInspector.logsAria")}>
            <div className="run-panel-title">
              <h3>{t(locale, "runInspector.logsTitle")}</h3>
              <span>{runLogs.length}</span>
            </div>

            {runLogs.length === 0 ? (
              <p className="run-empty-text">{t(locale, "runInspector.logsEmpty")}</p>
            ) : (
              <div className="run-log-list">
                {runLogs.map((log) => (
                  <article className={`run-log-row log-${log.level}`} key={log.id}>
                    <time>{formatTimestamp(log.timestamp, locale)}</time>
                    <strong>{log.level}</strong>
                    <span title={log.message}>{log.message}</span>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section
            className="run-panel run-node-io-panel"
            aria-label={t(locale, "runInspector.nodeIoAria")}
          >
            <div className="run-panel-title">
              <h3>{t(locale, "runInspector.nodeIoTitle")}</h3>
              <span>{nodeIoView.title}</span>
            </div>

            {nodeIoView.inputEvent === null && nodeIoView.outputEvent === null ? (
              <p className="run-empty-text">{nodeIoView.emptyMessage}</p>
            ) : (
              <div className="node-io-content">
                <NodeIoBlock
                  title={t(locale, "runInspector.input")}
                  emptyMessage={t(locale, "runInspector.noInputCaptured")}
                  locale={locale}
                  event={nodeIoView.inputEvent}
                />
                <NodeIoBlock
                  title={t(locale, "runInspector.output")}
                  emptyMessage={t(locale, "runInspector.noOutputCaptured")}
                  locale={locale}
                  event={nodeIoView.outputEvent}
                />
              </div>
            )}
          </section>

          <section className="run-panel run-events-panel" aria-label={t(locale, "runInspector.eventsAria")}>
            <div className="run-panel-title">
              <h3>{t(locale, "runInspector.eventsTitle")}</h3>
              <span>{runEvents.length}</span>
            </div>

            {runEvents.length === 0 ? (
              <p className="run-empty-text">{t(locale, "runInspector.eventsEmpty")}</p>
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
                    <p className="run-empty-text">{t(locale, "runInspector.selectPayload")}</p>
                  ) : (
                    <>
                      <div className="event-detail-header">
                        <strong>{selectedRunEvent.type}</strong>
                        <span>{formatTimestamp(selectedRunEvent.timestamp, locale)}</span>
                      </div>
                      <EventPayloadBadges locale={locale} payload={selectedRunEvent.payload} />
                      <pre>{prettyJson(selectedRunEvent.payload ?? {})}</pre>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
        </section>
      ) : null}
    </div>
  );
}

function RunReadinessPreview({
  locale,
  report,
  isLoading,
  error
}: {
  locale: Locale;
  report: RunReadinessReport | null;
  isLoading: boolean;
  error: string | null;
}): ReactElement {
  const statusClass = error !== null ? "unavailable" : report?.status ?? "loading";
  const issueCount =
    report?.issues.filter((issue) => issue.severity === "warning" || issue.severity === "error")
      .length ?? 0;
  const issueCounts = createRunReadinessIssueCounts(report);
  const issueGroups = createRunReadinessIssueGroups(report);

  return (
    <details
      className={`run-readiness-preview status-${statusClass}`}
      data-testid="run-readiness-preview"
    >
      <summary aria-label={t(locale, "runReadiness.title")}>
        <strong data-testid="run-readiness-status">
          {formatRunReadinessStatus(locale, report, isLoading, error)}
        </strong>
        <code data-testid="run-readiness-issue-count">{issueCount}</code>
      </summary>

      <div className="run-readiness-issues" data-testid="run-readiness-issue-summary">
        <p>{t(locale, "runReadiness.previewOnly")}</p>

        {error !== null ? (
          <p data-testid="run-readiness-error">{error}</p>
        ) : report === null || report.issues.length === 0 ? (
          <p>{t(locale, "runReadiness.noIssues")}</p>
        ) : (
          <>
            <div className="run-readiness-counts" data-testid="run-readiness-counts">
              <span data-testid="run-readiness-count-error">
                {formatRunReadinessCount(locale, issueCounts.error, "error")}
              </span>
              <span data-testid="run-readiness-count-warning">
                {formatRunReadinessCount(locale, issueCounts.warning, "warning")}
              </span>
              <span data-testid="run-readiness-count-info">
                {formatRunReadinessCount(locale, issueCounts.info, "info")}
              </span>
            </div>

            {issueGroups.map((group) => (
              <section
                className={`run-readiness-group severity-${group.severity}`}
                data-testid={`run-readiness-group-${group.severity}`}
                key={group.severity}
              >
                <h4>
                  {t(locale, runReadinessSeverityGroupLabelKeys[group.severity])}
                  <span>{group.issues.length}</span>
                </h4>
                <ul>
                  {group.issues.slice(0, 5).map((issue, index) => (
                    <li
                      className={`severity-${issue.severity}`}
                      key={`${issue.code}-${issue.nodeId ?? "flow"}-${index}`}
                    >
                      <strong>{formatRunReadinessIssue(locale, issue)}</strong>
                      <span>
                        {formatRunReadinessIssueSource(locale, issue)}
                        {issue.nodeId === undefined ? "" : ` / ${issue.nodeId}`}
                      </span>
                    </li>
                  ))}
                </ul>
                {group.issues.length > 5 ? (
                  <p>
                    {t(locale, "runReadiness.moreIssuesPrefix")} {group.issues.length - 5}
                  </p>
                ) : null}
              </section>
            ))}
          </>
        )}
      </div>
    </details>
  );
}

const runReadinessStatusLabelKeys = {
  ready: "runReadiness.status.ready",
  warning: "runReadiness.status.warning",
  blocked: "runReadiness.status.blocked"
} as const satisfies Record<RunReadinessStatus, I18nKey>;

const runReadinessSeverityLabelKeys = {
  info: "runReadiness.severity.info",
  warning: "runReadiness.severity.warning",
  error: "runReadiness.severity.error"
} as const satisfies Record<RunReadinessIssue["severity"], I18nKey>;

const runReadinessSeverityGroupLabelKeys = {
  info: "runReadiness.group.info",
  warning: "runReadiness.group.warning",
  error: "runReadiness.group.error"
} as const satisfies Record<RunReadinessIssue["severity"], I18nKey>;

const runReadinessIssueLabelKeys: Record<string, I18nKey> = {
  "runReadiness.issue.graphDiagnostic": "runReadiness.issue.graphDiagnostic",
  "runReadiness.issue.executionPlanNotReady": "runReadiness.issue.executionPlanNotReady",
  "runReadiness.issue.executionPlanUnsupported": "runReadiness.issue.executionPlanUnsupported",
  "runReadiness.issue.executionPlanError": "runReadiness.issue.executionPlanError",
  "runReadiness.issue.executionPlanWarning": "runReadiness.issue.executionPlanWarning",
  "runReadiness.issue.executionPlanStepBlocked": "runReadiness.issue.executionPlanStepBlocked",
  "runReadiness.issue.resourceEstimatePreviewOnly":
    "runReadiness.issue.resourceEstimatePreviewOnly",
  "runReadiness.issue.resourceEstimateUnknownCost": "runReadiness.issue.resourceEstimateUnknownCost",
  "runReadiness.issue.resourceEstimateLowConfidence":
    "runReadiness.issue.resourceEstimateLowConfidence",
  "estimator.warning.contractPreviewWarning": "estimator.warning.contractPreviewWarning",
  "estimator.warning.contractPreviewError": "estimator.warning.contractPreviewError",
  "estimator.warning.nonCatalogContract": "estimator.warning.nonCatalogContract",
  "estimator.warning.missingRequiredInput": "estimator.warning.missingRequiredInput",
  "estimator.warning.missingRuntime": "estimator.warning.missingRuntime",
  "estimator.warning.unknownRuntime": "estimator.warning.unknownRuntime",
  "estimator.warning.missingModel": "estimator.warning.missingModel",
  "estimator.warning.unknownModelMetadata": "estimator.warning.unknownModelMetadata",
  "estimator.warning.unknownPricing": "estimator.warning.unknownPricing"
};

const runReadinessSourceLabelKeys: Record<string, I18nKey> = {
  diagnostics: "runReadiness.source.diagnostics",
  execution_plan: "runReadiness.source.executionPlan",
  resource_estimate: "runReadiness.source.resourceEstimate"
};

interface RunReadinessIssueCounts {
  error: number;
  warning: number;
  info: number;
}

interface RunReadinessIssueGroup {
  severity: RunReadinessIssue["severity"];
  issues: RunReadinessIssue[];
}

function formatRunReadinessStatus(
  locale: Locale,
  report: RunReadinessReport | null,
  isLoading: boolean,
  error: string | null
): string {
  if (error !== null) {
    return t(locale, "runReadiness.unavailable");
  }

  if (isLoading && report === null) {
    return t(locale, "runReadiness.loading");
  }

  if (report === null) {
    return t(locale, "runReadiness.unavailable");
  }

  return t(locale, runReadinessStatusLabelKeys[report.status]);
}

function formatPreRunSummary(
  locale: Locale,
  report: RunReadinessReport | null,
  isLoading: boolean,
  error: string | null
): string {
  if (error !== null) {
    return t(locale, "preRun.unavailable");
  }

  if (isLoading && report === null) {
    return t(locale, "preRun.loading");
  }

  if (report === null) {
    return t(locale, "preRun.unavailable");
  }

  const counts = createRunReadinessIssueCounts(report);

  if (report.status === "ready") {
    return t(locale, "preRun.ready");
  }

  if (report.status === "warning") {
    return `${t(locale, "preRun.warning")} · ${counts.warning} ${t(locale, "preRun.warningSuffix")}`;
  }

  return `${t(locale, "preRun.blocked")} · ${counts.error} ${t(locale, "preRun.fixSuffix")}`;
}

function formatRunReadinessIssue(locale: Locale, issue: RunReadinessIssue): string {
  return t(locale, runReadinessIssueLabelKeys[issue.messageKey] ?? "runReadiness.issue.generic");
}

function formatRunReadinessCount(
  locale: Locale,
  count: number,
  severity: RunReadinessIssue["severity"]
): string {
  return `${count} ${t(locale, runReadinessSeverityLabelKeys[severity])}`;
}

function formatRunReadinessIssueSource(locale: Locale, issue: RunReadinessIssue): string {
  const source = issue.code.split(".")[0] ?? "diagnostics";

  return t(locale, runReadinessSourceLabelKeys[source] ?? "runReadiness.source.diagnostics");
}

function createRunReadinessIssueCounts(report: RunReadinessReport | null): RunReadinessIssueCounts {
  const counts: RunReadinessIssueCounts = {
    error: 0,
    warning: 0,
    info: 0
  };

  for (const issue of report?.issues ?? []) {
    counts[issue.severity] += 1;
  }

  return counts;
}

function createRunReadinessIssueGroups(
  report: RunReadinessReport | null
): RunReadinessIssueGroup[] {
  if (report === null) {
    return [];
  }

  const severityOrder: RunReadinessIssue["severity"][] = ["error", "warning", "info"];

  return severityOrder
    .map((severity) => ({
      severity,
      issues: report.issues.filter((issue) => issue.severity === severity)
    }))
    .filter((group) => group.issues.length > 0);
}

function NodeIoBlock({
  title,
  emptyMessage,
  locale,
  event
}: {
  title: string;
  emptyMessage: string;
  locale: Locale;
  event: RunEvent | null;
}): ReactElement {
  if (event === null) {
    return (
      <section className="io-block io-empty">
        <h4>{title}</h4>
        <p>{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="io-block">
      <div>
        <h4>{title}</h4>
        <span>
          {event.nodeId ?? "-"} / {formatTimestamp(event.timestamp, locale)}
        </span>
      </div>
      <pre>{prettyJson(event.payload ?? {})}</pre>
    </section>
  );
}

function EventPayloadBadges({
  locale,
  payload
}: {
  locale: Locale;
  payload: Record<string, unknown> | undefined;
}): ReactElement | null {
  const badges: string[] = [];

  if (hasPayloadFlag(payload, "protectedDryRun")) {
    badges.push(t(locale, "dryRun.protected"));
  }

  if (hasPayloadFlag(payload, "realExecutionBlocked")) {
    badges.push(t(locale, "dryRun.realExecutionBlocked"));
  }

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="event-detail-badges">
      {badges.map((badge) => (
        <span key={badge}>{badge}</span>
      ))}
    </div>
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
      t("en", "error.runtimeRegistryEmpty")
  };
}

function validateRuntimeRefsForRun(
  locale: Locale,
  flow: FlowSpec,
  runtimes: RuntimeSpec[],
  runtimeError: string | null
): RunProblemInput | null {
  if (runtimeError !== null && runtimes.length === 0) {
    return {
      title: t(locale, "error.gatewayUnavailable.title"),
      message: runtimeError,
      suggestion: t(locale, "error.gatewayUnavailable.suggestion"),
      source: "gateway",
      logTitle: t("en", "error.gatewayUnavailable.title"),
      logMessage: runtimeError,
      logSuggestion: t("en", "error.gatewayUnavailable.suggestion")
    };
  }

  if (runtimes.length === 0) {
    return {
      title: t(locale, "error.runtimeRegistryUnavailable.title"),
      message: t(locale, "error.runtimeRegistryUnavailable.message"),
      suggestion: t(locale, "error.runtimeRegistryUnavailable.suggestion"),
      source: "runtime-validation",
      logTitle: t("en", "error.runtimeRegistryUnavailable.title"),
      logMessage: t("en", "error.runtimeRegistryUnavailable.message"),
      logSuggestion: t("en", "error.runtimeRegistryUnavailable.suggestion")
    };
  }

  const runtimesById = new Map(runtimes.map((runtime) => [runtime.id, runtime]));
  const executableNodes = flow.nodes.filter(requiresRuntimeForMvpRun);

  for (const node of executableNodes) {
    const runtimeRef = node.runtimeRef?.trim();

    if (runtimeRef === undefined || runtimeRef === "") {
      const message = `Node "${node.label}" ${t(locale, "error.runtimeSelectionRequired.suffix")}`;
      const logMessage = `Node "${node.label}" ${t("en", "error.runtimeSelectionRequired.suffix")}`;

      return {
        title: t(locale, "error.runtimeSelectionRequired.title"),
        message,
        suggestion: t(locale, "error.runtimeSelectionRequired.suggestion"),
        source: "runtime-validation",
        logTitle: t("en", "error.runtimeSelectionRequired.title"),
        logMessage,
        logSuggestion: t("en", "error.runtimeSelectionRequired.suggestion")
      };
    }

    if (!runtimesById.has(runtimeRef)) {
      const message = `Runtime ${runtimeRef} ${t(locale, "error.runtimeNotFound.suffix")}`;
      const logMessage = `Runtime ${runtimeRef} ${t("en", "error.runtimeNotFound.suffix")}`;

      return {
        title: t(locale, "error.runtimeNotFound.title"),
        message,
        suggestion: t(locale, "error.runtimeNotFound.suggestion"),
        source: "runtime-validation",
        logTitle: t("en", "error.runtimeNotFound.title"),
        logMessage,
        logSuggestion: t("en", "error.runtimeNotFound.suggestion")
      };
    }

    const runtime = runtimesById.get(runtimeRef);

    if (runtime?.executionMode === "unavailable") {
      const message = `Runtime ${runtimeRef} ${t(locale, "error.runtimeUnavailable.suffix")}`;
      const logMessage = `Runtime ${runtimeRef} ${t("en", "error.runtimeUnavailable.suffix")}`;

      return {
        title: t(locale, "error.runtimeUnavailable.title"),
        message,
        suggestion: t(locale, "error.runtimeUnavailable.suggestion"),
        source: "runtime-validation",
        logTitle: t("en", "error.runtimeUnavailable.title"),
        logMessage,
        logSuggestion: t("en", "error.runtimeUnavailable.suggestion")
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

function validateFlowForRun(locale: Locale, flow: FlowSpec): RunProblemInput | null {
  if (flow.nodes.length === 0) {
    return createFlowValidationProblem(
      locale,
      "error.flowValidation.emptyNodes",
      "error.flowValidation.fixRequiredNodes"
    );
  }

  const triggerNodes = flow.nodes.filter((node) => node.role === "trigger");
  const outputNodes = flow.nodes.filter((node) => node.role === "output");

  if (triggerNodes.length === 0 || outputNodes.length === 0) {
    return createFlowValidationProblem(
      locale,
      "error.flowValidation.missingTriggerOutput",
      "error.flowValidation.fixRequiredNodes"
    );
  }

  if (flow.edges.length === 0) {
    return createFlowValidationProblem(
      locale,
      "error.flowValidation.noEdges",
      "error.flowValidation.fixEdges"
    );
  }

  if (!hasReachableOutput(flow, triggerNodes, outputNodes)) {
    return createFlowValidationProblem(
      locale,
      "error.flowValidation.noTriggerPath",
      "error.flowValidation.fixTriggerPath"
    );
  }

  return null;
}

function createFlowValidationProblem(
  locale: Locale,
  messageKey: I18nKey,
  suggestionKey: I18nKey
): RunProblemInput {
  return {
    title: t(locale, "error.flowValidation.title"),
    message: t(locale, messageKey),
    suggestion: t(locale, suggestionKey),
    source: "flow-validation",
    logTitle: t("en", "error.flowValidation.title"),
    logMessage: t("en", messageKey),
    logSuggestion: t("en", suggestionKey)
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

function createGatewayUnavailableProblem(locale: Locale, error: unknown): RunProblemInput {
  const rawMessage = error instanceof Error ? error.message : t("en", "error.gatewayUnavailable.connectFallback");
  const isFetchFailure = rawMessage === "Failed to fetch" || rawMessage.includes("fetch");
  const message = isFetchFailure
    ? `${t(locale, "error.gatewayUnavailable.connectFallback")} ${GATEWAY_HTTP_URL}.`
    : `${t(locale, "error.gatewayUnavailable.title")}: ${rawMessage}`;
  const logMessage = isFetchFailure
    ? `Gateway unavailable: unable to connect to ${GATEWAY_HTTP_URL}. Please make sure pnpm dev:gateway is running.`
    : `Gateway unavailable: ${rawMessage}`;

  return {
    title: t(locale, "error.gatewayUnavailable.title"),
    message,
    suggestion: t(locale, "error.gatewayUnavailable.suggestion"),
    source: "gateway",
    logTitle: "Gateway unavailable",
    logMessage,
    logSuggestion: "Please start the local gateway with pnpm dev:gateway and try again."
  };
}

function createGatewayRejectedProblem(
  locale: Locale,
  status: number,
  message: string | undefined
): RunProblemInput {
  const fallbackMessage = `Gateway returned HTTP ${status} while creating the run.`;

  return {
    title: t(locale, "error.gatewayRejected.title"),
    message: message ?? fallbackMessage,
    suggestion: t(locale, "error.gatewayRejected.suggestion"),
    source: "gateway",
    logTitle: "Gateway rejected the run",
    logMessage: message ?? fallbackMessage,
    logSuggestion: "Review the flow, make sure the local gateway is healthy, then run again."
  };
}

function isTerminalRunStatus(status: RunStatus): boolean {
  return status === "success" || status === "failed" || status === "cancelled" || status === "skipped";
}

function createRunSummary(
  locale: Locale,
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
      ? `${t(locale, "runInspector.duration")} -`
      : `${t(locale, "runInspector.duration")} ${formatDurationMs(
          new Date(completedAt ?? new Date().toISOString()).getTime() - new Date(startedAt).getTime()
        )}`;

  return {
    runId: runId ?? t(locale, "runInspector.noRun"),
    status: runStatus,
    eventCount: runEvents.length,
    succeededNodeCount,
    failedNodeCount,
    durationLabel
  };
}

function createNodeIoView(
  locale: Locale,
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
      emptyMessage: t(locale, "runInspector.noSelectedNodeIo")
    };
  }

  return {
    title:
      selectedNodeId === null
        ? t(locale, "runInspector.latestGlobalIo")
        : selectedNode?.label ?? selectedNodeId,
    inputEvent: latestInput,
    outputEvent: latestOutput,
    emptyMessage: t(locale, "runInspector.noNodeIo")
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

function createNodeHarnessSummary(
  locale: Locale,
  node: FlowNode,
  runtimes: RuntimeSpec[]
): ClawFlowNodeData["harnessSummary"] {
  if (node.harnessRef === undefined) {
    return undefined;
  }

  const profile = getHarnessProfile(node.harnessRef.harnessId);
  const compatibility = evaluateHarnessCompatibility(
    node.harnessRef,
    node.runtimeRef ?? "mock-local",
    createRuntimeLookup(runtimes)
  );

  return {
    label: formatHarnessLabel(locale, profile),
    riskLabel: formatHarnessRisk(locale, compatibility.riskLevel),
    riskLevel: compatibility.riskLevel,
    fitLabel: formatHarnessFit(locale, compatibility.fit),
    fit: compatibility.fit,
    executionModeLabel: formatHarnessExecutionMode(locale, compatibility.effectiveExecutionMode),
    protectedDryRunLabel: t(locale, "session.protectedDryRun"),
    protectedDryRun: compatibility.protectedDryRun
  };
}

const contractCategoryLabelKeys: Record<NodeCategory, I18nKey> = {
  trigger: "executionContract.category.trigger",
  agent: "executionContract.category.agent",
  capability: "executionContract.category.capability",
  knowledge: "executionContract.category.knowledge",
  control: "executionContract.category.control",
  output: "executionContract.category.output",
  utility: "executionContract.category.utility"
};

const contractProviderLabelKeys: Record<CapabilityProvider, I18nKey> = {
  internal: "executionContract.provider.internal",
  runtime: "executionContract.provider.runtime",
  cli: "executionContract.provider.cli",
  mcp: "executionContract.provider.mcp",
  rag: "executionContract.provider.rag",
  comfyui: "executionContract.provider.comfyui",
  api: "executionContract.provider.api",
  browser: "executionContract.provider.browser",
  human: "executionContract.provider.human"
};

const contractExecutionModeLabelKeys: Record<NodeExecutionMode, I18nKey> = {
  "trigger-only": "executionContract.mode.triggerOnly",
  "preview-only": "executionContract.mode.previewOnly",
  "mock-executable": "executionContract.mode.mockExecutable",
  protected: "executionContract.mode.protected",
  "runtime-required": "executionContract.mode.runtimeRequired",
  "output-only": "executionContract.mode.outputOnly",
  blocked: "executionContract.mode.blocked"
};

function createContractsByNodeId(
  preview: FlowExecutionContractPreview | null
): Map<string, NodeExecutionContract> {
  if (preview === null) {
    return new Map();
  }

  return new Map(preview.nodes.map((contract) => [contract.nodeId, contract]));
}

function createNodeContractSummary(
  locale: Locale,
  contract: NodeExecutionContract | undefined
): ClawFlowNodeData["contractSummary"] {
  if (contract === undefined) {
    return undefined;
  }

  const issueCount =
    contract.missingRequiredInputs.length + contract.warnings.length + contract.errors.length;
  const hasError =
    contract.errors.length > 0 ||
    contract.missingRequiredInputs.length > 0 ||
    contract.executionMode === "blocked";
  const readinessTone = resolveContractReadinessTone(contract);

  return {
    categoryLabel: t(locale, contractCategoryLabelKeys[contract.category]),
    executionModeLabel: t(locale, contractExecutionModeLabelKeys[contract.executionMode]),
    providerLabel:
      contract.capability === undefined
        ? t(locale, "common.notAvailable")
        : t(locale, contractProviderLabelKeys[contract.capability.provider]),
    contractSourceLabel: getContractSourceLabel(locale, contract),
    readinessLabel: getContractReadinessLabel(locale, readinessTone),
    readinessTone,
    inputSummary: `${t(locale, "executionContract.inputs")}: ${formatCompactPorts(contract.inputs)}`,
    outputSummary: `${t(locale, "executionContract.outputs")}: ${formatCompactPorts(contract.outputs)}`,
    issueCount,
    hasError
  };
}

function getContractSourceLabel(locale: Locale, contract: NodeExecutionContract): string {
  if (contract.contractSource === "catalog") {
    return t(locale, "executionContract.catalogContract");
  }

  return t(locale, "executionContract.inferredContract");
}

function resolveContractReadinessTone(
  contract: NodeExecutionContract
): NonNullable<ClawFlowNodeData["contractSummary"]>["readinessTone"] {
  if (
    contract.executionMode === "blocked" ||
    contract.errors.length > 0 ||
    contract.missingRequiredInputs.length > 0
  ) {
    return "blocked";
  }

  return contract.warnings.length > 0 ? "warning" : "ready";
}

function getContractReadinessLabel(
  locale: Locale,
  readinessTone: NonNullable<ClawFlowNodeData["contractSummary"]>["readinessTone"]
): string {
  if (readinessTone === "blocked") {
    return t(locale, "executionContract.blocked");
  }

  if (readinessTone === "warning") {
    return t(locale, "executionContract.warning");
  }

  return t(locale, "executionContract.ready");
}

function formatCompactPorts(ports: Array<{ id: string }>): string {
  if (ports.length === 0) {
    return "-";
  }

  return ports.map((port) => port.id).join(", ");
}

function createPlanStepsByNodeId(
  plan: LinearExecutionPlan | null
): Map<string, LinearExecutionPlanStep> {
  if (plan === null) {
    return new Map();
  }

  return new Map(plan.steps.map((step) => [step.nodeId, step]));
}

function createEstimatesByNodeId(estimate: FlowEstimate | null): Map<string, NodeEstimate> {
  if (estimate === null) {
    return new Map();
  }

  return new Map(estimate.nodes.map((nodeEstimate) => [nodeEstimate.nodeId, nodeEstimate]));
}

function isEdgeRemoveChange(
  change: EdgeChange<Edge>
): change is Extract<EdgeChange<Edge>, { type: "remove" }> {
  return change.type === "remove";
}

function createFlowDiagnosticsKey(flow: FlowSpec): string {
  return JSON.stringify({
    id: flow.id,
    nodes: flow.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      role: node.role,
      label: node.label,
      runtimeRef: node.runtimeRef,
      harnessRef: node.harnessRef,
      contextPolicy: node.contextPolicy,
      budgetPolicy: node.budgetPolicy,
      riskPolicy: node.riskPolicy,
      data: node.data
    })),
    edges: flow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: edge.target,
      targetHandle: edge.targetHandle
    }))
  });
}

function createNodePlanSummary(
  locale: Locale,
  step: LinearExecutionPlanStep | undefined,
  liveStatus: ExecutionPlanStepStatus | undefined
): ClawFlowNodeData["planSummary"] {
  if (step === undefined) {
    return undefined;
  }

  const status = liveStatus ?? step.status;

  return {
    stepLabel: t(locale, "linearPlan.step"),
    order: step.order,
    status: t(locale, planStepStatusLabelKeys[status]),
    statusSourceLabel:
      liveStatus === undefined
        ? t(locale, "linearPlan.preflightStatus")
        : t(locale, "linearPlan.liveStatus"),
    isLiveStatus: liveStatus !== undefined,
    hasBlockingReason: step.blockingReasons.length > 0 || status === "blocked"
  };
}

const planStepStatusLabelKeys: Record<ExecutionPlanStepStatus, I18nKey> = {
  pending: "linearPlan.stepStatus.pending",
  queued: "linearPlan.stepStatus.queued",
  running: "linearPlan.stepStatus.running",
  completed: "linearPlan.stepStatus.completed",
  failed: "linearPlan.stepStatus.failed",
  skipped: "linearPlan.stepStatus.skipped",
  blocked: "linearPlan.stepStatus.blocked"
};

function createRuntimeOptions(
  locale: Locale,
  runtimes: RuntimeSpec[],
  currentRuntimeRef: string | undefined
): RuntimeSpec[] {
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
      name: `${currentRuntimeRef} ${t(locale, "inspector.runtimeNotLoadedSuffix")}`,
      type: "custom",
      status: "unknown",
      executionMode: "unavailable",
      capabilities: [],
      errorMessage: t(locale, "inspector.runtimeMissingFromRegistry")
    }
  ];
}

function formatRuntimeSelection(
  locale: Locale,
  runtimeRef: string | undefined,
  runtimes: RuntimeSpec[]
): string | null {
  if (runtimeRef === undefined || runtimeRef === "") {
    return t(locale, "inspector.noRuntimeSelected");
  }

  const runtime = runtimes.find((candidate) => candidate.id === runtimeRef);

  if (runtime === undefined) {
    return `${t(locale, "inspector.selectedRuntime")}: ${runtimeRef}. ${t(
      locale,
      "inspector.runtimeDetailsNotLoaded"
    )}`;
  }

  return `${t(locale, "inspector.selectedRuntime")}: ${runtime.name} / ${runtime.type} / ${runtime.status}`;
}

function createRuntimeLookup(runtimes: RuntimeSpec[]): {
  getRuntime: (id: string) => RuntimeSpec | undefined;
} {
  const runtimeById = new Map(runtimes.map((runtime) => [runtime.id, runtime]));

  return {
    getRuntime: (id) => runtimeById.get(id)
  };
}

function formatTimestamp(timestamp: string, locale: Locale): string {
  return new Date(timestamp).toLocaleTimeString(locale);
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

function formatRunStatus(locale: Locale, status: string, runId: string | null): string {
  if (runId === null) {
    return `${t(locale, "top.runStatus")}: ${status}`;
  }

  return `${t(locale, "top.runStatus")}: ${status} / ${runId}`;
}

function prettyJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2);
}

function getRoleLabel(locale: Locale, role: NodeRole): string {
  return t(locale, roleLabelKeys[role]);
}

function createNodeEstimateSummary(
  locale: Locale,
  estimate: NodeEstimate | undefined
): ClawFlowNodeData["estimateSummary"] {
  if (estimate === undefined) {
    return undefined;
  }

  return {
    titleLabel: t(locale, "resourceEstimate.badge"),
    tokenLabel: formatNodeEstimateTokens(locale, estimate),
    costLabel: formatNodeEstimateCost(locale, estimate),
    latencyLabel: formatNodeEstimateRange(locale, estimate.latency.totalLatencyMs),
    confidenceLabel: t(locale, estimateConfidenceLabelKeys[estimate.confidence]),
    hasWarning: estimate.warnings.length > 0 || estimate.partial
  };
}

const estimateConfidenceLabelKeys = {
  high: "resourceEstimate.confidence.high",
  medium: "resourceEstimate.confidence.medium",
  low: "resourceEstimate.confidence.low",
  unknown: "resourceEstimate.confidence.unknown"
} as const satisfies Record<NodeEstimate["confidence"], I18nKey>;

function formatNodeEstimateTokens(locale: Locale, estimate: NodeEstimate): string {
  return `${t(locale, "resourceEstimate.tokens")}: ${formatNodeEstimateRange(
    locale,
    sumNodeEstimateRanges([
      estimate.tokens.inputTokens,
      estimate.tokens.outputTokens,
      estimate.tokens.reasoningTokens,
      estimate.tokens.toolCallOverheadTokens,
      estimate.tokens.contextCarryoverTokens
    ])
  )}`;
}

function formatNodeEstimateCost(locale: Locale, estimate: NodeEstimate): string {
  if (estimate.cost.status === "zero") {
    return t(locale, "resourceEstimate.noExternalCost");
  }

  if (
    estimate.cost.status === "unknown" ||
    estimate.cost.totalCost === undefined ||
    estimate.cost.totalCost.expected === undefined
  ) {
    return t(locale, "resourceEstimate.unknown");
  }

  return formatNodeEstimateRange(locale, estimate.cost.totalCost);
}

function formatNodeEstimateRange(locale: Locale, range: EstimateRange): string {
  if (range.expected === undefined) {
    return t(locale, "resourceEstimate.unknown");
  }

  if (range.unit === "tokens") {
    if (range.min !== undefined && range.max !== undefined && range.min !== range.max) {
      return `${formatCompactEstimateNumber(range.min)}-${formatCompactEstimateNumber(range.max)} ${t(
        locale,
        "resourceEstimate.unit.tokens"
      )}`;
    }

    return `${formatCompactEstimateNumber(range.expected)} ${t(locale, "resourceEstimate.unit.tokens")}`;
  }

  if (range.unit === "ms") {
    if (range.min !== undefined && range.max !== undefined && range.min !== range.max) {
      return `${formatEstimateMs(range.min)}-${formatEstimateMs(range.max)}`;
    }

    return formatEstimateMs(range.expected);
  }

  if (range.unit === "usd") {
    return `$${range.expected.toFixed(4)}`;
  }

  return String(range.expected);
}

function sumNodeEstimateRanges(ranges: Array<EstimateRange | undefined>): EstimateRange {
  const definedRanges = ranges.filter((range): range is EstimateRange => range !== undefined);

  if (definedRanges.length === 0) {
    return {
      min: 0,
      expected: 0,
      max: 0,
      unit: "tokens"
    };
  }

  if (
    definedRanges.some(
      (range) => range.min === undefined || range.expected === undefined || range.max === undefined
    )
  ) {
    return {
      unit: definedRanges[0]?.unit ?? "unknown"
    };
  }

  return {
    min: definedRanges.reduce((total, range) => total + (range.min ?? 0), 0),
    expected: definedRanges.reduce((total, range) => total + (range.expected ?? 0), 0),
    max: definedRanges.reduce((total, range) => total + (range.max ?? 0), 0),
    unit: definedRanges[0]?.unit ?? "tokens"
  };
}

function formatCompactEstimateNumber(value: number): string {
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }

  return String(Math.round(value));
}

function formatEstimateMs(value: number): string {
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}s`;
  }

  return `${Math.round(value)}ms`;
}

function getNodeTestId(node: FlowNode): string {
  if (node.type === "manual.trigger") {
    return "node-manual-trigger";
  }

  if (node.type === "agent.start") {
    return "node-start-agent";
  }

  if (node.type === "agent.worker") {
    return "node-worker-agent";
  }

  if (node.type === "agent.end") {
    return "node-end-agent";
  }

  if (node.type === "output.console") {
    return "node-console-output";
  }

  return `node-${node.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function hasPayloadFlag(payload: Record<string, unknown> | undefined, flag: string): boolean {
  if (payload === undefined) {
    return false;
  }

  if (payload[flag] === true) {
    return true;
  }

  const output = payload.output;

  if (typeof output === "object" && output !== null && (output as Record<string, unknown>)[flag] === true) {
    return true;
  }

  const runtimePlan = payload.runtimePlan;

  return (
    typeof runtimePlan === "object" &&
    runtimePlan !== null &&
    (runtimePlan as Record<string, unknown>)[flag] === true
  );
}
