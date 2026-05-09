import type { FlowEdge, FlowNode, FlowSpec, NodeType } from "@clawflow/protocol";
import { createFlowNode } from "./flowCatalog";
import type { I18nKey } from "./i18n";

export type TaskTemplateId = "excel-report" | "local-file-summary" | "multi-agent-planning";
export type TaskTemplateSafetyMode = "plan-only" | "read-only" | "controlled-write";

export interface TaskTemplateDefinition {
  id: TaskTemplateId;
  titleKey: I18nKey;
  descriptionKey: I18nKey;
  expectedOutputsKey: I18nKey;
  generatedAgentsKey: I18nKey;
  nodeCount: number;
}

export interface ExcelReportTemplateInput {
  templateId: "excel-report";
  taskName: string;
  inputExcelPath: string;
  outputFolder: string;
  generateWordReport: boolean;
  generateMarkdownReport: boolean;
  generateSummaryFile: boolean;
  safetyMode: TaskTemplateSafetyMode;
}

export interface LocalFileSummaryTemplateInput {
  templateId: "local-file-summary";
  inputPath: string;
  summaryStyle: string;
  outputMarkdownPath: string;
  safetyMode: TaskTemplateSafetyMode;
}

export interface MultiAgentPlanningTemplateInput {
  templateId: "multi-agent-planning";
  goal: string;
  workerCount: number;
  reviewerEnabled: boolean;
  safetyMode: TaskTemplateSafetyMode;
}

export type TaskTemplateInput =
  | ExcelReportTemplateInput
  | LocalFileSummaryTemplateInput
  | MultiAgentPlanningTemplateInput;

export interface TaskTemplateMetadata {
  source: "task-template";
  templateId: TaskTemplateId;
  templateName: string;
  generatedAt: string;
  safetyMode: TaskTemplateSafetyMode;
  userInputs: Record<string, unknown>;
  expectedOutputs: string[];
}

export const TASK_TEMPLATES: TaskTemplateDefinition[] = [
  {
    id: "excel-report",
    titleKey: "taskLauncher.template.excel.title",
    descriptionKey: "taskLauncher.template.excel.description",
    expectedOutputsKey: "taskLauncher.template.excel.outputs",
    generatedAgentsKey: "taskLauncher.template.excel.agents",
    nodeCount: 8
  },
  {
    id: "local-file-summary",
    titleKey: "taskLauncher.template.localFile.title",
    descriptionKey: "taskLauncher.template.localFile.description",
    expectedOutputsKey: "taskLauncher.template.localFile.outputs",
    generatedAgentsKey: "taskLauncher.template.localFile.agents",
    nodeCount: 5
  },
  {
    id: "multi-agent-planning",
    titleKey: "taskLauncher.template.planning.title",
    descriptionKey: "taskLauncher.template.planning.description",
    expectedOutputsKey: "taskLauncher.template.planning.outputs",
    generatedAgentsKey: "taskLauncher.template.planning.agents",
    nodeCount: 7
  }
];

export function createFlowFromTaskTemplate(input: TaskTemplateInput): FlowSpec {
  if (input.templateId === "excel-report") {
    return createExcelReportFlow(input);
  }

  if (input.templateId === "local-file-summary") {
    return createLocalFileSummaryFlow(input);
  }

  return createMultiAgentPlanningFlow(input);
}

