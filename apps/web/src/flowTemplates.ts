import type { FlowEdge, FlowNode, FlowSpec, NodeType } from "@clawflow/protocol";
import { createFlowNode } from "./flowCatalog";
import type { I18nKey } from "./i18n";

export type TaskTemplateId =
  | "hello-world"
  | "mock-agent-demo"
  | "protected-dry-run-demo"
  | "blank-flow"
  | "excel-report"
  | "local-file-summary"
  | "multi-agent-planning";
export type TaskTemplateSafetyMode = "plan-only" | "read-only" | "controlled-write";

export interface TaskTemplateDefinition {
  id: TaskTemplateId;
  titleKey: I18nKey;
  descriptionKey: I18nKey;
  expectedOutputsKey: I18nKey;
  generatedAgentsKey: I18nKey;
  badgeKeys?: I18nKey[];
  nodeCount: number;
}

export interface HelloWorldTemplateInput {
  templateId: "hello-world";
}

export interface MockAgentDemoTemplateInput {
  templateId: "mock-agent-demo";
}

export interface ProtectedDryRunDemoTemplateInput {
  templateId: "protected-dry-run-demo";
}

export interface BlankFlowTemplateInput {
  templateId: "blank-flow";
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
  | HelloWorldTemplateInput
  | MockAgentDemoTemplateInput
  | ProtectedDryRunDemoTemplateInput
  | BlankFlowTemplateInput
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
    id: "hello-world",
    titleKey: "taskLauncher.template.hello.title",
    descriptionKey: "taskLauncher.template.hello.description",
    expectedOutputsKey: "taskLauncher.template.hello.outputs",
    generatedAgentsKey: "taskLauncher.template.hello.agents",
    badgeKeys: [
      "taskLauncher.badge.recommended",
      "taskLauncher.badge.easiest",
      "taskLauncher.badge.mockSafe",
      "taskLauncher.badge.oneMinute"
    ],
    nodeCount: 3
  },
  {
    id: "mock-agent-demo",
    titleKey: "taskLauncher.template.mockDemo.title",
    descriptionKey: "taskLauncher.template.mockDemo.description",
    expectedOutputsKey: "taskLauncher.template.mockDemo.outputs",
    generatedAgentsKey: "taskLauncher.template.mockDemo.agents",
    badgeKeys: ["taskLauncher.badge.mockSafe"],
    nodeCount: 5
  },
  {
    id: "protected-dry-run-demo",
    titleKey: "taskLauncher.template.protectedDemo.title",
    descriptionKey: "taskLauncher.template.protectedDemo.description",
    expectedOutputsKey: "taskLauncher.template.protectedDemo.outputs",
    generatedAgentsKey: "taskLauncher.template.protectedDemo.agents",
    badgeKeys: ["taskLauncher.badge.protected"],
    nodeCount: 5
  },
  {
    id: "blank-flow",
    titleKey: "taskLauncher.template.blank.title",
    descriptionKey: "taskLauncher.template.blank.description",
    expectedOutputsKey: "taskLauncher.template.blank.outputs",
    generatedAgentsKey: "taskLauncher.template.blank.agents",
    nodeCount: 0
  },
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
  if (input.templateId === "hello-world") {
    return createHelloWorldFlow();
  }

  if (input.templateId === "mock-agent-demo") {
    return createMockAgentDemoFlow();
  }

  if (input.templateId === "protected-dry-run-demo") {
    return createProtectedDryRunDemoFlow();
  }

  if (input.templateId === "blank-flow") {
    return createBlankFlow();
  }

  if (input.templateId === "excel-report") {
    return createExcelReportFlow(input);
  }

  if (input.templateId === "local-file-summary") {
    return createLocalFileSummaryFlow(input);
  }

  return createMultiAgentPlanningFlow(input);
}

function createHelloWorldFlow(): FlowSpec {
  const metadata = createTemplateMetadata(
    "hello-world",
    "Hello World Agent Flow",
    "read-only",
    {
      prompt: "Say hello from Clawflow Studio.",
      mockOutput: "Hello from Clawflow Studio mock agent."
    },
    ["Hello from Clawflow Studio mock agent."]
  );
  const nodes = createLinearTemplateNodes(
    metadata,
    [
      {
        id: "template.hello.manual",
        type: "manual.trigger",
        label: "Hello World Trigger",
        objective: "Say hello from Clawflow Studio.",
        runtimeRef: "mock-local"
      },
      {
        id: "template.hello.worker",
        type: "agent.worker",
        label: "Hello World Agent",
        objective: "Return: Hello from Clawflow Studio mock agent.",
        runtimeRef: "mock-local"
      },
      {
        id: "template.hello.output",
        type: "output.console",
        label: "Console Output",
        objective: "Display the Hello World mock output and next step.",
        runtimeRef: "mock-local"
      }
    ]
  );

  return createTemplateFlow("flow.template.hello-world", "Hello World Agent Flow", metadata, nodes);
}

