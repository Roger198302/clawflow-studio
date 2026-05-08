import type {
  FlowSpec,
  HarnessCompatibilityResult,
  RuntimeExecutionMode,
  SessionIntervention,
  SessionInterventionKind,
  SessionInterventionStatus,
  SessionStatus,
  SessionStep,
  SessionStepStatus,
  SessionTurn,
  SessionTurnRole
} from "@clawflow/protocol";
import { getHarnessProfile } from "@clawflow/runtime-registry/harnesses";
import {
  ChevronLeft,
  ChevronRight,
  Ban,
  Check,
  Edit3,
  MessageSquare,
  Pause,
  Play,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldPlus,
  SkipForward,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from "react";
import { t, type I18nKey, type Locale } from "../i18n";
import { useFloatingPanelDrag } from "../hooks/useFloatingPanelDrag";
import {
  formatHarnessFit,
  formatHarnessLabel,
  formatHarnessRisk
} from "../harnessUi";
import { useSessionStore } from "../store/sessionStore";

export interface SessionConsoleProps {
  locale: Locale;
  flow: FlowSpec;
  isRunActive: boolean;
  onRunSession: () => void;
}

const statusLabelKeys: Record<SessionStatus, I18nKey> = {
  idle: "session.status.idle",
  running: "session.status.running",
  paused: "session.status.paused",
  waiting_for_user: "session.status.waitingForUser",
  completed: "session.status.completed",
  failed: "session.status.failed",
  cancelled: "session.status.cancelled"
};

const stepStatusLabelKeys: Record<SessionStepStatus, I18nKey> = {
  pending: "session.stepStatus.pending",
  running: "session.stepStatus.running",
  completed: "session.stepStatus.completed",
  failed: "session.stepStatus.failed",
  skipped: "session.stepStatus.skipped"
};

const roleLabelKeys: Record<SessionTurnRole, I18nKey> = {
  user: "session.userMessage",
  assistant: "session.assistantMessage",
  system: "session.systemMessage",
  runtime: "session.runtimeMessage"
};

const executionModeLabelKeys: Record<RuntimeExecutionMode, I18nKey> = {
  mock: "executionMode.mock",
  protected: "executionMode.protected",
  unavailable: "executionMode.unavailable"
};

const interventionKindLabelKeys: Record<SessionInterventionKind, I18nKey> = {
  pause: "session.intervention.pause",
  resume: "session.intervention.resume",
  cancel: "session.intervention.cancel",
  retry_step: "session.intervention.retryStep",
  skip_step: "session.intervention.skipStep",
  edit_step_input: "session.intervention.editStepInput",
  add_constraint: "session.intervention.addConstraint",
  approve: "session.intervention.approve",
  reject: "session.intervention.reject"
};

const interventionStatusLabelKeys: Record<SessionInterventionStatus, I18nKey> = {
  recorded: "session.intervention.status.recorded",
  applied: "session.intervention.status.applied",
  ignored: "session.intervention.status.ignored",
  failed: "session.intervention.status.failed"
};

type SessionInputMode = "message" | "constraint";

export function SessionConsole({
  locale,
  flow,
  isRunActive,
  onRunSession
}: SessionConsoleProps): ReactElement {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [draft, setDraft] = useState("");
  const [inputMode, setInputMode] = useState<SessionInputMode>("message");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingStepDraft, setEditingStepDraft] = useState("");
  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeSession = useSessionStore((state) => state.activeSession);
  const turns = useSessionStore((state) => state.turns);
  const steps = useSessionStore((state) => state.steps);
  const interventions = useSessionStore((state) => state.interventions);
  const sessionLoadStatus = useSessionStore((state) => state.sessionLoadStatus);
  const sessionError = useSessionStore((state) => state.sessionError);
  const loadSessions = useSessionStore((state) => state.loadSessions);
  const createSession = useSessionStore((state) => state.createSession);
  const loadSession = useSessionStore((state) => state.loadSession);
  const appendTurn = useSessionStore((state) => state.appendTurn);
  const pauseSession = useSessionStore((state) => state.pauseSession);
  const resumeSession = useSessionStore((state) => state.resumeSession);
  const cancelSession = useSessionStore((state) => state.cancelSession);
  const retryStep = useSessionStore((state) => state.retryStep);
  const skipStep = useSessionStore((state) => state.skipStep);
  const editStepInput = useSessionStore((state) => state.editStepInput);
  const addConstraint = useSessionStore((state) => state.addConstraint);
  const setActiveSessionId = useSessionStore((state) => state.setActiveSessionId);
  const { panelRef, panelStyle, dragHandleProps } = useFloatingPanelDrag<HTMLElement>();

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const runtimeSummary = useMemo(() => {
    if (activeSession?.runtimePlan === undefined) {
      return t(locale, "common.notAvailable");
    }

    return `${t(locale, executionModeLabelKeys[activeSession.runtimePlan.executionMode])} / ${
      activeSession.runtimePlan.runtimes.length
    }`;
  }, [activeSession?.runtimePlan, locale]);
  const currentNode = useMemo(
    () =>
      activeSession?.currentNodeId === undefined
        ? null
        : flow.nodes.find((node) => node.id === activeSession.currentNodeId) ?? null,
    [activeSession?.currentNodeId, flow.nodes]
  );
  const currentHarnessProfile = useMemo(
    () =>
      currentNode?.harnessRef === undefined
        ? undefined
        : getHarnessProfile(currentNode.harnessRef.harnessId),
    [currentNode?.harnessRef]
  );
  const currentStep = useMemo(
    () =>
      activeSession?.currentNodeId === undefined
        ? undefined
        : findLatestStepForNode(steps, activeSession.currentNodeId),
    [activeSession?.currentNodeId, steps]
  );
  const isTerminalSession =
    activeSession?.status === "completed" ||
    activeSession?.status === "failed" ||
    activeSession?.status === "cancelled";
  const canPause =
    activeSession !== null && !isTerminalSession && activeSession.status !== "paused";
  const canResume =
    activeSession?.status === "paused" || activeSession?.status === "waiting_for_user";
  const canCancel =
    activeSession?.status === "idle" ||
    activeSession?.status === "running" ||
    activeSession?.status === "paused" ||
    activeSession?.status === "waiting_for_user";
  const canRunSession =
    activeSession !== null &&
    !isRunActive &&
    activeSession.status !== "paused" &&
    activeSession.status !== "cancelled" &&
    activeSession.status !== "running";

  const handleCreateSession = useCallback(() => {
    void createSession(flow.id, `${flow.name} ${t(locale, "session.session")}`);
  }, [createSession, flow.id, flow.name, locale]);

  const handleRefreshSession = useCallback(() => {
    if (activeSessionId === null) {
      void loadSessions();
      return;
    }

    void loadSession(activeSessionId);
  }, [activeSessionId, loadSession, loadSessions]);

  const handleSessionChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setActiveSessionId(event.target.value === "" ? null : event.target.value);
    },
    [setActiveSessionId]
  );

  const handleSendTurn = useCallback(() => {
    const content = draft.trim();

    if (content === "") {
      return;
    }

    setDraft("");
    if (inputMode === "constraint") {
      void addConstraint(content);
      return;
    }

    void appendTurn(content);
  }, [addConstraint, appendTurn, draft, inputMode]);

  const handleAddConstraintToCurrentNode = useCallback(() => {
    const content = draft.trim();

    if (content === "" || activeSession?.currentNodeId === undefined) {
      return;
    }

    setDraft("");
    void addConstraint(content, activeSession.currentNodeId, currentStep?.id);
  }, [activeSession?.currentNodeId, addConstraint, currentStep?.id, draft]);

  const handleStartEditStep = useCallback((step: SessionStep) => {
    setEditingStepId(step.id);
    setEditingStepDraft(formatEditableStepInput(step.input));
  }, []);

  const handleCancelEditStep = useCallback(() => {
    setEditingStepId(null);
    setEditingStepDraft("");
  }, []);

  const handleSaveEditStep = useCallback(
    (step: SessionStep) => {
      void editStepInput(
        { stepId: step.id },
        parseEditableStepInput(editingStepDraft),
        "Step input edited from Session Console."
      );
      setEditingStepId(null);
      setEditingStepDraft("");
    },
    [editStepInput, editingStepDraft]
  );

  const handleRetryCurrentStep = useCallback(() => {
    if (currentStep === undefined) {
      return;
    }

    void retryStep({ stepId: currentStep.id }, "Current step retry requested from Session Console.");
  }, [currentStep, retryStep]);

  const handleSkipCurrentStep = useCallback(() => {
    if (currentStep === undefined) {
      return;
    }

    void skipStep({ stepId: currentStep.id }, "Current step skipped from Session Console.");
  }, [currentStep, skipStep]);

  if (isCollapsed) {
    return (
      <aside
      ref={panelRef}
      className="session-console session-console-collapsed"
      style={panelStyle}
      aria-label={t(locale, "session.console.title")}
      data-testid="session-console-panel"
    >
        <button
          type="button"
          data-testid="session-console-toggle"
          onClick={() => setIsCollapsed(false)}
          title={t(locale, "session.expand")}
        >
          <ChevronRight aria-hidden="true" size={16} />
          <span>{t(locale, "session.session")}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      ref={panelRef}
      className="session-console"
      style={panelStyle}
      aria-label={t(locale, "session.console.title")}
      data-testid="session-console-panel"
    >
      <header className="session-console-header" data-testid="session-console-header" {...dragHandleProps}>
        <div>
          <MessageSquare aria-hidden="true" size={17} />
          <span>
            <strong>{activeSession?.title ?? t(locale, "session.noActiveSession")}</strong>
            <small>{t(locale, "session.console.title")}</small>
          </span>
        </div>
        <button
          type="button"
          data-testid="session-console-toggle"
          onClick={() => setIsCollapsed(true)}
          title={t(locale, "session.collapse")}
        >
          <ChevronLeft aria-hidden="true" size={16} />
        </button>
      </header>

      <div className="session-console-body">
        <div className="session-toolbar">
          <button type="button" onClick={handleCreateSession} disabled={sessionLoadStatus === "loading"}>
            <PlusCircle aria-hidden="true" size={14} />
            {t(locale, "session.create")}
          </button>
          <button
            type="button"
            className="session-run-button"
            onClick={onRunSession}
            disabled={!canRunSession}
          >
            <Play aria-hidden="true" size={14} />
            {t(locale, "session.run")}
          </button>
          <button type="button" onClick={handleRefreshSession} disabled={sessionLoadStatus === "loading"}>
            <RefreshCw aria-hidden="true" size={14} />
            {t(locale, "session.refresh")}
          </button>
        </div>

        <div className="session-control-row" aria-label={t(locale, "session.interventions")}>
          <button type="button" onClick={() => void pauseSession()} disabled={!canPause}>
            <Pause aria-hidden="true" size={13} />
            {t(locale, "session.pause")}
          </button>
          <button type="button" onClick={() => void resumeSession()} disabled={!canResume}>
            <Play aria-hidden="true" size={13} />
            {t(locale, "session.resume")}
          </button>
          <button
            type="button"
            className="session-danger-button"
            onClick={() => void cancelSession()}
            disabled={!canCancel}
          >
            <Ban aria-hidden="true" size={13} />
            {t(locale, "session.cancel")}
          </button>
        </div>

        <label className="session-select">
          <span>{t(locale, "session.sessions")}</span>
          <select value={activeSessionId ?? ""} onChange={handleSessionChange}>
            <option value="">{t(locale, "session.noActiveSession")}</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ))}
          </select>
        </label>

        {sessionError !== null ? <p className="session-error">{sessionError}</p> : null}

        {activeSession === null ? (
          <section className="session-empty">
            <strong>{t(locale, "session.noActiveSession")}</strong>
            <span>{t(locale, "session.createToStart")}</span>
          </section>
        ) : (
          <>
            <section className="session-state-card">
              <div>
                <span>{t(locale, "inspector.status")}</span>
                <strong className={`session-status-badge session-status-${activeSession.status}`}>
                  {t(locale, statusLabelKeys[activeSession.status])}
                </strong>
              </div>
              <div>
                <span>{t(locale, "runtimeManager.executionMode")}</span>
                <code>{runtimeSummary}</code>
              </div>
              <div>
                <span>{t(locale, "session.currentRun")}</span>
                <code>{activeSession.currentRunId ?? "-"}</code>
              </div>
              <div>
                <span>{t(locale, "session.currentNode")}</span>
                <code>{activeSession.currentNodeId ?? "-"}</code>
              </div>
              {currentHarnessProfile !== undefined ? (
                <div>
                  <span>{t(locale, "harness.title")}</span>
                  <code>{formatHarnessLabel(locale, currentHarnessProfile)}</code>
                </div>
              ) : null}
              {currentHarnessProfile !== undefined ? (
                <div>
                  <span>{t(locale, "harness.riskLevel")}</span>
                  <strong className={`session-status-badge risk-${currentHarnessProfile.riskLevel}`}>
                    {formatHarnessRisk(locale, currentHarnessProfile.riskLevel)}
                  </strong>
                </div>
              ) : null}
              {currentStep !== undefined ? (
                <div className="session-current-actions">
                  <span>{t(locale, "session.currentNodeActions")}</span>
                  <div>
                    <button
                      type="button"
                      onClick={handleRetryCurrentStep}
                      disabled={!canRetryStep(currentStep)}
                    >
                      <RotateCcw aria-hidden="true" size={12} />
                      {t(locale, "session.retry")}
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipCurrentStep}
                      disabled={!canSkipStep(currentStep)}
                    >
                      <SkipForward aria-hidden="true" size={12} />
                      {t(locale, "session.skip")}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <SessionTurns locale={locale} turns={turns} />
            <SessionSteps
              locale={locale}
              steps={steps}
              editingStepId={editingStepId}
              editingStepDraft={editingStepDraft}
              onEditingStepDraftChange={setEditingStepDraft}
              onRetryStep={(step) =>
                void retryStep({ stepId: step.id }, "Step retry requested from Session Console.")
              }
              onSkipStep={(step) =>
                void skipStep({ stepId: step.id }, "Step skipped from Session Console.")
              }
              onStartEditStep={handleStartEditStep}
              onCancelEditStep={handleCancelEditStep}
              onSaveEditStep={handleSaveEditStep}
            />
            <SessionInterventions locale={locale} interventions={interventions} />

            <section className="session-input-area">
              <div className="session-input-mode">
                <button
                  type="button"
                  className={inputMode === "message" ? "is-active" : ""}
                  onClick={() => setInputMode("message")}
                >
                  {t(locale, "session.addMessage")}
                </button>
                <button
                  type="button"
                  className={inputMode === "constraint" ? "is-active" : ""}
                  onClick={() => setInputMode("constraint")}
                >
                  {t(locale, "session.addConstraint")}
                </button>
              </div>
              <label>
                <span>
                  {inputMode === "constraint"
                    ? t(locale, "session.addConstraint")
                    : t(locale, "session.addMessage")}
                </span>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={
                    inputMode === "constraint"
                      ? t(locale, "session.addConstraint")
                      : t(locale, "session.addMessage")
                  }
                  rows={3}
                />
              </label>
              <div className="session-input-actions">
                {activeSession.currentNodeId !== undefined ? (
                  <button
                    type="button"
                    onClick={handleAddConstraintToCurrentNode}
                    disabled={draft.trim() === ""}
                  >
                    <ShieldPlus aria-hidden="true" size={14} />
                    {t(locale, "session.addConstraintToCurrentNode")}
                  </button>
                ) : null}
                <button type="button" onClick={handleSendTurn} disabled={draft.trim() === ""}>
                  <Send aria-hidden="true" size={14} />
                  {t(locale, "session.send")}
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

function SessionTurns({ locale, turns }: { locale: Locale; turns: SessionTurn[] }): ReactElement {
  return (
    <section className="session-section">
      <div className="session-section-title">
        <h3>{t(locale, "session.turns")}</h3>
        <span>{turns.length}</span>
      </div>
      {turns.length === 0 ? (
        <p className="session-muted">{t(locale, "session.noTurns")}</p>
      ) : (
        <div className="session-turn-list">
          {turns.map((turn) => (
            <article className={`session-turn session-turn-${turn.role}`} key={turn.id}>
              <div>
                <strong>{t(locale, roleLabelKeys[turn.role])}</strong>
                <time>{formatSessionTime(turn.createdAt, locale)}</time>
              </div>
              <p>{turn.content}</p>
              <footer>
                {turn.nodeId !== undefined ? <code>{turn.nodeId}</code> : null}
                {turn.runtimeId !== undefined ? <code>{turn.runtimeId}</code> : null}
                {turn.protectedDryRun === true ? (
                  <span className="protected-dry-run-badge">{t(locale, "session.protectedDryRun")}</span>
                ) : null}
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SessionSteps({
  locale,
  steps,
  editingStepId,
  editingStepDraft,
  onEditingStepDraftChange,
  onRetryStep,
  onSkipStep,
  onStartEditStep,
  onCancelEditStep,
  onSaveEditStep
}: {
  locale: Locale;
  steps: SessionStep[];
  editingStepId: string | null;
  editingStepDraft: string;
  onEditingStepDraftChange: (value: string) => void;
  onRetryStep: (step: SessionStep) => void;
  onSkipStep: (step: SessionStep) => void;
  onStartEditStep: (step: SessionStep) => void;
  onCancelEditStep: () => void;
  onSaveEditStep: (step: SessionStep) => void;
}): ReactElement {
  return (
    <section className="session-section">
      <div className="session-section-title">
        <h3>{t(locale, "session.steps")}</h3>
        <span>{steps.length}</span>
      </div>
      {steps.length === 0 ? (
        <p className="session-muted">{t(locale, "session.noSteps")}</p>
      ) : (
        <div className="session-step-list">
          {steps.map((step) => (
            <article className={`session-step session-step-${step.status}`} key={step.id}>
              <div>
                <strong title={step.title ?? step.nodeId ?? ""}>
                  {step.title ?? step.nodeId ?? t(locale, "common.notAvailable")}
                </strong>
                <span>{t(locale, stepStatusLabelKeys[step.status])}</span>
              </div>
              <footer>
                <code>{step.nodeId ?? "-"}</code>
                <code>{step.runtimeId ?? "-"}</code>
                {step.compatibility !== undefined ? (
                  <span className={`harness-mini-fit fit-${step.compatibility.fit}`}>
                    {formatHarnessStepFit(locale, step.compatibility)}
                  </span>
                ) : null}
                {step.protectedDryRun === true ? (
                  <span className="protected-dry-run-badge">{t(locale, "session.protectedDryRun")}</span>
                ) : null}
              </footer>
              <div className="session-step-actions">
                <button
                  type="button"
                  onClick={() => onRetryStep(step)}
                  disabled={!canRetryStep(step)}
                >
                  <RotateCcw aria-hidden="true" size={12} />
                  {t(locale, "session.retry")}
                </button>
                <button
                  type="button"
                  onClick={() => onSkipStep(step)}
                  disabled={!canSkipStep(step)}
                >
                  <SkipForward aria-hidden="true" size={12} />
                  {t(locale, "session.skip")}
                </button>
                <button
                  type="button"
                  onClick={() => onStartEditStep(step)}
                  disabled={!canEditStepInput(step)}
                >
                  <Edit3 aria-hidden="true" size={12} />
                  {t(locale, "session.editInput")}
                </button>
              </div>
              {step.status === "completed" ? (
                <p className="session-step-note">{t(locale, "session.willNotRerunAutomatically")}</p>
              ) : null}
              {editingStepId === step.id ? (
                <div className="session-step-edit">
                  <textarea
                    value={editingStepDraft}
                    onChange={(event) => onEditingStepDraftChange(event.target.value)}
                    rows={4}
                  />
                  <div>
                    <button type="button" onClick={() => onSaveEditStep(step)}>
                      <Check aria-hidden="true" size={12} />
                      {t(locale, "session.save")}
                    </button>
                    <button type="button" onClick={onCancelEditStep}>
                      <X aria-hidden="true" size={12} />
                      {t(locale, "common.close")}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SessionInterventions({
  locale,
  interventions
}: {
  locale: Locale;
  interventions: SessionIntervention[];
}): ReactElement {
  return (
    <section className="session-section">
      <div className="session-section-title">
        <h3>{t(locale, "session.interventions")}</h3>
        <span>{interventions.length}</span>
      </div>
      {interventions.length === 0 ? (
        <p className="session-muted">{t(locale, "session.noInterventions")}</p>
      ) : (
        <div className="session-intervention-list">
          {interventions.slice().reverse().map((intervention) => (
            <article className="session-intervention" key={intervention.id}>
              <div>
                <strong>{t(locale, interventionKindLabelKeys[intervention.kind])}</strong>
                <span className={`intervention-status intervention-status-${intervention.status}`}>
                  {t(locale, interventionStatusLabelKeys[intervention.status])}
                </span>
              </div>
              <footer>
                <time>{formatSessionTime(intervention.createdAt, locale)}</time>
                {intervention.nodeId !== undefined ? <code>{intervention.nodeId}</code> : null}
                {intervention.stepId !== undefined ? <code>{intervention.stepId}</code> : null}
              </footer>
              {intervention.reason !== undefined ? <p>{intervention.reason}</p> : null}
              {intervention.content !== undefined ? <p>{intervention.content}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function findLatestStepForNode(steps: SessionStep[], nodeId: string): SessionStep | undefined {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (steps[index]?.nodeId === nodeId) {
      return steps[index];
    }
  }

  return undefined;
}

function canRetryStep(step: SessionStep): boolean {
  return step.status === "completed" || step.status === "failed" || step.status === "skipped";
}

function canSkipStep(step: SessionStep): boolean {
  return step.status !== "completed" && step.status !== "skipped";
}

function canEditStepInput(step: SessionStep): boolean {
  return (
    step.status === "pending" ||
    step.status === "running" ||
    step.status === "skipped" ||
    step.status === "failed" ||
    step.status === "completed"
  );
}

function formatEditableStepInput(input: unknown): string {
  if (input === undefined) {
    return "";
  }

  if (typeof input === "string") {
    return input;
  }

  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

function parseEditableStepInput(value: string): unknown {
  const trimmedValue = value.trim();

  if (trimmedValue === "") {
    return "";
  }

  try {
    return JSON.parse(trimmedValue);
  } catch {
    return {
      text: value
    };
  }
}

function formatSessionTime(timestamp: string, locale: Locale): string {
  return new Date(timestamp).toLocaleTimeString(locale);
}

function formatHarnessStepFit(locale: Locale, compatibility: HarnessCompatibilityResult): string {
  return formatHarnessFit(locale, compatibility.fit);
}
