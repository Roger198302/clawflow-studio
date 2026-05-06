import type { FlowSpec, RunEvent } from "@clawflow/protocol";

export interface FlowValidationIssue {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface FlowValidationResult {
  ok: boolean;
  issues: FlowValidationIssue[];
}

export interface FlowEngineOptions {
  createId?: (prefix: string) => string;
  now?: () => string;
}

export class FlowEngine {
  private readonly createId: (prefix: string) => string;
  private readonly now: () => string;

  constructor(options: FlowEngineOptions = {}) {
    this.createId = options.createId ?? this.defaultCreateId;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  validate(flow: FlowSpec): FlowValidationResult {
    const issues: FlowValidationIssue[] = [];
    const nodeIds = new Set<string>();

    for (const node of flow.nodes) {
      if (nodeIds.has(node.id)) {
        issues.push({
          code: "duplicate_node_id",
          message: `Duplicate node id: ${node.id}`,
          nodeId: node.id
        });
      }

      nodeIds.add(node.id);
    }

    for (const edge of flow.edges) {
      if (!nodeIds.has(edge.source)) {
        issues.push({
          code: "missing_edge_source",
          message: `Edge source node not found: ${edge.source}`,
          edgeId: edge.id
        });
      }

      if (!nodeIds.has(edge.target)) {
        issues.push({
          code: "missing_edge_target",
          message: `Edge target node not found: ${edge.target}`,
          edgeId: edge.id
        });
      }
    }

    return {
      ok: issues.length === 0,
      issues
    };
  }

  createRunSkeleton(flow: FlowSpec, runId = this.createId("run")): RunEvent[] {
    return [
      {
        id: this.createId("event"),
        runId,
        flowId: flow.id,
        sequence: 1,
        timestamp: this.now(),
        type: "run.created",
        status: "queued",
        message: `Run created for flow: ${flow.name}`
      }
    ];
  }

  private defaultCreateId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
