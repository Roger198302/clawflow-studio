import type { RuntimeHealth, RuntimeSpec } from "@clawflow/protocol";
import { create } from "zustand";

const GATEWAY_HTTP_URL = import.meta.env.VITE_GATEWAY_HTTP_URL ?? "http://localhost:8787";
const LOCAL_GATEWAY_CONNECTION_STORAGE_KEY = "clawflow.localGatewayConnection";
const GATEWAY_PROFILES_STORAGE_KEY = "clawflow.gatewayProfiles";
const AGENT_GATEWAY_BINDINGS_STORAGE_KEY = "clawflow.agentGatewayBindings";
const DEFAULT_LOCAL_GATEWAY_BASE_URL = "http://localhost:25311";
const DEFAULT_LOCAL_GATEWAY_HEALTH_PATH = "/health";
export const DEFAULT_GATEWAY_PROFILE_ID = "openclaw-local";

type RuntimeLoadStatus = "idle" | "loading" | "success" | "error";
export type LocalGatewayConnectionStatus =
  | "idle"
  | "checking"
  | "connected"
  | "unavailable"
  | "protected";

export interface LocalGatewayConnection {
  baseUrl: string;
  healthPath: string;
  healthUrl?: string;
  status: LocalGatewayConnectionStatus;
  message?: string;
  checkedAt?: string;
}

export interface LocalGatewayProbeInput {
  baseUrl: string;
  healthPath: string;
}

export interface GatewayProfile {
  id: string;
  name: string;
  kind: "openclaw";
  baseUrl: string;
  healthPath: string;
  healthUrl?: string;
  status: LocalGatewayConnectionStatus;
  protected: true;
  lastCheckedAt?: string;
  lastError?: string;
}

export type AgentGatewayBindingMode = "workspace-default" | "profile";

export interface AgentGatewayBinding {
  mode: AgentGatewayBindingMode;
  profileId?: string;
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
  localGatewayConnection: LocalGatewayConnection;
  gatewayProfiles: GatewayProfile[];
  agentGatewayBindings: Record<string, AgentGatewayBinding>;
  openRuntimeManager: () => void;
  closeRuntimeManager: () => void;
  toggleRuntimeManager: () => void;
  loadRuntimes: () => Promise<RuntimeSpec[]>;
  healthCheckAll: () => Promise<RuntimeHealth[]>;
  quickConnectOpenClaw: (input: LocalGatewayProbeInput) => Promise<OpenClawLocalProbeResponse | null>;
  clearLocalGatewayConnection: () => void;
  addGatewayProfile: () => string;
  updateGatewayProfile: (profileId: string, patch: Partial<Pick<GatewayProfile, "name" | "baseUrl" | "healthPath">>) => void;
  deleteGatewayProfile: (profileId: string) => void;
  checkGatewayProfile: (profileId: string) => Promise<GatewayProfile | null>;
  setAgentGatewayBinding: (nodeId: string, binding: AgentGatewayBinding) => void;
  clearAgentGatewayBindings: () => void;
}

