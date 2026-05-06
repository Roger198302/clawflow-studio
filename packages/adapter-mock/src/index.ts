import type { FlowNode, RuntimeHealth, RuntimeType } from "@clawflow/protocol";
import type { RuntimeAdapter } from "@clawflow/runtime-registry";

export interface MockRuntimeInput {
  node: FlowNode;
  input?: Record<string, unknown>;
}

export interface MockRuntimeOutput {
  nodeId: string;
  nodeType: string;
  label: string;
  output: Record<string, unknown>;
}

export class MockRuntimeAdapter implements RuntimeAdapter {
  readonly runtimeType: RuntimeType = "mock";

  async health(): Promise<RuntimeHealth> {
    return {
      runtimeId: "mock-local",
      status: "online",
      checkedAt: new Date().toISOString(),
      message: "Mock runtime adapter is online."
    };
  }

  async executeNode({ node, input }: MockRuntimeInput): Promise<MockRuntimeOutput> {
    const output = this.executeSupportedNode(node, input);

    return {
      nodeId: node.id,
      nodeType: node.type,
      label: node.label,
      output
    };
  }

  private executeSupportedNode(
    node: FlowNode,
    input: Record<string, unknown> | undefined
  ): Record<string, unknown> {
    switch (node.type) {
      case "manual.trigger":
        return {
          kind: "manual.trigger.output",
          prompt: input?.userInput ?? "Run the mock MVP flow.",
          acceptedAt: new Date().toISOString()
        };

      case "agent.start":
        return {
          kind: "agent.start.output",
          taskUnderstanding: "Prepare a sequential mock Agent workflow run.",
          riskAssessment: {
            level: node.riskPolicy.level,
            requiresApproval: node.riskPolicy.requiresApproval
          },
          plan: ["Read trigger input", "Execute worker step", "Summarize result"]
        };

      case "agent.worker":
        return {
          kind: "agent.worker.output",
          result: `Mock worker completed ${node.label}.`,
          usedRuntimeRef: node.runtimeRef ?? "mock-local",
          thinkingLevel: node.budgetPolicy.thinking,
          upstream: input ?? {}
        };

      case "agent.end":
        return {
          kind: "agent.end.output",
          summary: "Mock agent path completed successfully.",
          finalRiskLevel: node.riskPolicy.level,
          upstream: input ?? {}
        };

      case "output.console":
        return {
          kind: "output.console.output",
          console: "Mock flow completed. Final output is available in the Run Inspector.",
          upstream: input ?? {}
        };

      default:
        throw new Error(`MockRuntimeAdapter does not support node type: ${node.type}`);
    }
  }
}
