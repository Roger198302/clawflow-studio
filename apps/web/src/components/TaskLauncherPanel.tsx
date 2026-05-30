import { FileSpreadsheet, FileText, Workflow, X } from "lucide-react";
import { useMemo, useState, type ChangeEvent, type ReactElement } from "react";
import {
  TASK_TEMPLATES,
  type BlankFlowTemplateInput,
  type ExcelReportTemplateInput,
  type HelloWorldTemplateInput,
  type LocalFileSummaryTemplateInput,
  type MockAgentDemoTemplateInput,
  type MultiAgentPlanningTemplateInput,
  type ProtectedDryRunDemoTemplateInput,
  type TaskTemplateId,
  type TaskTemplateInput,
  type TaskTemplateSafetyMode
} from "../flowTemplates";
import { t, type Locale } from "../i18n";

interface TaskLauncherPanelProps {
  locale: Locale;
  onClose: () => void;
  onCreateFlow: (input: TaskTemplateInput) => void;
}

const safetyModes: TaskTemplateSafetyMode[] = ["plan-only", "read-only", "controlled-write"];

export function TaskLauncherPanel({
  locale,
  onClose,
  onCreateFlow
}: TaskLauncherPanelProps): ReactElement {
  const [selectedTemplateId, setSelectedTemplateId] = useState<TaskTemplateId>("hello-world");
  const [helloInput] = useState<HelloWorldTemplateInput>({
    templateId: "hello-world"
  });
  const [mockDemoInput] = useState<MockAgentDemoTemplateInput>({
    templateId: "mock-agent-demo"
  });
  const [protectedDemoInput] = useState<ProtectedDryRunDemoTemplateInput>({
    templateId: "protected-dry-run-demo"
  });
  const [blankFlowInput] = useState<BlankFlowTemplateInput>({
    templateId: "blank-flow"
  });
  const [excelInput, setExcelInput] = useState<ExcelReportTemplateInput>({
    templateId: "excel-report",
    taskName: "Excel Report Task",
    inputExcelPath: "",
    outputFolder: "",
    generateWordReport: true,
    generateMarkdownReport: true,
    generateSummaryFile: true,
    safetyMode: "controlled-write"
  });
  const [localFileInput, setLocalFileInput] = useState<LocalFileSummaryTemplateInput>({
    templateId: "local-file-summary",
    inputPath: "",
    summaryStyle: "Concise",
    outputMarkdownPath: "summary.md",
    safetyMode: "read-only"
  });
  const [planningInput, setPlanningInput] = useState<MultiAgentPlanningTemplateInput>({
    templateId: "multi-agent-planning",
    goal: "",
    workerCount: 2,
    reviewerEnabled: true,
    safetyMode: "plan-only"
  });
  const selectedTemplate = useMemo(
    () => TASK_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? TASK_TEMPLATES[0],
    [selectedTemplateId]
  );

  const handleCreateFlow = (): void => {
    if (selectedTemplateId === "hello-world") {
      onCreateFlow(helloInput);
      return;
    }

    if (selectedTemplateId === "mock-agent-demo") {
      onCreateFlow(mockDemoInput);
      return;
    }

    if (selectedTemplateId === "protected-dry-run-demo") {
      onCreateFlow(protectedDemoInput);
      return;
    }

    if (selectedTemplateId === "blank-flow") {
      onCreateFlow(blankFlowInput);
      return;
    }

    if (selectedTemplateId === "excel-report") {
      onCreateFlow(excelInput);
      return;
    }

    if (selectedTemplateId === "local-file-summary") {
      onCreateFlow(localFileInput);
      return;
    }

    onCreateFlow(planningInput);
  };

  return (
    <aside
      className="task-launcher-panel"
      aria-label={t(locale, "taskLauncher.aria")}
      data-testid="task-launcher-panel"
    >
      <header className="task-launcher-header">
        <div>
          <Workflow aria-hidden="true" size={18} />
          <span>
            <strong>{t(locale, "taskLauncher.title")}</strong>
            <small>{t(locale, "taskLauncher.subtitle")}</small>
          </span>
        </div>
        <button type="button" title={t(locale, "common.close")} onClick={onClose}>
          <X aria-hidden="true" size={16} />
        </button>
      </header>

      <div className="task-launcher-body">
        <section className="task-template-gallery" data-testid="task-template-gallery">
          {TASK_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              className={[
                template.id === selectedTemplateId ? "is-selected" : "",
                template.id === "hello-world" ? "is-featured" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              data-testid={`task-template-${template.id}`}
              onClick={() => setSelectedTemplateId(template.id)}
            >
              {template.id === "excel-report" ? (
                <FileSpreadsheet aria-hidden="true" size={16} />
              ) : template.id === "local-file-summary" ? (
                <FileText aria-hidden="true" size={16} />
              ) : (
                <Workflow aria-hidden="true" size={16} />
              )}
              <span>
                <strong>{t(locale, template.titleKey)}</strong>
                <small>{t(locale, template.descriptionKey)}</small>
                {template.badgeKeys !== undefined ? (
                  <span className="task-template-badges">
                    {template.badgeKeys.map((badgeKey) => (
                      <b key={badgeKey}>{t(locale, badgeKey)}</b>
                    ))}
                  </span>
                ) : null}
              </span>
              <em>{template.nodeCount}</em>
            </button>
          ))}
        </section>

        <section className="task-template-preview" data-testid="task-template-preview">
          <h2>{t(locale, selectedTemplate.titleKey)}</h2>
          <dl>
            <div>
              <dt>{t(locale, "taskLauncher.requiredInputs")}</dt>
              <dd>{createRequiredInputSummary(locale, selectedTemplate.id)}</dd>
            </div>
            <div>
              <dt>{t(locale, "taskLauncher.generatedAgents")}</dt>
              <dd>{t(locale, selectedTemplate.generatedAgentsKey)}</dd>
            </div>
            <div>
              <dt>{t(locale, "taskLauncher.safetyMode")}</dt>
              <dd>{t(locale, "taskLauncher.manualOnly")}</dd>
            </div>
            <div>
              <dt>{t(locale, "taskLauncher.expectedOutputs")}</dt>
              <dd>{t(locale, selectedTemplate.expectedOutputsKey)}</dd>
            </div>
          </dl>
        </section>

        <section className="task-template-form" data-testid="task-template-form">
          {selectedTemplateId === "hello-world" ? <HelloWorldTemplateForm locale={locale} /> : null}
          {selectedTemplateId === "mock-agent-demo" ? (
            <SimpleTemplateForm
              locale={locale}
              messageKey="taskLauncher.template.mockDemo.outputs"
              showGateway
            />
          ) : null}
          {selectedTemplateId === "protected-dry-run-demo" ? (
            <SimpleTemplateForm
              locale={locale}
              messageKey="taskLauncher.template.protectedDemo.outputs"
              showGateway
            />
          ) : null}
          {selectedTemplateId === "blank-flow" ? (
            <SimpleTemplateForm
              locale={locale}
              messageKey="taskLauncher.template.blank.outputs"
              showGateway={false}
            />
          ) : null}
          {selectedTemplateId === "excel-report" ? (
            <ExcelTemplateForm
              locale={locale}
              value={excelInput}
              onChange={setExcelInput}
            />
          ) : null}
          {selectedTemplateId === "local-file-summary" ? (
            <LocalFileTemplateForm
              locale={locale}
              value={localFileInput}
              onChange={setLocalFileInput}
            />
          ) : null}
          {selectedTemplateId === "multi-agent-planning" ? (
            <PlanningTemplateForm
              locale={locale}
              value={planningInput}
              onChange={setPlanningInput}
            />
          ) : null}
        </section>
      </div>

      <footer className="task-launcher-actions">
        <span>{t(locale, "taskLauncher.replaceNotice")}</span>
        <button type="button" data-testid="task-create-flow-button" onClick={handleCreateFlow}>
          {t(locale, "taskLauncher.createFlow")}
        </button>
      </footer>
    </aside>
  );
}

