import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { MockRuntimeAdapter } from "@clawflow/adapter-mock";
import {
  buildContractAwareLinearExecutionPlan,
  buildFlowExecutionContractPreview,
  buildRunReadinessReport,
  buildStaticFlowEstimate,
  FlowEngine,
  type FlowRuntimePlan,
  type NodeExecutionAdapter,
  type NodeExecutionInput,
  type NodeExecutionResult
} from "@clawflow/flow-engine";
import type {
  AddSessionConstraintRequest,
  AppendSessionTurnRequest,
  CreateSessionRequest,
  EditSessionStepInputRequest,
  FlowEstimate,
  FlowExecutionContractPreview,
  FlowSession,
  FlowNode,
  FlowSpec,
  HarnessCompatibilityResult,
  LinearExecutionPlan,
  RunEvent,
  RunFlowRequest,
  RunReadinessReport,
  RuntimeExecutionMode,
  RunStatus,
  RuntimeHealth,
  RuntimeSpec,
  RetrySessionStepRequest,
  SessionControlRequest,
  SessionDetail,
  SessionIntervention,
  SessionInterventionKind,
  SessionInterventionStatus,
  SkipSessionStepRequest,
  SessionStatus,
  SessionStep,
  SessionStepStatus,
  SessionTurn,
  SessionTurnRole
} from "@clawflow/protocol";
import { RuntimeRegistry } from "@clawflow/runtime-registry";
import { evaluateHarnessCompatibility } from "@clawflow/runtime-registry/harnesses";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { pathToFileURL } from "node:url";

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = "127.0.0.1";
const VERSION = "0.1.0";
const PROTOCOL_VERSION = "0.1";
const SOCKET_OPEN = 1;
const DEFAULT_OPENCLAW_QUICK_CONNECT_BASE_URL = "http://localhost:25311";
const DEFAULT_OPENCLAW_QUICK_CONNECT_HEALTH_PATH = "/health";
const DEFAULT_OPENCLAW_QUICK_CONNECT_TIMEOUT_MS = 1_500;
const MAX_OPENCLAW_QUICK_CONNECT_TIMEOUT_MS = 5_000;
const OPENCLAW_QUICK_CONNECT_HEALTH_PATHS = new Set([
  "/health",
  "/api/health",
  "/ready",
  "/readiness",
  "/live",
  "/liveness",
  "/status"
]);
const LOCAL_CORS_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://[::1]:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://[::1]:4173"
]);

export interface HealthResponse {
  status: "ok";
  service: "clawflow-gateway";
  timestamp: string;
}

export interface VersionResponse {
  name: "ClawFlow Studio Gateway";
  version: string;
  protocolVersion: string;
  runtimeMode: "mock";
}

export interface CreateRunResponse {
  runId: string;
  status: "queued";
  wsUrl: string;
}

export type SessionDetailResponse = SessionDetail;

export interface SessionControlResponse {
  session: FlowSession;
  intervention: SessionIntervention;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

interface OpenClawLocalProbeRequest {
  baseUrl: string;
  healthPath: string;
  timeoutMs: number;
}

interface OpenClawLocalProbeResponse {
  runtimeId: "openclaw-local";
  health: RuntimeHealth;
  connection: {
    baseUrl: string;
    healthPath: string;
    healthUrl: string;
    status: "connected" | "unavailable";
    protected: true;
    checkedAt: string;
  };
}

function isAllowedDevOrigin(origin: string | undefined): boolean {
  if (origin === undefined) {
    return true;
  }

  return LOCAL_CORS_ORIGINS.has(origin);
}

interface RunSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: Buffer): void;
  on(event: "close", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
}

interface StoredRun {
  runId: string;
  flowId: string;
  sessionId?: string;
  status: RunStatus;
  events: RunEvent[];
  clients: Set<RunSocket>;
}

interface ParsedRunRequest {
  flow: FlowSpec;
  sessionId?: string;
}

interface AppendSessionTurnInput {
  role: SessionTurnRole;
  content: string;
  nodeId?: string;
  runId?: string;
  runtimeId?: string;
  protectedDryRun?: boolean;
}

interface UpsertSessionStepInput {
  runId?: string;
  nodeId?: string;
  title?: string;
  status: SessionStepStatus;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  runtimeId?: string;
  protectedDryRun?: boolean;
  compatibility?: HarnessCompatibilityResult;
}

interface RecordSessionInterventionInput {
  kind: SessionInterventionKind;
  status?: SessionInterventionStatus;
  runId?: string;
  nodeId?: string;
  stepId?: string;
  content?: string;
  payload?: unknown;
  reason?: string;
}

interface FindSessionStepTarget {
  stepId?: string;
  nodeId?: string;
}

interface UpdateSessionStepInput {
  status?: SessionStepStatus;
  input?: unknown;
  output?: unknown;
  error?: unknown;
}

class InMemorySessionStore {
  private readonly sessions = new Map<string, FlowSession>();
  private readonly turnsBySessionId = new Map<string, SessionTurn[]>();
  private readonly stepsBySessionId = new Map<string, SessionStep[]>();
  private readonly interventionsBySessionId = new Map<string, SessionIntervention[]>();

  createSession(flowId: string, title?: string): FlowSession {
    const now = new Date().toISOString();
    const session: FlowSession = {
      id: createId("session"),
      flowId,
      title: title?.trim() === "" || title === undefined ? "Untitled Session" : title,
      status: "idle",
      createdAt: now,
      updatedAt: now
    };

    this.sessions.set(session.id, session);
    this.turnsBySessionId.set(session.id, []);
    this.stepsBySessionId.set(session.id, []);
    this.interventionsBySessionId.set(session.id, []);

    return session;
  }