function createExcelReportFlow(input: ExcelReportTemplateInput): FlowSpec {
  const taskName = normalizeText(input.taskName, "Excel Report Task");
  const expectedOutputs = [
    input.generateWordReport ? "report.docx" : null,
    input.generateMarkdownReport ? "report.md" : null,
    input.generateSummaryFile ? "summary.md" : null
  ].filter((value): value is string => value !== null);
  const metadata = createTemplateMetadata("excel-report", "Excel to Word / Markdown / Summary", input.safetyMode, {
    taskName,
    inputExcelPath: normalizeText(input.inputExcelPath, "(not provided)"),
    outputFolder: normalizeText(input.outputFolder, "(not provided)"),
    generateWordReport: input.generateWordReport,
    generateMarkdownReport: input.generateMarkdownReport,
    generateSummaryFile: input.generateSummaryFile
  }, expectedOutputs);
  const agentNodes: Array<{ id: string; type: NodeType; label: string; objective: string }> = [
    {
      id: "template.excel.planner",
      type: "agent.start",
      label: "Scenario Planner Agent",
      objective: "Confirm input/output paths, selected report formats, and safety constraints before any manual OpenClaw work."
    },
    {
      id: "template.excel.reader",
      type: "agent.worker",
      label: "Excel Reader Agent",
      objective: "Inspect workbook structure, sheets, tables, and columns from the provided Excel path or pasted metadata."
    }
  ];

  if (input.generateWordReport) {
    agentNodes.push({
      id: "template.excel.word-writer",
      type: "agent.worker",
      label: "Word Writer Agent",
      objective: "Prepare report.docx content and structure for manual OpenClaw-controlled generation."
    });
  }

  if (input.generateMarkdownReport) {
    agentNodes.push({
      id: "template.excel.markdown-writer",
      type: "agent.worker",
      label: "Markdown Writer Agent",
      objective: "Prepare report.md with tables, findings, and traceable workbook assumptions."
    });
  }

  if (input.generateSummaryFile) {
    agentNodes.push({
      id: "template.excel.summary",
      type: "agent.worker",
      label: "Summary Agent",
      objective: "Prepare summary.md with executive findings, warnings, and next steps."
    });
  }

  const nodes = createLinearTemplateNodes(
    metadata,
    [
      {
        id: "template.excel.manual",
        type: "manual.trigger",
        label: "Excel Report Request",
        objective: `Task: ${taskName}. Input: ${input.inputExcelPath || "(not provided)"}. Output folder: ${input.outputFolder || "(not provided)"}.`
      },
      ...agentNodes,
      {
        id: "template.excel.end",
        type: "agent.end",
        label: "Report Review Agent",
        objective: "Review generated report plan, confirm safety mode, and summarize unresolved assumptions."
      },
      {
        id: "template.excel.output",
        type: "output.console",
        label: "Console Output",
        objective: "Report generated files, warnings, blocked real execution, and manual next steps."
      }
    ]
  );

  return createTemplateFlow("flow.template.excel-report", taskName, metadata, nodes);
}

function createLocalFileSummaryFlow(input: LocalFileSummaryTemplateInput): FlowSpec {
  const inputPath = normalizeText(input.inputPath, "(not provided)");
  const outputMarkdownPath = normalizeText(input.outputMarkdownPath, "summary.md");
  const metadata = createTemplateMetadata("local-file-summary", "Local File Summary", input.safetyMode, {
    inputPath,
    summaryStyle: normalizeText(input.summaryStyle, "Concise"),
    outputMarkdownPath
  }, [outputMarkdownPath]);
  const nodes = createLinearTemplateNodes(metadata, [
    {
      id: "template.local-file.manual",
      type: "manual.trigger",
      label: "Local File Summary Request",
      objective: `Summarize local file or folder path metadata: ${inputPath}. Clawflow does not read files directly.`
    },
    {
      id: "template.local-file.reader",
      type: "agent.worker",
      label: "File Reader Agent",
      objective: "Ask for pasted content or user-confirmed metadata and outline what a manual OpenClaw file read should inspect."
    },
    {
      id: "template.local-file.summary",
      type: "agent.worker",
      label: "Summary Agent",
      objective: `Produce a ${input.summaryStyle || "concise"} markdown summary plan at ${outputMarkdownPath}.`
    },
    {
      id: "template.local-file.end",
      type: "agent.end",
      label: "Summary Review Agent",
      objective: "Review key points, risks, and missing context before manual execution."
    },
    {
      id: "template.local-file.output",
      type: "output.console",
      label: "Console Output",
      objective: "Report summary path, warnings, and next steps."
    }
  ]);

  return createTemplateFlow("flow.template.local-file-summary", "Local File Summary", metadata, nodes);
}

