import type {
  AgentInvokeInput,
  AgentInvokeResult,
  RuntimeCapability,
  RuntimeHealth,
  RuntimeType,
  ToolInvokeInput,
  ToolInvokeResult
} from "@clawflow/protocol";

export const DEFAULT_OPENCLAW_ENDPOINT = "ws://127.0.0.1:18789";
export const OPENCLAW_ENDPOINT_ENV = "CLAWFLOW_OPENCLAW_ENDPOINT";
export const OPENCLAW_HEALTH_TIMEOUT_ENV = "CLAWFLOW_OPENCLAW_HEALTH_TIMEOUT_MS";
const DEFAULT_HEALTH_TIMEOUT_MS = 1_500;

export interface OpenClawEnvironment {
  readonly CLAWFLOW_OPENCLAW_ENDPOINT?: string;
  readonly CLAWFLOW_OPENCLAW_HEALTH_TIMEOUT_MS?: string;
}

export interface OpenClawAdapterOptions {
  id?: string;
  endpoint?: string;
  healthTimeoutMs?: number;
  env?: OpenClawEnvironment;
}

export type OpenClawEventHandler = (event: unknown) => void;

export interface OpenClawAdapterConfig {
  endpoint: string;
  endpointConfigured: boolean;
  endpointSource: "options" | "environment" | "default";
  healthTimeoutMs: number;
  message: string;
}

export class OpenClawAdapter {
  readonly id: string;
  readonly type: Extract<RuntimeType, "openclaw"> = "openclaw";
  readonly endpoint: string;
  readonly config: OpenClawAdapterConfig;
  private readonly healthTimeoutMs: number;
  private socket: WebSocket | null = null;
  private readonly eventHandlers = new Set<OpenClawEventHandler>();

  constructor(options: OpenClawAdapterOptions = {}) {
    const config = createOpenClawAdapterConfig(options);

    this.id = options.id ?? "openclaw-local";
    this.config = config;
    this.endpoint = config.endpoint;
    this.healthTimeoutMs = config.healthTimeoutMs;
  }

  get isConfigured(): boolean {
    return this.config.endpointConfigured;
  }

  async connect(): Promise<void> {
    await this.disconnect();
    this.socket = await this.openSocket();
    this.socket.addEventListener("message", this.handleSocketMessage);
  }

  async disconnect(): Promise<void> {
    if (this.socket === null) {
      return;
    }

    const socket = this.socket;
    this.socket = null;
    socket.removeEventListener("message", this.handleSocketMessage);

    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  }

  async health(): Promise<RuntimeHealth> {
    const startedAt = Date.now();

    if (!this.config.endpointConfigured) {
      return {
        runtimeId: this.id,
        status: "unknown",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        message: this.config.message
      };
    }

    try {
      const socket = await this.openSocket();
      socket.close();

      return {
        runtimeId: this.id,
        status: "online",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        message:
          "OpenClaw endpoint is reachable. Protocol handshake and Agent execution are not enabled in Phase 5."
      };
    } catch (error: unknown) {
      return {
        runtimeId: this.id,
        status: error instanceof OpenClawEndpointError && error.kind === "invalid" ? "error" : "offline",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        message: formatHealthError(error)
      };
    }
  }

  async listCapabilities(): Promise<RuntimeCapability[]> {
    return createOpenClawCapabilities();
  }

  async invokeAgent(_input: AgentInvokeInput): Promise<AgentInvokeResult> {
    throw new Error("OpenClaw Agent invocation is not implemented in Phase 5.");
  }

  async invokeTool(_input: ToolInvokeInput): Promise<ToolInvokeResult> {
    throw new Error("OpenClaw Tool invocation is not implemented in Phase 5.");
  }

  subscribeEvents(handler: OpenClawEventHandler): () => void {
    this.eventHandlers.add(handler);

    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  private async openSocket(): Promise<WebSocket> {
    validateWebSocketEndpoint(this.endpoint);

    let socket: WebSocket;

    try {
      socket = new WebSocket(this.endpoint);
    } catch (error: unknown) {
      throw new OpenClawEndpointError(
        "invalid",
        `OpenClaw endpoint is invalid: ${readErrorMessage(error)}`
      );
    }

    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = (): void => {
        socket.removeEventListener("open", handleOpen);
        socket.removeEventListener("error", handleError);
        socket.removeEventListener("close", handleClose);
        clearTimeout(timeout);
      };

      const settle = (callback: () => void): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        callback();
      };

      const handleOpen = (): void => {
        settle(() => {
          resolve(socket);
        });
      };

      const handleError = (): void => {
        settle(() => {
          reject(createUnreachableEndpointError(this.endpoint));
        });
      };

      const handleClose = (): void => {
        settle(() => {
          reject(
            new OpenClawEndpointError(
              "unreachable",
              `OpenClaw endpoint closed before a connection was established: ${this.endpoint}`
            )
          );
        });
      };

      const timeout = setTimeout(() => {
        settle(() => {
          if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
            socket.close();
          }

          reject(
            new OpenClawEndpointError(
              "timeout",
              `OpenClaw endpoint health check timed out after ${this.healthTimeoutMs}ms: ${this.endpoint}`
            )
          );
        });
      }, this.healthTimeoutMs);