  getSession(sessionId: string): FlowSession | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): FlowSession[] {
    return Array.from(this.sessions.values()).sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    );
  }

  getSessionDetail(sessionId: string): SessionDetailResponse | undefined {
    const session = this.getSession(sessionId);

    if (session === undefined) {
      return undefined;
    }

    return {
      session,
      turns: this.turnsBySessionId.get(sessionId) ?? [],
      steps: this.stepsBySessionId.get(sessionId) ?? [],
      interventions: this.interventionsBySessionId.get(sessionId) ?? []
    };
  }

  appendSessionTurn(sessionId: string, input: AppendSessionTurnInput): SessionTurn | undefined {
    const session = this.getSession(sessionId);

    if (session === undefined) {
      return undefined;
    }

    const now = new Date().toISOString();
    const turn: SessionTurn = {
      id: createId("turn"),
      sessionId,
      role: input.role,
      content: input.content,
      nodeId: input.nodeId,
      runId: input.runId,
      runtimeId: input.runtimeId,
      protectedDryRun: input.protectedDryRun,
      createdAt: now
    };

    const turns = this.turnsBySessionId.get(sessionId) ?? [];
    this.turnsBySessionId.set(sessionId, [...turns, turn]);
    this.touchSession(sessionId, {});

    return turn;
  }

  upsertSessionStep(sessionId: string, input: UpsertSessionStepInput): SessionStep | undefined {
    const session = this.getSession(sessionId);

    if (session === undefined) {
      return undefined;
    }

    const now = new Date().toISOString();
    const steps = this.stepsBySessionId.get(sessionId) ?? [];
    const existingIndex = steps.findIndex(
      (step) => step.runId === input.runId && step.nodeId === input.nodeId
    );

    if (existingIndex === -1) {
      const step: SessionStep = {
        id: createId("step"),
        sessionId,
        runId: input.runId,
        nodeId: input.nodeId,
        title: input.title,
        status: input.status,
        input: input.input,
        output: input.output,
        error: input.error,
        runtimeId: input.runtimeId,
        protectedDryRun: input.protectedDryRun,
        compatibility: input.compatibility,
        createdAt: now,
        updatedAt: now
      };

      this.stepsBySessionId.set(sessionId, [...steps, step]);
      this.touchSession(sessionId, {});

      return step;
    }

    const existingStep = steps[existingIndex];
    const nextStep: SessionStep = {
      ...existingStep,
      title: input.title ?? existingStep.title,
      status: input.status,
      input: input.input === undefined ? existingStep.input : input.input,
      output: input.output === undefined ? existingStep.output : input.output,
      error: input.error === undefined ? existingStep.error : input.error,
      runtimeId: input.runtimeId ?? existingStep.runtimeId,
      protectedDryRun: input.protectedDryRun ?? existingStep.protectedDryRun,
      compatibility: input.compatibility ?? existingStep.compatibility,
      updatedAt: now
    };

    const nextSteps = [...steps];
    nextSteps[existingIndex] = nextStep;
    this.stepsBySessionId.set(sessionId, nextSteps);
    this.touchSession(sessionId, {});

    return nextStep;
  }

  findSessionStep(sessionId: string, target: FindSessionStepTarget): SessionStep | undefined {
    const steps = this.stepsBySessionId.get(sessionId) ?? [];

    if (target.stepId !== undefined) {
      return steps.find((step) => step.id === target.stepId);
    }

    if (target.nodeId !== undefined) {
      for (let index = steps.length - 1; index >= 0; index -= 1) {
        if (steps[index]?.nodeId === target.nodeId) {
          return steps[index];
        }
      }
    }

    return undefined;
  }

  updateSessionStep(
    sessionId: string,
    stepId: string,
    input: UpdateSessionStepInput
  ): SessionStep | undefined {
    const session = this.getSession(sessionId);

    if (session === undefined) {
      return undefined;
    }

    const steps = this.stepsBySessionId.get(sessionId) ?? [];
    const existingIndex = steps.findIndex((step) => step.id === stepId);

    if (existingIndex === -1) {
      return undefined;
    }

    const now = new Date().toISOString();
    const existingStep = steps[existingIndex];
    const nextStep: SessionStep = {
      ...existingStep,
      status: input.status ?? existingStep.status,
      input: input.input === undefined ? existingStep.input : input.input,
      output: input.output === undefined ? existingStep.output : input.output,
      error: input.error === undefined ? existingStep.error : input.error,
      updatedAt: now
    };
    const nextSteps = [...steps];
    nextSteps[existingIndex] = nextStep;
    this.stepsBySessionId.set(sessionId, nextSteps);
    this.touchSession(sessionId, {});

    return nextStep;
  }

  createRetryStep(
    sessionId: string,
    originalStep: SessionStep,
    input: {
      interventionId: string;
      reason?: string;
      editedInput?: unknown;
    }
  ): SessionStep | undefined {
    const session = this.getSession(sessionId);

    if (session === undefined) {
      return undefined;
    }

    const now = new Date().toISOString();
    const retryStep: SessionStep = {
      id: createId("step"),
      sessionId,
      runId: originalStep.runId,
      nodeId: originalStep.nodeId,
      title: originalStep.title === undefined ? "Retry requested." : `Retry requested: ${originalStep.title}`,
      status: "pending",
      input: {
        retryOfStepId: originalStep.id,
        interventionId: input.interventionId,
        reason: input.reason,
        value: input.editedInput === undefined ? originalStep.input ?? {} : input.editedInput
      },
      runtimeId: originalStep.runtimeId,
      protectedDryRun: originalStep.protectedDryRun,
      compatibility: originalStep.compatibility,
      createdAt: now,
      updatedAt: now
    };
    const steps = this.stepsBySessionId.get(sessionId) ?? [];
    this.stepsBySessionId.set(sessionId, [...steps, retryStep]);
    this.touchSession(sessionId, {});

    return retryStep;
  }

  markOpenStepsCancelled(sessionId: string, interventionId: string): void {
    const steps = this.stepsBySessionId.get(sessionId) ?? [];
    const now = new Date().toISOString();
    const nextSteps = steps.map((step) => {
      if (step.status !== "pending" && step.status !== "running") {
        return step;
      }

      return {
        ...step,
        status: "skipped" as const,
        error: {
          reason: "cancelled",
          interventionId
        },
        updatedAt: now
      };
    });

    this.stepsBySessionId.set(sessionId, nextSteps);
    this.touchSession(sessionId, {});
  }

  recordIntervention(
    sessionId: string,
    input: RecordSessionInterventionInput
  ): SessionIntervention | undefined {
    const session = this.getSession(sessionId);

    if (session === undefined) {
      return undefined;
    }

    const now = new Date().toISOString();
    const status = input.status ?? "applied";
    const intervention: SessionIntervention = {
      id: createId("intervention"),
      sessionId,
      kind: input.kind,
      status,
      runId: input.runId,
      nodeId: input.nodeId,
      stepId: input.stepId,
      content: input.content,
      payload: input.payload,
      reason: input.reason,
      createdAt: now,
      appliedAt: status === "applied" ? now : undefined
    };
    const interventions = this.interventionsBySessionId.get(sessionId) ?? [];
    this.interventionsBySessionId.set(sessionId, [...interventions, intervention]);
    this.touchSession(sessionId, {});

    return intervention;
  }

  updateSessionStatus(
    sessionId: string,
    status: SessionStatus,
    patch: Partial<Omit<FlowSession, "id" | "flowId" | "title" | "createdAt" | "updatedAt">> = {}
  ): FlowSession | undefined {
    return this.touchSession(sessionId, {
      ...patch,
      status
    });
  }

  touchSession(
    sessionId: string,
    patch: Partial<Omit<FlowSession, "id" | "flowId" | "title" | "createdAt" | "updatedAt">>
  ): FlowSession | undefined {
    const session = this.getSession(sessionId);

    if (session === undefined) {
      return undefined;
    }

    const nextSession: FlowSession = {
      ...session,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    this.sessions.set(sessionId, nextSession);

    return nextSession;
  }
}