export const useRuntimeStore = create<RuntimeStoreState>((set, get) => ({
  runtimes: [],
  runtimeHealth: {},
  runtimeLoadStatus: "idle",
  runtimeError: null,
  isRuntimeManagerOpen: false,
  localGatewayConnection: loadStoredLocalGatewayConnection(),
  gatewayProfiles: loadStoredGatewayProfiles(),
  agentGatewayBindings: loadStoredAgentGatewayBindings(),
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
        runtimes: applyLocalGatewayConnectionToRuntimes(body, get().localGatewayConnection),
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
      const localGatewayConnection = get().localGatewayConnection;

      if (localGatewayConnection.status !== "idle" && localGatewayConnection.status !== "checking") {
        const probeResponse = await probeOpenClawLocalGateway(localGatewayConnection).catch(() => null);

        if (probeResponse !== null) {
          healthByRuntimeId[probeResponse.health.runtimeId] = probeResponse.health;
          const nextConnection = createLocalGatewayConnectionFromProbe(probeResponse);
          const nextProfiles = syncDefaultGatewayProfile(get().gatewayProfiles, nextConnection);
          storeLocalGatewayConnection(nextConnection);
          storeGatewayProfiles(nextProfiles);
          set({ localGatewayConnection: nextConnection, gatewayProfiles: nextProfiles });
        }
      }

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
  },
  quickConnectOpenClaw: async (input) => {
    const checkingConnection: LocalGatewayConnection = {
      baseUrl: input.baseUrl.trim(),
      healthPath: input.healthPath.trim(),
      status: "checking"
    };

    set({
      localGatewayConnection: checkingConnection,
      runtimeLoadStatus: "loading",
      runtimeError: null
    });

    try {
      const probeResponse = await probeOpenClawLocalGateway(checkingConnection);
      const nextConnection = createLocalGatewayConnectionFromProbe(probeResponse);
      const nextRuntimeHealth = {
        ...get().runtimeHealth,
        [probeResponse.health.runtimeId]: probeResponse.health
      };
      const runtimes =
        get().runtimes.length === 0 ? await get().loadRuntimes() : get().runtimes;
      const nextProfiles = syncDefaultGatewayProfile(get().gatewayProfiles, nextConnection);

      storeLocalGatewayConnection(nextConnection);
      storeGatewayProfiles(nextProfiles);
      set({
        runtimes: applyHealthToRuntimes(
          applyLocalGatewayConnectionToRuntimes(runtimes, nextConnection),
          nextRuntimeHealth
        ),
        runtimeHealth: nextRuntimeHealth,
        localGatewayConnection: nextConnection,
        gatewayProfiles: nextProfiles,
        runtimeLoadStatus: "success",
        runtimeError: null
      });

      return probeResponse;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid local gateway URL.";
      const checkedAt = new Date().toISOString();
      const health: RuntimeHealth = {
        runtimeId: "openclaw-local",
        status: "error",
        checkedAt,
        message
      };
      const nextConnection: LocalGatewayConnection = {
        baseUrl: checkingConnection.baseUrl || DEFAULT_LOCAL_GATEWAY_BASE_URL,
        healthPath: checkingConnection.healthPath || DEFAULT_LOCAL_GATEWAY_HEALTH_PATH,
        status: "unavailable",
        message
      };
      const nextRuntimeHealth = {
        ...get().runtimeHealth,
        [health.runtimeId]: health
      };
      const nextProfiles = syncDefaultGatewayProfile(get().gatewayProfiles, nextConnection);

      storeLocalGatewayConnection(nextConnection);
      storeGatewayProfiles(nextProfiles);

      set({
        runtimes: applyHealthToRuntimes(get().runtimes, nextRuntimeHealth),
        runtimeHealth: nextRuntimeHealth,
        localGatewayConnection: nextConnection,
        gatewayProfiles: nextProfiles,
        runtimeLoadStatus: "success",
        runtimeError: null
      });

      return null;
    }
  },
  clearLocalGatewayConnection: () => {
    const nextConnection = createDefaultLocalGatewayConnection();
    const nextProfiles = syncDefaultGatewayProfile(get().gatewayProfiles, nextConnection);
    localStorage.removeItem(LOCAL_GATEWAY_CONNECTION_STORAGE_KEY);
    storeGatewayProfiles(nextProfiles);
    set({
      localGatewayConnection: nextConnection,
      gatewayProfiles: nextProfiles,
      runtimeHealth: removeRuntimeHealth(get().runtimeHealth, "openclaw-local"),
      runtimes: resetOpenClawRuntimeConnection(get().runtimes)
    });
  },
  addGatewayProfile: () => {
    const currentProfiles = ensureDefaultGatewayProfile(get().gatewayProfiles);
    const id = createGatewayProfileId(currentProfiles);
    const nextProfile: GatewayProfile = {
      id,
      name: `OpenClaw Local ${currentProfiles.length + 1}`,
      kind: "openclaw",
      baseUrl: DEFAULT_LOCAL_GATEWAY_BASE_URL,
      healthPath: DEFAULT_LOCAL_GATEWAY_HEALTH_PATH,
      status: "idle",
      protected: true
    };
    const nextProfiles = [...currentProfiles, nextProfile];

    storeGatewayProfiles(nextProfiles);
    set({ gatewayProfiles: nextProfiles });

    return id;
  },
  updateGatewayProfile: (profileId, patch) => {
    const nextProfiles: GatewayProfile[] = get().gatewayProfiles.map((profile) => {
      if (profile.id !== profileId) {
        return profile;
      }

      return {
        ...profile,
        ...patch,
        status: "idle" as const,
        healthUrl: undefined,
        lastCheckedAt: undefined,
        lastError: undefined
      };
    });

    storeGatewayProfiles(nextProfiles);
    set({ gatewayProfiles: nextProfiles });
  },
  deleteGatewayProfile: (profileId) => {
    if (profileId === DEFAULT_GATEWAY_PROFILE_ID) {
      return;
    }

    const nextProfiles = ensureDefaultGatewayProfile(
      get().gatewayProfiles.filter((profile) => profile.id !== profileId)
    );
    const nextBindings = Object.fromEntries(
      Object.entries(get().agentGatewayBindings).filter(
        ([, binding]) => binding.mode !== "profile" || binding.profileId !== profileId
      )
    );

    storeGatewayProfiles(nextProfiles);
    storeAgentGatewayBindings(nextBindings);
    set({
      gatewayProfiles: nextProfiles,
      agentGatewayBindings: nextBindings
    });
  },
  checkGatewayProfile: async (profileId) => {
    const profile = get().gatewayProfiles.find((candidate) => candidate.id === profileId);

    if (profile === undefined) {
      return null;
    }

    const checkingProfiles = get().gatewayProfiles.map((candidate) =>
      candidate.id === profileId ? { ...candidate, status: "checking" as const } : candidate
    );
    set({ gatewayProfiles: checkingProfiles });

    try {
      const probeResponse = await probeOpenClawLocalGateway(profile);
      const nextProfile = createGatewayProfileFromProbe(profile, probeResponse);
      const nextProfiles = get().gatewayProfiles.map((candidate) =>
        candidate.id === profileId ? nextProfile : candidate
      );

      storeGatewayProfiles(nextProfiles);
      set({ gatewayProfiles: nextProfiles });

      return nextProfile;
    } catch (error: unknown) {
      const nextProfile: GatewayProfile = {
        ...profile,
        status: "unavailable",
        lastCheckedAt: new Date().toISOString(),
        lastError: error instanceof Error ? error.message : "Gateway profile probe failed."
      };
      const nextProfiles = get().gatewayProfiles.map((candidate) =>
        candidate.id === profileId ? nextProfile : candidate
      );

      storeGatewayProfiles(nextProfiles);
      set({ gatewayProfiles: nextProfiles });

      return nextProfile;
    }
  },
  setAgentGatewayBinding: (nodeId, binding) => {
    const nextBindings = {
      ...get().agentGatewayBindings,
      [nodeId]: normalizeAgentGatewayBinding(binding)
    };

    if (nextBindings[nodeId].mode === "workspace-default") {
      delete nextBindings[nodeId];
    }

    storeAgentGatewayBindings(nextBindings);
    set({ agentGatewayBindings: nextBindings });
  },
  clearAgentGatewayBindings: () => {
    localStorage.removeItem(AGENT_GATEWAY_BINDINGS_STORAGE_KEY);
    set({ agentGatewayBindings: {} });
  }
}));