function SimpleTemplateForm({
  locale,
  messageKey,
  showGateway
}: {
  locale: Locale;
  messageKey: Parameters<typeof t>[1];
  showGateway: boolean;
}): ReactElement {
  return (
    <>
      <div className="task-form-readonly" data-testid="task-simple-template-copy">
        <strong>{t(locale, "taskLauncher.manualOnly")}</strong>
        <span>{t(locale, messageKey)}</span>
      </div>
      {showGateway ? <ReadOnlyGatewayField locale={locale} /> : null}
    </>
  );
}

function HelloWorldTemplateForm({ locale }: { locale: Locale }): ReactElement {
  return (
    <>
      <div className="task-form-readonly" data-testid="task-hello-world-copy">
        <strong>{t(locale, "taskLauncher.helloPrompt")}</strong>
        <span>{t(locale, "taskLauncher.helloOutput")}</span>
      </div>
      <ReadOnlyGatewayField locale={locale} />
    </>
  );
}

function ExcelTemplateForm({
  locale,
  value,
  onChange
}: {
  locale: Locale;
  value: ExcelReportTemplateInput;
  onChange: (value: ExcelReportTemplateInput) => void;
}): ReactElement {
  return (
    <>
      <TextField
        label={t(locale, "taskLauncher.taskName")}
        testId="task-excel-name-input"
        value={value.taskName}
        onChange={(taskName) => onChange({ ...value, taskName })}
      />
      <TextField
        label={t(locale, "taskLauncher.inputExcelPath")}
        testId="task-excel-path-input"
        value={value.inputExcelPath}
        onChange={(inputExcelPath) => onChange({ ...value, inputExcelPath })}
      />
      <TextField
        label={t(locale, "taskLauncher.outputFolder")}
        testId="task-output-folder-input"
        value={value.outputFolder}
        onChange={(outputFolder) => onChange({ ...value, outputFolder })}
      />
      <CheckboxField
        label={t(locale, "taskLauncher.generateWord")}
        testId="task-generate-word-checkbox"
        checked={value.generateWordReport}
        onChange={(generateWordReport) => onChange({ ...value, generateWordReport })}
      />
      <CheckboxField
        label={t(locale, "taskLauncher.generateMarkdown")}
        testId="task-generate-markdown-checkbox"
        checked={value.generateMarkdownReport}
        onChange={(generateMarkdownReport) => onChange({ ...value, generateMarkdownReport })}
      />
      <CheckboxField
        label={t(locale, "taskLauncher.generateSummary")}
        testId="task-generate-summary-checkbox"
        checked={value.generateSummaryFile}
        onChange={(generateSummaryFile) => onChange({ ...value, generateSummaryFile })}
      />
      <SafetyModeField
        locale={locale}
        value={value.safetyMode}
        onChange={(safetyMode) => onChange({ ...value, safetyMode })}
      />
      <ReadOnlyGatewayField locale={locale} />
    </>
  );
}

