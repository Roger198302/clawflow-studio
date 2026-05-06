import type {
  RuntimeCapability,
  RuntimeHealth,
  RuntimeSpec,
  RuntimeStatus,
  RuntimeType
} from "@clawflow/protocol";

export type RuntimeHealthStatus = RuntimeStatus;

export interface RuntimeAdapter {
  readonly runtimeType: RuntimeType;
  health(): Promise<RuntimeHealth>;
}

export class RuntimeRegistry {
  private readonly runtimes = new Map<string, RuntimeSpec>();

  constructor(runtimes: RuntimeSpec[] = createDefaultRuntimes()) {
    for (const runtime of runtimes) {
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
    const isMockRuntime = runtime.id === "mock-local" || runtime.type === "mock";
    const health: RuntimeHealth = isMockRuntime
      ? {
          runtimeId: runtime.id,
          status: "online",
          checkedAt,
          latencyMs: Date.now() - startedAt,
          message: "Mock runtime is online."
        }
      : {
          runtimeId: runtime.id,
          status: "unknown",
          checkedAt,
          latencyMs: Date.now() - startedAt,
          message: "Not connected in MVP. External Runtime health checks are placeholders only."
        };

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
}

function createDefaultRuntimes(): RuntimeSpec[] {
  return [
    {
      id: "mock-local",
      name: "Mock Local Runtime",
      type: "mock",
      status: "online",
      description: "In-process MVP runtime used by the Mock Flow Engine.",
      capabilities: [
        createCapability("agent.chat", "Agent Chat", "agent", "Mock chat-style agent capability."),
        createCapability("agent.start", "Start Agent", "agent", "Mock start-agent planning capability."),
        createCapability("agent.worker", "Worker Agent", "agent", "Mock worker execution capability."),
        createCapability("agent.end", "End Agent", "agent", "Mock agent summarization capability."),
        createCapability("output.console", "Console Output", "output", "Mock console output sink.")
      ]
    },
    {
      id: "openclaw-local",
      name: "OpenClaw Local Gateway",
      type: "openclaw",
      status: "unknown",
      endpoint: "ws://127.0.0.1:18789",
      description: "Placeholder OpenClaw runtime registration. Not connected in the MVP.",
      capabilities: [
        createCapability("agent.chat", "Agent Chat", "agent", "Placeholder OpenClaw agent chat."),
        createCapability("tool.call", "Tool Call", "tool", "Placeholder OpenClaw tool call.", "medium"),
        createCapability(
          "gateway.events",
          "Gateway Events",
          "control",
          "Placeholder OpenClaw event stream."
        )
      ],
      errorMessage: "Not connected in MVP."
    },
    {
      id: "hermes-local",
      name: "Hermes Local",
      type: "hermes",
      status: "unknown",
      description: "Placeholder Hermes runtime registration. Not connected in the MVP.",
      capabilities: [
        createCapability("agent.chat", "Agent Chat", "agent", "Placeholder Hermes agent chat."),
        createCapability("memory.search", "Memory Search", "memory", "Placeholder Hermes memory search."),
        createCapability("skill.run", "Skill Run", "tool", "Placeholder Hermes skill execution.", "medium")
      ],
      errorMessage: "Not connected in MVP."
    },
    {
      id: "shell-local",
      name: "Shell Local",
      type: "shell",
      status: "unknown",
      description: "Placeholder Shell runtime registration. Shell execution is disabled in the MVP.",
      capabilities: [
        createCapability("tool.shell", "Shell Tool", "tool", "Placeholder shell tool. Disabled in MVP.", "critical")
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
  riskLevel: RuntimeCapability["riskLevel"] = "low"
): RuntimeCapability {
  return {
    id,
    name,
    kind,
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
