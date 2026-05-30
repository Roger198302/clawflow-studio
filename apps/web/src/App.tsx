import {
  Background,
  Controls,
  ConnectionMode,
  MarkerType,
  MiniMap,
  ReactFlow,
  type ReactFlowInstance,
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
  BookOpen,
  ChevronDown,
  ChevronUp,
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
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type WheelEvent as ReactWheelEvent
} from "react";
import {
  ClawFlowNode,
  type ClawFlowNodeData,
  type EffectiveNodeDisplayMode
} from "./components/ClawFlowNode";
import { BeginnerStartCard } from "./components/BeginnerStartCard";
import { DemoGuidePanel } from "./components/DemoGuidePanel";
import { DismissibleAlert } from "./components/DismissibleAlert";
import { ExecutionContractPreviewPanel } from "./components/ExecutionContractPreviewPanel";
import { HarnessInspector } from "./components/HarnessInspector";
import { LinearExecutionPlanPanel } from "./components/LinearExecutionPlanPanel";
import { ResourceEstimatePanel } from "./components/ResourceEstimatePanel";
import { RuntimeManagerPanel } from "./components/RuntimeManagerPanel";
import { SessionConsole } from "./components/SessionConsole";
import {
  readSimpleNodeSetup,
  SimpleNodeSetupPanel,
  type SimpleNodeConnectionType,
  type SimpleNodeSetupData
} from "./components/SimpleNodeSetupPanel";
import { TaskLauncherPanel } from "./components/TaskLauncherPanel";
import { getCatalogDescription, getCatalogLabel, MVP_NODE_CATALOG } from "./flowCatalog";
import { createFlowFromTaskTemplate, type TaskTemplateInput } from "./flowTemplates";
import {
  formatHarnessExecutionMode,
  formatHarnessFit,
  formatHarnessLabel,
  formatHarnessRisk
} from "./harnessUi";
import { t, type I18nKey, type Locale } from "./i18n";
import { buildOpenClawTaskExport } from "./openClawTaskExport";
import { useFlowStore, type RunProblemInput } from "./store/flowStore";
import { useLocaleStore } from "./store/localeStore";
import {
  useRuntimeStore,
  type AgentGatewayBinding,
  type GatewayProfile,
  type LocalGatewayConnection,
  type LocalGatewayConnectionStatus
} from "./store/runtimeStore";
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
const NODE_DISPLAY_MODE_STORAGE_KEY = "clawflow.nodeDisplayMode";
const WORKSPACE_PRESET_STORAGE_KEY = "clawflow.workspacePreset";
const WORKSPACE_PANEL_STATE_STORAGE_KEY = "clawflow.workspacePanelState";
const EXPERIENCE_MODE_STORAGE_KEY = "clawflow.experienceMode";
const CONTEXT_MENU_WIDTH = 224;
const CONTEXT_MENU_MARGIN = 8;
const CONTEXT_MENU_ROW_HEIGHT = 34;
const CONTEXT_MENU_VERTICAL_PADDING = 12;
const workspaceViewModes = ["default", "focus", "run-monitor", "debug"] as const;
type WorkspaceViewMode = (typeof workspaceViewModes)[number];
const nodeDisplayModes = ["auto", "compact", "standard", "detailed", "trace"] as const;
type NodeDisplayMode = (typeof nodeDisplayModes)[number];
const workspacePresets = ["builder", "runner", "reviewer", "presenter", "custom"] as const;
type WorkspacePreset = (typeof workspacePresets)[number];
const experienceModes = ["simple", "advanced"] as const;
type ExperienceMode = (typeof experienceModes)[number];
type CanvasContextMenuKind = "pane" | "node" | "edge";
type ExportPanelMode = "flow-json" | "openclaw-task";
type OpenClawTaskCopyStatus = "idle" | "success" | "error";

const workspaceViewModeLabelKeys: Record<WorkspaceViewMode, I18nKey> = {
  default: "workspaceView.default",
  focus: "workspaceView.focus",
  "run-monitor": "workspaceView.runMonitor",
  debug: "workspaceView.debug"
};

const nodeDisplayModeLabelKeys: Record<NodeDisplayMode, I18nKey> = {
  auto: "nodeDisplay.auto",
  compact: "nodeDisplay.compact",
  standard: "nodeDisplay.standard",
  detailed: "nodeDisplay.detailed",
  trace: "nodeDisplay.trace"
};

const workspacePresetLabelKeys: Record<WorkspacePreset, I18nKey> = {
  builder: "workspacePreset.builder",
  runner: "workspacePreset.runner",
  reviewer: "workspacePreset.reviewer",
  presenter: "workspacePreset.presenter",
  custom: "workspacePreset.custom"
};

const experienceModeLabelKeys: Record<ExperienceMode, I18nKey> = {
  simple: "experienceMode.simple",
  advanced: "experienceMode.advanced"
};

const nodeOverrideDisplayModes: EffectiveNodeDisplayMode[] = [
  "compact",
  "standard",
  "detailed",
  "trace"
];

const nodeOverrideModeLabelKeys: Record<EffectiveNodeDisplayMode, I18nKey> = {
  compact: "nodeDisplay.compact",
  standard: "nodeDisplay.standard",
  detailed: "nodeDisplay.detailed",
  trace: "nodeDisplay.trace"
};

const nodeIcons: Record<NodeType, LucideIcon> = {
  "manual.trigger": MousePointer2,
  "agent.start": Play,
  "agent.worker": Workflow,
  "agent.end": CircleStop,
  "output.console": SquareTerminal
};

interface SimpleNodeLibraryItem {
  type: NodeType;
  labelKey: I18nKey;
  descriptionKey: I18nKey;
  helperKey: I18nKey;
  defaultLabelKey: I18nKey;
}

const simpleNodeLibraryItems: SimpleNodeLibraryItem[] = [
  {
    type: "manual.trigger",
    labelKey: "node.simpleStart.label",
    descriptionKey: "node.simpleStart.description",
    helperKey: "node.simpleStart.helper",
    defaultLabelKey: "node.simpleStart.label"
  },
  {
    type: "agent.worker",
    labelKey: "node.simpleAgentStep.label",
    descriptionKey: "node.simpleAgentStep.description",
    helperKey: "node.simpleAgentStep.helper",
    defaultLabelKey: "node.simpleAgentStep.label"
  },
  {
    type: "output.console",
    labelKey: "node.simpleOutput.label",
    descriptionKey: "node.simpleOutput.description",
    helperKey: "node.simpleOutput.helper",
    defaultLabelKey: "node.simpleOutput.label"
  }
];

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

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface CanvasContextMenuState extends ContextMenuPosition {
  kind: CanvasContextMenuKind;
  flowPosition?: FlowNode["position"];
  nodeId?: string;
  edgeId?: string;
}

interface CanvasContextMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  groupId?: string;
  groupLabel?: string;
  isActive?: boolean;
  tone?: "danger";
}

interface CanvasContextMenuProps {
  menu: CanvasContextMenuState;
  items: CanvasContextMenuItem[];
  label: string;
  closeLabel: string;
  onClose: () => void;
}

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

interface WorkspacePanelState {
  nodeLibraryCollapsed: boolean;
  inspectorCollapsed: boolean;
  runInspectorCollapsed: boolean;
}

interface WorkspacePresetConfig {
  workspaceViewMode: WorkspaceViewMode;
  nodeDisplayMode: NodeDisplayMode;
  panelState: WorkspacePanelState;
}

const DEFAULT_WORKSPACE_PANEL_STATE: WorkspacePanelState = {
  nodeLibraryCollapsed: false,
  inspectorCollapsed: false,
  runInspectorCollapsed: false
};

const PRESET_CONFIGS: Record<Exclude<WorkspacePreset, "custom">, WorkspacePresetConfig> = {
  builder: {
    workspaceViewMode: "default",
    nodeDisplayMode: "standard",
    panelState: {
      nodeLibraryCollapsed: false,
      inspectorCollapsed: false,
      runInspectorCollapsed: true
    }
  },
  runner: {
    workspaceViewMode: "run-monitor",
    nodeDisplayMode: "trace",
    panelState: {
      nodeLibraryCollapsed: true,
      inspectorCollapsed: true,
      runInspectorCollapsed: false
    }
  },
  reviewer: {
    workspaceViewMode: "debug",
    nodeDisplayMode: "detailed",
    panelState: {
      nodeLibraryCollapsed: true,
      inspectorCollapsed: false,
      runInspectorCollapsed: false
    }
  },
  presenter: {
    workspaceViewMode: "focus",
    nodeDisplayMode: "compact",
    panelState: {
      nodeLibraryCollapsed: true,
      inspectorCollapsed: true,
      runInspectorCollapsed: true
    }
  }
};

function isWorkspaceViewMode(value: string | null): value is WorkspaceViewMode {
  return workspaceViewModes.some((mode) => mode === value);
}

function isNodeDisplayMode(value: string | null): value is NodeDisplayMode {
  return nodeDisplayModes.some((mode) => mode === value);
}

function isWorkspacePreset(value: string | null): value is WorkspacePreset {
  return workspacePresets.some((preset) => preset === value);
}

function isExperienceMode(value: string | null): value is ExperienceMode {
  return experienceModes.some((mode) => mode === value);
}

function getLocalGatewayConnectionStatusKey(status: LocalGatewayConnectionStatus): I18nKey {
  if (status === "checking") {
    return "gatewayQuickConnect.checking";
  }

  if (status === "connected") {
    return "gatewayQuickConnect.connected";
  }

  if (status === "unavailable") {
    return "gatewayQuickConnect.unavailable";
  }

  if (status === "protected") {
    return "gatewayQuickConnect.protected";
  }

  return "gatewayQuickConnect.idle";
}

