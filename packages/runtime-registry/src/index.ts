import { OpenClawAdapter, createOpenClawCapabilities } from "@clawflow/adapter-openclaw";
import type {
  RuntimeCapability,
  RuntimeExecutionMode,
  RuntimeHealth,
  RuntimeSpec,
  RuntimeStatus,
  RuntimeType
} from "@clawflow/protocol";

export {
  evaluateHarnessCompatibility,
  getHarnessProfile,
  listHarnessProfiles
} from "./harnesses.js";

export type RuntimeHealthStatus = RuntimeStatus;

export interface RuntimeAdapter {
  readonly runtimeType: RuntimeType;
  health(): Promise<RuntimeHealth>;
}

export class RuntimeRegistry {
  private readonly runtimes = new Map<string, RuntimeSpec>();
  private readonly openClawAdapter: OpenClawAdapter;

  constructor(
    runtimes?: RuntimeSpec[],
    openClawAdapter = new OpenClawAdapter({ id: "openclaw-local" })
  ) {
    this.openClawAdapter = openClawAdapter;

    const initialRuntimes = runtimes ?? createDefaultRuntimes(openClawAdapter);

    for (const runtime of initialRuntimes) {
      this.registerRuntime(runtime);
    }
  }

  registerRuntime(runtime: RuntimeSpec): void {
    this.runtimes.set(runtime.id, cloneRuntime(runtime));
  }

  listRuntimes(): RuntimeSpec[] {
    return Array.from(this.runtimes.values()).map(cloneRuntime);
  }

  getRuntime(id: string): RuntimeSpec | undefined {
    const runtime = this.runtimes.get(id);

    return runtime === undefined ? undefined : cloneRuntime(runtime);
  }

  updateRuntimeStatus(id: string, status: RuntimeStatus, errorMessage?: string): void {
    const runtime = this.runtimes.get(id);

    if (runtime === undefined) {
      return;
    }

    this.runtimes.set(id, {
      ...runtime,
      status,
      lastHealthCheckAt: new Date().toISOString(),
      errorMessage: errorMessage ?? (status === "online" ? undefined : runtime.errorMessage)
    });
  }

  async healthCheck(id: string): Promise<RuntimeHealth> {
    const runtime = this.runtimes.get(id);

    if (runtime === undefined) {
      throw new Error(`Runtime not found: ${id}`);
    }

    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();
    const health: RuntimeHealth = await this.createRuntimeHealth(runtime, checkedAt, startedAt);

    this.updateRuntimeStatus(
      runtime.id,
      health.status,
      health.status === "online" ? undefined : health.message
    );

    return health;
  }

  async healthCheckAll(): Promise<RuntimeHealth[]> {
    const runtimeIds = Array.from(this.runtimes.keys());
    const results: RuntimeHealth[] = [];

    for (const runtimeId of runtimeIds) {
      results.push(await this.healthCheck(runtimeId));
    }

    return results;
  }

  private async createRuntimeHealth(
    runtime: RuntimeSpec,
    checkedAt: string,
    startedAt: number
  ): Promise<RuntimeHealth> {
    if (runtime.id === "mock-local" || runtime.type === "mock") {
      return {
        runtimeId: runtime.id,
        status: "online",
        checkedAt,
        latencyMs: Date.now() - startedAt,
        message: "Mock runtime is online."
      };
    }

    if (runtime.id === "openclaw-local" || runtime.type === "openclaw") {
      return this.openClawAdapter.health();
    }

    return {
      runtimeId: runtime.id,
      status: "unknown",
      checkedAt,
      latencyMs: Date.now() - startedAt,
      message: "Not connected in MVP. External Runtime health checks are placeholders only."
    };
  }
}

function createDefaultRuntimes(openClawAdapter: OpenClawAdapter): RuntimeSpec[] {
  const openClawStatusMessage = openClawAdapter.isConfigured
    ? "OpenClaw local health probe is configured. Run Health Check to verify reachability. Agent and Tool execution remain blocked."
    : openClawAdapter.config.message;

  return [
    {
      id: "mock-local",
      name: "Mock Local Runtime",
      type: "mock",
      status: "online",
      executionMode: "mock",
      description: "In-process MVP runtime used by the Mock Flow Engine.",
      capabilities: [
        createCapability("manual.trigger", "Manual Trigger", "trigger", "Mock manual trigger input.", "mock"),
        createCapability("agent.start", "Start Agent", "agent", "Mock start-agent planning capability.", "mock"),
        createCapability("agent.worker", "Worker Agent", "agent", "Mock worker execution capability.", "mock"),
        createCapability("agent.end", "End Agent", "agent", "Mock agent summarization capability.", "mock"),
        createCapability("output.console", "Console Output", "output", "Mock console output sink.", "mock")
      ]
    },
    {
      id: "openclaw-local",
      name: "OpenClaw Local Gateway",
      type: "openclaw",
      status: "unknown",
      executionMode: "protected",
      endpoint: openClawAdapter.healthEndpoint,
      description:
        "OpenClaw local dogfood bridge. Health checks probe local reachability only; Agent and Tool execution remain blocked.",
      capabilities: createOpenClawCapabilities(),
      errorMessage: openClawStatusMessage
    },
    {
      id: "hermes-local",
      name: "Hermes Local",
      type: "hermes",
      status: "unknown",
      executionMode: "unavailable",
      description: "Placeholder Hermes runtime registration. Not connected in the MVP.",
      capabilities: [
        createCapability("agent.chat", "Agent Chat", "agent", "Placeholder Hermes agent chat.", "unavailable"),
        createCapability("memory.search", "Memory Search", "memory", "Placeholder Hermes memory search.", "unavailable"),
        createCapability("skill.run", "Skill Run", "tool", "Placeholder Hermes skill execution.", "unavailable", "medium")
      ],
      errorMessage: "Not connected in MVP."
    },
    {
      id: "shell-local",
      name: "Shell Local",
      type: "shell",
      status: "unknown",
      executionMode: "unavailable",
      description: "Placeholder Shell runtime registration. Shell execution is disabled in the MVP.",
      capabilities: [
        createCapability(
          "tool.shell",
          "Shell Tool",
          "tool",
          "Placeholder shell tool. Disabled in MVP.",
          "unavailable",
          "critical"
        )
      ],
      errorMessage: "Not connected in MVP."
    }
  ];
}

function createCapability(
  id: string,
  name: string,
  kind: RuntimeCapability["kind"],
  description: string,
  executionMode: RuntimeExecutionMode,
  riskLevel: RuntimeCapability["riskLevel"] = "low"
): RuntimeCapability {
  return {
    id,
    name,
    kind,
    executionMode,
    description,
    riskLevel
  };
}

function cloneRuntime(runtime: RuntimeSpec): RuntimeSpec {
  return {
    ...runtime,
    capabilities: runtime.capabilities.map((capability) => ({ ...capability }))
  };
}
