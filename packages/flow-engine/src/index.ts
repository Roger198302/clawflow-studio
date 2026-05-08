import type {
  CapabilityProvider,
  ExecutionPlanStatus,
  ExecutionPlanUnsupportedReason,
  EstimateConfidence,
  EstimateRange,
  EstimatorSource,
  EstimatorWarning,
  FlowEdge,
  FlowEstimate,
  FlowExecutionContractPreview,
  FlowNode,
  FlowSpec,
  LatencyEstimate,
  LinearExecutionPlan,
  LinearExecutionPlanStep,
  NodeCategory,
  NodeCapabilityContract,
  NodeExecutionContract,
  NodeExecutionMode,
  NodeEstimateHints,
  NodeInputDefinition,
  NodeOutputDefinition,
  NodePortDefinition,
  NodeRiskLevel,
  NodeEstimate,
  NodeTypeDefinition,
  PortCompatibilityIssue,
  PortDataType,
  RunReadinessIssue,
  RunReadinessReport,
  RunEvent,
  RuntimeExecutionMode,
  RuntimePlanMetadata,
  RunStatus,
  TokenEstimate,
  CostEstimate
} from "@clawflow/protocol";
import { getNodeTypeDefinition } from "./nodeCatalog.js";

export {
  DEFAULT_NODE_TYPE_DEFINITIONS,
  getNodeTypeDefinition,
  listNodeTypeDefinitions
} from "./nodeCatalog.js";

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
  runtimePlan?: FlowRuntimePlan;
  onEvent?: (event: RunEvent) => void | Promise<void>;
}

export type FlowRuntimePlan = RuntimePlanMetadata;

export interface FlowExecutionResult {
  runId: string;
  status: RunStatus;
  events: RunEvent[];
  output?: Record<string, unknown>;
}

export interface FlowExecutionContractPreviewOptions {
  runtimeExecutionModes?: Record<string, RuntimeExecutionMode>;
}

export type LinearExecutionPlanOptions = FlowExecutionContractPreviewOptions;

export interface StaticModelEstimateMetadata {
  modelFamily?: string;
  contextWindowTokens?: number;
  inputCostUsdPer1KTokens?: number;
  outputCostUsdPer1KTokens?: number;
  reasoningCostUsdPer1KTokens?: number;
  baseLatencyMs?: number;
}

export interface FlowEstimateOptions extends FlowExecutionContractPreviewOptions {
  userInputText?: string;
  sessionContextText?: string;
  modelRefs?: Record<string, string>;
  modelMetadata?: Record<string, StaticModelEstimateMetadata>;
}

export type RunReadinessReportOptions = FlowEstimateOptions;

export interface FlowEngineOptions {
  createId?: (prefix: string) => string;
  now?: () => string;
  stepDelayMs?: number;
}

interface NodeContractDefinition {
  category: NodeCategory;
  inputs: NodeInputDefinition[];
  outputs: NodeOutputDefinition[];
  executionMode: NodeExecutionMode;
  capability?: Omit<NodeCapabilityContract, "runtimeRef">;
  source?: "catalog" | "placeholder" | "fallback";
}

export function buildFlowExecutionContractPreview(
  flow: FlowSpec,
  options: FlowExecutionContractPreviewOptions = {}
): FlowExecutionContractPreview {
  const incomingEdges = createIncomingEdgeMap(flow.edges);
  const outgoingEdges = createOutgoingEdgeMap(flow.edges);
  const nodesById = new Map(flow.nodes.map((node) => [node.id, node]));
  const runtimeExecutionModes = options.runtimeExecutionModes ?? {};
  const contracts = flow.nodes.map((node) =>
    createNodeExecutionContract(node, incomingEdges, outgoingEdges, runtimeExecutionModes)
  );
  const contractsByNodeId = new Map(contracts.map((contract) => [contract.nodeId, contract]));
  const previewWarnings: string[] = [];
  const previewErrors: string[] = [];
  const portCompatibilityIssues: PortCompatibilityIssue[] = [];

  for (const edge of flow.edges) {
    const sourceNode = nodesById.get(edge.source);
    const targetNode = nodesById.get(edge.target);

    if (sourceNode === undefined) {
      previewErrors.push(`Edge ${edge.id} references missing source node ${edge.source}.`);
      continue;
    }

    if (targetNode === undefined) {
      previewErrors.push(`Edge ${edge.id} references missing target node ${edge.target}.`);
      continue;
    }

    const sourceContract = contractsByNodeId.get(sourceNode.id);
    const targetContract = contractsByNodeId.get(targetNode.id);

    if (sourceContract === undefined || targetContract === undefined) {
      continue;
    }

    const sourcePort = resolveSourcePort(sourceContract, edge.sourceHandle);
    const targetPort = resolveTargetPort(targetContract, edge.targetHandle);
    const issue = evaluatePortCompatibility(
      sourceContract,
      sourcePort,
      targetContract,
      targetPort
    );

    if (issue !== null) {
      portCompatibilityIssues.push(issue);
    }
  }

  for (const contract of contracts) {
    previewWarnings.push(...contract.warnings.map((warning) => `${contract.nodeId}: ${warning}`));
    previewErrors.push(...contract.errors.map((error) => `${contract.nodeId}: ${error}`));
  }

  for (const issue of portCompatibilityIssues) {
    const message = `${issue.sourceNodeId} -> ${issue.targetNodeId}: ${issue.message}`;

    if (issue.severity === "error") {
      previewErrors.push(message);
    } else {
      previewWarnings.push(message);
    }
  }

  return {
    flowId: flow.id,
    nodes: contracts,
    warnings: previewWarnings,
    errors: previewErrors,
    summary: createExecutionContractSummary(contracts),
    portCompatibilityIssues
  };
}

export function buildContractAwareLinearExecutionPlan(
  flow: FlowSpec,
  options: LinearExecutionPlanOptions = {}
): LinearExecutionPlan {
  const contractPreview = buildFlowExecutionContractPreview(flow, options);
  const incomingEdges = createIncomingEdgeMap(flow.edges);
  const outgoingEdges = createOutgoingEdgeMap(flow.edges);
  const nodesById = new Map(flow.nodes.map((node) => [node.id, node]));
  const contractsByNodeId = new Map(
    contractPreview.nodes.map((contract) => [contract.nodeId, contract])
  );
  const warnings = new Set<string>(contractPreview.warnings);
  const errors = new Set<string>(contractPreview.errors);
  const unsupportedReasons = new Set<ExecutionPlanUnsupportedReason>();

  if (flow.nodes.length === 0) {
    unsupportedReasons.add("empty-flow");
    errors.add("Flow is empty.");

    return {
      flowId: flow.id,
      status: "invalid",
      steps: [],
      warnings: Array.from(warnings),
      errors: Array.from(errors),
      unsupportedReasons: Array.from(unsupportedReasons),
      summary: createLinearExecutionPlanSummary([]),
      contractPreview
    };
  }

  for (const edge of flow.edges) {
    if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) {
      unsupportedReasons.add("invalid-edge");
      errors.add(`Edge ${edge.id} references a missing source or target node.`);
    }
  }

  for (const [nodeId, edges] of outgoingEdges) {
    if (edges.length > 1) {
      unsupportedReasons.add("branching-not-supported");
      errors.add(`Node ${nodeId} has ${edges.length} outgoing edges; branching is not supported in Phase 5I.`);
    }
  }

  for (const [nodeId, edges] of incomingEdges) {
    if (edges.length > 1) {
      unsupportedReasons.add("fan-in-not-supported");
      errors.add(`Node ${nodeId} has ${edges.length} incoming edges; fan-in is not supported in Phase 5I.`);
    }
  }

  const triggerNodes = flow.nodes.filter((node) => isPlanTriggerNode(node, contractsByNodeId.get(node.id)));

  if (triggerNodes.length === 0) {
    unsupportedReasons.add("missing-trigger");
    errors.add("Linear execution plan requires exactly one trigger node.");
  }

  if (triggerNodes.length > 1) {
    unsupportedReasons.add("multiple-triggers");
    errors.add(`Linear execution plan requires one trigger node, found ${triggerNodes.length}.`);
  }

  if (hasCycle(flow.nodes, outgoingEdges)) {
    unsupportedReasons.add("cycle-detected");
    errors.add("Cycle detected; loops are not supported in Phase 5I.");
  }

  const orderedNodes = orderNodesForLinearPlan(flow, triggerNodes[0], outgoingEdges, nodesById);
  const orderedNodeIds = new Set(orderedNodes.map((node) => node.id));

  if (triggerNodes.length === 1 && orderedNodeIds.size < flow.nodes.length) {
    unsupportedReasons.add("branching-not-supported");
    warnings.add("Flow contains nodes outside the trigger path; multiple independent chains are not supported in Phase 5I.");
  }

  const stepIdByNodeId = new Map(orderedNodes.map((node) => [node.id, createPlanStepId(node.id)]));
  const steps = orderedNodes.map((node, index) =>
    createLinearExecutionPlanStep({
      node,
      order: index + 1,
      contract: contractsByNodeId.get(node.id),
      incomingEdges: incomingEdges.get(node.id) ?? [],
      outgoingEdges: outgoingEdges.get(node.id) ?? [],
      contractsByNodeId,
      stepIdByNodeId
    })
  );

  for (const step of steps) {
    for (const reason of step.blockingReasons) {
      unsupportedReasons.add(reason);
    }
  }

  const status = resolveLinearExecutionPlanStatus(
    Array.from(unsupportedReasons),
    steps,
    errors
  );

  return {
    flowId: flow.id,
    status,
    steps,
    warnings: Array.from(warnings),
    errors: Array.from(errors),
    unsupportedReasons: Array.from(unsupportedReasons),
    summary: createLinearExecutionPlanSummary(steps),
    contractPreview
  };
}

