import type { RuntimeType } from "@clawflow/protocol";

export type RuntimeHealthStatus = "online" | "offline" | "unavailable";

export interface RuntimeHealth {
  runtime: RuntimeType;
  status: RuntimeHealthStatus;
  checkedAt: string;
  message?: string;
}

export interface RuntimeAdapter {
  readonly runtimeType: RuntimeType;
  health(): Promise<RuntimeHealth>;
}

export class RuntimeRegistry {
  private readonly adapters = new Map<RuntimeType, RuntimeAdapter>();

  register(adapter: RuntimeAdapter): void {
    this.adapters.set(adapter.runtimeType, adapter);
  }

  get(runtimeType: RuntimeType): RuntimeAdapter | undefined {
    return this.adapters.get(runtimeType);
  }

  list(): RuntimeAdapter[] {
    return Array.from(this.adapters.values());
  }
}
