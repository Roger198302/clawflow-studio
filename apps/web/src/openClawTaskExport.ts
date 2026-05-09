import type { FlowSpec, LinearExecutionPlan, RunReadinessReport } from "@clawflow/protocol";
import type { TaskTemplateMetadata } from "./flowTemplates";

export interface OpenClawTaskExportInput {
  flow: FlowSpec;
  linearExecutionPlan: LinearExecutionPlan | null;
  runReadinessReport: RunReadinessReport | null;
  localGatewayConnection?: OpenClawTaskGatewayMetadata | null;
  gatewayProfiles?: OpenClawTaskGatewayProfileMetadata[];
  agentGatewayBindings?: Array<Record<string, unknown>>;
}

export interface OpenClawTaskGatewayMetadata {
  baseUrl: string;
  healthPath: string;
  healthUrl?: string;
  status: string;
  checkedAt?: string;
}

export interface OpenClawTaskGatewayProfileMetadata extends OpenClawTaskGatewayMetadata {
  id: string;
  name: string;
  kind: "openclaw";
  protected: true;
  lastCheckedAt?: string;
  lastError?: string;
}

export function buildOpenClawTaskExport({
  flow,
  linearExecutionPlan,
  runReadinessReport,
  localGatewayConnection,
  gatewayProfiles = [],
  agentGatewayBindings = []
}: OpenClawTaskExportInput): string {
  const payload = {
    schemaVersion: "clawflow.openclaw.manual-task.v0",
    generatedAt: new Date().toISOString(),
    source: "clawflow-studio",
    targetRuntimeId: "openclaw-local",
    targetGateway:
      localGatewayConnection?.status === "connected"
        ? {
            baseUrl: localGatewayConnection.baseUrl,
            healthPath: localGatewayConnection.healthPath,
            healthUrl: localGatewayConnection.healthUrl,
            status: localGatewayConnection.status,
            protected: true,
            checkedAt: localGatewayConnection.checkedAt
          }
        : undefined,
    workspaceDefaultGateway:
      localGatewayConnection === undefined || localGatewayConnection === null
        ? undefined
        : {
            baseUrl: localGatewayConnection.baseUrl,
            healthPath: localGatewayConnection.healthPath,
            healthUrl: localGatewayConnection.healthUrl,
            status: localGatewayConnection.status,
            protected: true,
            checkedAt: localGatewayConnection.checkedAt
          },
    gatewayProfiles: gatewayProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      kind: profile.kind,
      baseUrl: profile.baseUrl,
      healthPath: profile.healthPath,
      healthUrl: profile.healthUrl,
      status: profile.status,
      protected: profile.protected,
      lastCheckedAt: profile.lastCheckedAt,
      lastError: profile.lastError
    })),
    agentGatewayBindings,
    executionMode: "manual_export",
    realExecutionBlocked: true,
    protectedDryRun: true,
    safetyPolicy: {
      submittedByClawflow: false,
      requiresManualOpenClawCliRun: true,
      askForConfirmationBeforeRiskyActions: true,
      doNotAssumePermissionForShellBrowserFilesystemOrNetworkActions: true,
      note:
        "Clawflow Studio generated this payload for local dogfood only. It did not send the task to OpenClaw and it still blocks real OpenClaw execution."
    },
    template: extractTaskTemplateMetadata(flow),
    flow: {
      id: flow.id,
      name: flow.name,
      description: flow.description,
      nodeCount: flow.nodes.length,
      edgeCount: flow.edges.length,
      selectedRuntimes: Array.from(
        new Set(flow.nodes.map((node) => node.runtimeRef ?? "mock-local"))
      ),
      nodes: flow.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        label: node.label,
        role: node.role,
        runtimeRef: node.runtimeRef ?? "mock-local",
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
        targetHandle: edge.targetHandle,
        label: edge.label
      }))
    },
    readiness: runReadinessReport
      ? {
          status: runReadinessReport.status,
          summary: runReadinessReport.summary,
          issues: runReadinessReport.issues.map((issue) => ({
            code: issue.code,
            severity: issue.severity,
            messageKey: issue.messageKey,
            nodeId: issue.nodeId,
            details: issue.details
          }))
        }
      : {
          status: "unknown",
          summary: null,
          issues: []
        },
    linearExecutionPlan: linearExecutionPlan
      ? {
          status: linearExecutionPlan.status,
          unsupportedReasons: linearExecutionPlan.unsupportedReasons,
          summary: linearExecutionPlan.summary,
          steps: linearExecutionPlan.steps.map((step) => ({
            stepId: step.stepId,
            order: step.order,
            nodeId: step.nodeId,
            nodeType: step.nodeType,
            label: step.label,
            executionMode: step.executionMode,
            provider: step.provider,
            runtimeRef: step.runtimeRef,
            status: step.status,
            blockingReasons: step.blockingReasons,
            warnings: step.warnings,
            errors: step.errors
          }))
        }
      : {
          status: "unknown",
          unsupportedReasons: [],
          summary: null,
          steps: []
        },
    manualInstructions: [
      "Review this payload before using it outside Clawflow Studio.",
      "Run it manually through your local OpenClaw CLI only if you understand your OpenClaw permissions.",
      "Ask for confirmation before risky actions.",
      "Do not treat Runtime Manager health reachability as execution permission."
    ]
  };

  return JSON.stringify(payload, null, 2);
}

function extractTaskTemplateMetadata(flow: FlowSpec): TaskTemplateMetadata | undefined {
  for (const node of flow.nodes) {
    const template = node.data?.template;

    if (isTaskTemplateMetadata(template)) {
      return template;
    }
  }

  return undefined;
}

function isTaskTemplateMetadata(value: unknown): value is TaskTemplateMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<TaskTemplateMetadata>;

  return (
    candidate.source === "task-template" &&
    typeof candidate.templateId === "string" &&
    typeof candidate.templateName === "string" &&
    typeof candidate.generatedAt === "string" &&
    typeof candidate.safetyMode === "string" &&
    typeof candidate.userInputs === "object" &&
    candidate.userInputs !== null &&
    Array.isArray(candidate.expectedOutputs)
  );
}
