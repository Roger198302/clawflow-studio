import type {
  NodeDataType,
  NodeExecutionMode,
  NodeInputDefinition,
  NodeOutputDefinition,
  NodeTypeDefinition
} from "@clawflow/protocol";

function input(
  id: string,
  label: string,
  dataType: NodeDataType,
  options: Omit<NodeInputDefinition, "id" | "label" | "dataType"> = {}
): NodeInputDefinition {
  return {
    id,
    label,
    dataType,
    ...options
  };
}

function output(
  id: string,
  label: string,
  dataType: NodeDataType,
  options: Omit<NodeOutputDefinition, "id" | "label" | "dataType"> = {}
): NodeOutputDefinition {
  return {
    id,
    label,
    dataType,
    ...options
  };
}

function runtimeCompatibility(
  runtimeId: string,
  allowedExecutionModes: NodeExecutionMode[],
  defaultExecutionMode: NodeExecutionMode
): NodeTypeDefinition["runtimeCompatibility"][number] {
  return {
    runtimeId,
    allowedExecutionModes,
    defaultExecutionMode,
    protectedByDefault: defaultExecutionMode === "protected"
  };
}

export const DEFAULT_NODE_TYPE_DEFINITIONS: NodeTypeDefinition[] = [
  {
    type: "manual.trigger",
    category: "trigger",
    role: "trigger",
    labelKey: "node.manualTrigger.label",
    descriptionKey: "node.manualTrigger.description",
    groupKey: "nodeCatalog.group.triggers",
    inputs: [],
    outputs: [
      output("out", "Out", "event", {
        labelKey: "nodePort.out.label",
        description: "Manual trigger event emitted when the flow starts."
      })
    ],
    provider: "internal",
    providerCapabilityId: "manual.trigger",
    riskLevel: "safe",
    defaultExecutionMode: "trigger-only",
    allowedExecutionModes: ["trigger-only"],
    runtimeCompatibility: [
      runtimeCompatibility("mock-local", ["trigger-only"], "trigger-only")
    ],
    estimateHints: {
      latencyMs: 0
    }
  },
  {
    type: "agent.start",
    category: "agent",
    role: "start",
    labelKey: "node.agentStart.label",
    descriptionKey: "node.agentStart.description",
    groupKey: "nodeCatalog.group.agents",
    inputs: [
      input("in", "In", "any", {
        labelKey: "nodePort.in.label",
        required: true,
        resolutionSource: "upstream",
        description: "Initial trigger payload or user task context."
      })
    ],
    outputs: [
      output("out", "Out", "json", {
        labelKey: "nodePort.out.label",
        description: "Structured task understanding and plan."
      })
    ],
    provider: "runtime",
    providerCapabilityId: "agent.start",
    defaultRuntimeRef: "mock-local",
    defaultHarnessId: "chat.basic",
    riskLevel: "safe",
    defaultExecutionMode: "mock-executable",
    allowedExecutionModes: ["mock-executable", "protected", "runtime-required"],
    runtimeCompatibility: [
      runtimeCompatibility("mock-local", ["mock-executable"], "mock-executable"),
      runtimeCompatibility("openclaw-local", ["protected"], "protected")
    ],
    estimateHints: {
      inputTokenEstimate: 500,
      outputTokenEstimate: 500,
      latencyMs: 250
    }
  },
  {
    type: "agent.worker",
    category: "agent",
    role: "process",
    labelKey: "node.agentWorker.label",
    descriptionKey: "node.agentWorker.description",
    groupKey: "nodeCatalog.group.agents",
    inputs: [
      input("in", "In", "json", {
        labelKey: "nodePort.in.label",
        required: true,
        resolutionSource: "upstream",
        description: "Structured plan or upstream work context."
      })
    ],
    outputs: [
      output("out", "Out", "json", {
        labelKey: "nodePort.out.label",
        description: "Structured worker result."
      })
    ],
    provider: "runtime",
    providerCapabilityId: "agent.worker",
    defaultRuntimeRef: "mock-local",
    defaultHarnessId: "research.agent",
    riskLevel: "medium",
    defaultExecutionMode: "mock-executable",
    allowedExecutionModes: ["mock-executable", "protected", "runtime-required"],
    runtimeCompatibility: [
      runtimeCompatibility("mock-local", ["mock-executable"], "mock-executable"),
      runtimeCompatibility("openclaw-local", ["protected"], "protected")
    ],
    estimateHints: {
      inputTokenEstimate: 1_000,
      outputTokenEstimate: 1_000,
      latencyMs: 350
    }
  },
  {
    type: "agent.end",
    category: "agent",
    role: "end",
    labelKey: "node.agentEnd.label",
    descriptionKey: "node.agentEnd.description",
    groupKey: "nodeCatalog.group.agents",
    inputs: [
      input("in", "In", "json", {
        labelKey: "nodePort.in.label",
        required: true,
        resolutionSource: "upstream",
        description: "Structured result to summarize."
      })
    ],
    outputs: [
      output("out", "Out", "json", {
        labelKey: "nodePort.out.label",
        description: "Structured final agent summary."
      })
    ],
    provider: "runtime",
    providerCapabilityId: "agent.end",
    defaultRuntimeRef: "mock-local",
    defaultHarnessId: "critic.basic",
    riskLevel: "safe",
    defaultExecutionMode: "mock-executable",
    allowedExecutionModes: ["mock-executable", "protected", "runtime-required"],
    runtimeCompatibility: [
      runtimeCompatibility("mock-local", ["mock-executable"], "mock-executable"),
      runtimeCompatibility("openclaw-local", ["protected"], "protected")
    ],
    estimateHints: {
      inputTokenEstimate: 750,
      outputTokenEstimate: 500,
      latencyMs: 250
    }
  },
  {
    type: "output.console",
    category: "output",
    role: "output",
    labelKey: "node.outputConsole.label",
    descriptionKey: "node.outputConsole.description",
    groupKey: "nodeCatalog.group.outputs",
    inputs: [
      input("in", "In", "any", {
        labelKey: "nodePort.in.label",
        required: true,
        resolutionSource: "upstream",
        description: "Final value to display in the run inspector."
      })
    ],
    outputs: [],
    provider: "internal",
    providerCapabilityId: "output.console",
    riskLevel: "safe",
    defaultExecutionMode: "output-only",
    allowedExecutionModes: ["output-only"],
    runtimeCompatibility: [
      runtimeCompatibility("mock-local", ["output-only"], "output-only")
    ],
    estimateHints: {
      latencyMs: 0
    }
  }
];

