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
export const DEFAULT_OPENCLAW_BASE_URL = "http://localhost:18789";
export const DEFAULT_OPENCLAW_HEALTH_PATH = "/health";
export const OPENCLAW_ENDPOINT_ENV = "CLAWFLOW_OPENCLAW_ENDPOINT";
export const OPENCLAW_BASE_URL_ENV = "OPENCLAW_BASE_URL";
export const OPENCLAW_HEALTH_PATH_ENV = "OPENCLAW_HEALTH_PATH";
export const OPENCLAW_HEALTH_TIMEOUT_ENV = "CLAWFLOW_OPENCLAW_HEALTH_TIMEOUT_MS";
const DEFAULT_HEALTH_TIMEOUT_MS = 1_500;

export interface OpenClawEnvironment {
  readonly OPENCLAW_BASE_URL?: string;
  readonly OPENCLAW_HEALTH_PATH?: string;
  readonly CLAWFLOW_OPENCLAW_ENDPOINT?: string;
  readonly CLAWFLOW_OPENCLAW_HEALTH_TIMEOUT_MS?: string;
}

export interface OpenClawAdapterOptions {
  id?: string;
  baseUrl?: string;
  healthPath?: string;
  endpoint?: string;
  healthTimeoutMs?: number;
  env?: OpenClawEnvironment;
}

export type OpenClawEventHandler = (event: unknown) => void;

export interface OpenClawAdapterConfig {
  endpoint: string;
  endpointConfigured: boolean;
  endpointSource: "options" | "environment" | "default";
  baseUrl: string;
  healthPath: string;
  healthUrl: string;
  healthMode: "http" | "websocket";
  healthSource: "options" | "environment" | "default" | "legacy";
  healthTimeoutMs: number;
  message: string;
}

export class OpenClawAdapter {
  readonly id: string;
  readonly type: Extract<RuntimeType, "openclaw"> = "openclaw";
  readonly endpoint: string;
  readonly healthEndpoint: string;
  readonly config: OpenClawAdapterConfig;
  private readonly healthTimeoutMs: number;
  private socket: WebSocket | null = null;
  private readonly eventHandlers = new Set<OpenClawEventHandler>();

  constructor(options: OpenClawAdapterOptions = {}) {
    const config = createOpenClawAdapterConfig(options);

    this.id = options.id ?? "openclaw-local";
    this.config = config;
    this.endpoint = config.endpoint;
    this.healthEndpoint = config.healthMode === "http" ? config.healthUrl : config.endpoint;
    this.healthTimeoutMs = config.healthTimeoutMs;
  }