export async function createServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info"
    }
  });

  const runs = new Map<string, StoredRun>();
  const engine = new FlowEngine();
  const adapter = new MockRuntimeAdapter();
  const runtimeRegistry = new RuntimeRegistry();
  const runtimeRoutingAdapter = new RuntimeRoutingAdapter(runtimeRegistry, adapter);
  const sessionStore = new InMemorySessionStore();

  await server.register(cors, {
    origin: (origin, callback) => {
      callback(null, isAllowedDevOrigin(origin));
    }
  });
  await server.register(websocket, {
    errorHandler: (error, socket, request) => {
      server.log.error({ error, url: request.url }, "Run WebSocket handler error");
      socket.close(1011, "Run WebSocket handler error");
    }
  });

  server.setErrorHandler((error, _request, reply) => {
    const message = error instanceof Error ? error.message : "Unexpected gateway error.";
    const stack = error instanceof Error ? error.stack : undefined;
    server.log.error({ message, stack }, "Gateway request error");
    sendError(reply, 500, "internal_error", message);
  });

  server.get("/health", async (): Promise<HealthResponse> => ({
    status: "ok",
    service: "clawflow-gateway",
    timestamp: new Date().toISOString()
  }));

  server.get("/api/version", async (): Promise<VersionResponse> => ({
    name: "ClawFlow Studio Gateway",
    version: VERSION,
    protocolVersion: PROTOCOL_VERSION,
    runtimeMode: "mock"
  }));

  server.get("/api/runtimes", async (): Promise<RuntimeSpec[]> => runtimeRegistry.listRuntimes());

  server.get<{ Params: { id: string }; Reply: RuntimeSpec | ErrorResponse }>(
    "/api/runtimes/:id",
    async (request, reply) => {
      const runtime = runtimeRegistry.getRuntime(request.params.id);

      if (runtime === undefined) {
        return sendError(reply, 404, "runtime_not_found", `Runtime not found: ${request.params.id}`);
      }

      return runtime;
    }
  );

  server.get<{ Params: { id: string }; Reply: RuntimeHealth | ErrorResponse }>(
    "/api/runtimes/:id/health",
    async (request, reply) => {
      if (runtimeRegistry.getRuntime(request.params.id) === undefined) {
        return sendError(reply, 404, "runtime_not_found", `Runtime not found: ${request.params.id}`);
      }

      return runtimeRegistry.healthCheck(request.params.id);
    }
  );

  server.post<{ Reply: RuntimeHealth[] | ErrorResponse }>(
    "/api/runtimes/health-check",
    async (): Promise<RuntimeHealth[]> => runtimeRegistry.healthCheckAll()
  );

  server.post<{ Body: unknown; Reply: OpenClawLocalProbeResponse | ErrorResponse }>(
    "/api/runtimes/openclaw-local/probe",
    async (request, reply) => {
      const probeRequest = parseOpenClawLocalProbeRequest(request.body);

      if (probeRequest === undefined) {
        return sendError(
          reply,
          400,
          "invalid_openclaw_probe",
          "Request body must include a loopback http(s) baseUrl and a supported healthPath."
        );
      }

      return probeOpenClawLocalGateway(probeRequest);
    }
  );

  server.post<{ Body: unknown; Reply: FlowExecutionContractPreview | ErrorResponse }>(
    "/api/flows/execution-contract-preview",
    async (request, reply) => {
      const parsedRunRequest = parseRunFlowRequest(request.body);

      if (parsedRunRequest === undefined) {
        return sendError(
          reply,
          400,
          "invalid_flow_spec",
          "Request body must be a FlowSpec or { flow: FlowSpec }."
        );
      }

      return buildFlowExecutionContractPreview(parsedRunRequest.flow, {
        runtimeExecutionModes: Object.fromEntries(
          runtimeRegistry.listRuntimes().map((runtime) => [runtime.id, runtime.executionMode])
        )
      });
    }
  );

  server.post<{ Body: unknown; Reply: LinearExecutionPlan | ErrorResponse }>(
    "/api/flows/linear-execution-plan",
    async (request, reply) => {
      const parsedRunRequest = parseRunFlowRequest(request.body);

      if (parsedRunRequest === undefined) {
        return sendError(
          reply,
          400,
          "invalid_flow_spec",
          "Request body must be a FlowSpec or { flow: FlowSpec }."
        );
      }

      return buildContractAwareLinearExecutionPlan(parsedRunRequest.flow, {
        runtimeExecutionModes: Object.fromEntries(
          runtimeRegistry.listRuntimes().map((runtime) => [runtime.id, runtime.executionMode])
        )
      });
    }
  );

  server.post<{ Body: unknown; Reply: FlowEstimate | ErrorResponse }>(
    "/api/flows/estimate",
    async (request, reply) => {
      const parsedRunRequest = parseRunFlowRequest(request.body);

      if (parsedRunRequest === undefined) {
        return sendError(
          reply,
          400,
          "invalid_flow_spec",
          "Request body must be a FlowSpec or { flow: FlowSpec }."
        );
      }

      return buildStaticFlowEstimate(parsedRunRequest.flow, {
        runtimeExecutionModes: Object.fromEntries(
          runtimeRegistry.listRuntimes().map((runtime) => [runtime.id, runtime.executionMode])
        )
      });
    }
  );

  server.post<{ Body: unknown; Reply: RunReadinessReport | ErrorResponse }>(
    "/api/flows/run-readiness",
    async (request, reply) => {
      const parsedRunRequest = parseRunFlowRequest(request.body);

      if (parsedRunRequest === undefined) {
        return sendError(
          reply,
          400,
          "invalid_flow_spec",
          "Request body must be a FlowSpec or { flow: FlowSpec }."
        );
      }

      return buildRunReadinessReport(parsedRunRequest.flow, {
        runtimeExecutionModes: Object.fromEntries(
          runtimeRegistry.listRuntimes().map((runtime) => [runtime.id, runtime.executionMode])
        )
      });
    }
  );

  server.post<{ Body: unknown; Reply: FlowSession | ErrorResponse }>(
    "/api/sessions",
    async (request, reply) => {
      if (!isCreateSessionRequest(request.body)) {
        return sendError(reply, 400, "invalid_session_request", "Request body must include flowId.");
      }

      return sessionStore.createSession(request.body.flowId, request.body.title);
    }
  );

  server.get<{ Reply: FlowSession[] }>("/api/sessions", async (): Promise<FlowSession[]> =>
    sessionStore.listSessions()
  );

  server.get<{ Params: { sessionId: string }; Reply: SessionDetailResponse | ErrorResponse }>(
    "/api/sessions/:sessionId",
    async (request, reply) => {
      const detail = sessionStore.getSessionDetail(request.params.sessionId);

      if (detail === undefined) {
        return sendError(
          reply,
          404,
          "session_not_found",
          `Session not found: ${request.params.sessionId}`
        );
      }

      return detail;
    }
  );

  server.post<{
    Params: { sessionId: string };
    Body: unknown;
    Reply: SessionTurn | ErrorResponse;
  }>("/api/sessions/:sessionId/turns", async (request, reply) => {
    const session = sessionStore.getSession(request.params.sessionId);

    if (session === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    if (!isAppendSessionTurnRequest(request.body)) {
      return sendError(
        reply,
        400,
        "invalid_session_turn",
        "Request body must include a non-empty content string."
      );
    }

    const turn = sessionStore.appendSessionTurn(request.params.sessionId, {
      role: request.body.role ?? "user",
      content: request.body.content,
      nodeId: request.body.nodeId,
      runId: request.body.runId
    });

    if (turn === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    return turn;
  });

  server.post<{
    Params: { sessionId: string };
    Body: unknown;
    Reply: SessionControlResponse | ErrorResponse;
  }>("/api/sessions/:sessionId/pause", async (request, reply) => {
    const controlRequest = parseSessionControlRequest(request.body);

    if (controlRequest === undefined) {
      return sendError(reply, 400, "invalid_session_control", "Request body must be an object.");
    }

    const session = sessionStore.getSession(request.params.sessionId);

    if (session === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    const isTerminal = isTerminalSessionStatus(session.status);
    const intervention = sessionStore.recordIntervention(request.params.sessionId, {
      kind: "pause",
      status: isTerminal ? "ignored" : "applied",
      runId: session.currentRunId,
      nodeId: session.currentNodeId,
      reason: controlRequest.reason,
      payload: {
        previousStatus: session.status
      }
    });

    if (intervention === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    if (!isTerminal) {
      sessionStore.updateSessionStatus(request.params.sessionId, "paused");
      sessionStore.appendSessionTurn(request.params.sessionId, {
        role: "runtime",
        content: "Session paused.",
        runId: session.currentRunId
      });
    } else {
      sessionStore.appendSessionTurn(request.params.sessionId, {
        role: "runtime",
        content: `Pause ignored because the session is ${session.status}.`,
        runId: session.currentRunId
      });
    }

    const updatedSession = sessionStore.getSession(request.params.sessionId) ?? session;
    return {
      session: updatedSession,
      intervention
    };
  });

  server.post<{
    Params: { sessionId: string };
    Body: unknown;
    Reply: SessionControlResponse | ErrorResponse;
  }>("/api/sessions/:sessionId/resume", async (request, reply) => {
    const controlRequest = parseSessionControlRequest(request.body);

    if (controlRequest === undefined) {
      return sendError(reply, 400, "invalid_session_control", "Request body must be an object.");
    }

    const session = sessionStore.getSession(request.params.sessionId);

    if (session === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    const canResume = session.status === "paused" || session.status === "waiting_for_user";
    const nextStatus: SessionStatus =
      session.status === "paused" && session.currentRunId !== undefined ? "running" : "idle";
    const intervention = sessionStore.recordIntervention(request.params.sessionId, {
      kind: "resume",
      status: canResume ? "applied" : "ignored",
      runId: session.currentRunId,
      nodeId: session.currentNodeId,
      reason: controlRequest.reason,
      payload: {
        previousStatus: session.status,
        nextStatus: canResume ? nextStatus : session.status
      }
    });

    if (intervention === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    if (canResume) {
      sessionStore.updateSessionStatus(request.params.sessionId, nextStatus);
      sessionStore.appendSessionTurn(request.params.sessionId, {
        role: "runtime",
        content: "Session resumed.",
        runId: session.currentRunId
      });
    } else {
      sessionStore.appendSessionTurn(request.params.sessionId, {
        role: "runtime",
        content: `Resume ignored because the session is ${session.status}.`,
        runId: session.currentRunId
      });
    }

    const updatedSession = sessionStore.getSession(request.params.sessionId) ?? session;
    return {
      session: updatedSession,
      intervention
    };
  });

  server.post<{
    Params: { sessionId: string };
    Body: unknown;
    Reply: SessionControlResponse | ErrorResponse;
  }>("/api/sessions/:sessionId/cancel", async (request, reply) => {
    const controlRequest = parseSessionControlRequest(request.body);

    if (controlRequest === undefined) {
      return sendError(reply, 400, "invalid_session_control", "Request body must be an object.");
    }

    const session = sessionStore.getSession(request.params.sessionId);

    if (session === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    const isTerminal = isTerminalSessionStatus(session.status);
    const intervention = sessionStore.recordIntervention(request.params.sessionId, {
      kind: "cancel",
      status: isTerminal ? "ignored" : "applied",
      runId: session.currentRunId,
      nodeId: session.currentNodeId,
      reason: controlRequest.reason,
      payload: {
        previousStatus: session.status
      }
    });

    if (intervention === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    if (!isTerminal) {
      sessionStore.updateSessionStatus(request.params.sessionId, "cancelled");
      sessionStore.markOpenStepsCancelled(request.params.sessionId, intervention.id);
      sessionStore.appendSessionTurn(request.params.sessionId, {
        role: "runtime",
        content: "Session cancelled.",
        runId: session.currentRunId
      });
    } else {
      sessionStore.appendSessionTurn(request.params.sessionId, {
        role: "runtime",
        content: `Cancel ignored because the session is ${session.status}.`,
        runId: session.currentRunId
      });
    }

    const updatedSession = sessionStore.getSession(request.params.sessionId) ?? session;
    return {
      session: updatedSession,
      intervention
    };
  });

  server.post<{
    Params: { sessionId: string };
    Body: unknown;
    Reply: SessionDetailResponse | ErrorResponse;
  }>("/api/sessions/:sessionId/steps/retry", async (request, reply) => {
    if (sessionStore.getSession(request.params.sessionId) === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    if (!isRetrySessionStepRequest(request.body)) {
      return sendError(
        reply,
        400,
        "invalid_retry_step_request",
        "Request body must include a stepId or nodeId."
      );
    }

    const targetStep = sessionStore.findSessionStep(request.params.sessionId, request.body);

    if (targetStep === undefined) {
      return sendError(reply, 404, "session_step_not_found", "Session step not found.");
    }

    const intervention = sessionStore.recordIntervention(request.params.sessionId, {
      kind: "retry_step",
      status: "recorded",
      runId: targetStep.runId,
      nodeId: targetStep.nodeId,
      stepId: targetStep.id,
      reason: request.body.reason,
      payload: {
        editedInputProvided: request.body.editedInput !== undefined
      }
    });

    if (intervention === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    sessionStore.createRetryStep(request.params.sessionId, targetStep, {
      interventionId: intervention.id,
      reason: request.body.reason,
      editedInput: request.body.editedInput
    });
    sessionStore.appendSessionTurn(request.params.sessionId, {
      role: "system",
      content: "Step retry requested.",
      nodeId: targetStep.nodeId,
      runId: targetStep.runId
    });

    return sessionStore.getSessionDetail(request.params.sessionId) as SessionDetailResponse;
  });

  server.post<{
    Params: { sessionId: string };
    Body: unknown;
    Reply: SessionDetailResponse | ErrorResponse;
  }>("/api/sessions/:sessionId/steps/skip", async (request, reply) => {
    if (sessionStore.getSession(request.params.sessionId) === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    if (!isSkipSessionStepRequest(request.body)) {
      return sendError(
        reply,
        400,
        "invalid_skip_step_request",
        "Request body must include a stepId or nodeId."
      );
    }

    const targetStep = sessionStore.findSessionStep(request.params.sessionId, request.body);

    if (targetStep === undefined) {
      return sendError(reply, 404, "session_step_not_found", "Session step not found.");
    }

    const intervention = sessionStore.recordIntervention(request.params.sessionId, {
      kind: "skip_step",
      status: "applied",
      runId: targetStep.runId,
      nodeId: targetStep.nodeId,
      stepId: targetStep.id,
      reason: request.body.reason
    });

    if (intervention === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    sessionStore.updateSessionStep(request.params.sessionId, targetStep.id, {
      status: "skipped",
      error: {
        reason: request.body.reason ?? "skipped",
        interventionId: intervention.id
      }
    });
    sessionStore.appendSessionTurn(request.params.sessionId, {
      role: "runtime",
      content: "Step skipped.",
      nodeId: targetStep.nodeId,
      runId: targetStep.runId
    });

    return sessionStore.getSessionDetail(request.params.sessionId) as SessionDetailResponse;
  });

  server.post<{
    Params: { sessionId: string };
    Body: unknown;
    Reply: SessionDetailResponse | ErrorResponse;
  }>("/api/sessions/:sessionId/steps/edit-input", async (request, reply) => {
    if (sessionStore.getSession(request.params.sessionId) === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    if (!isEditSessionStepInputRequest(request.body)) {
      return sendError(
        reply,
        400,
        "invalid_edit_step_input_request",
        "Request body must include a stepId or nodeId and input."
      );
    }

    const targetStep = sessionStore.findSessionStep(request.params.sessionId, request.body);

    if (targetStep === undefined) {
      return sendError(reply, 404, "session_step_not_found", "Session step not found.");
    }

    const intervention = sessionStore.recordIntervention(request.params.sessionId, {
      kind: "edit_step_input",
      status: "applied",
      runId: targetStep.runId,
      nodeId: targetStep.nodeId,
      stepId: targetStep.id,
      reason: request.body.reason,
      payload: {
        previousInput: targetStep.input,
        input: request.body.input
      }
    });

    if (intervention === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    sessionStore.updateSessionStep(request.params.sessionId, targetStep.id, {
      input: request.body.input
    });
    sessionStore.appendSessionTurn(request.params.sessionId, {
      role: "system",
      content: "Step input edited.",
      nodeId: targetStep.nodeId,
      runId: targetStep.runId
    });

    return sessionStore.getSessionDetail(request.params.sessionId) as SessionDetailResponse;
  });

  server.post<{
    Params: { sessionId: string };
    Body: unknown;
    Reply: SessionDetailResponse | ErrorResponse;
  }>("/api/sessions/:sessionId/constraints", async (request, reply) => {
    const session = sessionStore.getSession(request.params.sessionId);

    if (session === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    if (!isAddSessionConstraintRequest(request.body)) {
      return sendError(
        reply,
        400,
        "invalid_constraint_request",
        "Request body must include a non-empty content string."
      );
    }

    if (request.body.stepId !== undefined) {
      const targetStep = sessionStore.findSessionStep(request.params.sessionId, {
        stepId: request.body.stepId
      });

      if (targetStep === undefined) {
        return sendError(reply, 404, "session_step_not_found", "Session step not found.");
      }
    }

    sessionStore.appendSessionTurn(request.params.sessionId, {
      role: "user",
      content: request.body.content,
      nodeId: request.body.nodeId,
      runId: session.currentRunId
    });
    sessionStore.recordIntervention(request.params.sessionId, {
      kind: "add_constraint",
      status: "recorded",
      runId: session.currentRunId,
      nodeId: request.body.nodeId,
      stepId: request.body.stepId,
      content: request.body.content
    });

    if (session.status === "idle" || session.status === "paused") {
      sessionStore.updateSessionStatus(request.params.sessionId, "waiting_for_user");
    }

    return sessionStore.getSessionDetail(request.params.sessionId) as SessionDetailResponse;
  });

  server.post<{
    Params: { sessionId: string };
    Body: unknown;
    Reply: CreateRunResponse | ErrorResponse;
  }>("/api/sessions/:sessionId/run", async (request, reply) => {
    if (sessionStore.getSession(request.params.sessionId) === undefined) {
      return sendError(
        reply,
        404,
        "session_not_found",
        `Session not found: ${request.params.sessionId}`
      );
    }

    const parsedRunRequest = parseRunFlowRequest(request.body);

    if (parsedRunRequest === undefined) {
      return sendError(
        reply,
        400,
        "invalid_flow_spec",
        "Request body must be a FlowSpec or { flow: FlowSpec }."
      );
    }

    const result = startRun(parsedRunRequest.flow, {
      runs,
      engine,
      runtimeRegistry,
      runtimeRoutingAdapter,
      sessionStore,
      sessionId: request.params.sessionId
    });

    if (!result.ok) {
      return sendError(reply, result.statusCode, result.code, result.message);
    }

    return result.response;
  });

  server.post<{ Body: unknown; Reply: CreateRunResponse | ErrorResponse }>(
    "/api/runs",
    async (request, reply) => {
      const parsedRunRequest = parseRunFlowRequest(request.body);

      if (parsedRunRequest === undefined) {
        return sendError(
          reply,
          400,
          "invalid_flow_spec",
          "Request body must be a FlowSpec or { flow: FlowSpec, sessionId?: string }."
        );
      }

      const result = startRun(parsedRunRequest.flow, {
        runs,
        engine,
        runtimeRegistry,
        runtimeRoutingAdapter,
        sessionStore,
        sessionId: parsedRunRequest.sessionId
      });

      if (!result.ok) {
        return sendError(reply, result.statusCode, result.code, result.message);
      }

      return result.response;
    }
  );

  server.get("/ws/runs", { websocket: true }, (socket, request) => {
    const runId = readRunIdFromUrl(request.raw.url ?? request.url);
    const runSocket = getRunSocket(socket);

    if (runId === undefined || runId.trim() === "") {
      sendSocketJson(runSocket, {
        error: {
          code: "missing_run_id",
          message: "WebSocket query parameter runId is required."
        }
      });
      runSocket.close(1008, Buffer.from("missing runId"));
      return;
    }

    const storedRun = runs.get(runId);

    if (storedRun === undefined) {
      sendSocketJson(runSocket, {
        error: {
          code: "run_not_found",
          message: `Run not found: ${runId}`
        }
      });
      runSocket.close(1008, Buffer.from("run not found"));
      return;
    }

    storedRun.clients.add(runSocket);

    for (const event of storedRun.events) {
      sendSocketJson(runSocket, event);
    }

    runSocket.on("close", () => {
      storedRun.clients.delete(runSocket);
    });
    runSocket.on("error", (error) => {
      server.log.warn({ error, runId }, "Run WebSocket error");
      storedRun.clients.delete(runSocket);
    });
  });

  return server;
}

interface StartRunDependencies {
  runs: Map<string, StoredRun>;
  engine: FlowEngine;
  runtimeRegistry: RuntimeRegistry;
  runtimeRoutingAdapter: RuntimeRoutingAdapter;
  sessionStore: InMemorySessionStore;
  sessionId?: string;
}

type StartRunResult =
  | {
      ok: true;
      response: CreateRunResponse;
    }
  | {
      ok: false;
      statusCode: number;
      code: string;
      message: string;
    };

type SessionRunGateResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      statusCode: number;
      code: string;
      message: string;
    };

function validateSessionCanStartRun(session: FlowSession): SessionRunGateResult {
  if (session.status === "cancelled") {
    return {
      ok: false,
      statusCode: 409,
      code: "session_cancelled",
      message: "Cannot run cancelled session. Create a new session or use a different session."
    };
  }

  if (session.status === "paused") {
    return {
      ok: false,
      statusCode: 409,
      code: "session_paused",
      message: "Cannot run paused session. Resume the session before starting another run."
    };
  }

  if (session.status === "running") {
    return {
      ok: false,
      statusCode: 409,
      code: "session_already_running",
      message: "Session is already running. Wait for the current run to finish before starting another run."
    };
  }

  return {
    ok: true
  };
}

function isTerminalSessionStatus(status: SessionStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function startRun(flow: FlowSpec, dependencies: StartRunDependencies): StartRunResult {
  if (dependencies.sessionId !== undefined) {
    const session = dependencies.sessionStore.getSession(dependencies.sessionId);

    if (session === undefined) {
      return {
        ok: false,
        statusCode: 404,
        code: "session_not_found",
        message: `Session not found: ${dependencies.sessionId}`
      };
    }

    const sessionRunGate = validateSessionCanStartRun(session);

    if (!sessionRunGate.ok) {
      return {
        ok: false,
        statusCode: sessionRunGate.statusCode,
        code: sessionRunGate.code,
        message: sessionRunGate.message
      };
    }
  }

  const validation = dependencies.engine.validate(flow);
  const runtimePlan = createRuntimePlan(flow, dependencies.runtimeRegistry);

  if (!validation.ok) {
    return {
      ok: false,
      statusCode: 400,
      code: "invalid_flow_graph",
      message: validation.issues[0]?.message ?? "Invalid flow graph."
    };
  }

  if (!runtimePlan.ok) {
    return {
      ok: false,
      statusCode: 400,
      code: runtimePlan.code,
      message: runtimePlan.message
    };
  }

  const runId = createId("run");
  const harnessCompatibilityByNodeId = createHarnessCompatibilityMap(flow, dependencies.runtimeRegistry);
  dependencies.runs.set(runId, {
    runId,
    flowId: flow.id,
    sessionId: dependencies.sessionId,
    status: "queued",
    events: [],
    clients: new Set()
  });

  if (dependencies.sessionId !== undefined) {
    dependencies.sessionStore.touchSession(dependencies.sessionId, {
      currentRunId: runId,
      runtimePlan: runtimePlan.plan
    });
  }

  setTimeout(() => {
    const emitRunEvent = (event: RunEvent): void => {
      const enrichedEvent = enrichRunEventWithHarnessCompatibility(event, harnessCompatibilityByNodeId);

      if (dependencies.sessionId !== undefined) {
        updateSessionTimeline(dependencies.sessionStore, dependencies.sessionId, enrichedEvent);
      }

      publishRunEvent(dependencies.runs, enrichedEvent);
    };

    void dependencies.engine
      .execute(flow, dependencies.runtimeRoutingAdapter, {
        runId,
        initialInput: {
          userInput: "Run requested from ClawFlow Studio WebUI."
        },
        runtimePlan: runtimePlan.plan,
        onEvent: emitRunEvent
      })
      .then((result) => {
        const storedRun = dependencies.runs.get(runId);

        if (storedRun !== undefined) {
          storedRun.status = result.status;
        }
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unexpected mock flow execution error.";
        const failedEvent: RunEvent = {
          id: createId("event"),
          runId,
          flowId: flow.id,
          sequence: (dependencies.runs.get(runId)?.events.length ?? 0) + 1,
          timestamp: new Date().toISOString(),
          type: "run.failed",
          status: "failed",
          message,
          payload: {
            error: message
          }
        };

        emitRunEvent(failedEvent);
      });
  }, 0);

  return {
    ok: true,
    response: {
      runId,
      status: "queued",
      wsUrl: `/ws/runs?runId=${encodeURIComponent(runId)}`
    }
  };
}

function updateSessionTimeline(
  sessionStore: InMemorySessionStore,
  sessionId: string,
  event: RunEvent
): void {
  const runtimeId = readRuntimeIdFromEvent(event);
  const protectedDryRun = readProtectedDryRunFromEvent(event);
  const compatibility = readHarnessCompatibilityFromEvent(event);

  if (event.type === "run.started") {
    sessionStore.updateSessionStatus(sessionId, "running", {
      currentRunId: event.runId,
      currentNodeId: undefined,
      runtimePlan: readRuntimePlanFromEvent(event)
    });
    sessionStore.appendSessionTurn(sessionId, {
      role: "runtime",
      content: "Run started for this session.",
      runId: event.runId,
      protectedDryRun
    });
    return;
  }

  if (event.type === "execution.plan.created") {
    sessionStore.appendSessionTurn(sessionId, {
      role: "runtime",
      content: "Linear execution plan created.",
      runId: event.runId,
      protectedDryRun
    });
    return;
  }

  if (event.nodeId !== undefined) {
    sessionStore.updateSessionStatus(sessionId, "running", {
      currentRunId: event.runId,
      currentNodeId: event.nodeId
    });
  }

  if (event.type === "execution.step.started") {
    sessionStore.upsertSessionStep(sessionId, {
      runId: event.runId,
      nodeId: event.nodeId,
      title: event.message,
      status: "running",
      input: event.payload?.receivedInput,
      runtimeId,
      protectedDryRun,
      compatibility
    });
    return;
  }

  if (event.type === "execution.step.completed") {
    sessionStore.upsertSessionStep(sessionId, {
      runId: event.runId,
      nodeId: event.nodeId,
      title: event.message,
      status: "completed",
      output: event.payload?.output,
      runtimeId,
      protectedDryRun,
      compatibility
    });
    return;
  }

  if (event.type === "execution.step.blocked") {
    sessionStore.upsertSessionStep(sessionId, {
      runId: event.runId,
      nodeId: event.nodeId,
      title: event.message,
      status: "skipped",
      error: event.payload,
      runtimeId,
      protectedDryRun,
      compatibility
    });
    return;
  }

  if (event.type === "node.started") {
    sessionStore.upsertSessionStep(sessionId, {
      runId: event.runId,
      nodeId: event.nodeId,
      title: event.message,
      status: "running",
      runtimeId,
      protectedDryRun,
      compatibility
    });
    return;
  }

  if (event.type === "node.input") {
    sessionStore.upsertSessionStep(sessionId, {
      runId: event.runId,
      nodeId: event.nodeId,
      title: event.message,
      status: "running",
      input: event.payload?.input,
      runtimeId,
      protectedDryRun,
      compatibility
    });
    return;
  }

  if (event.type === "node.output") {
    sessionStore.upsertSessionStep(sessionId, {
      runId: event.runId,
      nodeId: event.nodeId,
      title: event.message,
      status: "running",
      output: event.payload?.output ?? event.payload,
      runtimeId,
      protectedDryRun,
      compatibility
    });

    if (protectedDryRun) {
      sessionStore.appendSessionTurn(sessionId, {
        role: "runtime",
        content: "Protected dry run completed. Real agent/tool execution was blocked.",
        nodeId: event.nodeId,
        runId: event.runId,
        runtimeId,
        protectedDryRun: true
      });
    }

    return;
  }

  if (event.type === "node.completed") {
    sessionStore.upsertSessionStep(sessionId, {
      runId: event.runId,
      nodeId: event.nodeId,
      title: event.message,
      status: "completed",
      output: event.payload?.output,
      runtimeId,
      protectedDryRun,
      compatibility
    });
    return;
  }

  if (event.type === "node.failed") {
    sessionStore.upsertSessionStep(sessionId, {
      runId: event.runId,
      nodeId: event.nodeId,
      title: event.message,
      status: "failed",
      error: event.payload?.error ?? event.payload,
      runtimeId,
      protectedDryRun,
      compatibility
    });
    return;
  }

  if (event.type === "run.completed") {
    sessionStore.updateSessionStatus(sessionId, "completed", {
      currentRunId: event.runId,
      currentNodeId: undefined
    });
    sessionStore.appendSessionTurn(sessionId, {
      role: "runtime",
      content: "Run completed.",
      runId: event.runId
    });
    return;
  }

  if (event.type === "run.failed") {
    sessionStore.updateSessionStatus(sessionId, "failed", {
      currentRunId: event.runId
    });
    sessionStore.appendSessionTurn(sessionId, {
      role: "runtime",
      content: `Run failed: ${event.message}`,
      runId: event.runId
    });
  }
}

function createHarnessCompatibilityMap(
  flow: FlowSpec,
  runtimeRegistry: RuntimeRegistry
): Map<string, HarnessCompatibilityResult> {
  const compatibilityByNodeId = new Map<string, HarnessCompatibilityResult>();

  for (const node of flow.nodes) {
    if (node.harnessRef === undefined) {
      continue;
    }

    compatibilityByNodeId.set(
      node.id,
      evaluateHarnessCompatibility(node.harnessRef, resolveNodeRuntimeRef(node), runtimeRegistry)
    );
  }

  return compatibilityByNodeId;
}

function enrichRunEventWithHarnessCompatibility(
  event: RunEvent,
  compatibilityByNodeId: Map<string, HarnessCompatibilityResult>
): RunEvent {
  if (event.type === "run.started" && compatibilityByNodeId.size > 0) {
    return {
      ...event,
      payload: {
        ...event.payload,
        harnessCompatibility: Array.from(compatibilityByNodeId.entries()).map(
          ([nodeId, compatibility]) => ({
            nodeId,
            ...compatibility
          })
        )
      }
    };
  }

  if (event.nodeId === undefined) {
    return event;
  }

  const compatibility = compatibilityByNodeId.get(event.nodeId);

  if (compatibility === undefined) {
    return event;
  }

  return {
    ...event,
    payload: {
      ...event.payload,
      harnessCompatibility: compatibility
    }
  };
}

interface RuntimePlanValidationResult {
  ok: boolean;
  code: string;
  message: string;
  plan?: FlowRuntimePlan;
}

class RuntimeRoutingAdapter implements NodeExecutionAdapter {
  constructor(
    private readonly runtimeRegistry: RuntimeRegistry,
    private readonly mockAdapter: MockRuntimeAdapter
  ) {}

  async executeNode(input: NodeExecutionInput): Promise<NodeExecutionResult> {
    const runtimeRef = resolveNodeRuntimeRef(input.node);
    const runtime = this.runtimeRegistry.getRuntime(runtimeRef);

    if (runtime === undefined) {
      throw new Error(`Runtime not found: ${runtimeRef}`);
    }

    if (runtime.executionMode === "mock") {
      return this.mockAdapter.executeNode(input);
    }

    if (runtime.executionMode === "protected") {
      return createProtectedDryRunResult(input.node, runtime, input.input);
    }

    throw new Error(`Runtime ${runtime.id} is unavailable and cannot execute this flow.`);
  }
}

function createRuntimePlan(
  flow: FlowSpec,
  runtimeRegistry: RuntimeRegistry
): RuntimePlanValidationResult {
  const runtimesById = new Map<string, RuntimeSpec>();

  for (const node of flow.nodes.filter(requiresRuntimeForRun)) {
    const runtimeRef = resolveNodeRuntimeRef(node);
    const runtime = runtimeRegistry.getRuntime(runtimeRef);

    if (runtime === undefined) {
      return {
        ok: false,
        code: "runtime_not_found",
        message: `Runtime not found: ${runtimeRef}`
      };
    }

    if (runtime.executionMode === "unavailable") {
      return {
        ok: false,
        code: "runtime_unavailable",
        message: `Runtime ${runtime.id} is unavailable and cannot execute this flow.`
      };
    }

    runtimesById.set(runtime.id, runtime);
  }

  const runtimes = Array.from(runtimesById.values()).map((runtime) => ({
    runtimeId: runtime.id,
    executionMode: runtime.executionMode
  }));
  const protectedDryRun = runtimes.some((runtime) => runtime.executionMode === "protected");
  const executionMode: RuntimeExecutionMode = protectedDryRun ? "protected" : "mock";

  return {
    ok: true,
    code: "ok",
    message: "Runtime plan created.",
    plan: {
      executionMode,
      protectedDryRun,
      runtimes
    }
  };
}

function createProtectedDryRunResult(
  node: FlowNode,
  runtime: RuntimeSpec,
  input: Record<string, unknown> | undefined
): NodeExecutionResult {
  return {
    nodeId: node.id,
    nodeType: node.type,
    label: node.label,
    output: {
      kind: "runtime.protected_dry_run.output",
      status: "protected_dry_run",
      selectedRuntimeId: runtime.id,
      executionMode: runtime.executionMode,
      protectedDryRun: true,
      realExecutionBlocked: true,
      message: `Protected dry run completed for ${node.label}. Real agent/tool execution was blocked.`,
      node: {
        id: node.id,
        type: node.type,
        role: node.role,
        label: node.label
      },
      upstream: input ?? {}
    }
  };
}

function resolveNodeRuntimeRef(node: FlowNode): string {
  return node.runtimeRef?.trim() === "" || node.runtimeRef === undefined ? "mock-local" : node.runtimeRef;
}

function requiresRuntimeForRun(node: FlowNode): boolean {
  if (node.role === "trigger" && (node.runtimeRef === undefined || node.runtimeRef.trim() === "")) {
    return false;
  }

  return (
    node.role === "trigger" ||
    node.role === "start" ||
    node.role === "process" ||
    node.role === "end" ||
    node.role === "tool" ||
    node.role === "output" ||
    node.type.startsWith("agent.") ||
    node.type.startsWith("output.")
  );
}

async function main(): Promise<void> {
  const server = await createServer();
  const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
  const host = process.env.CLAWFLOW_GATEWAY_HOST ?? DEFAULT_HOST;

  await server.listen({
    host,
    port
  });
}

function publishRunEvent(runs: Map<string, StoredRun>, event: RunEvent): void {
  const storedRun = runs.get(event.runId);

  if (storedRun === undefined) {
    return;
  }

  storedRun.status = event.status;
  storedRun.events.push(event);

  for (const client of storedRun.clients) {
    sendSocketJson(client, event);
  }
}

function sendSocketJson(socket: RunSocket, data: unknown): void {
  if (socket.readyState !== SOCKET_OPEN) {
    return;
  }

  try {
    socket.send(JSON.stringify(data));
  } catch {
    // The next close/error event will remove the client from the run.
  }
}

function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string
): FastifyReply {
  return reply.code(statusCode).send({
    error: {
      code,
      message
    }
  });
}

function parseRunFlowRequest(value: unknown): ParsedRunRequest | undefined {
  if (isFlowSpec(value)) {
    return {
      flow: value
    };
  }

  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const candidate = value as Partial<RunFlowRequest>;

  if (!isFlowSpec(candidate.flow)) {
    return undefined;
  }

  return {
    flow: candidate.flow,
    sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : undefined
  };
}

function parseOpenClawLocalProbeRequest(value: unknown): OpenClawLocalProbeRequest | undefined {
  if (value !== undefined && (typeof value !== "object" || value === null || Array.isArray(value))) {
    return undefined;
  }

  const candidate = (value ?? {}) as {
    baseUrl?: unknown;
    healthPath?: unknown;
    timeoutMs?: unknown;
  };
  const baseUrl =
    typeof candidate.baseUrl === "string" && candidate.baseUrl.trim() !== ""
      ? candidate.baseUrl.trim()
      : DEFAULT_OPENCLAW_QUICK_CONNECT_BASE_URL;
  const healthPath = normalizeOpenClawProbeHealthPath(
    typeof candidate.healthPath === "string" && candidate.healthPath.trim() !== ""
      ? candidate.healthPath
      : DEFAULT_OPENCLAW_QUICK_CONNECT_HEALTH_PATH
  );
  const timeoutMs = normalizeOpenClawProbeTimeout(candidate.timeoutMs);

  if (healthPath === undefined || timeoutMs === undefined) {
    return undefined;
  }

  let parsedBaseUrl: URL;

  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    return undefined;
  }

  if (!isSafeOpenClawProbeBaseUrl(parsedBaseUrl)) {
    return undefined;
  }

  const normalizedBaseUrl = `${parsedBaseUrl.protocol}//${parsedBaseUrl.host}`;
  const healthUrl = new URL(healthPath, `${normalizedBaseUrl}/`);

  if (healthUrl.search !== "" || healthUrl.hash !== "" || !isAllowedOpenClawProbePath(healthUrl.pathname)) {
    return undefined;
  }

  return {
    baseUrl: normalizedBaseUrl,
    healthPath: healthUrl.pathname,
    timeoutMs
  };
}

function normalizeOpenClawProbeHealthPath(value: string): string | undefined {
  const trimmedValue = value.trim();

  if (trimmedValue === "" || /^https?:\/\//i.test(trimmedValue)) {
    return undefined;
  }

  const normalizedPath = trimmedValue.startsWith("/") ? trimmedValue : `/${trimmedValue}`;
  const lowerPath = normalizedPath.toLowerCase();

  if (
    normalizedPath.includes("\\") ||
    normalizedPath.includes("?") ||
    normalizedPath.includes("#") ||
    lowerPath.includes("..") ||
    lowerPath.includes("%2e") ||
    lowerPath.includes("%2f") ||
    lowerPath.includes("%5c")
  ) {
    return undefined;
  }

  return normalizedPath;
}

function normalizeOpenClawProbeTimeout(value: unknown): number | undefined {
  if (value === undefined) {
    return DEFAULT_OPENCLAW_QUICK_CONNECT_TIMEOUT_MS;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const timeoutMs = Math.floor(value);

  if (timeoutMs < 100 || timeoutMs > MAX_OPENCLAW_QUICK_CONNECT_TIMEOUT_MS) {
    return undefined;
  }

  return timeoutMs;
}

function isSafeOpenClawProbeBaseUrl(url: URL): boolean {
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "" &&
    isLoopbackHostname(url.hostname)
  );
}

function isLoopbackHostname(hostname: string): boolean {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "::1" ||
    normalizedHostname === "0:0:0:0:0:0:0:1" ||
    isIpv4LoopbackAddress(normalizedHostname) ||
    (normalizedHostname.startsWith("::ffff:") &&
      isIpv4LoopbackAddress(normalizedHostname.slice("::ffff:".length)))
  );
}

function isIpv4LoopbackAddress(hostname: string): boolean {
  const octets = hostname.split(".");

  if (octets.length !== 4 || octets[0] !== "127") {
    return false;
  }

  return octets.every((octet) => {
    if (!/^\d{1,3}$/.test(octet)) {
      return false;
    }

    const value = Number.parseInt(octet, 10);
    return value >= 0 && value <= 255;
  });
}

function isAllowedOpenClawProbePath(pathname: string): boolean {
  return OPENCLAW_QUICK_CONNECT_HEALTH_PATHS.has(pathname);
}

async function probeOpenClawLocalGateway(
  request: OpenClawLocalProbeRequest
): Promise<OpenClawLocalProbeResponse> {
  const startedAt = Date.now();
  const healthUrl = new URL(request.healthPath, `${request.baseUrl}/`);
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, request.timeoutMs);

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal
    });
    const checkedAt = new Date().toISOString();
    const latencyMs = Date.now() - startedAt;
    const isOnline = response.ok;
    const health: RuntimeHealth = {
      runtimeId: "openclaw-local",
      status: isOnline ? "online" : "offline",
      checkedAt,
      latencyMs,
      message: isOnline
        ? "OpenClaw local gateway is reachable. Real Agent and Tool execution remains blocked."
        : `OpenClaw local gateway returned HTTP ${response.status}. Real execution remains blocked.`
    };

    return createOpenClawLocalProbeResponse(request, health, healthUrl.toString());
  } catch (error: unknown) {
    const checkedAt = new Date().toISOString();
    const latencyMs = Date.now() - startedAt;
    const health: RuntimeHealth = {
      runtimeId: "openclaw-local",
      status: "offline",
      checkedAt,
      latencyMs,
      message: isAbortError(error)
        ? `OpenClaw local gateway probe timed out after ${request.timeoutMs}ms. Real execution remains blocked.`
        : "OpenClaw local gateway is unavailable. Real execution remains blocked."
    };

    return createOpenClawLocalProbeResponse(request, health, healthUrl.toString());
  } finally {
    clearTimeout(timeout);
  }
}

function createOpenClawLocalProbeResponse(
  request: OpenClawLocalProbeRequest,
  health: RuntimeHealth,
  healthUrl: string
): OpenClawLocalProbeResponse {
  return {
    runtimeId: "openclaw-local",
    health,
    connection: {
      baseUrl: request.baseUrl,
      healthPath: request.healthPath,
      healthUrl,
      status: health.status === "online" ? "connected" : "unavailable",
      protected: true,
      checkedAt: health.checkedAt
    }
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isCreateSessionRequest(value: unknown): value is CreateSessionRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<CreateSessionRequest>;

  return (
    typeof candidate.flowId === "string" &&
    candidate.flowId.trim() !== "" &&
    (candidate.title === undefined || typeof candidate.title === "string")
  );
}

function isAppendSessionTurnRequest(value: unknown): value is AppendSessionTurnRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AppendSessionTurnRequest>;

  return (
    typeof candidate.content === "string" &&
    candidate.content.trim() !== "" &&
    (candidate.role === undefined || isSessionTurnRole(candidate.role)) &&
    (candidate.nodeId === undefined || typeof candidate.nodeId === "string") &&
    (candidate.runId === undefined || typeof candidate.runId === "string")
  );
}

function parseSessionControlRequest(value: unknown): SessionControlRequest | undefined {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Partial<SessionControlRequest>;

  if (candidate.reason !== undefined && typeof candidate.reason !== "string") {
    return undefined;
  }

  return {
    reason: candidate.reason
  };
}

function isRetrySessionStepRequest(value: unknown): value is RetrySessionStepRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<RetrySessionStepRequest>;

  return (
    hasStepTarget(candidate) &&
    (candidate.reason === undefined || typeof candidate.reason === "string")
  );
}

function isSkipSessionStepRequest(value: unknown): value is SkipSessionStepRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<SkipSessionStepRequest>;

  return (
    hasStepTarget(candidate) &&
    (candidate.reason === undefined || typeof candidate.reason === "string")
  );
}

function isEditSessionStepInputRequest(value: unknown): value is EditSessionStepInputRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<EditSessionStepInputRequest>;

  return (
    hasStepTarget(candidate) &&
    Object.prototype.hasOwnProperty.call(candidate, "input") &&
    (candidate.reason === undefined || typeof candidate.reason === "string")
  );
}

function isAddSessionConstraintRequest(value: unknown): value is AddSessionConstraintRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<AddSessionConstraintRequest>;

  return (
    typeof candidate.content === "string" &&
    candidate.content.trim() !== "" &&
    (candidate.nodeId === undefined || typeof candidate.nodeId === "string") &&
    (candidate.stepId === undefined || typeof candidate.stepId === "string")
  );
}

function hasStepTarget(value: { stepId?: unknown; nodeId?: unknown }): boolean {
  const hasStepId = typeof value.stepId === "string" && value.stepId.trim() !== "";
  const hasNodeId = typeof value.nodeId === "string" && value.nodeId.trim() !== "";

  return hasStepId || hasNodeId;
}

function isSessionTurnRole(value: unknown): value is SessionTurnRole {
  return (
    value === "user" ||
    value === "assistant" ||
    value === "system" ||
    value === "runtime"
  );
}

function readRuntimePlanFromEvent(event: RunEvent): FlowRuntimePlan | undefined {
  const runtimePlan = readRecord(event.payload?.runtimePlan);

  if (runtimePlan === undefined) {
    return undefined;
  }

  if (
    typeof runtimePlan.executionMode !== "string" ||
    typeof runtimePlan.protectedDryRun !== "boolean" ||
    !Array.isArray(runtimePlan.runtimes)
  ) {
    return undefined;
  }

  return runtimePlan as unknown as FlowRuntimePlan;
}

function readRuntimeIdFromEvent(event: RunEvent): string | undefined {
  const payload = event.payload;
  const output = readRecord(payload?.output);

  return (
    readString(payload?.runtimeRef) ??
    readString(payload?.runtimeId) ??
    readString(payload?.selectedRuntimeId) ??
    readString(readRecord(payload?.step)?.runtimeRef) ??
    readString(output?.selectedRuntimeId) ??
    readString(output?.usedRuntimeRef) ??
    readString(output?.runtimeId)
  );
}

function readProtectedDryRunFromEvent(event: RunEvent): boolean {
  const payload = event.payload;
  const output = readRecord(payload?.output);

  return payload?.protectedDryRun === true || output?.protectedDryRun === true;
}

function readHarnessCompatibilityFromEvent(event: RunEvent): HarnessCompatibilityResult | undefined {
  const compatibility = readRecord(event.payload?.harnessCompatibility);

  if (compatibility === undefined || typeof compatibility.harnessId !== "string") {
    return undefined;
  }

  return compatibility as unknown as HarnessCompatibilityResult;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function isFlowSpec(value: unknown): value is FlowSpec {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<FlowSpec>;

  return (
    candidate.schemaVersion === "0.1" &&
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges)
  );
}

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function readRunIdFromUrl(url: string): string | undefined {
  const parsedUrl = new URL(url, "http://localhost");
  return parsedUrl.searchParams.get("runId") ?? undefined;
}

function getRunSocket(value: unknown): RunSocket {
  if (
    typeof value === "object" &&
    value !== null &&
    "socket" in value &&
    typeof (value as { socket?: unknown }).socket === "object"
  ) {
    return (value as { socket: RunSocket }).socket;
  }

  return value as RunSocket;
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
