import type { FlowSpec, LinearExecutionPlan, RunReadinessReport } from "@clawflow/protocol";

export interface OpenClawTaskExportInput {
  flow: FlowSpec;
  linearExecutionPlan: LinearExecutionPlan | null;
  runReadinessReport: RunReadinessReport | null;
}

export function buildOpenClawTaskExport({
  flow,
  linearExecutionPlan,
  runReadinessReport
}: OpenClawTaskExportInput): string {
  const payload = {
    schemaVersion: "clawflow.openclaw.manual-task.v0",
    generatedAt: new Date().toISOString(),
    source: "clawflow-studio",
    targetRuntimeId: "openclaw-local",
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
        riskPolicy: node.riskPolicy
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
