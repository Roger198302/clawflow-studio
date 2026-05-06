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
import type { BudgetPolicy, NodeRole, NodeType, RiskPolicy } from "@clawflow/protocol";
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
import { useCallback, useMemo, type ChangeEvent, type ReactElement } from "react";
import { ClawFlowNode, type ClawFlowNodeData } from "./components/ClawFlowNode";
import { MVP_NODE_CATALOG } from "./flowCatalog";
import { useFlowStore } from "./store/flowStore";

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

export function App(): ReactElement {
  const flow = useFlowStore((state) => state.flow);
  const selectedNodeId = useFlowStore((state) => state.selectedNodeId);
  const nodeStatuses = useFlowStore((state) => state.nodeStatuses);
  const saveNotice = useFlowStore((state) => state.saveNotice);
  const isExportOpen = useFlowStore((state) => state.isExportOpen);
  const selectNode = useFlowStore((state) => state.selectNode);
  const addNode = useFlowStore((state) => state.addNode);
  const updateNode = useFlowStore((state) => state.updateNode);
  const updateNodePosition = useFlowStore((state) => state.updateNodePosition);
  const markFlowSaved = useFlowStore((state) => state.markFlowSaved);
  const toggleExport = useFlowStore((state) => state.toggleExport);
  const closeExport = useFlowStore((state) => state.closeExport);

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
          {saveNotice}
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
        <div className="pane-title">
          <Braces aria-hidden="true" size={16} />
          <span>Run Inspector</span>
        </div>

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
      </section>
    </div>
  );
}
