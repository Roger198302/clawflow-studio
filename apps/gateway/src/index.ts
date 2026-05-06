import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { MockRuntimeAdapter } from "@clawflow/adapter-mock";
import { FlowEngine } from "@clawflow/flow-engine";
import type { FlowSpec, RunEvent, RunStatus } from "@clawflow/protocol";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import { pathToFileURL } from "node:url";

const DEFAULT_PORT = 8787;
const VERSION = "0.1.0";
const PROTOCOL_VERSION = "0.1";
const SOCKET_OPEN = 1;

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

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
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
  status: RunStatus;
  events: RunEvent[];
  clients: Set<RunSocket>;
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

  await server.register(cors, {
    origin: true
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

  server.post<{ Body: unknown; Reply: CreateRunResponse | ErrorResponse }>(
    "/api/runs",
    async (request, reply) => {
      if (!isFlowSpec(request.body)) {
        return sendError(reply, 400, "invalid_flow_spec", "Request body must be a FlowSpec.");
      }

      const flow = request.body;
      const validation = engine.validate(flow);

      if (!validation.ok) {
        return sendError(
          reply,
          400,
          "invalid_flow_graph",
          validation.issues[0]?.message ?? "Invalid flow graph."
        );
      }

      const runId = createId("run");
      runs.set(runId, {
        runId,
        flowId: flow.id,
        status: "queued",
        events: [],
        clients: new Set()
      });

      setTimeout(() => {
        void engine
          .execute(flow, adapter, {
            runId,
            initialInput: {
              userInput: "Run requested from ClawFlow Studio WebUI."
            },
            onEvent: (event) => {
              publishRunEvent(runs, event);
            }
          })
          .then((result) => {
            const storedRun = runs.get(runId);

            if (storedRun !== undefined) {
              storedRun.status = result.status;
            }
          })
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : "Unexpected mock flow execution error.";

            publishRunEvent(runs, {
              id: createId("event"),
              runId,
              flowId: flow.id,
              sequence: (runs.get(runId)?.events.length ?? 0) + 1,
              timestamp: new Date().toISOString(),
              type: "run.failed",
              status: "failed",
              message,
              payload: {
                error: message
              }
            });
          });
      }, 0);

      return {
        runId,
        status: "queued",
        wsUrl: `/ws/runs?runId=${encodeURIComponent(runId)}`
      };
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

async function main(): Promise<void> {
  const server = await createServer();
  const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);

  await server.listen({
    host: "0.0.0.0",
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