function createMultiAgentPlanningFlow(input: MultiAgentPlanningTemplateInput): FlowSpec {
  const goal = normalizeText(input.goal, "Plan a multi-agent task");
  const workerCount = clampWorkerCount(input.workerCount);
  const workerNodes = Array.from({ length: workerCount }, (_, index) => ({
    id: `template.planning.worker-${index + 1}`,
    type: "agent.worker" as NodeType,
    label: `Worker Agent ${index + 1}`,
    objective: `Develop plan slice ${index + 1} for the goal while staying within manual/protected execution boundaries.`
  }));
  const metadata = createTemplateMetadata("multi-agent-planning", "Multi-Agent Planning", input.safetyMode, {
    goal,
    workerCount,
    reviewerEnabled: input.reviewerEnabled
  }, ["planning-brief.md", "risk-review.md", "next-steps.md"]);
  const nodes = createLinearTemplateNodes(metadata, [
    {
      id: "template.planning.manual",
      type: "manual.trigger",
      label: "Planning Request",
      objective: goal
    },
    {
      id: "template.planning.planner",
      type: "agent.start",
      label: "Planner Agent",
      objective: "Break the goal into workstreams, constraints, and acceptance criteria."
    },
    ...workerNodes,
    ...(input.reviewerEnabled
      ? [
          {
            id: "template.planning.reviewer",
            type: "agent.worker" as NodeType,
            label: "Reviewer Agent",
            objective: "Review the plan for gaps, risk, sequencing, and unsupported assumptions."
          }
        ]
      : []),
    {
      id: "template.planning.summary",
      type: "agent.worker",
      label: "Summary Agent",
      objective: "Synthesize worker outputs into a concise plan, risks, and next actions."
    },
    {
      id: "template.planning.end",
      type: "agent.end",
      label: "Planning Review Agent",
      objective: "Confirm the final plan is coherent and safe for manual execution."
    },
    {
      id: "template.planning.output",
      type: "output.console",
      label: "Console Output",
      objective: "Report planning artifacts, warnings, and next steps."
    }
  ]);

  return createTemplateFlow("flow.template.multi-agent-planning", "Multi-Agent Planning", metadata, nodes);
}

function createLinearTemplateNodes(
  metadata: TaskTemplateMetadata,
  specs: Array<{ id: string; type: NodeType; label: string; objective: string }>
): FlowNode[] {
  return specs.map((spec, index) => {
    const node = createFlowNode(spec.type, spec.id, { x: 80 + index * 270, y: 120 }, spec.label);

    return {
      ...node,
      runtimeRef: spec.type.startsWith("agent.") ? "openclaw-local" : node.runtimeRef,
      data: {
        ...(node.data ?? {}),
        template: metadata,
        objective: spec.objective,
        gatewayBinding: "workspace-default",
        safetyNote: "Manual export only. Clawflow Studio does not execute this template through OpenClaw."
      }
    };
  });
}

function createTemplateFlow(
  id: string,
  name: string,
  metadata: TaskTemplateMetadata,
  nodes: FlowNode[]
): FlowSpec {
  const now = new Date().toISOString();

  return {
    schemaVersion: "0.1",
    id,
    name,
    description: `${metadata.templateName} generated from Task Launcher. Safety mode: ${metadata.safetyMode}. Manual export only.`,
    createdAt: now,
    updatedAt: now,
    nodes,
    edges: createLinearTemplateEdges(nodes)
  };
}

function createLinearTemplateEdges(nodes: FlowNode[]): FlowEdge[] {
  return nodes.slice(1).map((node, index) => ({
    id: `edge.${nodes[index].id}.${node.id}`,
    source: nodes[index].id,
    sourceHandle: "out",
    target: node.id,
    targetHandle: "in"
  }));
}

function createTemplateMetadata(
  templateId: TaskTemplateId,
  templateName: string,
  safetyMode: TaskTemplateSafetyMode,
  userInputs: Record<string, unknown>,
  expectedOutputs: string[]
): TaskTemplateMetadata {
  return {
    source: "task-template",
    templateId,
    templateName,
    generatedAt: new Date().toISOString(),
    safetyMode,
    userInputs,
    expectedOutputs
  };
}

function normalizeText(value: string, fallback: string): string {
  const trimmedValue = value.trim();
  return trimmedValue === "" ? fallback : trimmedValue;
}

function clampWorkerCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 2;
  }

  return Math.min(4, Math.max(1, Math.floor(value)));
}