async function probeOpenClawLocalGateway(
  connection: Pick<LocalGatewayConnection, "baseUrl" | "healthPath">
): Promise<OpenClawLocalProbeResponse> {
  const response = await fetch(`${GATEWAY_HTTP_URL}/api/runtimes/openclaw-local/probe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      baseUrl: connection.baseUrl,
      healthPath: connection.healthPath
    })
  });
  const body = (await response.json().catch(() => ({}))) as OpenClawLocalProbeResponse | ErrorResponse;

  if (!response.ok) {
    throw new Error(readErrorMessage(body) ?? `Gateway returned HTTP ${response.status}.`);
  }

  if (!isOpenClawLocalProbeResponse(body)) {
    throw new Error("Gateway returned an invalid OpenClaw probe response.");
  }

  return body;
}

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

function applyLocalGatewayConnectionToRuntimes(
  runtimes: RuntimeSpec[],
  connection: LocalGatewayConnection
): RuntimeSpec[] {
  if (connection.status === "idle" || connection.status === "checking") {
    return runtimes;
  }

  return runtimes.map((runtime) => {
    if (runtime.id !== "openclaw-local") {
      return runtime;
    }

    return {
      ...runtime,
      endpoint: connection.healthUrl ?? runtime.endpoint,
      status: connection.status === "connected" ? "online" : "offline",
      lastHealthCheckAt: connection.checkedAt ?? runtime.lastHealthCheckAt,
      errorMessage: connection.status === "connected" ? undefined : connection.message
    };
  });
}

function resetOpenClawRuntimeConnection(runtimes: RuntimeSpec[]): RuntimeSpec[] {
  return runtimes.map((runtime) => {
    if (runtime.id !== "openclaw-local") {
      return runtime;
    }

    return {
      ...runtime,
      status: "unknown",
      lastHealthCheckAt: undefined,
      errorMessage: undefined
    };
  });
}

function removeRuntimeHealth(
  runtimeHealth: Record<string, RuntimeHealth>,
  runtimeId: string
): Record<string, RuntimeHealth> {
  const nextRuntimeHealth = { ...runtimeHealth };
  delete nextRuntimeHealth[runtimeId];
  return nextRuntimeHealth;
}

function createLocalGatewayConnectionFromProbe(
  response: OpenClawLocalProbeResponse
): LocalGatewayConnection {
  return {
    baseUrl: response.connection.baseUrl,
    healthPath: response.connection.healthPath,
    healthUrl: response.connection.healthUrl,
    status: response.connection.status === "connected" ? "connected" : "unavailable",
    message: response.health.message,
    checkedAt: response.health.checkedAt
  };
}

function createGatewayProfileFromProbe(
  profile: GatewayProfile,
  response: OpenClawLocalProbeResponse
): GatewayProfile {
  return {
    ...profile,
    baseUrl: response.connection.baseUrl,
    healthPath: response.connection.healthPath,
    healthUrl: response.connection.healthUrl,
    status: response.connection.status === "connected" ? "connected" : "unavailable",
    protected: true,
    lastCheckedAt: response.health.checkedAt,
    lastError: response.health.status === "online" ? undefined : response.health.message
  };
}

function syncDefaultGatewayProfile(
  profiles: GatewayProfile[],
  connection: LocalGatewayConnection
): GatewayProfile[] {
  return ensureDefaultGatewayProfile(profiles).map((profile) => {
    if (profile.id !== DEFAULT_GATEWAY_PROFILE_ID) {
      return profile;
    }

    return {
      ...profile,
      baseUrl: connection.baseUrl,
      healthPath: connection.healthPath,
      healthUrl: connection.healthUrl,
      status: connection.status,
      lastCheckedAt: connection.checkedAt,
      lastError: connection.status === "connected" ? undefined : connection.message
    };
  });
}

function readErrorMessage(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return undefined;
  }

  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  return (value as ErrorResponse).error?.message;
}

function isOpenClawLocalProbeResponse(value: unknown): value is OpenClawLocalProbeResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<OpenClawLocalProbeResponse>;

  return (
    candidate.runtimeId === "openclaw-local" &&
    typeof candidate.health === "object" &&
    candidate.health !== null &&
    typeof candidate.connection === "object" &&
    candidate.connection !== null
  );
}

function createDefaultLocalGatewayConnection(): LocalGatewayConnection {
  return {
    baseUrl: DEFAULT_LOCAL_GATEWAY_BASE_URL,
    healthPath: DEFAULT_LOCAL_GATEWAY_HEALTH_PATH,
    status: "idle"
  };
}

function loadStoredLocalGatewayConnection(): LocalGatewayConnection {
  try {
    const rawValue = localStorage.getItem(LOCAL_GATEWAY_CONNECTION_STORAGE_KEY);

    if (rawValue === null) {
      return createDefaultLocalGatewayConnection();
    }

    const parsedValue = JSON.parse(rawValue) as Partial<LocalGatewayConnection>;

    if (
      typeof parsedValue.baseUrl !== "string" ||
      typeof parsedValue.healthPath !== "string" ||
      !isStoredLocalGatewayStatus(parsedValue.status)
    ) {
      return createDefaultLocalGatewayConnection();
    }

    return {
      baseUrl: parsedValue.baseUrl,
      healthPath: parsedValue.healthPath,
      healthUrl: typeof parsedValue.healthUrl === "string" ? parsedValue.healthUrl : undefined,
      status: parsedValue.status,
      message: typeof parsedValue.message === "string" ? parsedValue.message : undefined,
      checkedAt: typeof parsedValue.checkedAt === "string" ? parsedValue.checkedAt : undefined
    };
  } catch {
    return createDefaultLocalGatewayConnection();
  }
}

function loadStoredGatewayProfiles(): GatewayProfile[] {
  try {
    const rawValue = localStorage.getItem(GATEWAY_PROFILES_STORAGE_KEY);

    if (rawValue === null) {
      return createDefaultGatewayProfiles();
    }

    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return createDefaultGatewayProfiles();
    }

    const profiles = parsedValue
      .map((value) => sanitizeGatewayProfile(value as Partial<GatewayProfile>))
      .filter((profile): profile is GatewayProfile => profile !== null);

    return ensureDefaultGatewayProfile(profiles);
  } catch {
    return createDefaultGatewayProfiles();
  }
}

function createDefaultGatewayProfiles(): GatewayProfile[] {
  return [
    {
      id: DEFAULT_GATEWAY_PROFILE_ID,
      name: "OpenClaw Local",
      kind: "openclaw",
      baseUrl: DEFAULT_LOCAL_GATEWAY_BASE_URL,
      healthPath: DEFAULT_LOCAL_GATEWAY_HEALTH_PATH,
      status: "idle",
      protected: true
    }
  ];
}

function ensureDefaultGatewayProfile(profiles: GatewayProfile[]): GatewayProfile[] {
  if (profiles.some((profile) => profile.id === DEFAULT_GATEWAY_PROFILE_ID)) {
    return profiles;
  }

  return [...createDefaultGatewayProfiles(), ...profiles];
}

function createGatewayProfileId(profiles: GatewayProfile[]): string {
  let index = profiles.length + 1;
  let candidateId = `openclaw-local-${index}`;
  const profileIds = new Set(profiles.map((profile) => profile.id));

  while (profileIds.has(candidateId)) {
    index += 1;
    candidateId = `openclaw-local-${index}`;
  }

  return candidateId;
}

function sanitizeGatewayProfile(value: Partial<GatewayProfile>): GatewayProfile | null {
  if (
    typeof value.id !== "string" ||
    value.id.trim() === "" ||
    typeof value.name !== "string" ||
    value.name.trim() === "" ||
    value.kind !== "openclaw" ||
    typeof value.baseUrl !== "string" ||
    typeof value.healthPath !== "string" ||
    !isStoredLocalGatewayStatus(value.status)
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name.trim(),
    kind: "openclaw",
    baseUrl: value.baseUrl.trim(),
    healthPath: value.healthPath.trim(),
    healthUrl: typeof value.healthUrl === "string" ? value.healthUrl : undefined,
    status: value.status,
    protected: true,
    lastCheckedAt: typeof value.lastCheckedAt === "string" ? value.lastCheckedAt : undefined,
    lastError: typeof value.lastError === "string" ? value.lastError : undefined
  };
}

function storeGatewayProfiles(profiles: GatewayProfile[]): void {
  localStorage.setItem(GATEWAY_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
}

function loadStoredAgentGatewayBindings(): Record<string, AgentGatewayBinding> {
  try {
    const rawValue = localStorage.getItem(AGENT_GATEWAY_BINDINGS_STORAGE_KEY);

    if (rawValue === null) {
      return {};
    }

    const parsedValue = JSON.parse(rawValue);

    if (typeof parsedValue !== "object" || parsedValue === null || Array.isArray(parsedValue)) {
      return {};
    }

    const entries: Array<[string, AgentGatewayBinding]> = [];

    for (const [nodeId, binding] of Object.entries(parsedValue)) {
      const normalizedBinding = normalizeAgentGatewayBinding(binding);

      if (normalizedBinding.mode !== "workspace-default") {
        entries.push([nodeId, normalizedBinding]);
      }
    }

    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

function normalizeAgentGatewayBinding(value: unknown): AgentGatewayBinding {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      mode: "workspace-default"
    };
  }

  const candidate = value as Partial<AgentGatewayBinding>;

  if (candidate.mode !== "profile" || typeof candidate.profileId !== "string") {
    return {
      mode: "workspace-default"
    };
  }

  return {
    mode: "profile",
    profileId: candidate.profileId
  };
}

function storeAgentGatewayBindings(bindings: Record<string, AgentGatewayBinding>): void {
  localStorage.setItem(AGENT_GATEWAY_BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
}

function storeLocalGatewayConnection(connection: LocalGatewayConnection): void {
  localStorage.setItem(
    LOCAL_GATEWAY_CONNECTION_STORAGE_KEY,
    JSON.stringify({
      baseUrl: connection.baseUrl,
      healthPath: connection.healthPath,
      healthUrl: connection.healthUrl,
      status: connection.status,
      message: connection.message,
      checkedAt: connection.checkedAt
    })
  );
}

function isStoredLocalGatewayStatus(value: unknown): value is LocalGatewayConnectionStatus {
  return (
    value === "idle" ||
    value === "connected" ||
    value === "unavailable" ||
    value === "protected"
  );
}

function createRuntimeGatewayError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : "Unable to connect to the gateway.";
  const isFetchFailure = rawMessage === "Failed to fetch" || rawMessage.includes("fetch");

  if (isFetchFailure) {
    return `Gateway unavailable: unable to load Runtime registry from ${GATEWAY_HTTP_URL}. Please make sure pnpm dev:gateway is running.`;
  }

  return `Runtime registry unavailable: ${rawMessage}`;
}
