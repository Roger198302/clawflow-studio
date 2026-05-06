import type { FlowEdge, FlowNode, FlowSpec, RunEvent, RunStatus } from "@clawflow/protocol";

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

export interface NodeExecutionInput {
  node: FlowNode;
  input?: Record<string, unknown>;
}

export interface NodeExecutionResult {
  nodeId: string;
  nodeType: string;
  label: string;
  output: Record<string, unknown>;
}

export interface NodeExecutionAdapter {
  executeNode(input: NodeExecutionInput): Promise<NodeExecutionResult>;
}

export interface FlowExecutionOptions {
  runId?: string;
  initialInput?: Record<string, unknown>;
  onEvent?: (event: RunEvent) => void | Promise<void>;
}

export interface FlowExecutionResult {
  runId: string;
  status: RunStatus;
  events: RunEvent[];
  output?: Record<string, unknown>;
}

export interface FlowEngineOptions {
  createId?: (prefix: string) => string;
  now?: () => string;
  stepDelayMs?: number;
}

export class FlowEngine {
  private readonly createId: (prefix: string) => string;
  private readonly now: () => string;
  private readonly stepDelayMs: number;

  constructor(options: FlowEngineOptions = {}) {
    this.createId = options.createId ?? this.defaultCreateId;
    this.now = options.now ?? (() => new Date().toISOString());
    this.stepDelayMs = options.stepDelayMs ?? 250;
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

  async execute(
    flow: FlowSpec,
    adapter: NodeExecutionAdapter,
    options: FlowExecutionOptions = {}
  ): Promise<FlowExecutionResult> {
    const runId = options.runId ?? this.createId("run");
    const events: RunEvent[] = [];
    let sequence = 0;
    let activeNode: FlowNode | undefined;

    const emit = async (
      event: Omit<RunEvent, "id" | "runId" | "flowId" | "sequence" | "timestamp">
    ): Promise<void> => {
      const runEvent: RunEvent = {
        id: this.createId("event"),
        runId,
        flowId: flow.id,
        sequence: ++sequence,
        timestamp: this.now(),
        ...event
      };

      events.push(runEvent);
      await options.onEvent?.(runEvent);
    };

    try {
      const path = this.resolveSinglePath(flow);
      let currentInput: Record<string, unknown> | undefined = options.initialInput;

      await emit({
        type: "run.started",
        status: "running",
        message: `Run started for flow: ${flow.name}`,
        payload: {
          nodeCount: path.length
        }
      });

      for (const node of path) {
        activeNode = node;
        await this.delay();

        await emit({
          type: "node.started",
          status: "running",
          nodeId: node.id,
          message: `${node.label} started.`,
          payload: this.createNodePayload(node)
        });

        await emit({
          type: "node.input",
          status: "running",
          nodeId: node.id,
          message: `${node.label} received input.`,
          payload: {
            input: currentInput ?? {}
          }
        });

        const result = await adapter.executeNode({
          node,
          input: currentInput
        });

        currentInput = result.output;

        await emit({
          type: "node.output",
          status: "running",
          nodeId: node.id,
          message: `${node.label} produced output.`,
          payload: {
            nodeId: result.nodeId,
            nodeType: result.nodeType,
            label: result.label,
            output: result.output
          }
        });

        await emit({
          type: "node.completed",
          status: "success",
          nodeId: node.id,
          message: `${node.label} completed.`,
          payload: {
            output: result.output
          }
        });
      }

      await emit({
        type: "run.completed",
        status: "success",
        message: `Run completed for flow: ${flow.name}`,
        payload: {
          output: currentInput ?? {}
        }
      });

      return {
        runId,
        status: "success",
        events,
        output: currentInput
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown flow execution error.";

      if (activeNode !== undefined) {
        await emit({
          type: "node.failed",
          status: "failed",
          nodeId: activeNode.id,
          message: `${activeNode.label} failed: ${message}`,
          payload: {
            error: message
          }
        });
      }

      await emit({
        type: "run.failed",
        status: "failed",
        message: `Run failed: ${message}`,
        payload: {
          error: message
        }
      });

      return {
        runId,
        status: "failed",
        events
      };
    }
  }

  private resolveSinglePath(flow: FlowSpec): FlowNode[] {
    const validation = this.validate(flow);

    if (!validation.ok) {
      throw new Error(validation.issues.map((issue) => issue.message).join("; "));
    }

    const triggerNodes = flow.nodes.filter((node) => node.role === "trigger");

    if (triggerNodes.length !== 1) {
      throw new Error(`Expected exactly one trigger node, found ${triggerNodes.length}.`);
    }

    const nodesById = new Map(flow.nodes.map((node) => [node.id, node]));
    const outgoingEdges = this.createOutgoingEdgeMap(flow.edges);
    const path: FlowNode[] = [];
    const visited = new Set<string>();
    let currentNode: FlowNode | undefined = triggerNodes[0];

    while (currentNode !== undefined) {
      if (visited.has(currentNode.id)) {
        throw new Error(`Loop detected at node: ${currentNode.id}`);
      }

      visited.add(currentNode.id);
      path.push(currentNode);

      const edges = outgoingEdges.get(currentNode.id) ?? [];

      if (edges.length > 1) {
        throw new Error(`Branching is not supported yet at node: ${currentNode.id}`);
      }

      if (edges.length === 0) {
        currentNode = undefined;
      } else {
        currentNode = nodesById.get(edges[0].target);
      }
    }

    return path;
  }

  private createOutgoingEdgeMap(edges: FlowEdge[]): Map<string, FlowEdge[]> {
    const outgoingEdges = new Map<string, FlowEdge[]>();

    for (const edge of edges) {
      const existingEdges = outgoingEdges.get(edge.source) ?? [];
      existingEdges.push(edge);
      outgoingEdges.set(edge.source, existingEdges);
    }

    return outgoingEdges;
  }

  private createNodePayload(node: FlowNode): Record<string, unknown> {
    return {
      nodeId: node.id,
      type: node.type,
      role: node.role,
      runtimeRef: node.runtimeRef ?? "mock-local"
    };
  }

  private async delay(): Promise<void> {
    if (this.stepDelayMs <= 0) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, this.stepDelayMs);
    });
  }

  private defaultCreateId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
