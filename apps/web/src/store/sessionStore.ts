import type {
  AddSessionConstraintRequest,
  AppendSessionTurnRequest,
  CreateSessionRequest,
  EditSessionStepInputRequest,
  FlowSession,
  FlowSpec,
  RetrySessionStepRequest,
  SessionControlRequest,
  SessionDetail,
  SessionIntervention,
  SessionStep,
  SkipSessionStepRequest,
  SessionTurn
} from "@clawflow/protocol";
import { create } from "zustand";

const GATEWAY_HTTP_URL = import.meta.env.VITE_GATEWAY_HTTP_URL ?? "http://localhost:8787";

type SessionLoadStatus = "idle" | "loading" | "success" | "error";

interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

type SessionDetailResponse = SessionDetail;

interface SessionControlResponse {
  session: FlowSession;
  intervention: SessionIntervention;
}

export interface SessionStepTarget {
  stepId?: string;
  nodeId?: string;
}

export interface CreateRunResponse {
  runId: string;
  status: "queued";
  wsUrl: string;
}

export interface SessionStoreState {
  sessions: FlowSession[];
  activeSessionId: string | null;
  activeSession: FlowSession | null;
  turns: SessionTurn[];
  steps: SessionStep[];
  interventions: SessionIntervention[];
  sessionLoadStatus: SessionLoadStatus;
  sessionError: string | null;
  loadSessions: () => Promise<FlowSession[]>;
  createSession: (flowId: string, title?: string) => Promise<FlowSession | null>;
  loadSession: (sessionId: string) => Promise<SessionDetailResponse | null>;
  appendTurn: (content: string) => Promise<SessionTurn | null>;
  runActiveSession: (flow: FlowSpec) => Promise<CreateRunResponse | null>;
  pauseSession: (reason?: string) => Promise<SessionControlResponse | null>;
  resumeSession: (reason?: string) => Promise<SessionControlResponse | null>;
  cancelSession: (reason?: string) => Promise<SessionControlResponse | null>;
  retryStep: (
    target: SessionStepTarget,
    reason?: string,
    editedInput?: unknown
  ) => Promise<SessionDetailResponse | null>;
  skipStep: (target: SessionStepTarget, reason?: string) => Promise<SessionDetailResponse | null>;
  editStepInput: (
    target: SessionStepTarget,
    input: unknown,
    reason?: string
  ) => Promise<SessionDetailResponse | null>;
  addConstraint: (
    content: string,
    nodeId?: string,
    stepId?: string
  ) => Promise<SessionDetailResponse | null>;
  setActiveSessionId: (sessionId: string | null) => void;
  clearSessionError: () => void;
}

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  activeSession: null,
  turns: [],
  steps: [],
  interventions: [],
  sessionLoadStatus: "idle",
  sessionError: null,
  loadSessions: async () => {
    set({ sessionLoadStatus: "loading", sessionError: null });

    try {
      const response = await fetch(`${GATEWAY_HTTP_URL}/api/sessions`);
      const body = (await response.json().catch(() => ({}))) as FlowSession[] | ErrorResponse;

      if (!response.ok) {
        throw new Error(readErrorMessage(body) ?? `Gateway returned HTTP ${response.status}.`);
      }

      if (!Array.isArray(body)) {
        throw new Error("Gateway returned an invalid Session list response.");
      }

      set({
        sessions: body,
        sessionLoadStatus: "success",
        sessionError: null
      });

      return body;
    } catch (error: unknown) {
      const message = createSessionGatewayError(error);

      set({
        sessionLoadStatus: "error",
        sessionError: message
      });

      return [];
    }
  },
  createSession: async (flowId, title) => {
    set({ sessionLoadStatus: "loading", sessionError: null });

    try {
      const requestBody: CreateSessionRequest = {
        flowId,
        title
      };
      const response = await fetch(`${GATEWAY_HTTP_URL}/api/sessions`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      const body = (await response.json().catch(() => ({}))) as FlowSession | ErrorResponse;

      if (!response.ok) {
        throw new Error(readErrorMessage(body) ?? `Gateway returned HTTP ${response.status}.`);
      }

      if (!isFlowSession(body)) {
        throw new Error("Gateway returned an invalid Session response.");
      }

      set((state) => ({
        sessions: [body, ...state.sessions.filter((session) => session.id !== body.id)],
        activeSessionId: body.id,
        activeSession: body,
        turns: [],
        steps: [],
        interventions: [],
        sessionLoadStatus: "success",
        sessionError: null
      }));

      return body;
    } catch (error: unknown) {
      const message = createSessionGatewayError(error);

      set({
        sessionLoadStatus: "error",
        sessionError: message
      });

      return null;
    }
  },
  loadSession: async (sessionId) => {
    set({ sessionLoadStatus: "loading", sessionError: null });

    try {
      const response = await fetch(`${GATEWAY_HTTP_URL}/api/sessions/${encodeURIComponent(sessionId)}`);
      const body = (await response.json().catch(() => ({}))) as SessionDetailResponse | ErrorResponse;

      if (!response.ok) {
        throw new Error(readErrorMessage(body) ?? `Gateway returned HTTP ${response.status}.`);
      }

      if (!isSessionDetailResponse(body)) {
        throw new Error("Gateway returned an invalid Session detail response.");
      }

      set((state) => ({
        sessions: [body.session, ...state.sessions.filter((session) => session.id !== body.session.id)],
        activeSessionId: body.session.id,
        activeSession: body.session,
        turns: body.turns,
        steps: body.steps,
        interventions: body.interventions ?? [],
        sessionLoadStatus: "success",
        sessionError: null
      }));

      return body;
    } catch (error: unknown) {
      const message = createSessionGatewayError(error);

      set({
        sessionLoadStatus: "error",
        sessionError: message
      });

      return null;
    }
  },
  appendTurn: async (content) => {
    const sessionId = get().activeSessionId;

    if (sessionId === null) {
      set({ sessionError: "No active session selected." });
      return null;
    }

    try {
      const requestBody: AppendSessionTurnRequest = {
        role: "user",
        content
      };
      const response = await fetch(
        `${GATEWAY_HTTP_URL}/api/sessions/${encodeURIComponent(sessionId)}/turns`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(requestBody)
        }
      );
      const body = (await response.json().catch(() => ({}))) as SessionTurn | ErrorResponse;

      if (!response.ok) {
        throw new Error(readErrorMessage(body) ?? `Gateway returned HTTP ${response.status}.`);
      }

      if (!isSessionTurn(body)) {
        throw new Error("Gateway returned an invalid Session turn response.");
      }

      set((state) => ({
        turns: [...state.turns, body],
        sessionLoadStatus: "success",
        sessionError: null
      }));
      void get().loadSession(sessionId);

      return body;
    } catch (error: unknown) {
      const message = createSessionGatewayError(error);

      set({
        sessionLoadStatus: "error",
        sessionError: message
      });

      return null;
    }
  },
  runActiveSession: async (flow) => {
    const sessionId = get().activeSessionId;

    if (sessionId === null) {
      set({ sessionError: "No active session selected." });
      return null;
    }

    try {
      const response = await fetch(`${GATEWAY_HTTP_URL}/api/sessions/${encodeURIComponent(sessionId)}/run`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ flow })
      });
      const body = (await response.json().catch(() => ({}))) as CreateRunResponse | ErrorResponse;

      if (!response.ok) {
        throw new Error(readErrorMessage(body) ?? `Gateway returned HTTP ${response.status}.`);
      }

      if (!isCreateRunResponse(body)) {
        throw new Error("Gateway returned an invalid run response for the active Session.");
      }

      void get().loadSession(sessionId);

      return body;
    } catch (error: unknown) {
      const message = createSessionGatewayError(error);

      set({
        sessionLoadStatus: "error",
        sessionError: message
      });

      return null;
    }
  },
  pauseSession: async (reason) => {
    const result = await postSessionControl(get, set, "pause", { reason });

    if (result !== null) {
      void get().loadSession(result.session.id);
    }

    return result;
  },
  resumeSession: async (reason) => {
    const result = await postSessionControl(get, set, "resume", { reason });

    if (result !== null) {
      void get().loadSession(result.session.id);
    }

    return result;
  },
  cancelSession: async (reason) => {
    const result = await postSessionControl(get, set, "cancel", { reason });

    if (result !== null) {
      void get().loadSession(result.session.id);
    }

    return result;
  },
  retryStep: async (target, reason, editedInput) =>
    postSessionDetailAction(get, set, "steps/retry", {
      ...target,
      reason,
      editedInput
    } satisfies RetrySessionStepRequest),
  skipStep: async (target, reason) =>
    postSessionDetailAction(get, set, "steps/skip", {
      ...target,
      reason
    } satisfies SkipSessionStepRequest),
  editStepInput: async (target, input, reason) =>
    postSessionDetailAction(get, set, "steps/edit-input", {
      ...target,
      input,
      reason
    } satisfies EditSessionStepInputRequest),
  addConstraint: async (content, nodeId, stepId) =>
    postSessionDetailAction(get, set, "constraints", {
      content,
      nodeId,
      stepId
    } satisfies AddSessionConstraintRequest),
  setActiveSessionId: (sessionId) => {
    if (sessionId === null) {
      set({
        activeSessionId: null,
        activeSession: null,
        turns: [],
        steps: [],
        interventions: []
      });
      return;
    }

    set({ activeSessionId: sessionId });
    void get().loadSession(sessionId);
  },
  clearSessionError: () => {
    set({ sessionError: null });
  }
}));