function LocalFileTemplateForm({
  locale,
  value,
  onChange
}: {
  locale: Locale;
  value: LocalFileSummaryTemplateInput;
  onChange: (value: LocalFileSummaryTemplateInput) => void;
}): ReactElement {
  return (
    <>
      <TextField
        label={t(locale, "taskLauncher.inputPath")}
        testId="task-local-file-path-input"
        value={value.inputPath}
        onChange={(inputPath) => onChange({ ...value, inputPath })}
      />
      <TextField
        label={t(locale, "taskLauncher.summaryStyle")}
        testId="task-summary-style-input"
        value={value.summaryStyle}
        onChange={(summaryStyle) => onChange({ ...value, summaryStyle })}
      />
      <TextField
        label={t(locale, "taskLauncher.outputMarkdownPath")}
        testId="task-output-markdown-input"
        value={value.outputMarkdownPath}
        onChange={(outputMarkdownPath) => onChange({ ...value, outputMarkdownPath })}
      />
      <SafetyModeField
        locale={locale}
        value={value.safetyMode}
        onChange={(safetyMode) => onChange({ ...value, safetyMode })}
      />
      <ReadOnlyGatewayField locale={locale} />
    </>
  );
}

function PlanningTemplateForm({
  locale,
  value,
  onChange
}: {
  locale: Locale;
  value: MultiAgentPlanningTemplateInput;
  onChange: (value: MultiAgentPlanningTemplateInput) => void;
}): ReactElement {
  return (
    <>
      <TextField
        label={t(locale, "taskLauncher.goal")}
        testId="task-planning-goal-input"
        value={value.goal}
        onChange={(goal) => onChange({ ...value, goal })}
      />
      <label className="task-form-field">
        <span>{t(locale, "taskLauncher.workerCount")}</span>
        <input
          type="number"
          min={1}
          max={4}
          data-testid="task-worker-count-input"
          value={value.workerCount}
          onChange={(event) =>
            onChange({
              ...value,
              workerCount: Number.parseInt(event.target.value, 10)
            })
          }
        />
      </label>
      <CheckboxField
        label={t(locale, "taskLauncher.reviewerEnabled")}
        testId="task-reviewer-enabled-checkbox"
        checked={value.reviewerEnabled}
        onChange={(reviewerEnabled) => onChange({ ...value, reviewerEnabled })}
      />
      <SafetyModeField
        locale={locale}
        value={value.safetyMode}
        onChange={(safetyMode) => onChange({ ...value, safetyMode })}
      />
      <ReadOnlyGatewayField locale={locale} />
    </>
  );
}