function createMockAgentDemoFlow(): FlowSpec {
  const metadata = createTemplateMetadata(
    "mock-agent-demo",
    "Mock Agent Demo",
    "read-only",
    {
      prompt: "Run the safe mock Agent demo."
    },
    ["Mock flow completed."]
  );
  const nodes = createLinearTemplateNodes(metadata, [
    {
      id: "template.mock.manual",
      type: "manual.trigger",
      label: "Manual Trigger",
      objective: "Start the safe mock Agent demo.",
      runtimeRef: "mock-local"
    },
    {
      id: "template.mock.start",
      type: "agent.start",
      label: "Start Agent",
      objective: "Prepare the sequential mock workflow.",
      runtimeRef: "mock-local"
    },
    {
      id: "template.mock.worker",
      type: "agent.worker",
      label: "Worker Agent",
      objective: "Complete the mock worker step.",
      runtimeRef: "mock-local"
    },
    {
      id: "template.mock.end",
      type: "agent.end",
      label: "End Agent",
      objective: "Summarize the safe mock run.",
      runtimeRef: "mock-local"
    },
    {
      id: "template.mock.output",
      type: "output.console",
      label: "Console Output",
      objective: "Show mock run completion details.",
      runtimeRef: "mock-local"
    }
  ]);

  return createTemplateFlow("flow.template.mock-agent-demo", "Mock Agent Demo", metadata, nodes);
}

function createProtectedDryRunDemoFlow(): FlowSpec {
  const metadata = createTemplateMetadata(
    "protected-dry-run-demo",
    "Protected Dry Run Demo",
    "plan-only",
    {
      prompt: "Verify protected dry-run boundaries for openclaw-local."
    },
    ["Protected dry-run metadata only."]
  );
  const nodes = createLinearTemplateNodes(metadata, [
    {
      id: "template.protected.manual",
      type: "manual.trigger",
      label: "Protected Trigger",
      objective: "Start a protected dry-run verification flow.",
      runtimeRef: "mock-local"
    },
    {
      id: "template.protected.start",
      type: "agent.start",
      label: "Protected Start Agent",
      objective: "Explain that local OpenClaw reachability is not execution permission.",
      runtimeRef: "openclaw-local"
    },
    {
      id: "template.protected.worker",
      type: "agent.worker",
      label: "Protected Worker Agent",
      objective: "Produce protected dry-run metadata without real OpenClaw execution.",
      runtimeRef: "openclaw-local"
    },
    {
      id: "template.protected.end",
      type: "agent.end",
      label: "Protected Review Agent",
      objective: "Confirm that real execution remains blocked.",
      runtimeRef: "openclaw-local"
    },
    {
      id: "template.protected.output",
      type: "output.console",
      label: "Console Output",
      objective: "Show protected dry-run warnings and manual next steps.",
      runtimeRef: "mock-local"
    }
  ]);

  return createTemplateFlow("flow.template.protected-dry-run-demo", "Protected Dry Run Demo", metadata, nodes);
}

function createBlankFlow(): FlowSpec {
  const now = new Date().toISOString();

  return {
    schemaVersion: "0.1",
    id: "flow.template.blank",
    name: "Blank Flow",
    description: "Blank canvas generated from Task Launcher. No execution is triggered.",
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: []
  };
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
  specs: Array<{
    id: string;
    type: NodeType;
    label: string;
    objective: string;
    runtimeRef?: FlowNode["runtimeRef"];
  }>
): FlowNode[] {
  return specs.map((spec, index) => {
    const node = createFlowNode(spec.type, spec.id, { x: 80 + index * 270, y: 120 }, spec.label);

    return {
      ...node,
      runtimeRef: spec.runtimeRef ?? (spec.type.startsWith("agent.") ? "openclaw-local" : node.runtimeRef),
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