function formatLocalGatewayConnectionMessage(
  locale: Locale,
  connection: LocalGatewayConnection
): string {
  if (connection.status === "checking") {
    return t(locale, "gatewayQuickConnect.checking");
  }

  if (connection.status === "connected") {
    return `${t(locale, "gatewayQuickConnect.reachable")} ${t(
      locale,
      "gatewayQuickConnect.protectedCopy"
    )}`;
  }

  if (connection.status === "unavailable") {
    const message = connection.message?.trim();

    if (message === undefined || message === "" || message.includes("loopback http")) {
      return t(locale, "gatewayQuickConnect.invalidLocalUrl");
    }

    return message;
  }

  return t(locale, "gatewayQuickConnect.protectedCopy");
}

function loadStoredWorkspaceViewMode(): WorkspaceViewMode {
  const storedValue = window.localStorage.getItem(WORKSPACE_VIEW_MODE_STORAGE_KEY);

  return isWorkspaceViewMode(storedValue) ? storedValue : "default";
}

function loadStoredNodeDisplayMode(): NodeDisplayMode {
  const storedValue = window.localStorage.getItem(NODE_DISPLAY_MODE_STORAGE_KEY);

  return isNodeDisplayMode(storedValue) ? storedValue : "auto";
}

function loadStoredWorkspacePreset(): WorkspacePreset {
  const storedValue = window.localStorage.getItem(WORKSPACE_PRESET_STORAGE_KEY);

  return isWorkspacePreset(storedValue) ? storedValue : "custom";
}

function loadStoredExperienceMode(): ExperienceMode {
  const storedValue = window.localStorage.getItem(EXPERIENCE_MODE_STORAGE_KEY);

  return isExperienceMode(storedValue) ? storedValue : "simple";
}

function isWorkspacePanelState(value: unknown): value is WorkspacePanelState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<WorkspacePanelState>;

  return (
    typeof candidate.nodeLibraryCollapsed === "boolean" &&
    typeof candidate.inspectorCollapsed === "boolean" &&
    typeof candidate.runInspectorCollapsed === "boolean"
  );
}

function loadStoredWorkspacePanelState(): WorkspacePanelState {
  const storedValue = window.localStorage.getItem(WORKSPACE_PANEL_STATE_STORAGE_KEY);

  if (storedValue === null) {
    return DEFAULT_WORKSPACE_PANEL_STATE;
  }

  try {
    const parsedValue = JSON.parse(storedValue);

    return isWorkspacePanelState(parsedValue) ? parsedValue : DEFAULT_WORKSPACE_PANEL_STATE;
  } catch {
    return DEFAULT_WORKSPACE_PANEL_STATE;
  }
}

function storeWorkspaceViewMode(mode: WorkspaceViewMode): void {
  window.localStorage.setItem(WORKSPACE_VIEW_MODE_STORAGE_KEY, mode);
}

function storeNodeDisplayMode(mode: NodeDisplayMode): void {
  window.localStorage.setItem(NODE_DISPLAY_MODE_STORAGE_KEY, mode);
}

function storeWorkspacePreset(preset: WorkspacePreset): void {
  window.localStorage.setItem(WORKSPACE_PRESET_STORAGE_KEY, preset);
}

function storeExperienceMode(mode: ExperienceMode): void {
  window.localStorage.setItem(EXPERIENCE_MODE_STORAGE_KEY, mode);
}

function storeWorkspacePanelState(panelState: WorkspacePanelState): void {
  window.localStorage.setItem(WORKSPACE_PANEL_STATE_STORAGE_KEY, JSON.stringify(panelState));
}

function resolveEffectiveNodeDisplayMode(
  nodeDisplayMode: NodeDisplayMode,
  workspaceViewMode: WorkspaceViewMode,
  experienceMode: ExperienceMode
): EffectiveNodeDisplayMode {
  if (nodeDisplayMode !== "auto") {
    return nodeDisplayMode;
  }

  if (workspaceViewMode === "focus") {
    return "compact";
  }

  if (workspaceViewMode === "run-monitor") {
    return "trace";
  }

  if (workspaceViewMode === "debug") {
    return "detailed";
  }

  if (experienceMode === "simple") {
    return "compact";
  }

  return "standard";
}