export const buildLinearExecutionPlan = buildContractAwareLinearExecutionPlan;

export function buildStaticFlowEstimate(
  flow: FlowSpec,
  options: FlowEstimateOptions = {}
): FlowEstimate {
  const contractPreview = buildFlowExecutionContractPreview(flow, options);
  const contractsByNodeId = new Map(
    contractPreview.nodes.map((contract) => [contract.nodeId, contract])
  );
  const flowWarnings: EstimatorWarning[] = [
    ...contractPreview.warnings.map((warning) =>
      createEstimatorWarning("contract_preview_warning", "estimator.warning.contractPreviewWarning", {
        message: warning
      })
    ),
    ...contractPreview.errors.map((error) =>
      createEstimatorWarning("contract_preview_error", "estimator.warning.contractPreviewError", {
        message: error
      })
    )
  ];
  const nodes = flow.nodes.map((node) =>
    createNodeEstimate(node, contractsByNodeId.get(node.id), options)
  );
  const nodeWarnings = nodes.flatMap((node) => node.warnings);
  const warnings = [...flowWarnings, ...nodeWarnings];
  const totals = createFlowEstimateTotals(nodes);

  return {
    flowId: flow.id,
    confidence: combineConfidence(nodes.map((node) => node.confidence)),
    tokenConfidence: combineConfidence(nodes.map((node) => node.tokenConfidence)),
    costConfidence: combineConfidence(nodes.map((node) => node.costConfidence)),
    latencyConfidence: combineConfidence(nodes.map((node) => node.latencyConfidence)),
    nodes,
    totals,
    warnings,
    partial:
      warnings.length > 0 ||
      nodes.some((node) => node.partial) ||
      totals.cost.status === "unknown"
  };
}

export const estimateFlowResources = buildStaticFlowEstimate;

