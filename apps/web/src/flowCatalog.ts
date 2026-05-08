import type {
  BudgetPolicy,
  ContextPolicy,
  FlowNode,
  FlowSpec,
  NodeHarnessRef,
  NodeRole,
  NodeType
} from "@clawflow/protocol";
import { t, type I18nKey, type Locale } from "./i18n";

export interface NodeCatalogItem {
  type: NodeType;
  role: NodeRole;
  labelKey: I18nKey;
  descriptionKey: I18nKey;
  defaultHarnessRef?: NodeHarnessRef;
}

export const MVP_NODE_CATALOG: NodeCatalogItem[] = [
  {
    type: "manual.trigger",
    role: "trigger",
    labelKey: "node.manualTrigger.label",
    descriptionKey: "node.manualTrigger.description",
    defaultHarnessRef: {
      harnessId: "approval.human",
      executionMode: "dry_run"
    }
  },
  {
    type: "agent.start",
    role: "start",
    labelKey: "node.agentStart.label",
    descriptionKey: "node.agentStart.description",
    defaultHarnessRef: {
      harnessId: "chat.basic",
      executionMode: "dry_run"
    }
  },
  {
    type: "agent.worker",
    role: "process",
    labelKey: "node.agentWorker.label",
    descriptionKey: "node.agentWorker.description",
    defaultHarnessRef: {
      harnessId: "research.agent",
      executionMode: "dry_run"
    }
  },
  {
    type: "agent.end",
    role: "end",
    labelKey: "node.agentEnd.label",
    descriptionKey: "node.agentEnd.description",
    defaultHarnessRef: {
      harnessId: "critic.basic",
      executionMode: "dry_run"
    }
  },
  {
    type: "output.console",
    role: "output",
    labelKey: "node.outputConsole.label",
    descriptionKey: "node.outputConsole.description"
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

export function getCatalogLabel(type: NodeType, locale: Locale = "en"): string {
  return t(locale, getCatalogItem(type).labelKey);
}

export function getCatalogDescription(type: NodeType, locale: Locale = "en"): string {
  return t(locale, getCatalogItem(type).descriptionKey);
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
    label: label ?? getCatalogLabel(type, "en"),
    runtimeRef: "mock-local",
    harnessRef: catalogItem.defaultHarnessRef,
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