const nodeTypeDefinitionsByType = new Map(
  DEFAULT_NODE_TYPE_DEFINITIONS.map((definition) => [definition.type, definition])
);

export function listNodeTypeDefinitions(): NodeTypeDefinition[] {
  return DEFAULT_NODE_TYPE_DEFINITIONS.map(cloneNodeTypeDefinition);
}

export function getNodeTypeDefinition(type: string): NodeTypeDefinition | undefined {
  const definition = nodeTypeDefinitionsByType.get(type);

  return definition === undefined ? undefined : cloneNodeTypeDefinition(definition);
}

function cloneNodeTypeDefinition(definition: NodeTypeDefinition): NodeTypeDefinition {
  return {
    ...definition,
    inputs: definition.inputs.map((inputDefinition) => ({ ...inputDefinition })),
    outputs: definition.outputs.map((outputDefinition) => ({ ...outputDefinition })),
    allowedExecutionModes: [...definition.allowedExecutionModes],
    runtimeCompatibility: definition.runtimeCompatibility.map((compatibility) => ({
      ...compatibility,
      allowedExecutionModes: [...compatibility.allowedExecutionModes],
      supportedRuntimeTypes:
        compatibility.supportedRuntimeTypes === undefined
          ? undefined
          : [...compatibility.supportedRuntimeTypes],
      requiredCapabilities:
        compatibility.requiredCapabilities === undefined
          ? undefined
          : [...compatibility.requiredCapabilities],
      recommendedCapabilities:
        compatibility.recommendedCapabilities === undefined
          ? undefined
          : [...compatibility.recommendedCapabilities]
    })),
    estimateHints:
      definition.estimateHints === undefined
        ? undefined
        : {
            ...definition.estimateHints
          }
  };
}
