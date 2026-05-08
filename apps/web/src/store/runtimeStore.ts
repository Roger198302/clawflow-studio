import type { RuntimeHealth, RuntimeSpec } from "@clawflow/protocol";
import { create } from "zustand";

const GATEWAY_HTTP_URL = import.meta.env.VITE_GATEWAY_HTTP_URL ?? "http://localhost:8787";

type RuntimeLoadStatus = "idle" | "loading" | "success" | "error";

interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

export interface RuntimeStoreState {
  runtimes: RuntimeSpec[];
  runtimeHealth: Record<string, RuntimeHealth>;
  runtimeLoadStatus: RuntimeLoadStatus;
  runtimeError: string | null;
  isRuntimeManagerOpen: boolean;
  openRuntimeManager: () => void;
  closeRuntimeManager: () => void;
  toggleRuntimeManager: () => void;
  loadRuntimes: () => Promise<RuntimeSpec[]>;
  healthCheckAll: () => Promise<RuntimeHealth[]>;
}

export const useRuntimeStore = create<RuntimeStoreState>((set, get) => ({
  runtimes: [],
  runtimeHealth: {},
  runtimeLoadStatus: "idle",
  runtimeError: null,
  isRuntimeManagerOpen: false,
  openRuntimeManager: () => {
    set({ isRuntimeManagerOpen: true });
  },
  closeRuntimeManager: () => {
    set({ isRuntimeManagerOpen: false });
  },
  toggleRuntimeManager: () => {
    set((state) => ({ isRuntimeManagerOpen: !state.isRuntimeManagerOpen }));
  },
  loadRuntimes: async () => {
    set({ runtimeLoadStatus: "loading", runtimeError: null });

    try {
      const response = await fetch(`${GATEWAY_HTTP_URL}/api/runtimes`);
      const body = (await response.json().catch(() => ({}))) as RuntimeSpec[] | ErrorResponse;

      if (!response.ok) {
        throw new Error(readErrorMessage(body) ?? `Gateway returned HTTP ${response.status}.`);
      }

      if (!Array.isArray(body)) {
        throw new Error("Gateway returned an invalid Runtime registry response.");
      }

      set({
        runtimes: body,
        runtimeHealth: {},
        runtimeLoadStatus: "success",
        runtimeError: null
      });

      return body;
    } catch (error: unknown) {
      const message = createRuntimeGatewayError(error);

      set({
        runtimeLoadStatus: "error",
        runtimeError: message
      });

      return [];
    }
  },
  healthCheckAll: async () => {
    set({ runtimeLoadStatus: "loading", runtimeError: null });

    try {
      const response = await fetch(`${GATEWAY_HTTP_URL}/api/runtimes/health-check`, {
        method: "POST"
      });
      const body = (await response.json().catch(() => ({}))) as RuntimeHealth[] | ErrorResponse;

      if (!response.ok) {
        throw new Error(readErrorMessage(body) ?? `Gateway returned HTTP ${response.status}.`);
      }

      if (!Array.isArray(body)) {
        throw new Error("Gateway returned an invalid Runtime health response.");
      }

      const healthByRuntimeId = Object.fromEntries(body.map((health) => [health.runtimeId, health]));
      const runtimes =
        get().runtimes.length === 0 ? await get().loadRuntimes() : get().runtimes;

      set({
        runtimes: applyHealthToRuntimes(runtimes, healthByRuntimeId),
        runtimeHealth: {
          ...get().runtimeHealth,
          ...healthByRuntimeId
        },
        runtimeLoadStatus: "success",
        runtimeError: null
      });

      return body;
    } catch (error: unknown) {
      const message = createRuntimeGatewayError(error);

      set({
        runtimeLoadStatus: "error",
        runtimeError: message
      });

      return [];
    }
  }
}));

function applyHealthToRuntimes(
  runtimes: RuntimeSpec[],
  healthByRuntimeId: Record<string, RuntimeHealth>
): RuntimeSpec[] {
  return runtimes.map((runtime) => {
    const health = healthByRuntimeId[runtime.id];

    if (health === undefined) {
      return runtime;
    }

    return {
      ...runtime,
      status: health.status,
      lastHealthCheckAt: health.checkedAt,
      errorMessage: health.status === "online" ? undefined : health.message
    };
  });
}

function readErrorMessage(value: RuntimeSpec[] | RuntimeHealth[] | ErrorResponse): string | undefined {
  if (Array.isArray(value)) {
    return undefined;
  }

  return value.error?.message;
}

function createRuntimeGatewayError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : "Unable to connect to the gateway.";
  const isFetchFailure = rawMessage === "Failed to fetch" || rawMessage.includes("fetch");

  if (isFetchFailure) {
    return `Gateway unavailable: unable to load Runtime registry from ${GATEWAY_HTTP_URL}. Please make sure pnpm dev:gateway is running.`;
  }

  return `Runtime registry unavailable: ${rawMessage}`;
}