type SessionStoreSet = (
  partial:
    | Partial<SessionStoreState>
    | ((state: SessionStoreState) => Partial<SessionStoreState>)
) => void;

type SessionStoreGet = () => SessionStoreState;

async function postSessionControl(
  get: SessionStoreGet,
  set: SessionStoreSet,
  action: "pause" | "resume" | "cancel",
  requestBody: SessionControlRequest
): Promise<SessionControlResponse | null> {
  const sessionId = get().activeSessionId;

  if (sessionId === null) {
    set({ sessionError: "No active session selected." });
    return null;
  }

  set({ sessionLoadStatus: "loading", sessionError: null });

  try {
    const response = await fetch(
      `${GATEWAY_HTTP_URL}/api/sessions/${encodeURIComponent(sessionId)}/${action}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(requestBody)
      }
    );
    const body = (await response.json().catch(() => ({}))) as SessionControlResponse | ErrorResponse;

    if (!response.ok) {
      throw new Error(readErrorMessage(body) ?? `Gateway returned HTTP ${response.status}.`);
    }

    if (!isSessionControlResponse(body)) {
      throw new Error("Gateway returned an invalid Session control response.");
    }

    set((state) => ({
      sessions: [body.session, ...state.sessions.filter((session) => session.id !== body.session.id)],
      activeSessionId: body.session.id,
      activeSession: body.session,
      interventions: [
        ...state.interventions.filter((intervention) => intervention.id !== body.intervention.id),
        body.intervention
      ],
      sessionLoadStatus: "success",
      sessionError: null
    }));

    return body;
  } catch (error: unknown) {
    const message = createSessionGatewayError(error);

    set({
      sessionLoadStatus: "error",
      sessionError: message
    });

    return null;
  }
}

async function postSessionDetailAction(
  get: SessionStoreGet,
  set: SessionStoreSet,
  path: "steps/retry" | "steps/skip" | "steps/edit-input" | "constraints",
  requestBody:
    | RetrySessionStepRequest
    | SkipSessionStepRequest
    | EditSessionStepInputRequest
    | AddSessionConstraintRequest
): Promise<SessionDetailResponse | null> {
  const sessionId = get().activeSessionId;

  if (sessionId === null) {
    set({ sessionError: "No active session selected." });
    return null;
  }

  set({ sessionLoadStatus: "loading", sessionError: null });

  try {
    const response = await fetch(
      `${GATEWAY_HTTP_URL}/api/sessions/${encodeURIComponent(sessionId)}/${path}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(requestBody)
      }
    );
    const body = (await response.json().catch(() => ({}))) as SessionDetailResponse | ErrorResponse;

    if (!response.ok) {
      throw new Error(readErrorMessage(body) ?? `Gateway returned HTTP ${response.status}.`);
    }

    if (!isSessionDetailResponse(body)) {
      throw new Error("Gateway returned an invalid Session detail response.");
    }

    applySessionDetail(set, body);

    return body;
  } catch (error: unknown) {
    const message = createSessionGatewayError(error);

    set({
      sessionLoadStatus: "error",
      sessionError: message
    });

    return null;
  }
}