function TextField({
  label,
  testId,
  value,
  onChange
}: {
  label: string;
  testId: string;
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <label className="task-form-field">
      <span>{label}</span>
      <input value={value} data-testid={testId} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function CheckboxField({
  label,
  testId,
  checked,
  onChange
}: {
  label: string;
  testId: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}): ReactElement {
  return (
    <label className="task-form-check">
      <input
        type="checkbox"
        data-testid={testId}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function SafetyModeField({
  locale,
  value,
  onChange
}: {
  locale: Locale;
  value: TaskTemplateSafetyMode;
  onChange: (value: TaskTemplateSafetyMode) => void;
}): ReactElement {
  return (
    <label className="task-form-field">
      <span>{t(locale, "taskLauncher.safetyMode")}</span>
      <select
        value={value}
        data-testid="task-safety-mode-select"
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(event.target.value as TaskTemplateSafetyMode)
        }
      >
        {safetyModes.map((mode) => (
          <option key={mode} value={mode}>
            {t(locale, createSafetyModeLabelKey(mode))}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReadOnlyGatewayField({ locale }: { locale: Locale }): ReactElement {
  return (
    <div className="task-form-readonly" data-testid="task-gateway-default">
      <strong>{t(locale, "gatewayProfiles.workspaceDefault")}</strong>
      <span>{t(locale, "taskLauncher.followWorkspaceGateway")}</span>
    </div>
  );
}

function createSafetyModeLabelKey(mode: TaskTemplateSafetyMode):
  | "taskLauncher.safety.planOnly"
  | "taskLauncher.safety.readOnly"
  | "taskLauncher.safety.controlledWrite" {
  if (mode === "read-only") {
    return "taskLauncher.safety.readOnly";
  }

  if (mode === "controlled-write") {
    return "taskLauncher.safety.controlledWrite";
  }

  return "taskLauncher.safety.planOnly";
}

function createRequiredInputSummary(locale: Locale, templateId: TaskTemplateId): string {
  if (templateId === "hello-world") {
    return t(locale, "taskLauncher.template.hello.inputs");
  }

  if (templateId === "mock-agent-demo") {
    return t(locale, "taskLauncher.template.mockDemo.inputs");
  }

  if (templateId === "protected-dry-run-demo") {
    return t(locale, "taskLauncher.template.protectedDemo.inputs");
  }

  if (templateId === "blank-flow") {
    return t(locale, "taskLauncher.template.blank.inputs");
  }

  if (templateId === "excel-report") {
    return t(locale, "taskLauncher.template.excel.inputs");
  }

  if (templateId === "local-file-summary") {
    return t(locale, "taskLauncher.template.localFile.inputs");
  }

  return t(locale, "taskLauncher.template.planning.inputs");
}
