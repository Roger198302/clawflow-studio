import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node
} from "@xyflow/react";
import {
  Braces,
  CircleStop,
  ClipboardList,
  Library,
  MousePointer2,
  Play,
  Save,
  Settings2,
  SquareTerminal,
  Workflow,
  type LucideIcon
} from "lucide-react";
import type { ReactElement } from "react";

type CanvasNodeData = Record<string, unknown> & {
  label: string;
  role: string;
  nodeType: string;
  runtimeRef: string;
};

type LibraryNode = {
  name: string;
  nodeType: string;
  role: string;
  runtimeRef: string;
  icon: LucideIcon;
};

const libraryNodes: LibraryNode[] = [
  {
    name: "Manual Trigger",
    nodeType: "manual.trigger",
    role: "trigger",
    runtimeRef: "mock",
    icon: MousePointer2
  },
  {
    name: "Start Agent",
    nodeType: "agent.start",
    role: "start",
    runtimeRef: "mock",
    icon: Play
  },
  {
    name: "Worker Agent",
    nodeType: "agent.worker",
    role: "process",
    runtimeRef: "mock",
    icon: Workflow
  },
  {
    name: "End Agent",
    nodeType: "agent.end",
    role: "end",
    runtimeRef: "mock",
    icon: CircleStop
  },
  {
    name: "Console Output",
    nodeType: "output.console",
    role: "output",
    runtimeRef: "mock",
    icon: SquareTerminal
  }
];

const initialNodes: Node<CanvasNodeData>[] = [
  {
    id: "manual.trigger",
    type: "input",
    position: { x: 80, y: 110 },
    data: {
      label: "Manual Trigger",
      nodeType: "manual.trigger",
      role: "trigger",
      runtimeRef: "mock"
    }
  },
  {
    id: "agent.worker",
    position: { x: 350, y: 110 },
    data: {
      label: "Worker Agent",
      nodeType: "agent.worker",
      role: "process",
      runtimeRef: "mock"
    }
  },
  {
    id: "output.console",
    type: "output",
    position: { x: 640, y: 110 },
    data: {
      label: "Console Output",
      nodeType: "output.console",
      role: "output",
      runtimeRef: "mock"
    }
  }
];

const initialEdges: Edge[] = [
  {
    id: "edge.manual.trigger.agent.worker",
    source: "manual.trigger",
    target: "agent.worker"
  },
  {
    id: "edge.agent.worker.output.console",
    source: "agent.worker",
    target: "output.console"
  }
];

const runEvents = [
  {
    status: "queued",
    event: "run.created",
    node: "Flow",
    message: "Mock run is ready."
  },
  {
    status: "idle",
    event: "node.pending",
    node: "Worker Agent",
    message: "No runtime call has been executed."
  }
];

export function App(): ReactElement {
  return (
    <div className="studio-shell">
      <header className="top-bar">
        <div className="brand-lockup">
          <Workflow aria-hidden="true" size={20} />
          <div>
            <strong>ClawFlow Studio</strong>
            <span>Mock orchestration workspace</span>
          </div>
        </div>

        <nav className="top-actions" aria-label="Workspace actions">
          <button type="button" title="Save flow">
            <Save aria-hidden="true" size={16} />
            Save
          </button>
          <button type="button" title="Open runtime manager">
            <Settings2 aria-hidden="true" size={16} />
            Runtimes
          </button>
          <button type="button" className="primary-action" title="Run mock flow">
            <Play aria-hidden="true" size={16} />
            Run
          </button>
        </nav>
      </header>

      <aside className="node-library" aria-label="Node library">
        <div className="pane-title">
          <Library aria-hidden="true" size={16} />
          <span>Node Library</span>
        </div>

        <div className="node-list">
          {libraryNodes.map((node) => {
            const Icon = node.icon;

            return (
              <button key={node.role} className="node-list-item" type="button">
                <Icon aria-hidden="true" size={18} />
                <span>
                  <strong>{node.name}</strong>
                  <small>
                    {node.nodeType} / {node.runtimeRef}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <main className="canvas-pane" aria-label="Flow canvas">
        <ReactFlow
          nodes={initialNodes}
          edges={initialEdges}
          fitView
          fitViewOptions={{ padding: 0.35 }}
        >
          <Background />
          <Controls position="bottom-left" />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </main>

      <aside className="inspector-pane" aria-label="Inspector">
        <div className="pane-title">
          <ClipboardList aria-hidden="true" size={16} />
          <span>Inspector</span>
        </div>

        <section className="property-group">
          <h2>Selected Node</h2>
          <dl>
            <div>
              <dt>Role</dt>
              <dd>process</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>agent.worker</dd>
            </div>
            <div>
              <dt>Runtime Ref</dt>
              <dd>mock</dd>
            </div>
            <div>
              <dt>Risk</dt>
              <dd>low</dd>
            </div>
          </dl>
        </section>

        <section className="property-group">
          <h2>Policies</h2>
          <dl>
            <div>
              <dt>Context</dt>
              <dd>selected</dd>
            </div>
            <div>
              <dt>Budget</dt>
              <dd>low thinking</dd>
            </div>
            <div>
              <dt>Approval</dt>
              <dd>not required</dd>
            </div>
          </dl>
        </section>
      </aside>

      <section className="run-inspector" aria-label="Run inspector">
        <div className="pane-title">
          <Braces aria-hidden="true" size={16} />
          <span>Run Inspector</span>
        </div>

        <div className="event-table" role="table" aria-label="Run events">
          <div className="event-row event-row-head" role="row">
            <span role="columnheader">Status</span>
            <span role="columnheader">Event</span>
            <span role="columnheader">Node</span>
            <span role="columnheader">Message</span>
          </div>

          {runEvents.map((event) => (
            <div className="event-row" role="row" key={`${event.event}-${event.node}`}>
              <span role="cell">{event.status}</span>
              <span role="cell">{event.event}</span>
              <span role="cell">{event.node}</span>
              <span role="cell">{event.message}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