  get isConfigured(): boolean {
    return this.config.healthMode === "http" || this.config.endpointConfigured;
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

    if (this.config.healthMode === "http") {
      return this.healthHttp(startedAt);
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
          "OpenClaw endpoint is reachable. Clawflow Studio still blocks real Agent and Tool execution in Phase 6I."
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

  private async healthHttp(startedAt: number): Promise<RuntimeHealth> {
    let healthUrl: URL;

    try {
      healthUrl = validateHttpHealthUrl(this.config.healthUrl);
    } catch (error: unknown) {
      return {
        runtimeId: this.id,
        status: "error",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        message: formatHealthError(error)
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.healthTimeoutMs);

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal
      });

      if (response.ok) {
        return {
          runtimeId: this.id,
          status: "online",
          checkedAt: new Date().toISOString(),
          latencyMs: Date.now() - startedAt,
          message:
            "OpenClaw local health endpoint is reachable. Clawflow Studio still blocks real Agent and Tool execution in Phase 6I."
        };
      }

      return {
        runtimeId: this.id,
        status: "offline",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        message: `OpenClaw local health endpoint returned HTTP ${response.status}: ${healthUrl.toString()}`
      };
    } catch (error: unknown) {
      return {
        runtimeId: this.id,
        status: isAbortError(error) ? "offline" : "offline",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        message: isAbortError(error)
          ? `OpenClaw local health check timed out after ${this.healthTimeoutMs}ms: ${healthUrl.toString()}`
          : `OpenClaw local health endpoint is offline or unreachable: ${healthUrl.toString()}`
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async listCapabilities(): Promise<RuntimeCapability[]> {
    return createOpenClawCapabilities();
  }

  async invokeAgent(_input: AgentInvokeInput): Promise<AgentInvokeResult> {
    throw new Error("OpenClaw Agent invocation is protected and not enabled in Phase 6I.");
  }

  async invokeTool(_input: ToolInvokeInput): Promise<ToolInvokeResult> {
    throw new Error("OpenClaw Tool invocation is protected and not enabled in Phase 6I.");
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
  reason: "OpenClaw health probing is available; Agent and Tool execution are blocked in Phase 6I."
} as const;

export function createOpenClawCapabilities(): RuntimeCapability[] {
  return [
    {
      id: "agent.chat",
      name: "Agent Chat",
      kind: "agent",
      executionMode: "protected",
      description: "OpenClaw agent chat placeholder. Real execution blocked in Phase 6I.",
      riskLevel: "low"
    },
    {
      id: "tool.call",
      name: "Tool Call",
      kind: "tool",
      executionMode: "protected",
      description: "OpenClaw tool call placeholder. Real execution blocked in Phase 6I.",
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
      description: "OpenClaw canvas visibility placeholder. Dynamic discovery blocked in Phase 6I.",
      riskLevel: "low"
    },
    {
      id: "browser.control",
      name: "Browser Control",
      kind: "tool",
      executionMode: "protected",
      description: "OpenClaw browser control placeholder. Real execution blocked in Phase 6I.",
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
  const optionBaseUrl = normalizeEnvString(options.baseUrl);
  const envBaseUrl = normalizeEnvString(env.OPENCLAW_BASE_URL);
  const optionHealthPath = normalizeEnvString(options.healthPath);
  const envHealthPath = normalizeEnvString(env.OPENCLAW_HEALTH_PATH);
  const optionEndpoint = normalizeEnvString(options.endpoint);
  const envEndpoint = normalizeEnvString(env.CLAWFLOW_OPENCLAW_ENDPOINT);
  const endpoint = optionEndpoint ?? envEndpoint ?? DEFAULT_OPENCLAW_ENDPOINT;
  const endpointConfigured = optionEndpoint !== undefined || envEndpoint !== undefined;
  const endpointSource =
    optionEndpoint !== undefined ? "options" : envEndpoint !== undefined ? "environment" : "default";
  const shouldUseLegacyWebSocketHealth =
    optionBaseUrl === undefined &&
    envBaseUrl === undefined &&
    (optionEndpoint !== undefined || envEndpoint !== undefined);
  const baseUrl = optionBaseUrl ?? envBaseUrl ?? DEFAULT_OPENCLAW_BASE_URL;
  const healthPath = normalizeHealthPath(optionHealthPath ?? envHealthPath ?? DEFAULT_OPENCLAW_HEALTH_PATH);
  const healthSource =
    optionBaseUrl !== undefined
      ? "options"
      : envBaseUrl !== undefined
        ? "environment"
        : shouldUseLegacyWebSocketHealth
          ? "legacy"
          : "default";
  const healthMode = shouldUseLegacyWebSocketHealth ? "websocket" : "http";
  const healthUrl = createHttpHealthUrl(baseUrl, healthPath);
  const healthTimeoutMs =
    normalizePositiveInteger(options.healthTimeoutMs) ??
    parsePositiveInteger(env.CLAWFLOW_OPENCLAW_HEALTH_TIMEOUT_MS) ??
    DEFAULT_HEALTH_TIMEOUT_MS;
  const message =
    healthMode === "http"
      ? `OpenClaw local health probe uses ${healthUrl}. Set ${OPENCLAW_BASE_URL_ENV} and ${OPENCLAW_HEALTH_PATH_ENV} to change it. Real execution remains protected.`
      : `OpenClaw legacy WebSocket endpoint configured from ${endpointSource}. Run Health Check to verify reachability. Real execution remains protected.`;

  return {
    endpoint,
    endpointConfigured,
    endpointSource,
    baseUrl,
    healthPath,
    healthUrl,
    healthMode,
    healthSource,
    healthTimeoutMs,
    message
  };
}

function readOpenClawEnvironment(): OpenClawEnvironment {
  const processLike = globalThis as {
    process?: {
      env?: {
        OPENCLAW_BASE_URL?: string;
        OPENCLAW_HEALTH_PATH?: string;
        CLAWFLOW_OPENCLAW_ENDPOINT?: string;
        CLAWFLOW_OPENCLAW_HEALTH_TIMEOUT_MS?: string;
      };
    };
  };

  return {
    OPENCLAW_BASE_URL: processLike.process?.env?.OPENCLAW_BASE_URL,
    OPENCLAW_HEALTH_PATH: processLike.process?.env?.OPENCLAW_HEALTH_PATH,
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

function normalizeHealthPath(value: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue === "") {
    return DEFAULT_OPENCLAW_HEALTH_PATH;
  }

  return trimmedValue.startsWith("/") ? trimmedValue : `/${trimmedValue}`;
}

function createHttpHealthUrl(baseUrl: string, healthPath: string): string {
  try {
    const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const normalizedPath = healthPath.startsWith("/") ? healthPath.slice(1) : healthPath;
    return new URL(normalizedPath, normalizedBaseUrl).toString();
  } catch {
    return `${baseUrl}${healthPath}`;
  }
}

function validateHttpHealthUrl(healthUrl: string): URL {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(healthUrl);
  } catch (error: unknown) {
    throw new OpenClawEndpointError(
      "invalid",
      `OpenClaw health URL is invalid: ${readErrorMessage(error)}`
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new OpenClawEndpointError(
      "invalid",
      `OpenClaw health URL must use http:// or https://: ${healthUrl}`
    );
  }

  return parsedUrl;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
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