function applySessionDetail(set: SessionStoreSet, detail: SessionDetailResponse): void {
  set((state) => ({
    sessions: [detail.session, ...state.sessions.filter((session) => session.id !== detail.session.id)],
    activeSessionId: detail.session.id,
    activeSession: detail.session,
    turns: detail.turns,
    steps: detail.steps,
    interventions: detail.interventions ?? [],
    sessionLoadStatus: "success",
    sessionError: null
  }));
}

function readErrorMessage(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  return (value as ErrorResponse).error?.message;
}

function createSessionGatewayError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : "Unable to connect to the gateway.";
  const isFetchFailure = rawMessage === "Failed to fetch" || rawMessage.includes("fetch");

  if (isFetchFailure) {
    return `Gateway unavailable: unable to load Sessions from ${GATEWAY_HTTP_URL}. Please make sure pnpm dev:gateway is running.`;
  }

  return `Session gateway error: ${rawMessage}`;
}

function isFlowSession(value: unknown): value is FlowSession {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<FlowSession>).id === "string" &&
    typeof (value as Partial<FlowSession>).flowId === "string"
  );
}

function isSessionTurn(value: unknown): value is SessionTurn {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<SessionTurn>).id === "string" &&
    typeof (value as Partial<SessionTurn>).sessionId === "string" &&
    typeof (value as Partial<SessionTurn>).content === "string"
  );
}

function isSessionDetailResponse(value: unknown): value is SessionDetailResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SessionDetailResponse>;

  return (
    isFlowSession(candidate.session) &&
    Array.isArray(candidate.turns) &&
    Array.isArray(candidate.steps) &&
    (candidate.interventions === undefined || Array.isArray(candidate.interventions))
  );
}

function isCreateRunResponse(value: unknown): value is CreateRunResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<CreateRunResponse>).runId === "string" &&
    typeof (value as Partial<CreateRunResponse>).wsUrl === "string"
  );
}

function isSessionControlResponse(value: unknown): value is SessionControlResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SessionControlResponse>;

  return isFlowSession(candidate.session) && isSessionIntervention(candidate.intervention);
}

function isSessionIntervention(value: unknown): value is SessionIntervention {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<SessionIntervention>).id === "string" &&
    typeof (value as Partial<SessionIntervention>).sessionId === "string" &&
    typeof (value as Partial<SessionIntervention>).kind === "string" &&
    typeof (value as Partial<SessionIntervention>).status === "string"
  );
}