      socket.addEventListener("open", handleOpen);
      socket.addEventListener("error", handleError);
      socket.addEventListener("close", handleClose);
    });
  }

  private readonly handleSocketMessage = (event: MessageEvent): void => {
    for (const handler of this.eventHandlers) {
      handler(event.data);
    }
  };
}

export const openClawAdapterStatus = {
  runtimeType: "openclaw",
  status: "skeleton",
  reason: "OpenClaw health probing is available; Agent and Tool execution are disabled in Phase 5."
} as const;

export function createOpenClawCapabilities(): RuntimeCapability[] {
  return [
    {
      id: "agent.chat",
      name: "Agent Chat",
      kind: "agent",
      executionMode: "protected",
      description: "OpenClaw agent chat placeholder. Execution disabled in Phase 5.",
      riskLevel: "low"
    },
    {
      id: "tool.call",
      name: "Tool Call",
      kind: "tool",
      executionMode: "protected",
      description: "OpenClaw tool call placeholder. Execution disabled in Phase 5.",
      riskLevel: "medium"
    },
    {
      id: "gateway.events",
      name: "Gateway Events",
      kind: "control",
      executionMode: "protected",
      description: "OpenClaw gateway event stream placeholder.",
      riskLevel: "low"
    },
    {
      id: "canvas.view",
      name: "Canvas View",
      kind: "control",
      executionMode: "protected",
      description: "OpenClaw canvas visibility placeholder. Dynamic discovery disabled in Phase 5.",
      riskLevel: "low"
    },
    {
      id: "browser.control",
      name: "Browser Control",
      kind: "tool",
      executionMode: "protected",
      description: "OpenClaw browser control placeholder. Execution disabled in Phase 5.",
      riskLevel: "high"
    }
  ];
}

class OpenClawEndpointError extends Error {
  constructor(
    readonly kind: "invalid" | "timeout" | "unreachable",
    message: string
  ) {
    super(message);
    this.name = "OpenClawEndpointError";
  }
}

function formatHealthError(error: unknown): string {
  if (error instanceof OpenClawEndpointError) {
    return error.message;
  }

  return `OpenClaw endpoint health check failed: ${readErrorMessage(error)}`;
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}

export function createOpenClawAdapterConfig(options: OpenClawAdapterOptions): OpenClawAdapterConfig {
  const env = options.env ?? readOpenClawEnvironment();
  const optionEndpoint = normalizeEnvString(options.endpoint);
  const envEndpoint = normalizeEnvString(env.CLAWFLOW_OPENCLAW_ENDPOINT);
  const endpoint = optionEndpoint ?? envEndpoint ?? DEFAULT_OPENCLAW_ENDPOINT;
  const endpointConfigured = optionEndpoint !== undefined || envEndpoint !== undefined;
  const endpointSource =
    optionEndpoint !== undefined ? "options" : envEndpoint !== undefined ? "environment" : "default";
  const healthTimeoutMs =
    normalizePositiveInteger(options.healthTimeoutMs) ??
    parsePositiveInteger(env.CLAWFLOW_OPENCLAW_HEALTH_TIMEOUT_MS) ??
    DEFAULT_HEALTH_TIMEOUT_MS;
  const message = endpointConfigured
    ? `OpenClaw endpoint configured from ${endpointSource}. Run Health Check to verify reachability.`
    : `OpenClaw endpoint is not configured. Set ${OPENCLAW_ENDPOINT_ENV} to enable OpenClaw health checks. Default endpoint: ${DEFAULT_OPENCLAW_ENDPOINT}.`;

  return {
    endpoint,
    endpointConfigured,
    endpointSource,
    healthTimeoutMs,
    message
  };
}

function readOpenClawEnvironment(): OpenClawEnvironment {
  const processLike = globalThis as {
    process?: {
      env?: {
        CLAWFLOW_OPENCLAW_ENDPOINT?: string;
        CLAWFLOW_OPENCLAW_HEALTH_TIMEOUT_MS?: string;
      };
    };
  };

  return {
    CLAWFLOW_OPENCLAW_ENDPOINT: processLike.process?.env?.CLAWFLOW_OPENCLAW_ENDPOINT,
    CLAWFLOW_OPENCLAW_HEALTH_TIMEOUT_MS:
      processLike.process?.env?.CLAWFLOW_OPENCLAW_HEALTH_TIMEOUT_MS
  };
}

function normalizeEnvString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue === "" ? undefined : trimmedValue;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  const normalizedValue = normalizeEnvString(value);

  if (normalizedValue === undefined) {
    return undefined;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);

  return normalizePositiveInteger(parsedValue);
}

function normalizePositiveInteger(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.floor(value);
}

function validateWebSocketEndpoint(endpoint: string): void {
  let parsedEndpoint: URL;

  try {
    parsedEndpoint = new URL(endpoint);
  } catch (error: unknown) {
    throw new OpenClawEndpointError(
      "invalid",
      `OpenClaw endpoint is invalid: ${readErrorMessage(error)}`
    );
  }

  if (parsedEndpoint.protocol !== "ws:" && parsedEndpoint.protocol !== "wss:") {
    throw new OpenClawEndpointError(
      "invalid",
      `OpenClaw endpoint must use ws:// or wss://: ${endpoint}`
    );
  }
}

function createUnreachableEndpointError(endpoint: string): OpenClawEndpointError {
  return new OpenClawEndpointError(
    "unreachable",
    `OpenClaw endpoint is offline or unreachable: ${endpoint}`
  );
}