export function buildRunReadinessReport(
  flow: FlowSpec,
  options: RunReadinessReportOptions = {}
): RunReadinessReport {
  const diagnostics = validateFlowDefinition(flow);
  const executionPlan = buildContractAwareLinearExecutionPlan(flow, options);
  const resourceEstimate = buildStaticFlowEstimate(flow, options);
  const issues: RunReadinessIssue[] = [];

  for (const issue of diagnostics.issues) {
    issues.push({
      code: `diagnostics.${issue.code}`,
      severity: "error",
      messageKey: "runReadiness.issue.graphDiagnostic",
      nodeId: issue.nodeId,
      details: {
        technicalMessage: issue.message,
        edgeId: issue.edgeId
      }
    });
  }

  if (executionPlan.status !== "ready") {
    issues.push({
      code: `execution_plan.status.${executionPlan.status}`,
      severity: "error",
      messageKey: "runReadiness.issue.executionPlanNotReady",
      details: {
        status: executionPlan.status
      }
    });
  }

  for (const reason of executionPlan.unsupportedReasons) {
    issues.push({
      code: `execution_plan.unsupported.${reason}`,
      severity: "error",
      messageKey: "runReadiness.issue.executionPlanUnsupported",
      details: {
        reason
      }
    });
  }

  for (const error of executionPlan.errors) {
    issues.push({
      code: "execution_plan.error",
      severity: "error",
      messageKey: "runReadiness.issue.executionPlanError",
      details: {
        technicalMessage: error
      }
    });
  }

  for (const warning of executionPlan.warnings) {
    issues.push({
      code: "execution_plan.warning",
      severity: "warning",
      messageKey: "runReadiness.issue.executionPlanWarning",
      details: {
        technicalMessage: warning
      }
    });
  }

  for (const step of executionPlan.steps) {
    for (const reason of step.blockingReasons) {
      issues.push({
        code: `execution_plan.step_blocked.${reason}`,
        severity: "error",
        messageKey: "runReadiness.issue.executionPlanStepBlocked",
        nodeId: step.nodeId,
        details: {
          stepId: step.stepId,
          reason
        }
      });
    }
  }

  issues.push({
    code: "resource_estimate.preview_only",
    severity: "info",
    messageKey: "runReadiness.issue.resourceEstimatePreviewOnly"
  });

  for (const warning of resourceEstimate.warnings) {
    issues.push({
      code: `resource_estimate.${warning.code}`,
      severity: "warning",
      messageKey: warning.messageKey,
      nodeId: warning.nodeId,
      details: createRunReadinessDetails(warning.details)
    });
  }

  if (resourceEstimate.totals.cost.status === "unknown") {
    issues.push({
      code: "resource_estimate.unknown_cost",
      severity: "warning",
      messageKey: "runReadiness.issue.resourceEstimateUnknownCost",
      details: {
        costStatus: resourceEstimate.totals.cost.status
      }
    });
  }

  if (resourceEstimate.confidence === "low" || resourceEstimate.confidence === "unknown") {
    issues.push({
      code: `resource_estimate.confidence.${resourceEstimate.confidence}`,
      severity: "warning",
      messageKey: "runReadiness.issue.resourceEstimateLowConfidence",
      details: {
        confidence: resourceEstimate.confidence,
        tokenConfidence: resourceEstimate.tokenConfidence,
        costConfidence: resourceEstimate.costConfidence,
        latencyConfidence: resourceEstimate.latencyConfidence
      }
    });
  }

  const errorIssues = issues.filter((issue) => issue.severity === "error").length;
  const warningIssues = issues.filter((issue) => issue.severity === "warning").length;
  const infoIssues = issues.filter((issue) => issue.severity === "info").length;

  return {
    flowId: flow.id,
    status: errorIssues > 0 ? "blocked" : warningIssues > 0 ? "warning" : "ready",
    issues,
    sources: {
      diagnostics: true,
      executionPlan: true,
      resourceEstimate: true
    },
    summary: {
      totalIssues: issues.length,
      infoIssues,
      warningIssues,
      errorIssues,
      diagnosticIssueCount: diagnostics.issues.length,
      executionPlanStatus: executionPlan.status,
      executionPlanIssueCount:
        executionPlan.errors.length +
        executionPlan.warnings.length +
        executionPlan.unsupportedReasons.length +
        executionPlan.steps.reduce((total, step) => total + step.blockingReasons.length, 0),
      resourceEstimateWarningCount: resourceEstimate.warnings.length,
      resourceEstimateConfidence: resourceEstimate.confidence,
      resourceEstimateCostStatus: resourceEstimate.totals.cost.status
    }
  };
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
    return validateFlowDefinition(flow);
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
      const linearExecutionPlan = buildContractAwareLinearExecutionPlan(flow, {
        runtimeExecutionModes: createRuntimeExecutionModeMap(options.runtimePlan)
      });
      const planStepsByNodeId = new Map(
        linearExecutionPlan.steps.map((step) => [step.nodeId, step])
      );
      let currentInput: Record<string, unknown> | undefined = options.initialInput;

      await emit({
        type: "run.started",
        status: "running",
        message: `Run started for flow: ${flow.name}`,
        payload: {
          nodeCount: path.length,
          runtimePlan: options.runtimePlan,
          linearExecutionPlan: {
            status: linearExecutionPlan.status,
            summary: linearExecutionPlan.summary
          },
          protectedDryRun: options.runtimePlan?.protectedDryRun ?? false
        }
      });

      await emit({
        type: "execution.plan.created",
        status: linearExecutionPlan.status === "ready" ? "queued" : "waiting_approval",
        message: `Linear execution plan ${linearExecutionPlan.status} for flow: ${flow.name}`,
        payload: {
          planStatus: linearExecutionPlan.status,
          summary: linearExecutionPlan.summary,
          unsupportedReasons: linearExecutionPlan.unsupportedReasons,
          warnings: linearExecutionPlan.warnings,
          errors: linearExecutionPlan.errors,
          steps: linearExecutionPlan.steps.map((step) => ({
            stepId: step.stepId,
            order: step.order,
            nodeId: step.nodeId,
            nodeType: step.nodeType,
            executionMode: step.executionMode,
            status: step.status
          }))
        }
      });

      for (const node of path) {
        activeNode = node;
        const planStep = planStepsByNodeId.get(node.id);

        await emit({
          type: "execution.step.queued",
          status: "queued",
          nodeId: node.id,
          message: `${node.label} queued as ${planStep?.stepId ?? "unplanned step"}.`,
          payload: {
            step: createPlanStepEventPayload(planStep)
          }
        });

        await this.delay();

        await emit({
          type: "execution.step.started",
          status: "running",
          nodeId: node.id,
          message: `${node.label} step started.`,
          payload: {
            step: createPlanStepEventPayload(planStep),
            receivedInput: currentInput ?? {}
          }
        });

        await emit({
          type: "node.started",
          status: "running",
          nodeId: node.id,
          message: `${node.label} started.`,
          payload: {
            ...this.createNodePayload(node),
            step: createPlanStepEventPayload(planStep)
          }
        });

        await emit({
          type: "node.input",
          status: "running",
          nodeId: node.id,
          message: `${node.label} received input.`,
          payload: {
            step: createPlanStepEventPayload(planStep),
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
            step: createPlanStepEventPayload(planStep),
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
            step: createPlanStepEventPayload(planStep),
            output: result.output
          }
        });

        await emit({
          type: "execution.step.completed",
          status: "success",
          nodeId: node.id,
          message: `${node.label} step completed.`,
          payload: {
            step: createPlanStepEventPayload(planStep),
            output: result.output
          }
        });
      }

      await emit({
        type: "execution.plan.completed",
        status: "success",
        message: `Linear execution plan completed for flow: ${flow.name}`,
        payload: {
          planStatus: "ready",
          summary: linearExecutionPlan.summary
        }
      });

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

interface CreateLinearPlanStepInput {
  node: FlowNode;
  order: number;
  contract: NodeExecutionContract | undefined;
  incomingEdges: FlowEdge[];
  outgoingEdges: FlowEdge[];
  contractsByNodeId: Map<string, NodeExecutionContract>;
  stepIdByNodeId: Map<string, string>;
}

function createLinearExecutionPlanStep(input: CreateLinearPlanStepInput): LinearExecutionPlanStep {
  const contract = input.contract ?? createFallbackNodeExecutionContract(input.node);
  const blockingReasons: ExecutionPlanUnsupportedReason[] = [];
  const errors = [...contract.errors];

  if (contract.executionMode === "blocked") {
    blockingReasons.push("blocked-node");
  }

  if (contract.missingRequiredInputs.length > 0) {
    blockingReasons.push("missing-required-input");
  }

  if (contract.warnings.some((warning) => warning.includes("Unknown node type"))) {
    blockingReasons.push("unknown-node");
  }

  return {
    stepId: input.stepIdByNodeId.get(input.node.id) ?? createPlanStepId(input.node.id),
    order: input.order,
    nodeId: input.node.id,
    nodeType: input.node.type,
    label: input.node.label,
    category: contract.category,
    executionMode: contract.executionMode,
    provider: contract.capability?.provider,
    runtimeRef: contract.capability?.runtimeRef,
    riskLevel: contract.capability?.riskLevel,
    upstreamNodeIds: input.incomingEdges.map((edge) => edge.source),
    downstreamNodeIds: input.outgoingEdges.map((edge) => edge.target),
    inputMappings: createStepInputMappings(input.node, contract, input.incomingEdges, input.contractsByNodeId, input.stepIdByNodeId),
    outputMappings: createStepOutputMappings(contract, input.outgoingEdges),
    status: blockingReasons.length > 0 ? "blocked" : "pending",
    blockingReasons,
    warnings: [...contract.warnings],
    errors
  };
}

function createStepInputMappings(
  node: FlowNode,
  contract: NodeExecutionContract,
  incomingEdges: FlowEdge[],
  contractsByNodeId: Map<string, NodeExecutionContract>,
  stepIdByNodeId: Map<string, string>
): LinearExecutionPlanStep["inputMappings"] {
  if (contract.inputs.length === 0) {
    return [
      {
        strategy: contract.category === "trigger" || node.role === "trigger" ? "trigger" : "constant",
        status: "resolved"
      }
    ];
  }

  return contract.inputs.map((inputPort) => {
    const sourceEdge = incomingEdges[0];

    if (sourceEdge === undefined) {
      return {
        inputPortId: inputPort.id,
        dataType: inputPort.dataType,
        strategy: "unresolved",
        required: inputPort.required,
        status: inputPort.required === true ? "unresolved" : "warning"
      };
    }

    const sourceContract = contractsByNodeId.get(sourceEdge.source);
    const sourcePort = resolveSourcePort(sourceContract ?? createFallbackNodeExecutionContract({
      id: sourceEdge.source,
      type: "unknown",
      role: "process",
      label: sourceEdge.source,
      position: { x: 0, y: 0 },
      contextPolicy: { mode: "none", includeRunHistory: false },
      budgetPolicy: { thinking: "none" },
      riskPolicy: { level: "low", requiresApproval: false }
    }), sourceEdge.sourceHandle);

    return {
      inputPortId: inputPort.id,
      sourceNodeId: sourceEdge.source,
      sourcePortId: sourcePort?.id,
      sourceStepId: stepIdByNodeId.get(sourceEdge.source),
      dataType: inputPort.dataType,
      strategy: "single-upstream-output",
      required: inputPort.required,
      status: sourceContract === undefined ? "warning" : "resolved"
    };
  });
}

function createStepOutputMappings(
  contract: NodeExecutionContract,
  outgoingEdges: FlowEdge[]
): LinearExecutionPlanStep["outputMappings"] {
  if (contract.outputs.length === 0) {
    return [
      {
        targetNodeIds: outgoingEdges.map((edge) => edge.target),
        strategy: outgoingEdges.length === 0 ? "terminal" : "unmapped"
      }
    ];
  }

  return contract.outputs.map((outputPort) => ({
    outputPortId: outputPort.id,
    targetNodeIds: outgoingEdges.map((edge) => edge.target),
    dataType: outputPort.dataType,
    strategy:
      outgoingEdges.length > 0
        ? "pass-through"
        : contract.category === "output"
          ? "terminal"
          : "unmapped"
  }));
}

function orderNodesForLinearPlan(
  flow: FlowSpec,
  triggerNode: FlowNode | undefined,
  outgoingEdges: Map<string, FlowEdge[]>,
  nodesById: Map<string, FlowNode>
): FlowNode[] {
  if (triggerNode === undefined) {
    return [...flow.nodes];
  }

  const orderedNodes: FlowNode[] = [];
  const visited = new Set<string>();
  let currentNode: FlowNode | undefined = triggerNode;

  while (currentNode !== undefined && !visited.has(currentNode.id)) {
    orderedNodes.push(currentNode);
    visited.add(currentNode.id);

    const nextEdge: FlowEdge | undefined = outgoingEdges.get(currentNode.id)?.[0];
    currentNode = nextEdge === undefined ? undefined : nodesById.get(nextEdge.target);
  }

  for (const node of flow.nodes) {
    if (!visited.has(node.id)) {
      orderedNodes.push(node);
    }
  }

  return orderedNodes;
}

function hasCycle(nodes: FlowNode[], outgoingEdges: Map<string, FlowEdge[]>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) {
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visiting.add(nodeId);

    for (const edge of outgoingEdges.get(nodeId) ?? []) {
      if (visit(edge.target)) {
        return true;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);

    return false;
  };

  return nodes.some((node) => visit(node.id));
}

function isPlanTriggerNode(
  node: FlowNode,
  contract: NodeExecutionContract | undefined
): boolean {
  return node.role === "trigger" || contract?.category === "trigger";
}

function resolveLinearExecutionPlanStatus(
  unsupportedReasons: ExecutionPlanUnsupportedReason[],
  steps: LinearExecutionPlanStep[],
  errors: Set<string>
): ExecutionPlanStatus {
  const invalidReasons: ExecutionPlanUnsupportedReason[] = [
    "empty-flow",
    "invalid-edge",
    "missing-trigger",
    "multiple-triggers",
    "cycle-detected"
  ];

  if (unsupportedReasons.some((reason) => invalidReasons.includes(reason))) {
    return "invalid";
  }

  const unsupportedStructureReasons: ExecutionPlanUnsupportedReason[] = [
    "branching-not-supported",
    "fan-in-not-supported",
    "unknown-node"
  ];

  if (unsupportedReasons.some((reason) => unsupportedStructureReasons.includes(reason))) {
    return "unsupported";
  }

  if (
    errors.size > 0 ||
    steps.some((step) =>
      step.blockingReasons.some((reason) => reason === "blocked-node" || reason === "missing-required-input")
    )
  ) {
    return "blocked";
  }

  return "ready";
}

function createLinearExecutionPlanSummary(
  steps: LinearExecutionPlanStep[]
): LinearExecutionPlan["summary"] {
  return {
    totalSteps: steps.length,
    runnableSteps: steps.filter((step) => step.status !== "blocked" && step.executionMode !== "preview-only").length,
    blockedSteps: steps.filter((step) => step.status === "blocked").length,
    outputSteps: steps.filter((step) => step.category === "output").length,
    triggerSteps: steps.filter((step) => step.category === "trigger").length,
    protectedSteps: steps.filter((step) => step.executionMode === "protected").length,
    mockExecutableSteps: steps.filter((step) => step.executionMode === "mock-executable").length,
    previewOnlySteps: steps.filter((step) => step.executionMode === "preview-only").length
  };
}

function createFallbackNodeExecutionContract(node: FlowNode): NodeExecutionContract {
  const definition = createUnknownNodeDefinition(node);

  return {
    nodeId: node.id,
    nodeType: node.type,
    label: node.label,
    category: definition.category,
    contractSource: toNodeContractSource(definition.source),
    inputs: definition.inputs.map(clonePort),
    outputs: definition.outputs.map(clonePort),
    executionMode: definition.executionMode,
    capability: definition.capability,
    missingRequiredInputs: [],
    warnings: [`Unknown node type ${node.type}; using fallback linear plan contract.`],
    errors: [],
    isExecutable: false,
    isPreviewable: true
  };
}

function createPlanStepId(nodeId: string): string {
  return `step.${nodeId}`;
}

function createRuntimeExecutionModeMap(
  runtimePlan: FlowRuntimePlan | undefined
): Record<string, RuntimeExecutionMode> {
  if (runtimePlan === undefined) {
    return {};
  }

  return Object.fromEntries(
    runtimePlan.runtimes.map((runtime) => [runtime.runtimeId, runtime.executionMode])
  );
}

function createPlanStepEventPayload(
  step: LinearExecutionPlanStep | undefined
): Record<string, unknown> | undefined {
  if (step === undefined) {
    return undefined;
  }

  return {
    stepId: step.stepId,
    order: step.order,
    nodeId: step.nodeId,
    nodeType: step.nodeType,
    label: step.label,
    category: step.category,
    executionMode: step.executionMode,
    provider: step.provider,
    runtimeRef: step.runtimeRef,
    riskLevel: step.riskLevel,
    status: step.status,
    upstreamNodeIds: step.upstreamNodeIds,
    downstreamNodeIds: step.downstreamNodeIds,
    blockingReasons: step.blockingReasons,
    warnings: step.warnings,
    errors: step.errors
  };
}

function createNodeEstimate(
  node: FlowNode,
  contract: NodeExecutionContract | undefined,
  options: FlowEstimateOptions
): NodeEstimate {
  const resolvedContract = contract ?? createFallbackNodeExecutionContract(node);
  const nodeTypeDefinition = getNodeTypeDefinition(node.type);
  const estimateHints = nodeTypeDefinition?.estimateHints;
  const runtimeRef = resolvedContract.capability?.runtimeRef ?? readNodeRuntimeRef(node);
  const runtimeMode = runtimeRef === undefined ? undefined : options.runtimeExecutionModes?.[runtimeRef];
  const modelRef = readNodeModelRef(node, options);
  const modelMetadata = modelRef === undefined ? undefined : options.modelMetadata?.[modelRef];
  const warnings: EstimatorWarning[] = [];
  const sources = new Set<EstimatorSource>();

  if (resolvedContract.contractSource === "catalog") {
    sources.add("node-catalog");
  } else {
    sources.add("inferred");
    warnings.push(
      createEstimatorWarning(
        "non_catalog_contract",
        "estimator.warning.nonCatalogContract",
        {
          contractSource: resolvedContract.contractSource ?? "inferred",
          nodeType: node.type
        },
        node.id,
        "inferred"
      )
    );
  }

  if (options.userInputText !== undefined && options.userInputText.trim() !== "") {
    sources.add("user-input");
  }

  if (options.sessionContextText !== undefined && options.sessionContextText.trim() !== "") {
    sources.add("session-context");
  }

  if (runtimeRef !== undefined) {
    sources.add("runtime-registry");
  }

  if (modelMetadata !== undefined) {
    sources.add("model-metadata");
  }

  if (estimateHints === undefined) {
    sources.add("static-default");
  }

  if (resolvedContract.missingRequiredInputs.length > 0) {
    warnings.push(
      createEstimatorWarning(
        "missing_required_input",
        "estimator.warning.missingRequiredInput",
        {
          inputs: resolvedContract.missingRequiredInputs
        },
        node.id,
        "node-catalog"
      )
    );
  }

  if (resolvedContract.capability?.provider === "runtime") {
    if (runtimeRef === undefined) {
      warnings.push(
        createEstimatorWarning(
          "missing_runtime",
          "estimator.warning.missingRuntime",
          {
            nodeType: node.type
          },
          node.id,
          "runtime-registry"
        )
      );
    } else if (runtimeMode === undefined) {
      warnings.push(
        createEstimatorWarning(
          "unknown_runtime",
          "estimator.warning.unknownRuntime",
          {
            runtimeRef
          },
          node.id,
          "runtime-registry"
        )
      );
    }

    if (modelRef === undefined) {
      warnings.push(
        createEstimatorWarning(
          "missing_model",
          "estimator.warning.missingModel",
          {
            runtimeRef
          },
          node.id,
          "model-metadata"
        )
      );
    } else if (modelMetadata === undefined) {
      warnings.push(
        createEstimatorWarning(
          "unknown_model_metadata",
          "estimator.warning.unknownModelMetadata",
          {
            modelRef
          },
          node.id,
          "model-metadata"
        )
      );
    }
  }

  const tokens = createTokenEstimate(node, resolvedContract, estimateHints, options);
  const cost = createCostEstimate(
    resolvedContract,
    tokens,
    modelMetadata,
    warnings,
    node.id
  );
  const latency = createLatencyEstimate(
    resolvedContract,
    estimateHints,
    runtimeMode,
    modelMetadata
  );
  const tokenConfidence = resolveTokenConfidence(resolvedContract, estimateHints);
  const costConfidence = resolveCostConfidence(cost);
  const latencyConfidence = resolveLatencyConfidence(resolvedContract, estimateHints, runtimeMode);
  const confidence = combineConfidence([tokenConfidence, costConfidence, latencyConfidence]);

  return {
    nodeId: node.id,
    nodeType: node.type,
    label: node.label,
    runtimeRef,
    modelRef,
    contractSource: resolvedContract.contractSource,
    confidence,
    tokenConfidence,
    costConfidence,
    latencyConfidence,
    sources: Array.from(sources),
    tokens,
    cost,
    latency,
    warnings,
    partial:
      warnings.length > 0 ||
      cost.status === "unknown" ||
      confidence === "low" ||
      confidence === "unknown"
  };
}

function createTokenEstimate(
  node: FlowNode,
  contract: NodeExecutionContract,
  estimateHints: NodeEstimateHints | undefined,
  options: FlowEstimateOptions
): TokenEstimate {
  const userInputTokens = estimateTextTokens(options.userInputText);
  const sessionContextTokens = estimateTextTokens(options.sessionContextText);
  const dataTokens = estimateUnknownTokens(node.data);
  const inputHint = estimateHints?.inputTokenEstimate;
  const outputHint = estimateHints?.outputTokenEstimate;
  const inputBaseline =
    inputHint ??
    inferInputTokensFromContract(contract) +
      dataTokens +
      (contract.category === "trigger" ? userInputTokens : 0);
  const outputBaseline =
    outputHint ??
    inferOutputTokensFromContract(contract) +
      (contract.category === "trigger" ? Math.max(userInputTokens, 16) : 0);
  const contextCarryover =
    sessionContextTokens > 0 && contract.category === "agent"
      ? tokenRange(Math.ceil(sessionContextTokens * 0.35), 0.4)
      : undefined;
  const inputTokens = tokenRange(inputBaseline + (contextCarryover?.expected ?? 0), 0.35);
  const outputTokens = tokenRange(outputBaseline, 0.4);
  const reasoningTokens = createReasoningTokenEstimate(node, outputTokens.expected ?? 0);
  const toolCallOverheadTokens = createToolCallOverheadEstimate(contract);

  return {
    inputTokens,
    outputTokens,
    reasoningTokens,
    toolCallOverheadTokens,
    contextCarryoverTokens: contextCarryover
  };
}

function createCostEstimate(
  contract: NodeExecutionContract,
  tokens: TokenEstimate,
  modelMetadata: StaticModelEstimateMetadata | undefined,
  warnings: EstimatorWarning[],
  nodeId: string
): CostEstimate {
  if (contract.capability?.provider === "internal" || contract.executionMode === "output-only") {
    return {
      status: "zero",
      totalCost: costRange(0),
      currency: "USD"
    };
  }

  if (modelMetadata === undefined) {
    warnings.push(
      createEstimatorWarning(
        "unknown_pricing",
        "estimator.warning.unknownPricing",
        {
          provider: contract.capability?.provider ?? "unknown"
        },
        nodeId,
        "model-metadata"
      )
    );

    return {
      status: "unknown",
      totalCost: unknownRange("usd"),
      currency: "USD"
    };
  }

  const hasInputPricing = typeof modelMetadata.inputCostUsdPer1KTokens === "number";
  const hasOutputPricing = typeof modelMetadata.outputCostUsdPer1KTokens === "number";

  if (!hasInputPricing || !hasOutputPricing) {
    warnings.push(
      createEstimatorWarning(
        "unknown_pricing",
        "estimator.warning.unknownPricing",
        {
          provider: contract.capability?.provider ?? "unknown"
        },
        nodeId,
        "model-metadata"
      )
    );

    return {
      status: "unknown",
      totalCost: unknownRange("usd"),
      currency: "USD"
    };
  }

  const inputCost = costRange(
    ((tokens.inputTokens.expected ?? 0) / 1_000) * modelMetadata.inputCostUsdPer1KTokens!
  );
  const outputCost = costRange(
    ((tokens.outputTokens.expected ?? 0) / 1_000) * modelMetadata.outputCostUsdPer1KTokens!
  );
  const reasoningCost =
    tokens.reasoningTokens === undefined
      ? undefined
      : costRange(
          ((tokens.reasoningTokens.expected ?? 0) / 1_000) *
            (modelMetadata.reasoningCostUsdPer1KTokens ??
              modelMetadata.outputCostUsdPer1KTokens!)
        );

  return {
    status: "known",
    inputCost,
    outputCost,
    reasoningCost,
    totalCost: sumEstimateRanges(
      [inputCost, outputCost, reasoningCost].filter(isDefinedRange),
      "usd"
    ),
    currency: "USD"
  };
}

function createLatencyEstimate(
  contract: NodeExecutionContract,
  estimateHints: NodeEstimateHints | undefined,
  runtimeMode: RuntimeExecutionMode | undefined,
  modelMetadata: StaticModelEstimateMetadata | undefined
): LatencyEstimate {
  const hintLatency = estimateHints?.latencyMs ?? modelMetadata?.baseLatencyMs;
  const baseLatency =
    hintLatency ??
    (contract.capability?.provider === "internal"
      ? 20
      : contract.executionMode === "protected"
        ? 300
        : contract.executionMode === "runtime-required"
          ? 1_000
          : 500);
  const modeMultiplier =
    runtimeMode === "mock"
      ? 0.6
      : runtimeMode === "protected"
        ? 0.8
        : runtimeMode === "unavailable"
          ? 1.8
          : contract.executionMode === "runtime-required"
            ? 2
            : 1;
  const expectedLatency = Math.max(0, Math.ceil(baseLatency * modeMultiplier));

  return {
    modelLatencyMs:
      contract.capability?.provider === "runtime"
        ? latencyRange(expectedLatency, 0.55)
        : undefined,
    totalLatencyMs: latencyRange(expectedLatency, 0.55)
  };
}

function createFlowEstimateTotals(nodes: NodeEstimate[]): FlowEstimate["totals"] {
  return {
    tokens: {
      inputTokens: sumEstimateRanges(nodes.map((node) => node.tokens.inputTokens), "tokens"),
      outputTokens: sumEstimateRanges(nodes.map((node) => node.tokens.outputTokens), "tokens"),
      reasoningTokens: sumEstimateRanges(
        nodes.map((node) => node.tokens.reasoningTokens).filter(isDefinedRange),
        "tokens"
      ),
      toolCallOverheadTokens: sumEstimateRanges(
        nodes.map((node) => node.tokens.toolCallOverheadTokens).filter(isDefinedRange),
        "tokens"
      ),
      contextCarryoverTokens: sumEstimateRanges(
        nodes.map((node) => node.tokens.contextCarryoverTokens).filter(isDefinedRange),
        "tokens"
      )
    },
    cost: createFlowCostTotal(nodes),
    latency: {
      totalLatencyMs: sumEstimateRanges(
        nodes.map((node) => node.latency.totalLatencyMs),
        "ms"
      )
    }
  };
}

function createFlowCostTotal(nodes: NodeEstimate[]): CostEstimate {
  const statuses = nodes.map((node) => node.cost.status);

  if (statuses.some((status) => status === "unknown")) {
    return {
      status: "unknown",
      totalCost: unknownRange("usd"),
      currency: "USD"
    };
  }

  if (statuses.some((status) => status === "known")) {
    return {
      status: "known",
      totalCost: sumEstimateRanges(
        nodes.map((node) => node.cost.totalCost).filter(isDefinedRange),
        "usd"
      ),
      currency: "USD"
    };
  }

  if (statuses.some((status) => status === "zero")) {
    return {
      status: "zero",
      totalCost: costRange(0),
      currency: "USD"
    };
  }

  return {
    status: "not_applicable",
    totalCost: unknownRange("usd"),
    currency: "USD"
  };
}

function createReasoningTokenEstimate(
  node: FlowNode,
  outputTokenExpected: number
): EstimateRange | undefined {
  const multiplier =
    node.budgetPolicy.thinking === "high"
      ? 1
      : node.budgetPolicy.thinking === "medium"
        ? 0.5
        : node.budgetPolicy.thinking === "low"
          ? 0.15
          : 0;

  if (multiplier === 0) {
    return undefined;
  }

  return tokenRange(Math.ceil(outputTokenExpected * multiplier), 0.45);
}

function createToolCallOverheadEstimate(
  contract: NodeExecutionContract
): EstimateRange | undefined {
  const provider = contract.capability?.provider;

  if (
    provider === "api" ||
    provider === "browser" ||
    provider === "cli" ||
    provider === "mcp" ||
    provider === "comfyui"
  ) {
    return tokenRange(160, 0.6);
  }

  if (provider === "rag") {
    return tokenRange(240, 0.65);
  }

  return undefined;
}

function resolveTokenConfidence(
  contract: NodeExecutionContract,
  estimateHints: NodeEstimateHints | undefined
): EstimateConfidence {
  if (contract.errors.length > 0 || contract.missingRequiredInputs.length > 0) {
    return "low";
  }

  if (contract.contractSource !== "catalog") {
    return "low";
  }

  return estimateHints === undefined ? "medium" : "high";
}

function resolveCostConfidence(cost: CostEstimate): EstimateConfidence {
  if (cost.status === "known" || cost.status === "zero" || cost.status === "not_applicable") {
    return "high";
  }

  return "unknown";
}

function resolveLatencyConfidence(
  contract: NodeExecutionContract,
  estimateHints: NodeEstimateHints | undefined,
  runtimeMode: RuntimeExecutionMode | undefined
): EstimateConfidence {
  if (contract.contractSource !== "catalog") {
    return "low";
  }

  if (contract.executionMode === "runtime-required" || runtimeMode === "unavailable") {
    return "low";
  }

  if (contract.executionMode === "protected" || runtimeMode === "protected") {
    return "medium";
  }

  return estimateHints?.latencyMs === undefined ? "medium" : "high";
}

function inferInputTokensFromContract(contract: NodeExecutionContract): number {
  if (contract.inputs.length === 0) {
    return 0;
  }

  return contract.inputs.reduce(
    (total, input) => total + inferTokensForDataType(input.dataType, input.required === true),
    0
  );
}

function inferOutputTokensFromContract(contract: NodeExecutionContract): number {
  if (contract.outputs.length === 0) {
    return 0;
  }

  return contract.outputs.reduce(
    (total, output) => total + inferTokensForDataType(output.dataType, false),
    0
  );
}

function inferTokensForDataType(dataType: PortDataType, required: boolean): number {
  const base =
    dataType === "json"
      ? 300
      : dataType === "text"
        ? 220
        : dataType === "event"
          ? 80
          : dataType === "artifact" ||
              dataType === "file" ||
              dataType === "image" ||
              dataType === "video"
            ? 48
            : 120;

  return required ? base : Math.ceil(base * 0.5);
}

function estimateTextTokens(text: string | undefined): number {
  if (text === undefined || text.trim() === "") {
    return 0;
  }

  return Math.ceil(text.length / 4);
}

function estimateUnknownTokens(value: unknown): number {
  if (value === undefined || value === null) {
    return 0;
  }

  if (typeof value === "string") {
    return estimateTextTokens(value);
  }

  try {
    return Math.ceil(JSON.stringify(value).length / 4);
  } catch {
    return 0;
  }
}

function readNodeModelRef(
  node: FlowNode,
  options: FlowEstimateOptions
): string | undefined {
  const modelRef = options.modelRefs?.[node.id] ?? node.data?.modelRef;

  return typeof modelRef === "string" && modelRef.trim() !== "" ? modelRef : undefined;
}

function tokenRange(expected: number, variance: number): EstimateRange {
  return numericRange(Math.ceil(expected), variance, "tokens");
}

function latencyRange(expected: number, variance: number): EstimateRange {
  return numericRange(Math.ceil(expected), variance, "ms");
}

function costRange(expected: number): EstimateRange {
  return numericRange(Number(expected.toFixed(6)), 0.2, "usd");
}

function unknownRange(unit: EstimateRange["unit"]): EstimateRange {
  return {
    unit
  };
}

function numericRange(
  expected: number,
  variance: number,
  unit: EstimateRange["unit"]
): EstimateRange {
  if (expected <= 0) {
    return {
      min: 0,
      expected: 0,
      max: 0,
      unit
    };
  }

  return {
    min: Math.max(0, Math.floor(expected * (1 - variance))),
    expected,
    max: Math.ceil(expected * (1 + variance)),
    unit
  };
}

function sumEstimateRanges(
  ranges: EstimateRange[],
  unit: EstimateRange["unit"]
): EstimateRange {
  if (ranges.length === 0) {
    return {
      min: 0,
      expected: 0,
      max: 0,
      unit
    };
  }

  const hasUnknown = ranges.some(
    (range) => range.min === undefined || range.expected === undefined || range.max === undefined
  );

  if (hasUnknown) {
    return {
      unit
    };
  }

  return {
    min: ranges.reduce((total, range) => total + (range.min ?? 0), 0),
    expected: ranges.reduce((total, range) => total + (range.expected ?? 0), 0),
    max: ranges.reduce((total, range) => total + (range.max ?? 0), 0),
    unit
  };
}

function isDefinedRange(range: EstimateRange | undefined): range is EstimateRange {
  return range !== undefined;
}

function createEstimatorWarning(
  code: string,
  messageKey: string,
  details?: Record<string, unknown>,
  nodeId?: string,
  source?: EstimatorSource
): EstimatorWarning {
  return {
    code,
    messageKey,
    details,
    nodeId,
    source
  };
}

function combineConfidence(confidences: EstimateConfidence[]): EstimateConfidence {
  if (confidences.length === 0) {
    return "unknown";
  }

  return confidences.reduce((lowest, confidence) =>
    confidenceRank(confidence) < confidenceRank(lowest) ? confidence : lowest
  );
}

function confidenceRank(confidence: EstimateConfidence): number {
  if (confidence === "high") {
    return 3;
  }

  if (confidence === "medium") {
    return 2;
  }

  if (confidence === "low") {
    return 1;
  }

  return 0;
}

const contractDefinitions: Record<string, NodeContractDefinition> = {
  "manual.trigger": {
    category: "trigger",
    inputs: [],
    outputs: [
      port("event", "Trigger event", "event"),
      port("payload", "Trigger payload", "json")
    ],
    executionMode: "trigger-only",
    capability: {
      provider: "internal",
      providerCapabilityId: "manual.trigger",
      riskLevel: "safe",
      description: "Manual user-triggered flow entry point."
    }
  },
  "agent.start": {
    category: "agent",
    inputs: [port("input", "Input", "any", true)],
    outputs: [port("plan", "Plan", "json")],
    executionMode: "mock-executable",
    capability: {
      provider: "runtime",
      providerCapabilityId: "agent.start",
      riskLevel: "safe",
      description: "Agent task understanding and planning step."
    }
  },
  "agent.worker": {
    category: "agent",
    inputs: [port("input", "Input", "json", true)],
    outputs: [port("result", "Result", "json")],
    executionMode: "mock-executable",
    capability: {
      provider: "runtime",
      providerCapabilityId: "agent.worker",
      riskLevel: "medium",
      description: "Agent work step over upstream context."
    }
  },
  "agent.end": {
    category: "agent",
    inputs: [port("input", "Input", "json", true)],
    outputs: [port("summary", "Summary", "json")],
    executionMode: "mock-executable",
    capability: {
      provider: "runtime",
      providerCapabilityId: "agent.end",
      riskLevel: "safe",
      description: "Agent summarization and completion step."
    }
  },
  "output.console": {
    category: "output",
    inputs: [port("input", "Input", "any", true)],
    outputs: [],
    executionMode: "output-only",
    capability: {
      provider: "internal",
      providerCapabilityId: "output.console",
      riskLevel: "safe",
      description: "Console-style flow output sink."
    }
  },
  "cli.command": {
    category: "capability",
    inputs: [port("command", "Command", "text", true), port("input", "Input", "json")],
    outputs: [port("stdout", "Stdout", "text"), port("result", "Result", "json")],
    executionMode: "blocked",
    capability: {
      provider: "cli",
      providerCapabilityId: "cli.command",
      riskLevel: "dangerous",
      requiresApproval: true,
      description: "Preview placeholder for future CLI command execution."
    }
  },
  "mcp.tool": {
    category: "capability",
    inputs: [port("input", "Input", "json", true)],
    outputs: [port("output", "Output", "json"), port("artifact", "Artifact", "artifact")],
    executionMode: "preview-only",
    capability: {
      provider: "mcp",
      providerCapabilityId: "mcp.tool",
      riskLevel: "medium",
      requiresApproval: true,
      description: "Preview placeholder for future MCP tool invocation."
    }
  },
  "mcp.resource": {
    category: "knowledge",
    inputs: [port("query", "Query", "json")],
    outputs: [port("resource", "Resource", "artifact")],
    executionMode: "preview-only",
    capability: {
      provider: "mcp",
      providerCapabilityId: "mcp.resource",
      riskLevel: "safe",
      description: "Preview placeholder for future MCP resource retrieval."
    }
  },
  "mcp.prompt": {
    category: "utility",
    inputs: [port("variables", "Variables", "json")],
    outputs: [port("prompt", "Prompt", "text")],
    executionMode: "preview-only",
    capability: {
      provider: "mcp",
      providerCapabilityId: "mcp.prompt",
      riskLevel: "safe",
      description: "Preview placeholder for future MCP prompt rendering."
    }
  },
  "rag.query": {
    category: "knowledge",
    inputs: [port("query", "Query", "text", true)],
    outputs: [port("results", "Results", "json"), port("answer", "Answer", "text")],
    executionMode: "preview-only",
    capability: {
      provider: "rag",
      providerCapabilityId: "rag.query",
      riskLevel: "safe",
      description: "Preview placeholder for future knowledge base retrieval."
    }
  },
  "rag.context": {
    category: "knowledge",
    inputs: [port("documents", "Documents", "json", true)],
    outputs: [port("context", "Context", "text")],
    executionMode: "preview-only",
    capability: {
      provider: "rag",
      providerCapabilityId: "rag.context",
      riskLevel: "safe",
      description: "Preview placeholder for future RAG context assembly."
    }
  },
  "comfyui.workflow": {
    category: "capability",
    inputs: [
      port("prompt", "Prompt", "text"),
      port("workflow", "Workflow", "json", true),
      port("image", "Image", "image")
    ],
    outputs: [
      port("image", "Image", "image"),
      port("video", "Video", "video"),
      port("artifact", "Artifact", "artifact")
    ],
    executionMode: "preview-only",
    capability: {
      provider: "comfyui",
      providerCapabilityId: "comfyui.workflow",
      riskLevel: "medium",
      requiresApproval: true,
      description: "Preview placeholder for future ComfyUI workflow execution."
    }
  },
  "api.call": {
    category: "capability",
    inputs: [port("request", "Request", "json", true)],
    outputs: [port("response", "Response", "json")],
    executionMode: "preview-only",
    capability: {
      provider: "api",
      providerCapabilityId: "api.call",
      riskLevel: "medium",
      requiresApproval: true,
      description: "Preview placeholder for future external API calls."
    }
  },
  "browser.action": {
    category: "capability",
    inputs: [port("instruction", "Instruction", "text", true), port("context", "Context", "json")],
    outputs: [port("result", "Result", "json"), port("artifact", "Artifact", "artifact")],
    executionMode: "preview-only",
    capability: {
      provider: "browser",
      providerCapabilityId: "browser.action",
      riskLevel: "medium",
      requiresApproval: true,
      description: "Preview placeholder for future browser automation."
    }
  },
  "human.approval": {
    category: "control",
    inputs: [port("input", "Input", "any", true)],
    outputs: [port("decision", "Decision", "event"), port("output", "Output", "any")],
    executionMode: "preview-only",
    capability: {
      provider: "human",
      providerCapabilityId: "human.approval",
      riskLevel: "safe",
      requiresApproval: false,
      description: "Preview placeholder for explicit human approval."
    }
  }
};

function createNodeExecutionContract(
  node: FlowNode,
  incomingEdges: Map<string, FlowEdge[]>,
  outgoingEdges: Map<string, FlowEdge[]>,
  runtimeExecutionModes: Record<string, RuntimeExecutionMode>
): NodeExecutionContract {
  const definition = createNodeContractDefinition(node);
  const runtimeRef = readNodeRuntimeRef(node);
  const runtimeExecutionMode =
    runtimeRef === undefined ? undefined : runtimeExecutionModes[runtimeRef];
  const executionMode = resolveNodeExecutionMode(definition, node, runtimeExecutionMode);
  const warnings: string[] = [];
  const errors: string[] = [];
  const incoming = incomingEdges.get(node.id) ?? [];
  const outgoing = outgoingEdges.get(node.id) ?? [];
  const missingRequiredInputs = definition.inputs
    .filter((input) => input.required === true && incoming.length === 0)
    .map((input) => input.id);

  if (definition.source === "fallback") {
    warnings.push(`Unknown node type ${node.type}; using preview-only generic contract.`);
  }

  if (missingRequiredInputs.length > 0) {
    errors.push(`Missing required input: ${missingRequiredInputs.join(", ")}.`);
  }

  if (!isOutputLikeNode(node, definition) && outgoing.length === 0) {
    warnings.push("Node has no outgoing edge and is not an output/end node.");
  }

  if (!isTriggerLikeNode(node, definition) && incoming.length === 0) {
    warnings.push("Node has no incoming edge and is not a trigger/manual node.");
  }

  if (runtimeRef !== undefined && runtimeExecutionMode === undefined && definition.capability?.provider === "runtime") {
    warnings.push(`Runtime ${runtimeRef} was not found in the preview runtime map.`);
  }

  if (executionMode === "blocked") {
    errors.push("Node is blocked in preview because the selected capability is unavailable or disabled.");
  }

  const capability =
    definition.capability === undefined
      ? undefined
      : {
          ...definition.capability,
          runtimeRef
        };

  return {
    nodeId: node.id,
    nodeType: node.type,
    label: node.label,
    category: definition.category,
    contractSource: toNodeContractSource(definition.source),
    inputs: definition.inputs.map(clonePort),
    outputs: definition.outputs.map(clonePort),
    executionMode,
    capability,
    missingRequiredInputs,
    warnings,
    errors,
    isExecutable: isExecutableMode(executionMode) && errors.length === 0,
    isPreviewable: true
  };
}

function createNodeContractDefinition(node: FlowNode): NodeContractDefinition {
  const catalogDefinition = getNodeTypeDefinition(node.type);

  if (catalogDefinition !== undefined) {
    return createNodeContractDefinitionFromCatalog(catalogDefinition);
  }

  const placeholderDefinition = contractDefinitions[node.type];

  if (placeholderDefinition !== undefined) {
    return {
      ...placeholderDefinition,
      source: placeholderDefinition.source ?? "placeholder"
    };
  }

  return createUnknownNodeDefinition(node);
}

function createNodeContractDefinitionFromCatalog(
  definition: NodeTypeDefinition
): NodeContractDefinition {
  const providerCapabilityId = definition.providerCapabilityId ?? definition.type;

  return {
    category: definition.category,
    inputs: definition.inputs.map(clonePort),
    outputs: definition.outputs.map(clonePort),
    executionMode:
      definition.defaultExecutionMode ??
      definition.runtimeCompatibility[0]?.defaultExecutionMode ??
      definition.allowedExecutionModes[0] ??
      "preview-only",
    capability: {
      provider: definition.provider,
      providerCapabilityId,
      capabilityId: providerCapabilityId,
      riskLevel: definition.riskLevel,
      description: definition.descriptionKey
    },
    source: "catalog"
  };
}

function toNodeContractSource(
  source: NodeContractDefinition["source"]
): NodeExecutionContract["contractSource"] {
  if (source === "catalog") {
    return "catalog";
  }

  if (source === "placeholder") {
    return "placeholder";
  }

  return "inferred";
}

function resolveNodeExecutionMode(
  definition: NodeContractDefinition,
  node: FlowNode,
  runtimeExecutionMode: RuntimeExecutionMode | undefined
): NodeExecutionMode {
  if (definition.executionMode === "trigger-only" || definition.executionMode === "output-only") {
    return definition.executionMode;
  }

  if (definition.executionMode === "blocked" || definition.capability?.provider === "cli") {
    return "blocked";
  }

  if (definition.executionMode === "preview-only") {
    return "preview-only";
  }

  if (definition.capability?.provider !== "runtime") {
    return definition.executionMode;
  }

  if (runtimeExecutionMode === "mock" || readNodeRuntimeRef(node) === "mock-local") {
    return "mock-executable";
  }

  if (runtimeExecutionMode === "protected" || readNodeRuntimeRef(node) === "openclaw-local") {
    return "protected";
  }

  if (runtimeExecutionMode === "unavailable") {
    return "blocked";
  }

  return "runtime-required";
}

function createUnknownNodeDefinition(node: FlowNode): NodeContractDefinition {
  return {
    category: roleToCategory(node.role),
    inputs: node.role === "trigger" ? [] : [port("input", "Input", "any", true)],
    outputs: node.role === "output" ? [] : [port("output", "Output", "any")],
    executionMode: "preview-only",
    capability: {
      provider: "internal",
      providerCapabilityId: node.type,
      capabilityId: node.type,
      riskLevel: "medium",
      description: "Generic preview-only contract for an unknown node type."
    },
    source: "fallback"
  };
}

function roleToCategory(role: FlowNode["role"]): NodeCategory {
  if (role === "trigger") {
    return "trigger";
  }

  if (role === "start" || role === "process" || role === "end") {
    return "agent";
  }

  if (role === "tool") {
    return "capability";
  }

  if (role === "memory") {
    return "knowledge";
  }

  if (role === "control" || role === "safety") {
    return "control";
  }

  if (role === "output") {
    return "output";
  }

  return "utility";
}

function validateFlowDefinition(flow: FlowSpec): FlowValidationResult {
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

function createRunReadinessDetails(
  details: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (details === undefined) {
    return undefined;
  }

  if (typeof details.message !== "string") {
    return details;
  }

  const { message, ...rest } = details;

  return {
    ...rest,
    technicalMessage: message
  };
}

function createExecutionContractSummary(
  contracts: NodeExecutionContract[]
): FlowExecutionContractPreview["summary"] {
  return {
    totalNodes: contracts.length,
    executableNodes: contracts.filter((contract) => contract.isExecutable).length,
    blockedNodes: contracts.filter((contract) => contract.executionMode === "blocked").length,
    previewOnlyNodes: contracts.filter((contract) => contract.executionMode === "preview-only").length,
    triggerNodes: contracts.filter((contract) => contract.category === "trigger").length,
    outputNodes: contracts.filter((contract) => contract.category === "output").length,
    riskCounts: {
      safe: contracts.filter((contract) => contract.capability?.riskLevel === "safe").length,
      medium: contracts.filter((contract) => contract.capability?.riskLevel === "medium").length,
      dangerous: contracts.filter((contract) => contract.capability?.riskLevel === "dangerous").length
    }
  };
}

function evaluatePortCompatibility(
  sourceContract: NodeExecutionContract,
  sourcePort: NodePortDefinition | undefined,
  targetContract: NodeExecutionContract,
  targetPort: NodePortDefinition | undefined
): PortCompatibilityIssue | null {
  if (sourcePort === undefined) {
    return {
      sourceNodeId: sourceContract.nodeId,
      sourceDataType: "any",
      targetNodeId: targetContract.nodeId,
      targetPortId: targetPort?.id,
      targetDataType: targetPort?.dataType ?? "any",
      severity: "warning",
      message: "Source port is unknown."
    };
  }

  if (targetPort === undefined) {
    return {
      sourceNodeId: sourceContract.nodeId,
      sourcePortId: sourcePort.id,
      sourceDataType: sourcePort.dataType,
      targetNodeId: targetContract.nodeId,
      targetDataType: "any",
      severity: "warning",
      message: "Target port is unknown."
    };
  }

  const compatibility = classifyPortCompatibility(sourcePort.dataType, targetPort.dataType);

  if (compatibility === "compatible") {
    return null;
  }

  return {
    sourceNodeId: sourceContract.nodeId,
    sourcePortId: sourcePort.id,
    sourceDataType: sourcePort.dataType,
    targetNodeId: targetContract.nodeId,
    targetPortId: targetPort.id,
    targetDataType: targetPort.dataType,
    severity: compatibility,
    message: `Port type ${sourcePort.dataType} -> ${targetPort.dataType} may require adaptation.`
  };
}

function classifyPortCompatibility(
  sourceDataType: PortDataType,
  targetDataType: PortDataType
): "compatible" | "warning" | "error" {
  if (sourceDataType === "any" || targetDataType === "any" || sourceDataType === targetDataType) {
    return "compatible";
  }

  if (
    (sourceDataType === "text" && targetDataType === "json") ||
    (sourceDataType === "json" && targetDataType === "text")
  ) {
    return "warning";
  }

  if (
    sourceDataType === "artifact" &&
    (targetDataType === "image" || targetDataType === "video" || targetDataType === "file")
  ) {
    return "warning";
  }

  if (
    (sourceDataType === "image" || sourceDataType === "video" || sourceDataType === "file") &&
    (targetDataType === "text" || targetDataType === "json" || targetDataType === "event")
  ) {
    return "error";
  }

  return "warning";
}

function resolveSourcePort(
  contract: NodeExecutionContract,
  sourceHandle: string | undefined
): NodePortDefinition | undefined {
  if (sourceHandle !== undefined) {
    return contract.outputs.find((portDefinition) => portDefinition.id === sourceHandle);
  }

  return contract.outputs[0];
}

function resolveTargetPort(
  contract: NodeExecutionContract,
  targetHandle: string | undefined
): NodePortDefinition | undefined {
  if (targetHandle !== undefined) {
    return contract.inputs.find((portDefinition) => portDefinition.id === targetHandle);
  }

  return contract.inputs[0];
}

function isOutputLikeNode(node: FlowNode, definition: NodeContractDefinition): boolean {
  return node.role === "output" || node.role === "end" || definition.category === "output";
}

function isTriggerLikeNode(node: FlowNode, definition: NodeContractDefinition): boolean {
  return node.role === "trigger" || definition.category === "trigger" || node.type === "manual.trigger";
}

function isExecutableMode(executionMode: NodeExecutionMode): boolean {
  return (
    executionMode === "mock-executable" ||
    executionMode === "protected" ||
    executionMode === "trigger-only" ||
    executionMode === "output-only"
  );
}

function createIncomingEdgeMap(edges: FlowEdge[]): Map<string, FlowEdge[]> {
  const incomingEdges = new Map<string, FlowEdge[]>();

  for (const edge of edges) {
    const existingEdges = incomingEdges.get(edge.target) ?? [];
    incomingEdges.set(edge.target, [...existingEdges, edge]);
  }

  return incomingEdges;
}

function createOutgoingEdgeMap(edges: FlowEdge[]): Map<string, FlowEdge[]> {
  const outgoingEdges = new Map<string, FlowEdge[]>();

  for (const edge of edges) {
    const existingEdges = outgoingEdges.get(edge.source) ?? [];
    outgoingEdges.set(edge.source, [...existingEdges, edge]);
  }

  return outgoingEdges;
}

function port(
  id: string,
  label: string,
  dataType: PortDataType,
  required?: boolean
): NodePortDefinition {
  return {
    id,
    label,
    dataType,
    required
  };
}

function clonePort<T extends NodePortDefinition>(portDefinition: T): T {
  return {
    ...portDefinition
  };
}

function readNodeRuntimeRef(node: FlowNode): string | undefined {
  const runtimeRef = node.runtimeRef?.trim();

  return runtimeRef === "" ? undefined : runtimeRef;
}