function createNodeCompanionPresentation(status: RunStatus): ClawFlowNodeData["companion"] {
  const petMood = (() => {
    switch (status) {
      case "queued":
      case "running":
      case "success":
      case "failed":
        return status;
      case "waiting_approval":
        return "waiting";
      case "idle":
        return "idle";
      case "skipped":
      case "cancelled":
        return "warning";
    }
  })();

  return {
    petEnabled: false,
    petMood,
    petAnchor: "top-right"
  };
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
        runInspector: true
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

function createContextMenuPosition(
  clientX: number,
  clientY: number,
  itemCount: number
): ContextMenuPosition {
  const estimatedHeight = itemCount * CONTEXT_MENU_ROW_HEIGHT + CONTEXT_MENU_VERTICAL_PADDING;
  const maxX = Math.max(CONTEXT_MENU_MARGIN, window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN);
  const maxY = Math.max(CONTEXT_MENU_MARGIN, window.innerHeight - estimatedHeight - CONTEXT_MENU_MARGIN);

  return {
    x: Math.min(Math.max(clientX, CONTEXT_MENU_MARGIN), maxX),
    y: Math.min(Math.max(clientY, CONTEXT_MENU_MARGIN), maxY)
  };
}

function getContextMenuItemCount(kind: CanvasContextMenuKind): number {
  if (kind === "pane") {
    return 7;
  }

  if (kind === "node") {
    return 15;
  }

  return 1;
}

function CanvasContextMenu({
  menu,
  items,
  label,
  closeLabel,
  onClose
}: CanvasContextMenuProps): ReactElement {
  let previousGroupId: string | undefined;

  return (
    <>
      <button
        type="button"
        className="canvas-context-menu-backdrop"
        aria-label={closeLabel}
        onPointerDown={onClose}
      />
      <div
        className={`canvas-context-menu context-${menu.kind}`}
        role="menu"
        aria-label={label}
        data-testid="canvas-context-menu"
        style={{
          left: menu.x,
          top: menu.y
        }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {items.map((item) => {
          const shouldShowGroup =
            item.groupId !== undefined && item.groupId !== previousGroupId;
          previousGroupId = item.groupId;

          return (
            <div className="canvas-context-menu-row" key={item.id}>
              {shouldShowGroup ? (
                <div
                  className="canvas-context-menu-group-label"
                  data-testid={`context-menu-group-${item.groupId}`}
                >
                  {item.groupLabel}
                </div>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className={`${item.isActive ? "is-active" : ""} ${
                  item.tone === "danger" ? "is-danger" : ""
                }`}
                aria-current={item.isActive ? "true" : undefined}
                data-active={item.isActive ? "true" : "false"}
                data-testid={`context-menu-${item.id}`}
                onClick={item.onSelect}
              >
                {item.isActive ? <span aria-hidden="true" className="context-menu-active-dot" /> : null}
                <span>{item.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function App(): ReactElement {
  const activeSocketRef = useRef<WebSocket | null>(null);
  const reactFlowInstanceRef = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(null);
  const [workspaceViewMode, setWorkspaceViewModeState] = useState<WorkspaceViewMode>(
    loadStoredWorkspaceViewMode
  );
  const [nodeDisplayMode, setNodeDisplayModeState] = useState<NodeDisplayMode>(
    loadStoredNodeDisplayMode
  );
  const [workspacePreset, setWorkspacePresetState] = useState<WorkspacePreset>(
    loadStoredWorkspacePreset
  );
  const [experienceMode, setExperienceModeState] = useState<ExperienceMode>(
    loadStoredExperienceMode
  );
  const [workspacePanelState, setWorkspacePanelState] = useState<WorkspacePanelState>(
    loadStoredWorkspacePanelState
  );
  const [isInspectorAdvancedSettingsOpen, setIsInspectorAdvancedSettingsOpen] =
    useState(false);
  const [nodeDisplayOverrides, setNodeDisplayOverrides] = useState<
    Partial<Record<string, EffectiveNodeDisplayMode>>
  >({});
  const [contextMenu, setContextMenu] = useState<CanvasContextMenuState | null>(null);
  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState(false);
  const [isTaskLauncherOpen, setIsTaskLauncherOpen] = useState(false);
  const [exportPanelMode, setExportPanelMode] = useState<ExportPanelMode>("flow-json");
  const [openClawTaskCopyStatus, setOpenClawTaskCopyStatus] =
    useState<OpenClawTaskCopyStatus>("idle");
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
  const duplicateNode = useFlowStore((state) => state.duplicateNode);
  const removeNode = useFlowStore((state) => state.removeNode);
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
  const resetDemoFlow = useFlowStore((state) => state.resetDemoFlow);
  const replaceFlow = useFlowStore((state) => state.replaceFlow);
  const clearRun = useFlowStore((state) => state.clearRun);
  const runtimes = useRuntimeStore((state) => state.runtimes);
  const runtimeHealth = useRuntimeStore((state) => state.runtimeHealth);
  const runtimeLoadStatus = useRuntimeStore((state) => state.runtimeLoadStatus);
  const runtimeError = useRuntimeStore((state) => state.runtimeError);
  const isRuntimeManagerOpen = useRuntimeStore((state) => state.isRuntimeManagerOpen);
  const localGatewayConnection = useRuntimeStore((state) => state.localGatewayConnection);
  const gatewayProfiles = useRuntimeStore((state) => state.gatewayProfiles);
  const agentGatewayBindings = useRuntimeStore((state) => state.agentGatewayBindings);
  const openRuntimeManager = useRuntimeStore((state) => state.openRuntimeManager);
  const closeRuntimeManager = useRuntimeStore((state) => state.closeRuntimeManager);
  const loadRuntimes = useRuntimeStore((state) => state.loadRuntimes);
  const healthCheckAll = useRuntimeStore((state) => state.healthCheckAll);
  const quickConnectOpenClaw = useRuntimeStore((state) => state.quickConnectOpenClaw);
  const clearLocalGatewayConnection = useRuntimeStore(
    (state) => state.clearLocalGatewayConnection
  );
  const addGatewayProfile = useRuntimeStore((state) => state.addGatewayProfile);
  const updateGatewayProfile = useRuntimeStore((state) => state.updateGatewayProfile);
  const deleteGatewayProfile = useRuntimeStore((state) => state.deleteGatewayProfile);
  const checkGatewayProfile = useRuntimeStore((state) => state.checkGatewayProfile);
  const setAgentGatewayBinding = useRuntimeStore((state) => state.setAgentGatewayBinding);
  const clearAgentGatewayBindings = useRuntimeStore((state) => state.clearAgentGatewayBindings);
  const loadSession = useSessionStore((state) => state.loadSession);
  const runActiveSession = useSessionStore((state) => state.runActiveSession);
  const isNodeLibraryCollapsed = workspacePanelState.nodeLibraryCollapsed;
  const isInspectorCollapsed = workspacePanelState.inspectorCollapsed;
  const isRunInspectorCollapsed = workspacePanelState.runInspectorCollapsed;
  const [gatewayBaseUrlInput, setGatewayBaseUrlInput] = useState(
    localGatewayConnection.baseUrl
  );
  const [gatewayHealthPathInput, setGatewayHealthPathInput] = useState(
    localGatewayConnection.healthPath
  );

  useEffect(() => {
    setIsInspectorAdvancedSettingsOpen(experienceMode === "advanced");
  }, [experienceMode, selectedNodeId]);

  useEffect(() => {
    void loadRuntimes();
  }, [loadRuntimes]);

  useEffect(() => {
    if (localGatewayConnection.status === "checking") {
      return;
    }

    setGatewayBaseUrlInput(localGatewayConnection.baseUrl);
    setGatewayHealthPathInput(localGatewayConnection.healthPath);
  }, [localGatewayConnection.baseUrl, localGatewayConnection.healthPath, localGatewayConnection.status]);

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
  const gatewayProfileUsage = useMemo(
    () => createGatewayProfileUsage(flow.nodes, agentGatewayBindings),
    [agentGatewayBindings, flow.nodes]
  );
  const selectedAgentGatewayBinding = useMemo<AgentGatewayBinding>(
    () =>
      selectedNode === null
        ? { mode: "workspace-default" }
        : agentGatewayBindings[selectedNode.id] ?? { mode: "workspace-default" },
    [agentGatewayBindings, selectedNode]
  );
  const selectedGatewayProfile = useMemo(
    () =>
      selectedAgentGatewayBinding.mode === "profile"
        ? gatewayProfiles.find((profile) => profile.id === selectedAgentGatewayBinding.profileId) ??
          null
        : null,
    [gatewayProfiles, selectedAgentGatewayBinding]
  );
  const effectiveNodeDisplayMode = useMemo(
    () => resolveEffectiveNodeDisplayMode(nodeDisplayMode, workspaceViewMode, experienceMode),
    [experienceMode, nodeDisplayMode, workspaceViewMode]
  );
  const shouldShowTechnicalPreviews = experienceMode === "advanced" || workspaceViewMode === "debug";

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
          label: createNodePresentationLabel(locale, node, experienceMode),
          nodeType: node.type,
          displayMode: nodeDisplayOverrides[node.id] ?? effectiveNodeDisplayMode,
          isSimpleExperience: experienceMode === "simple",
          simpleSummary: createSimpleNodeSummary(locale, node),
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
          estimateSummary: createNodeEstimateSummary(locale, estimatesByNodeId.get(node.id)),
          gatewaySummary: createNodeGatewaySummary(
            locale,
            node,
            agentGatewayBindings,
            gatewayProfiles
          ),
          outcomeSummary: createNodeOutcomeSummary(
            locale,
            node,
            runEvents,
            nodeStatuses[node.id] ?? "idle"
          ),
          companion: createNodeCompanionPresentation(nodeStatuses[node.id] ?? "idle")
        },
        selected: node.id === selectedNodeId
      }));
    },
    [
      effectiveNodeDisplayMode,
      experienceMode,
      executionContractPreview,
      flowEstimate,
      flow.nodes,
      linearExecutionPlan,
      livePlanStepStatuses,
      locale,
      agentGatewayBindings,
      gatewayProfiles,
      nodeDisplayOverrides,
      nodeStatuses,
      runEvents,
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
  const openClawTaskText = useMemo(
    () =>
      buildOpenClawTaskExport({
        flow,
        linearExecutionPlan,
        runReadinessReport,
        localGatewayConnection,
        gatewayProfiles,
        agentGatewayBindings: createOpenClawTaskAgentGatewayBindings(
          flow.nodes,
          agentGatewayBindings,
          gatewayProfiles,
          localGatewayConnection
        )
      }),
    [
      agentGatewayBindings,
      flow,
      gatewayProfiles,
      linearExecutionPlan,
      localGatewayConnection,
      runReadinessReport
    ]
  );
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
  const selectedNodeOutcome = useMemo<NonNullable<ClawFlowNodeData["outcomeSummary"]> | null>(
    () =>
      selectedNode === null
        ? null
        : createNodeOutcomeSummary(
            locale,
            selectedNode,
            runEvents,
            nodeStatuses[selectedNode.id] ?? "idle"
          ),
    [locale, nodeStatuses, runEvents, selectedNode]
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

  const setWorkspacePreset = useCallback((preset: WorkspacePreset) => {
    setWorkspacePresetState(preset);
    storeWorkspacePreset(preset);
  }, []);

  const setWorkspaceViewMode = useCallback(
    (mode: WorkspaceViewMode, options?: { markCustom?: boolean }) => {
      setWorkspaceViewModeState(mode);
      storeWorkspaceViewMode(mode);

      if (options?.markCustom !== false) {
        setWorkspacePreset("custom");
      }
    },
    [setWorkspacePreset]
  );

  const setNodeDisplayMode = useCallback(
    (mode: NodeDisplayMode, options?: { markCustom?: boolean }) => {
      setNodeDisplayModeState(mode);
      storeNodeDisplayMode(mode);

      if (options?.markCustom !== false) {
        setWorkspacePreset("custom");
      }
    },
    [setWorkspacePreset]
  );

  const setExperienceMode = useCallback((mode: ExperienceMode) => {
    setExperienceModeState(mode);
    storeExperienceMode(mode);
  }, []);

  const updateWorkspacePanelState = useCallback(
    (patch: Partial<WorkspacePanelState>, options?: { markCustom?: boolean }) => {
      setWorkspacePanelState((currentPanelState) => {
        const nextPanelState = {
          ...currentPanelState,
          ...patch
        };
        storeWorkspacePanelState(nextPanelState);
        return nextPanelState;
      });

      if (options?.markCustom !== false) {
        setWorkspacePreset("custom");
      }
    },
    [setWorkspacePreset]
  );

  const applyWorkspacePreset = useCallback(
    (preset: WorkspacePreset) => {
      setWorkspacePreset(preset);

      if (preset === "custom") {
        return;
      }

      const config = PRESET_CONFIGS[preset];
      setWorkspaceViewModeState(config.workspaceViewMode);
      setNodeDisplayModeState(config.nodeDisplayMode);
      setWorkspacePanelState(config.panelState);
      storeWorkspaceViewMode(config.workspaceViewMode);
      storeNodeDisplayMode(config.nodeDisplayMode);
      storeWorkspacePanelState(config.panelState);
    },
    [setWorkspacePreset]
  );

  const resetLayout = useCallback(() => {
    setWorkspacePreset("custom");
    setWorkspaceViewModeState("default");
    setNodeDisplayModeState("auto");
    setWorkspacePanelState(DEFAULT_WORKSPACE_PANEL_STATE);
    setNodeDisplayOverrides({});
    storeWorkspaceViewMode("default");
    storeNodeDisplayMode("auto");
    setExperienceMode("simple");
    storeWorkspacePanelState(DEFAULT_WORKSPACE_PANEL_STATE);
  }, [setExperienceMode, setWorkspacePreset]);

  const hideNodeDetails = useCallback((nodeId: string) => {
    setNodeDisplayOverrides((currentOverrides) => ({
      ...currentOverrides,
      [nodeId]: "compact"
    }));
  }, []);

  const showNodeDetails = useCallback((nodeId: string) => {
    setNodeDisplayOverrides((currentOverrides) => {
      const nextOverrides = { ...currentOverrides };
      delete nextOverrides[nodeId];
      return nextOverrides;
    });
  }, []);

  const setNodeDisplayOverride = useCallback(
    (nodeId: string, displayMode: EffectiveNodeDisplayMode | null) => {
      if (displayMode === null) {
        showNodeDetails(nodeId);
        return;
      }

      setNodeDisplayOverrides((currentOverrides) => ({
        ...currentOverrides,
        [nodeId]: displayMode
      }));
    },
    [showNodeDetails]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || isTextEditingTarget(event.target)) {
        return;
      }

      if (contextMenu !== null) {
        setContextMenu(null);
        return;
      }

      if (isDemoGuideOpen) {
        setIsDemoGuideOpen(false);
        return;
      }

      if (isTaskLauncherOpen) {
        setIsTaskLauncherOpen(false);
        return;
      }

      if (workspaceViewMode !== "default") {
        setWorkspaceViewMode("default");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contextMenu, isDemoGuideOpen, isTaskLauncherOpen, setWorkspaceViewMode, workspaceViewMode]);

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

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const stopPanelWheelPropagation = useCallback((event: ReactWheelEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | ReactMouseEvent<Element>) => {
      event.preventDefault();
      const itemCount = getContextMenuItemCount("pane");
      const menuPosition = createContextMenuPosition(event.clientX, event.clientY, itemCount);
      const flowPosition =
        reactFlowInstanceRef.current?.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY
        }) ?? {
          x: event.clientX,
          y: event.clientY
        };

      setContextMenu({
        kind: "pane",
        ...menuPosition,
        flowPosition
      });
    },
    []
  );

  const handleNodeContextMenu = useCallback(
    (event: MouseEvent | ReactMouseEvent<Element>, node: CanvasNode) => {
      event.preventDefault();
      event.stopPropagation();
      selectNode(node.id);
      setContextMenu({
        kind: "node",
        ...createContextMenuPosition(event.clientX, event.clientY, getContextMenuItemCount("node")),
        nodeId: node.id
      });
    },
    [selectNode]
  );

  const handleEdgeContextMenu = useCallback(
    (event: MouseEvent | ReactMouseEvent<Element>, edge: Edge) => {
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        kind: "edge",
        ...createContextMenuPosition(event.clientX, event.clientY, getContextMenuItemCount("edge")),
        edgeId: edge.id
      });
    },
    []
  );

  const handleSaveFlow = useCallback(() => {
    markFlowSaved();
  }, [markFlowSaved]);

  const handleToggleFlowExport = useCallback(() => {
    setExportPanelMode("flow-json");
    toggleExport();
  }, [toggleExport]);

  const handleOpenOpenClawTaskExport = useCallback(() => {
    setExportPanelMode("openclaw-task");

    if (!isExportOpen) {
      toggleExport();
    }
  }, [isExportOpen, toggleExport]);

  const handleCopyOpenClawTask = useCallback(() => {
    setExportPanelMode("openclaw-task");

    if (!isExportOpen) {
      toggleExport();
    }

    if (navigator.clipboard === undefined) {
      setOpenClawTaskCopyStatus("error");
      return;
    }

    void navigator.clipboard
      .writeText(openClawTaskText)
      .then(() => setOpenClawTaskCopyStatus("success"))
      .catch(() => setOpenClawTaskCopyStatus("error"));
  }, [isExportOpen, openClawTaskText, toggleExport]);

  const handleRefreshRuntimes = useCallback(() => {
    void loadRuntimes();
  }, [loadRuntimes]);

  const handleRuntimeHealthCheck = useCallback(() => {
    void healthCheckAll();
  }, [healthCheckAll]);

  const handleGatewayQuickConnect = useCallback(() => {
    void quickConnectOpenClaw({
      baseUrl: gatewayBaseUrlInput,
      healthPath: gatewayHealthPathInput
    });
  }, [gatewayBaseUrlInput, gatewayHealthPathInput, quickConnectOpenClaw]);

  const handleGatewayQuickConnectSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      handleGatewayQuickConnect();
    },
    [handleGatewayQuickConnect]
  );

  const handleClearGatewayConnection = useCallback(() => {
    clearLocalGatewayConnection();
  }, [clearLocalGatewayConnection]);

  const handleRefreshExecutionContractPreview = useCallback(() => {
    void requestExecutionContractPreview(flow);
  }, [flow, requestExecutionContractPreview]);

  const handleRefreshLinearExecutionPlan = useCallback(() => {
    void requestLinearExecutionPlan(flow);
  }, [flow, requestLinearExecutionPlan]);

  const handleRefreshFlowEstimate = useCallback(() => {
    void requestFlowEstimate(flow);
  }, [flow, requestFlowEstimate]);

  const openDemoGuide = useCallback(() => {
    setIsDemoGuideOpen(true);
  }, []);

  const closeDemoGuide = useCallback(() => {
    setIsDemoGuideOpen(false);
  }, []);

  const openTaskLauncher = useCallback(() => {
    setIsTaskLauncherOpen(true);
  }, []);

  const closeTaskLauncher = useCallback(() => {
    setIsTaskLauncherOpen(false);
  }, []);

  const handleOpenRuntimeManagerFromGuide = useCallback(() => {
    setIsDemoGuideOpen(false);
    openRuntimeManager();
  }, [openRuntimeManager]);

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

  const handleNodeDisplayModeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setNodeDisplayMode(event.target.value as NodeDisplayMode);
    },
    [setNodeDisplayMode]
  );

  const handleExperienceModeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setExperienceMode(event.target.value as ExperienceMode);
    },
    [setExperienceMode]
  );

  const handleWorkspacePresetChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      applyWorkspacePreset(event.target.value as WorkspacePreset);
    },
    [applyWorkspacePreset]
  );

  const closeActiveSocket = useCallback(() => {
    if (activeSocketRef.current !== null) {
      const socketToClose = activeSocketRef.current;
      activeSocketRef.current = null;
      socketToClose.close();
    }
  }, []);

  const handleCreateFlowFromTemplate = useCallback(
    (input: TaskTemplateInput) => {
      if (!window.confirm(t(locale, "taskLauncher.replaceConfirm"))) {
        return;
      }

      const nextFlow = createFlowFromTaskTemplate(input);

      closeActiveSocket();
      replaceFlow(nextFlow);
      clearAgentGatewayBindings();
      setNodeDisplayOverrides({});
      setContextMenu(null);
      setIsTaskLauncherOpen(false);

      window.setTimeout(() => {
        void reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 180 });
      }, 0);
    },
    [clearAgentGatewayBindings, closeActiveSocket, locale, replaceFlow]
  );

  const handleStartHelloWorldFromGuide = useCallback(() => {
    if (!window.confirm(t(locale, "taskLauncher.replaceConfirm"))) {
      return;
    }

    const nextFlow = createFlowFromTaskTemplate({ templateId: "hello-world" });

    closeActiveSocket();
    replaceFlow(nextFlow);
    clearAgentGatewayBindings();
    setNodeDisplayOverrides({});
    setContextMenu(null);
    setIsDemoGuideOpen(false);
    applyWorkspacePreset("builder");

    window.setTimeout(() => {
      void reactFlowInstanceRef.current?.fitView({ padding: 0.35, duration: 180 });
    }, 0);
  }, [applyWorkspacePreset, clearAgentGatewayBindings, closeActiveSocket, locale, replaceFlow]);

  const handleResetDemoFlow = useCallback(() => {
    if (!window.confirm(t(locale, "demoGuide.resetConfirm"))) {
      return;
    }

    closeActiveSocket();
    resetDemoFlow();
    setNodeDisplayOverrides({});
    clearAgentGatewayBindings();
    setContextMenu(null);
  }, [clearAgentGatewayBindings, closeActiveSocket, locale, resetDemoFlow]);

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

  const handleGatewayBindingModeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      if (selectedNode === null) {
        return;
      }

      const mode = event.target.value;

      if (mode === "profile") {
        setAgentGatewayBinding(selectedNode.id, {
          mode: "profile",
          profileId: gatewayProfiles[0]?.id
        });
        return;
      }

      setAgentGatewayBinding(selectedNode.id, {
        mode: "workspace-default"
      });
    },
    [gatewayProfiles, selectedNode, setAgentGatewayBinding]
  );

  const handleGatewayProfileSelectionChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      if (selectedNode !== null) {
        setAgentGatewayBinding(selectedNode.id, {
          mode: "profile",
          profileId: event.target.value
        });
      }
    },
    [selectedNode, setAgentGatewayBinding]
  );

  const handleSimpleSetupChange = useCallback(
    (patch: Partial<SimpleNodeSetupData>) => {
      if (selectedNode === null) {
        return;
      }

      const currentSetup = readSimpleNodeSetup(selectedNode, selectedAgentGatewayBinding);
      const nextSetup = {
        ...currentSetup,
        ...patch
      };
      const nextData = {
        ...(selectedNode.data ?? {}),
        simpleSetup: nextSetup,
        ...(patch.task !== undefined ? { objective: patch.task } : {})
      };

      updateNode(selectedNode.id, { data: nextData });
    },
    [selectedAgentGatewayBinding, selectedNode, updateNode]
  );

  const handleSimpleConnectionTypeChange = useCallback(
    (connectionType: SimpleNodeConnectionType) => {
      if (selectedNode === null) {
        return;
      }

      const currentSetup = readSimpleNodeSetup(selectedNode, selectedAgentGatewayBinding);
      handleSimpleSetupChange({
        connectionType,
        connectionValue:
          connectionType === "url" || connectionType === "api" || connectionType === "manual"
            ? currentSetup.connectionValue
            : ""
      });

      if (connectionType === "gateway-profile") {
        setAgentGatewayBinding(selectedNode.id, {
          mode: "profile",
          profileId: selectedAgentGatewayBinding.mode === "profile"
            ? selectedAgentGatewayBinding.profileId
            : gatewayProfiles[0]?.id
        });
        return;
      }

      if (connectionType === "workspace-gateway") {
        setAgentGatewayBinding(selectedNode.id, {
          mode: "workspace-default"
        });
      }
    },
    [
      gatewayProfiles,
      handleSimpleSetupChange,
      selectedAgentGatewayBinding,
      selectedNode,
      setAgentGatewayBinding
    ]
  );

  const handleSimpleGatewayProfileChange = useCallback(
    (profileId: string) => {
      if (selectedNode === null) {
        return;
      }

      setAgentGatewayBinding(selectedNode.id, {
        mode: "profile",
        profileId
      });
      handleSimpleSetupChange({
        connectionType: "gateway-profile"
      });
    },
    [handleSimpleSetupChange, selectedNode, setAgentGatewayBinding]
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

  const contextMenuItems = useMemo<CanvasContextMenuItem[]>(() => {
    if (contextMenu === null) {
      return [];
    }

    const closeAfter = (action: () => void): (() => void) => {
      return () => {
        action();
        closeContextMenu();
      };
    };

    if (contextMenu.kind === "pane") {
      const addNodeAtCursor = (type: NodeType): (() => void) =>
        closeAfter(() => addNode(type, contextMenu.flowPosition));
      const createNodeGroup = {
        groupId: "create-node",
        groupLabel: t(locale, "contextMenu.groupCreateNode")
      };
      const canvasActionsGroup = {
        groupId: "canvas-actions",
        groupLabel: t(locale, "contextMenu.groupCanvasActions")
      };

      return [
        {
          id: "add-manual-trigger",
          label: t(locale, "contextMenu.addManualTrigger"),
          ...createNodeGroup,
          onSelect: addNodeAtCursor("manual.trigger")
        },
        {
          id: "add-start-agent",
          label: t(locale, "contextMenu.addStartAgent"),
          ...createNodeGroup,
          onSelect: addNodeAtCursor("agent.start")
        },
        {
          id: "add-worker-agent",
          label: t(locale, "contextMenu.addWorkerAgent"),
          ...createNodeGroup,
          onSelect: addNodeAtCursor("agent.worker")
        },
        {
          id: "add-end-agent",
          label: t(locale, "contextMenu.addEndAgent"),
          ...createNodeGroup,
          onSelect: addNodeAtCursor("agent.end")
        },
        {
          id: "add-console-output",
          label: t(locale, "contextMenu.addConsoleOutput"),
          ...createNodeGroup,
          onSelect: addNodeAtCursor("output.console")
        },
        {
          id: "fit-view",
          label: t(locale, "contextMenu.fitView"),
          ...canvasActionsGroup,
          onSelect: closeAfter(() => {
            void reactFlowInstanceRef.current?.fitView({ padding: 0.25, duration: 180 });
          })
        },
        {
          id: "clear-selection",
          label: t(locale, "contextMenu.clearSelection"),
          ...canvasActionsGroup,
          onSelect: closeAfter(() => selectNode(null))
        }
      ];
    }

    if (contextMenu.kind === "node" && contextMenu.nodeId !== undefined) {
      const nodeId = contextMenu.nodeId;
      const nodeDisplayOverride = nodeDisplayOverrides[nodeId];
      const nodeActionGroup = {
        groupId: "node-actions",
        groupLabel: t(locale, "contextMenu.groupNodeActions")
      };
      const nodeDisplayGroup = {
        groupId: "node-display",
        groupLabel: t(locale, "contextMenu.groupNodeDisplay")
      };
      const dangerGroup = {
        groupId: "danger",
        groupLabel: t(locale, "contextMenu.groupDanger")
      };
      const revealInspector = (): void => {
        selectNode(nodeId);

        if (workspaceViewMode !== "focus" && !workspaceVisibility.inspector) {
          setWorkspaceViewMode("debug");
        }
      };
      const revealContract = (): void => {
        selectNode(nodeId);

        if (workspaceViewMode !== "focus" && !workspaceVisibility.contractPreview) {
          setWorkspaceViewMode("debug");
        }
      };

      return [
        {
          id: "inspect-node",
          label: t(locale, "contextMenu.inspectNode"),
          ...nodeActionGroup,
          onSelect: closeAfter(revealInspector)
        },
        {
          id: "duplicate-node",
          label: t(locale, "contextMenu.duplicateNode"),
          ...nodeActionGroup,
          onSelect: closeAfter(() => duplicateNode(nodeId))
        },
        {
          id: "show-contract",
          label: t(locale, "contextMenu.showContract"),
          ...nodeActionGroup,
          onSelect: closeAfter(revealContract)
        },
        {
          id: "display-follow-global",
          label: t(locale, "contextMenu.followGlobal"),
          ...nodeDisplayGroup,
          isActive: nodeDisplayOverride === undefined,
          onSelect: closeAfter(() => setNodeDisplayOverride(nodeId, null))
        },
        ...nodeOverrideDisplayModes.map((displayMode) => ({
          id: `display-${displayMode}`,
          label: t(locale, nodeOverrideModeLabelKeys[displayMode]),
          ...nodeDisplayGroup,
          isActive: nodeDisplayOverride === displayMode,
          onSelect: closeAfter(() => setNodeDisplayOverride(nodeId, displayMode))
        })),
        {
          id: "hide-details",
          label: t(locale, "contextMenu.hideDetails"),
          ...nodeDisplayGroup,
          onSelect: closeAfter(() => hideNodeDetails(nodeId))
        },
        {
          id: "show-details",
          label: t(locale, "contextMenu.showDetails"),
          ...nodeDisplayGroup,
          onSelect: closeAfter(() => showNodeDetails(nodeId))
        },
        {
          id: "delete-node",
          label: t(locale, "contextMenu.deleteNode"),
          ...dangerGroup,
          tone: "danger",
          onSelect: closeAfter(() => {
            removeNode(nodeId);
            showNodeDetails(nodeId);
          })
        }
      ];
    }

    if (contextMenu.kind === "edge" && contextMenu.edgeId !== undefined) {
      const edgeId = contextMenu.edgeId;

      return [
        {
          id: "delete-edge",
          label: t(locale, "contextMenu.deleteEdge"),
          onSelect: closeAfter(() => removeEdges([edgeId]))
        }
      ];
    }

    return [];
  }, [
    addNode,
    closeContextMenu,
    contextMenu,
    duplicateNode,
    hideNodeDetails,
    locale,
    removeEdges,
    removeNode,
    selectNode,
    setNodeDisplayOverride,
    setWorkspaceViewMode,
    showNodeDetails,
    nodeDisplayOverrides,
    workspaceViewMode,
    workspaceVisibility.contractPreview,
    workspaceVisibility.inspector
  ]);

  const contextMenuLabel =
    contextMenu === null
      ? t(locale, "contextMenu.label")
      : contextMenu.kind === "pane"
        ? t(locale, "contextMenu.canvasLabel")
        : contextMenu.kind === "node"
          ? t(locale, "contextMenu.nodeLabel")
          : t(locale, "contextMenu.edgeLabel");
  const isNodeLibraryPanelVisible = workspaceVisibility.nodeLibrary && !isNodeLibraryCollapsed;
  const isNodeLibraryRestoreVisible = workspaceVisibility.nodeLibrary && isNodeLibraryCollapsed;
  const isInspectorPanelVisible = workspaceVisibility.inspector && !isInspectorCollapsed;
  const isInspectorRestoreVisible = workspaceVisibility.inspector && isInspectorCollapsed;
  const inspectorRestoreSummary = selectedNode?.label ?? t(locale, "inspector.noSelection");

  return (
    <div
      className={`studio-shell workspace-mode-${workspaceViewMode} ${
        isNodeLibraryCollapsed ? "node-library-collapsed" : ""
      } ${
        isInspectorCollapsed ? "inspector-collapsed" : ""
      } ${isRunInspectorCollapsed ? "run-inspector-collapsed" : ""}`}
      data-testid="studio-shell"
      data-workspace-mode={workspaceViewMode}
      data-workspace-preset={workspacePreset}
      data-experience-mode={experienceMode}
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

        <div className="execution-action-strip" data-testid="execution-action-strip">
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
        </div>

        <RunReadinessPreview
          locale={locale}
          report={runReadinessReport}
          isLoading={runReadinessLoading}
          error={runReadinessError}
        />

        <nav className="top-actions" aria-label={t(locale, "top.workspaceActions")} data-testid="workspace-actions">
          <label
            className="experience-mode-switcher"
            title={t(locale, "experienceMode.title")}
            data-testid="experience-mode-control"
          >
            <span>{t(locale, "experienceMode.label")}</span>
            <select
              value={experienceMode}
              onChange={handleExperienceModeChange}
              aria-label={t(locale, "experienceMode.title")}
              data-testid="experience-mode-select"
            >
              {experienceModes.map((mode) => (
                <option key={mode} value={mode}>
                  {t(locale, experienceModeLabelKeys[mode])}
                </option>
              ))}
            </select>
          </label>
          <label
            className="workspace-preset-switcher"
            title={t(locale, "workspacePreset.title")}
            data-testid="workspace-preset-control"
          >
            <span>{t(locale, "workspacePreset.label")}</span>
            <select
              value={workspacePreset}
              onChange={handleWorkspacePresetChange}
              aria-label={t(locale, "workspacePreset.title")}
              data-testid="workspace-preset-select"
            >
              {workspacePresets.map((preset) => (
                <option key={preset} value={preset}>
                  {t(locale, workspacePresetLabelKeys[preset])}
                </option>
              ))}
            </select>
          </label>
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
          <label
            className="node-display-switcher"
            title={t(locale, "nodeDisplay.autoHint")}
            data-testid="node-display-mode-control"
          >
            <span>{t(locale, "nodeDisplay.label")}</span>
            <select
              value={nodeDisplayMode}
              onChange={handleNodeDisplayModeChange}
              aria-label={t(locale, "nodeDisplay.title")}
              aria-describedby="node-display-mode-hint"
              data-testid="node-display-mode-select"
            >
              {nodeDisplayModes.map((mode) => (
                <option key={mode} value={mode}>
                  {t(locale, nodeDisplayModeLabelKeys[mode])}
                </option>
              ))}
            </select>
            <span id="node-display-mode-hint" className="sr-only" data-testid="node-display-mode-hint">
              {t(locale, "nodeDisplay.autoHint")}
            </span>
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
          <button
            type="button"
            title={t(locale, "top.saveFlowTitle")}
            data-testid="save-flow-button"
            onClick={handleSaveFlow}
          >
            <Save aria-hidden="true" size={16} />
            {t(locale, "top.saveFlow")}
          </button>
          <button
            type="button"
            title={t(locale, "top.exportJsonTitle")}
            data-testid="export-json-button"
            onClick={handleToggleFlowExport}
          >
            <Braces aria-hidden="true" size={16} />
            {t(locale, "top.exportJson")}
          </button>
          <button
            type="button"
            title={t(locale, "top.runtimesTitle")}
            data-testid="runtime-manager-button"
            onClick={openRuntimeManager}
          >
            <Server aria-hidden="true" size={16} />
            {t(locale, "top.runtimes")}
          </button>
          <button
            type="button"
            title={t(locale, "taskLauncher.buttonTitle")}
            data-testid="task-launcher-button"
            onClick={openTaskLauncher}
          >
            <Plus aria-hidden="true" size={16} />
            {t(locale, "taskLauncher.button")}
          </button>
          <button
            type="button"
            title={t(locale, "demoGuide.buttonTitle")}
            data-testid="demo-guide-button"
            onClick={openDemoGuide}
          >
            <BookOpen aria-hidden="true" size={16} />
            {t(locale, "demoGuide.button")}
          </button>
          <button
            type="button"
            title={t(locale, "workspacePreset.resetTitle")}
            data-testid="reset-layout-button"
            onClick={resetLayout}
          >
            <RotateCcw aria-hidden="true" size={16} />
            {t(locale, "workspacePreset.reset")}
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
          runtimeHealth={runtimeHealth}
          locale={locale}
          isLoading={runtimeLoadStatus === "loading"}
          error={runtimeError}
          localGatewayConnection={localGatewayConnection}
          gatewayProfiles={gatewayProfiles}
          gatewayProfileUsage={gatewayProfileUsage}
          openClawTaskCopyStatus={openClawTaskCopyStatus}
          onClose={closeRuntimeManager}
          onRefresh={handleRefreshRuntimes}
          onHealthCheck={handleRuntimeHealthCheck}
          onAddGatewayProfile={addGatewayProfile}
          onUpdateGatewayProfile={updateGatewayProfile}
          onDeleteGatewayProfile={deleteGatewayProfile}
          onCheckGatewayProfile={checkGatewayProfile}
          onCopyOpenClawTask={handleCopyOpenClawTask}
          onOpenOpenClawTaskExport={handleOpenOpenClawTaskExport}
        />
      ) : null}

      {isTaskLauncherOpen ? (
        <TaskLauncherPanel
          locale={locale}
          onClose={closeTaskLauncher}
          onCreateFlow={handleCreateFlowFromTemplate}
        />
      ) : null}

      {isDemoGuideOpen ? (
        <DemoGuidePanel
          locale={locale}
          onClose={closeDemoGuide}
          onOpenRuntimeManager={handleOpenRuntimeManagerFromGuide}
          onResetDemoFlow={handleResetDemoFlow}
          onStartHelloWorld={handleStartHelloWorldFromGuide}
        />
      ) : null}

      {isNodeLibraryPanelVisible ? (
        <aside
          className="node-library"
          aria-label={t(locale, "nodeLibrary.aria")}
          data-testid="node-library"
          data-collapsed="false"
        >
          <div className="pane-title node-library-title">
            <span className="pane-title-main">
              <Library aria-hidden="true" size={16} />
              {t(locale, "nodeLibrary.title")}
            </span>
            <span className="pane-title-summary" data-testid="node-library-summary">
              {experienceMode === "simple"
                ? `${simpleNodeLibraryItems.length} ${t(locale, "nodeLibrary.quickNodes")}`
                : `${MVP_NODE_CATALOG.length} ${t(locale, "common.nodes")}`}
            </span>
            <button
              type="button"
              className="pane-toggle-button"
              data-testid="node-library-toggle"
              title={t(locale, "nodeLibrary.collapse")}
              aria-label={t(locale, "nodeLibrary.collapse")}
              onClick={() =>
                updateWorkspacePanelState({
                  nodeLibraryCollapsed: true
                })
              }
            >
              <ChevronUp aria-hidden="true" size={16} />
            </button>
          </div>

          <div
            className="node-library-body panel-scroll-body"
            data-testid="node-library-body"
            onWheel={stopPanelWheelPropagation}
          >
            {experienceMode === "simple" ? (
              <BeginnerStartCard
                locale={locale}
                localGatewayConnection={localGatewayConnection}
                onStartHelloWorld={handleStartHelloWorldFromGuide}
                onConnectGateway={handleGatewayQuickConnect}
                onExportTask={handleOpenOpenClawTaskExport}
              />
            ) : null}
            <form
              className="gateway-quick-connect-card"
              data-testid="gateway-quick-connect"
              onSubmit={handleGatewayQuickConnectSubmit}
            >
              <div className="gateway-quick-connect-header">
                <span>
                  <Server aria-hidden="true" size={15} />
                  <strong>{t(locale, "gatewayQuickConnect.title")}</strong>
                </span>
                <span
                  className={`gateway-quick-connect-status status-${localGatewayConnection.status}`}
                  data-testid="gateway-quick-connect-status"
                >
                  {t(locale, getLocalGatewayConnectionStatusKey(localGatewayConnection.status))}
                </span>
              </div>
              <label>
                <span>{t(locale, "gatewayQuickConnect.gatewayUrl")}</span>
                <input
                  type="url"
                  value={gatewayBaseUrlInput}
                  data-testid="gateway-url-input"
                  placeholder="http://localhost:25311"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setGatewayBaseUrlInput(event.target.value)}
                />
              </label>
              <label>
                <span>{t(locale, "gatewayQuickConnect.healthPath")}</span>
                <input
                  type="text"
                  value={gatewayHealthPathInput}
                  data-testid="gateway-health-path-input"
                  placeholder="/health"
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setGatewayHealthPathInput(event.target.value)}
                />
              </label>
              <div className="gateway-quick-connect-actions">
                <button
                  type="submit"
                  data-testid="gateway-connect-button"
                  disabled={localGatewayConnection.status === "checking"}
                >
                  {localGatewayConnection.status === "checking"
                    ? t(locale, "gatewayQuickConnect.checking")
                    : t(locale, "gatewayQuickConnect.connect")}
                </button>
                <button
                  type="button"
                  data-testid="gateway-clear-connection-button"
                  onClick={handleClearGatewayConnection}
                >
                  {t(locale, "gatewayQuickConnect.clear")}
                </button>
              </div>
              <p data-testid="gateway-quick-connect-message">
                {formatLocalGatewayConnectionMessage(locale, localGatewayConnection)}
              </p>
            </form>
            {experienceMode === "simple" ? (
              <>
                <div className="node-library-mode-note" data-testid="simple-node-library-note">
                  <strong>{t(locale, "nodeLibrary.simpleTitle")}</strong>
                  <span>{t(locale, "nodeLibrary.simpleBody")}</span>
                </div>
                <div className="node-list simple-node-list" data-testid="node-library-content">
                  {simpleNodeLibraryItems.map((node, index) => {
                    const catalogItem = MVP_NODE_CATALOG.find((item) => item.type === node.type);
                    const Icon = nodeIcons[node.type];

                    return (
                      <button
                        key={node.type}
                        className={`node-list-item simple-node-list-item role-${catalogItem?.role ?? "process"}`}
                        data-testid={`node-library-item-${node.type.replaceAll(".", "-")}`}
                        type="button"
                        title={t(locale, node.descriptionKey)}
                        onClick={() => addNode(node.type, undefined, t(locale, node.defaultLabelKey))}
                      >
                        <span className="simple-node-step" aria-hidden="true">
                          {index + 1}
                        </span>
                        <Icon aria-hidden="true" size={17} />
                        <span>
                          <strong>{t(locale, node.labelKey)}</strong>
                          <small>{t(locale, node.descriptionKey)}</small>
                          <em>{t(locale, node.helperKey)}</em>
                        </span>
                        <Plus aria-hidden="true" className="node-add-icon" size={16} />
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="node-list" data-testid="node-library-content">
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
            )}
          </div>
        </aside>
      ) : null}

      <main className="canvas-pane" aria-label={t(locale, "canvas.aria")} data-testid="clawflow-canvas">
        {isNodeLibraryRestoreVisible ? (
          <button
            type="button"
            className="canvas-restore-tab node-library-restore-tab"
            data-testid="node-library-collapsed"
            title={t(locale, "nodeLibrary.restore")}
            aria-label={t(locale, "nodeLibrary.restore")}
            onClick={() =>
              updateWorkspacePanelState({
                nodeLibraryCollapsed: false
              })
            }
          >
            <Library aria-hidden="true" size={14} />
            <span>{t(locale, "nodeLibrary.title")}</span>
          </button>
        ) : null}
        {isInspectorRestoreVisible ? (
          <button
            type="button"
            className="canvas-restore-tab inspector-restore-tab"
            data-testid="inspector-collapsed"
            title={t(locale, "inspector.restore")}
            aria-label={t(locale, "inspector.restore")}
            onClick={() =>
              updateWorkspacePanelState({
                inspectorCollapsed: false
              })
            }
          >
            <ClipboardList aria-hidden="true" size={14} />
            <span>{t(locale, "inspector.title")}</span>
            <small data-testid="inspector-collapsed-summary">{inspectorRestoreSummary}</small>
          </button>
        ) : null}
        {workspaceVisibility.sessionConsole ? (
          <SessionConsole
            locale={locale}
            flow={flow}
            isRunActive={isRunActive}
            onRunSession={handleRunSession}
          />
        ) : null}
        {workspaceVisibility.contractPreview && shouldShowTechnicalPreviews ? (
          <ExecutionContractPreviewPanel
            locale={locale}
            preview={executionContractPreview}
            isLoading={executionContractPreviewLoading}
            error={executionContractPreviewError}
            onRefresh={handleRefreshExecutionContractPreview}
          />
        ) : null}
        {workspaceVisibility.linearPlan && shouldShowTechnicalPreviews ? (
          <LinearExecutionPlanPanel
            locale={locale}
            plan={linearExecutionPlan}
            isLoading={linearExecutionPlanLoading}
            error={linearExecutionPlanError}
            liveStepStatuses={livePlanStepStatuses}
            onRefresh={handleRefreshLinearExecutionPlan}
          />
        ) : null}
        {workspaceVisibility.resourceEstimate && shouldShowTechnicalPreviews ? (
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
          onInit={(instance) => {
            reactFlowInstanceRef.current = instance;
          }}
          onNodeClick={(_, node) => selectNode(node.id)}
          onPaneClick={() => selectNode(null)}
          onPaneContextMenu={handlePaneContextMenu}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeContextMenu={handleEdgeContextMenu}
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
        {contextMenu !== null ? (
          <CanvasContextMenu
            menu={contextMenu}
            items={contextMenuItems}
            label={contextMenuLabel}
            closeLabel={t(locale, "contextMenu.close")}
            onClose={closeContextMenu}
          />
        ) : null}

        {isExportOpen ? (
          <aside className="export-panel" aria-label={t(locale, "export.aria")}>
            <div className="export-panel-header">
              <div>
                <strong>
                  {exportPanelMode === "openclaw-task"
                    ? t(locale, "export.openClawTaskTitle")
                    : t(locale, "export.title")}
                </strong>
                <span>
                  {exportPanelMode === "openclaw-task"
                    ? t(locale, "export.openClawTaskSubtitle")
                    : `${flow.nodes.length} ${t(locale, "common.nodes")}`}
                </span>
              </div>
              <button type="button" title={t(locale, "export.closeTitle")} onClick={closeExport}>
                <X aria-hidden="true" size={16} />
              </button>
            </div>
            <div className="export-panel-tabs" role="tablist" aria-label={t(locale, "export.tabs")}>
              <button
                type="button"
                className={exportPanelMode === "flow-json" ? "is-active" : undefined}
                aria-selected={exportPanelMode === "flow-json"}
                data-testid="export-tab-flow-json"
                onClick={() => setExportPanelMode("flow-json")}
              >
                {t(locale, "export.flowJson")}
              </button>
              <button
                type="button"
                className={exportPanelMode === "openclaw-task" ? "is-active" : undefined}
                aria-selected={exportPanelMode === "openclaw-task"}
                data-testid="export-tab-openclaw-task"
                onClick={() => setExportPanelMode("openclaw-task")}
              >
                {t(locale, "export.openClawTask")}
              </button>
            </div>
            {exportPanelMode === "openclaw-task" ? (
              <pre data-testid="openclaw-task-preview">{openClawTaskText}</pre>
            ) : (
              <pre data-testid="flow-json-export">{flowJson}</pre>
            )}
          </aside>
        ) : null}
      </main>

      {isInspectorPanelVisible ? (
        <aside
          className="inspector-pane"
          aria-label={t(locale, "inspector.aria")}
          data-testid="inspector-pane"
          data-collapsed="false"
        >
          <div className="pane-title inspector-title">
            <span className="pane-title-main">
              <ClipboardList aria-hidden="true" size={16} />
              {t(locale, "inspector.title")}
            </span>
            <span className="pane-title-summary" data-testid="inspector-summary">
              {selectedNode?.label ?? t(locale, "inspector.noSelection")}
            </span>
            <button
              type="button"
              className="pane-toggle-button"
              data-testid="inspector-toggle"
              title={t(locale, "inspector.minimize")}
              aria-label={t(locale, "inspector.minimize")}
              onClick={() =>
                updateWorkspacePanelState({
                  inspectorCollapsed: true
                })
              }
            >
              <ChevronUp aria-hidden="true" size={16} />
            </button>
          </div>

          <div
            className="inspector-body panel-scroll-body"
            data-testid="inspector-body"
            onWheel={stopPanelWheelPropagation}
          >
            <div className="inspector-scroll" data-testid="inspector-content">
              {selectedNode === null ? (
                <section className="inspector-empty">
                  <strong>{t(locale, "inspector.emptyTitle")}</strong>
                  <span>{t(locale, "inspector.emptyBody")}</span>
                </section>
              ) : (
                <>
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

                {selectedNodeOutcome !== null ? (
                  <section className="inspector-card node-outcome-inspector" data-testid="inspector-node-outcome">
                    <h2>{t(locale, "nodeOutcome.title")}</h2>
                    <div className="node-outcome-inspector-grid">
                      <span>{selectedNodeOutcome.purposeLabel}</span>
                      <strong>{selectedNodeOutcome.purpose}</strong>
                      <span>{selectedNodeOutcome.resultLabel}</span>
                      <strong className={selectedNodeOutcome.hasOutput ? "has-output" : "is-empty"}>
                        {selectedNodeOutcome.result}
                      </strong>
                    </div>
                  </section>
                ) : null}

                <SimpleNodeSetupPanel
                  locale={locale}
                  node={selectedNode}
                  gatewayProfiles={gatewayProfiles}
                  gatewayBinding={selectedAgentGatewayBinding}
                  localGatewayConnection={localGatewayConnection}
                  selectedGatewayProfile={selectedGatewayProfile}
                  onSetupChange={handleSimpleSetupChange}
                  onConnectionTypeChange={handleSimpleConnectionTypeChange}
                  onGatewayProfileChange={handleSimpleGatewayProfileChange}
                />

                <details
                  className="inspector-advanced-settings"
                  data-testid="inspector-advanced-settings"
                  open={isInspectorAdvancedSettingsOpen}
                  onToggle={(event) =>
                    setIsInspectorAdvancedSettingsOpen(event.currentTarget.open)
                  }
                >
                  <summary data-testid="inspector-advanced-summary">
                    {t(locale, "simpleSetup.advancedSettings")}
                  </summary>

                <section className="inspector-card">
                  <h2>{t(locale, "inspector.runtime")}</h2>
                  <label className="field-control">
                    <span>{t(locale, "inspector.runtimeRef")}</span>
                    <select
                      value={selectedNode.runtimeRef ?? ""}
                      data-testid="inspector-runtime-select"
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
                  <div className="runtime-select-summary" data-testid="inspector-runtime-summary">
                    {runtimeError !== null ? (
                      <span className="field-error-text">{runtimeError}</span>
                    ) : (
                      <span>
                        {formatRuntimeSelection(locale, selectedNode.runtimeRef, runtimes) ??
                          t(locale, "inspector.runtimeRegistryNotLoaded")}
                      </span>
                    )}
                    {selectedNode.runtimeRef === "openclaw-local" ? (
                      <span className="protected-runtime-note" data-testid="inspector-openclaw-protected-note">
                        {t(locale, "inspector.openClawProtectedOnly")}
                      </span>
                    ) : null}
                  </div>
                </section>

                {isAgentNode(selectedNode) ? (
                  <section className="inspector-card gateway-binding-card" data-testid="inspector-gateway-section">
                    <h2>{t(locale, "gatewayProfiles.inspectorTitle")}</h2>
                    <div className="field-stack">
                      <label className="field-control">
                        <span>{t(locale, "gatewayProfiles.bindingMode")}</span>
                        <select
                          value={selectedAgentGatewayBinding.mode}
                          data-testid="inspector-gateway-binding-mode"
                          onChange={handleGatewayBindingModeChange}
                        >
                          <option value="workspace-default">
                            {t(locale, "gatewayProfiles.followWorkspaceDefault")}
                          </option>
                          <option value="profile">
                            {t(locale, "gatewayProfiles.useGatewayProfile")}
                          </option>
                        </select>
                      </label>
                      {selectedAgentGatewayBinding.mode === "profile" ? (
                        <label className="field-control">
                          <span>{t(locale, "gatewayProfiles.profileName")}</span>
                          <select
                            value={selectedAgentGatewayBinding.profileId ?? gatewayProfiles[0]?.id ?? ""}
                            data-testid="inspector-gateway-profile-select"
                            onChange={handleGatewayProfileSelectionChange}
                          >
                            {gatewayProfiles.map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name} / {formatGatewayProfileStatus(locale, profile)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <div className="gateway-binding-summary" data-testid="inspector-gateway-status">
                        <strong>
                          {selectedAgentGatewayBinding.mode === "profile" && selectedGatewayProfile !== null
                            ? selectedGatewayProfile.name
                            : t(locale, "gatewayProfiles.workspaceDefault")}
                        </strong>
                        <span>
                          {selectedAgentGatewayBinding.mode === "profile" && selectedGatewayProfile !== null
                            ? formatGatewayProfileStatus(locale, selectedGatewayProfile)
                            : t(locale, getLocalGatewayConnectionStatusKey(localGatewayConnection.status))}
                        </span>
                        <small>{t(locale, "gatewayProfiles.uiPreferenceOnly")}</small>
                        {selectedAgentGatewayBinding.mode === "profile" &&
                        selectedGatewayProfile?.status === "unavailable" ? (
                          <small className="field-error-text" data-testid="inspector-gateway-warning">
                            {t(locale, "gatewayProfiles.unavailableWarning")}
                          </small>
                        ) : null}
                      </div>
                    </div>
                  </section>
                ) : null}

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
                </details>
                </>
              )}
            </div>
          </div>
        </aside>
      ) : null}

      {workspaceVisibility.runInspector ? (
        <section
          className={`run-inspector ${isRunInspectorCollapsed ? "is-collapsed" : ""}`}
          aria-label={t(locale, "runInspector.aria")}
          data-testid="run-inspector"
          data-collapsed={isRunInspectorCollapsed ? "true" : "false"}
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
          <button
            type="button"
            className="pane-toggle-button"
            data-testid="run-inspector-toggle"
            title={t(
              locale,
              isRunInspectorCollapsed ? "runInspector.restore" : "runInspector.minimize"
            )}
            aria-label={t(
              locale,
              isRunInspectorCollapsed ? "runInspector.restore" : "runInspector.minimize"
            )}
            onClick={() =>
              updateWorkspacePanelState({
                runInspectorCollapsed: !isRunInspectorCollapsed
              })
            }
          >
            {isRunInspectorCollapsed ? (
              <ChevronDown aria-hidden="true" size={16} />
            ) : (
              <ChevronUp aria-hidden="true" size={16} />
            )}
          </button>
        </div>

        <div
          className="run-inspector-body panel-scroll-body"
          data-testid="run-inspector-body"
          hidden={isRunInspectorCollapsed}
          onWheel={stopPanelWheelPropagation}
        >
        <div className="run-inspector-grid" data-testid="run-inspector-content">
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

  const payloadSummary = summarizeRunEventPayload(locale, event);

  return (
    <section className="io-block">
      <div>
        <h4>{title}</h4>
        <span>
          {event.nodeId ?? "-"} / {formatTimestamp(event.timestamp, locale)}
        </span>
      </div>
      <p
        className="io-summary"
        data-testid={event.type === "node.output" ? "node-io-output-summary" : "node-io-input-summary"}
      >
        {payloadSummary}
      </p>
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
    runId: runId ?? t(locale, "runInspector.noActiveSession"),
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

function createNodeOutcomeSummary(
  locale: Locale,
  node: FlowNode,
  runEvents: RunEvent[],
  status: RunStatus
): NonNullable<ClawFlowNodeData["outcomeSummary"]> {
  const latestOutputEvent =
    findLatestNodeEvent(runEvents, node.id, "node.output") ??
    findLatestNodeEvent(runEvents, node.id, "node.completed") ??
    findLatestNodeEvent(runEvents, node.id, "execution.step.completed");
  const output = readRecord(latestOutputEvent?.payload?.output);
  const hasOutput = output !== undefined;

  return {
    purposeLabel: t(locale, "nodeOutcome.purpose"),
    purpose: createSimpleNodeSummary(locale, node),
    resultLabel: t(locale, "nodeOutcome.latestResult"),
    result:
      output === undefined
        ? status === "success"
          ? t(locale, "nodeOutcome.outputCaptured")
          : t(locale, "nodeOutcome.noResultYet")
        : summarizeNodeOutput(locale, output),
    hasOutput
  };
}

function summarizeRunEventPayload(locale: Locale, event: RunEvent): string {
  const output = readRecord(event.payload?.output);

  if (output !== undefined) {
    return summarizeNodeOutput(locale, output);
  }

  const input = readRecord(event.payload?.input) ?? readRecord(event.payload?.receivedInput);

  if (input !== undefined) {
    return summarizeStructuredValue(locale, input);
  }

  return event.message;
}

function summarizeNodeOutput(locale: Locale, output: Record<string, unknown>): string {
  const prioritizedString =
    readString(output.console) ??
    readString(output.result) ??
    readString(output.summary) ??
    readString(output.taskUnderstanding) ??
    readString(output.prompt);

  if (prioritizedString !== undefined) {
    return truncateSummary(prioritizedString);
  }

  const plan = Array.isArray(output.plan) ? output.plan.filter((item): item is string => typeof item === "string") : [];

  if (plan.length > 0) {
    return truncateSummary(plan.join(" -> "));
  }

  const upstream = readRecord(output.upstream);

  if (upstream !== undefined) {
    return summarizeStructuredValue(locale, upstream);
  }

  return t(locale, "nodeOutcome.outputCaptured");
}

function summarizeStructuredValue(locale: Locale, value: Record<string, unknown>): string {
  const preferredString =
    readString(value.userInput) ??
    readString(value.prompt) ??
    readString(value.content) ??
    readString(value.text) ??
    readString(value.result) ??
    readString(value.summary);

  if (preferredString !== undefined) {
    return truncateSummary(preferredString);
  }

  const keyCount = Object.keys(value).length;

  if (keyCount === 0) {
    return t(locale, "nodeOutcome.outputCaptured");
  }

  return `${keyCount} ${t(locale, "nodeOutcome.fieldsCaptured")}`;
}

function findLatestNodeEvent(
  runEvents: RunEvent[],
  nodeId: string,
  type: RunEvent["type"]
): RunEvent | null {
  for (let index = runEvents.length - 1; index >= 0; index -= 1) {
    const event = runEvents[index];

    if (event?.nodeId === nodeId && event.type === type) {
      return event;
    }
  }

  return null;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function truncateSummary(value: string): string {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
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

function createNodePresentationLabel(
  locale: Locale,
  node: FlowNode,
  experienceMode: ExperienceMode
): string {
  if (experienceMode !== "simple") {
    return node.label;
  }

  const nodeType = node.type as NodeType;
  const catalogLabel = getCatalogLabel(nodeType, "en");
  const localizedCatalogLabel = getCatalogLabel(nodeType, locale);

  if (node.label !== catalogLabel && node.label !== localizedCatalogLabel) {
    return node.label;
  }

  return getSimpleNodePresentationLabel(locale, nodeType);
}

function getSimpleNodePresentationLabel(locale: Locale, nodeType: NodeType): string {
  if (nodeType === "manual.trigger") {
    return t(locale, "node.simpleStart.label");
  }

  if (nodeType === "agent.start") {
    return t(locale, "node.simpleAgentStart.label");
  }

  if (nodeType === "agent.end") {
    return t(locale, "node.simpleFinish.label");
  }

  if (nodeType === "output.console") {
    return t(locale, "node.simpleOutput.label");
  }

  return t(locale, "node.simpleAgentStep.label");
}

function createSimpleNodeSummary(locale: Locale, node: FlowNode): string {
  if (node.type === "manual.trigger") {
    return t(locale, "node.simpleStart.summary");
  }

  if (node.type === "agent.start") {
    return t(locale, "node.simpleAgentStart.summary");
  }

  if (node.type === "agent.end") {
    return t(locale, "node.simpleFinish.summary");
  }

  if (node.type === "output.console") {
    return t(locale, "node.simpleOutput.summary");
  }

  return t(locale, "node.simpleAgentStep.summary");
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

function isAgentNode(node: FlowNode): boolean {
  return node.type.startsWith("agent.");
}

function formatGatewayProfileStatus(locale: Locale, profile: GatewayProfile): string {
  return t(locale, getLocalGatewayConnectionStatusKey(profile.status));
}

function createGatewayProfileUsage(
  nodes: FlowNode[],
  bindings: Record<string, AgentGatewayBinding>
): Record<string, string[]> {
  const usage: Record<string, string[]> = {};

  for (const node of nodes) {
    const binding = bindings[node.id];

    if (!isAgentNode(node) || binding?.mode !== "profile" || binding.profileId === undefined) {
      continue;
    }

    usage[binding.profileId] = [...(usage[binding.profileId] ?? []), node.label];
  }

  return usage;
}

function createNodeGatewaySummary(
  locale: Locale,
  node: FlowNode,
  bindings: Record<string, AgentGatewayBinding>,
  profiles: GatewayProfile[]
): ClawFlowNodeData["gatewaySummary"] {
  const binding = bindings[node.id];

  if (!isAgentNode(node) || binding?.mode !== "profile" || binding.profileId === undefined) {
    return undefined;
  }

  const profile = profiles.find((candidate) => candidate.id === binding.profileId);

  if (profile === undefined) {
    return {
      label: t(locale, "gatewayProfiles.customGateway"),
      status: t(locale, "common.notAvailable"),
      hasWarning: true
    };
  }

  return {
    label: profile.name,
    status: formatGatewayProfileStatus(locale, profile),
    hasWarning: profile.status === "unavailable"
  };
}

function createOpenClawTaskAgentGatewayBindings(
  nodes: FlowNode[],
  bindings: Record<string, AgentGatewayBinding>,
  profiles: GatewayProfile[],
  workspaceDefault: LocalGatewayConnection
): Array<Record<string, unknown>> {
  return nodes.filter(isAgentNode).map((node) => {
    const binding = bindings[node.id] ?? { mode: "workspace-default" as const };
    const profile =
      binding.mode === "profile"
        ? profiles.find((candidate) => candidate.id === binding.profileId)
        : undefined;

    return {
      nodeId: node.id,
      nodeType: node.type,
      label: node.label,
      bindingMode: binding.mode,
      profileId: binding.mode === "profile" ? binding.profileId : undefined,
      resolvedGateway:
        profile === undefined
          ? {
              source: "workspace-default",
              baseUrl: workspaceDefault.baseUrl,
              healthPath: workspaceDefault.healthPath,
              healthUrl: workspaceDefault.healthUrl,
              status: workspaceDefault.status,
              protected: true,
              checkedAt: workspaceDefault.checkedAt
            }
          : {
              source: "profile",
              profileId: profile.id,
              name: profile.name,
              baseUrl: profile.baseUrl,
              healthPath: profile.healthPath,
              healthUrl: profile.healthUrl,
              status: profile.status,
              protected: profile.protected,
              checkedAt: profile.lastCheckedAt,
              lastError: profile.lastError
            }
    };
  });
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
  if (node.id === "node.manual.trigger") {
    return "node-manual-trigger";
  }

  if (node.id === "node.agent.start") {
    return "node-start-agent";
  }

  if (node.id === "node.agent.worker") {
    return "node-worker-agent";
  }

  if (node.id === "node.agent.end") {
    return "node-end-agent";
  }

  if (node.id === "node.output.console") {
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
