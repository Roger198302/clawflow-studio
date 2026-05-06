import type { BudgetPolicy, ContextPolicy, FlowNode, FlowSpec, NodeRole, NodeType } from "@clawflow/protocol";

export interface NodeCatalogItem {
  type: NodeType;
  role: NodeRole;
  label: string;
  description: string;
}

export const MVP_NODE_CATALOG: NodeCatalogItem[] = [
  {
    type: "manual.trigger",
    role: "trigger",
    label: "Manual Trigger",
    description: "Entry point for manually starting a flow."
  },
  {
    type: "agent.start",
    role: "start",
    label: "Start Agent",
    description: "Marks the beginning of an agent execution span."
  },
  {
    type: "agent.worker",
    role: "process",
    label: "Worker Agent",
    description: "Represents a mock agent work step."
  },
  {
    type: "agent.end",
    role: "end",
    label: "End Agent",
    description: "Marks the end of an agent execution span."
  },
  {
    type: "output.console",
    role: "output",
    label: "Console Output",
    description: "Displays mock output from upstream nodes."
  }
];

const defaultContextPolicy: ContextPolicy = {
  mode: "selected",
  includeRunHistory: false,
  maxTokens: 4_000
};

const defaultBudgetPolicy: BudgetPolicy = {
  thinking: "low",
  maxTokens: 2_000,
  timeoutMs: 30_000
};

const defaultRiskPolicy = {
  level: "low",
  requiresApproval: false
} as const;

export function getCatalogItem(type: NodeType): NodeCatalogItem {
  const catalogItem = MVP_NODE_CATALOG.find((item) => item.type === type);

  if (catalogItem === undefined) {
    throw new Error(`Unknown MVP node type: ${type}`);
  }

  return catalogItem;
}

export function createFlowNode(
  type: NodeType,
  id: string,
  position: FlowNode["position"],
  label?: string
): FlowNode {
  const catalogItem = getCatalogItem(type);

  return {
    id,
    type,
    role: catalogItem.role,
    label: label ?? catalogItem.label,
    runtimeRef: "mock-local",
    contextPolicy: { ...defaultContextPolicy },
    budgetPolicy: { ...defaultBudgetPolicy },
    riskPolicy: { ...defaultRiskPolicy },
    position
  };
}

export function createDefaultFlow(): FlowSpec {
  const now = new Date().toISOString();

  return {
    schemaVersion: "0.1",
    id: "flow.mvp.default",
    name: "MVP Agent Flow",
    description: "Default mock flow for the Phase 2 canvas.",
    createdAt: now,
    updatedAt: now,
    nodes: [
      createFlowNode("manual.trigger", "node.manual.trigger", { x: 60, y: 120 }),
      createFlowNode("agent.start", "node.agent.start", { x: 330, y: 120 }),
      createFlowNode("agent.worker", "node.agent.worker", { x: 600, y: 120 }),
      createFlowNode("agent.end", "node.agent.end", { x: 870, y: 120 }),
      createFlowNode("output.console", "node.output.console", { x: 1_140, y: 120 })
    ],
    edges: [
      {
        id: "edge.manual.trigger.agent.start",
        source: "node.manual.trigger",
        target: "node.agent.start"
      },
      {
        id: "edge.agent.start.agent.worker",
        source: "node.agent.start",
        target: "node.agent.worker"
      },
      {
        id: "edge.agent.worker.agent.end",
        source: "node.agent.worker",
        target: "node.agent.end"
      },
      {
        id: "edge.agent.end.output.console",
        source: "node.agent.end",
        target: "node.output.console"
      }
    ]
  };
}
