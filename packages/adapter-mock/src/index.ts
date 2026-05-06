import type { RuntimeType } from "@clawflow/protocol";
import type { RuntimeAdapter, RuntimeHealth } from "@clawflow/runtime-registry";

export class MockRuntimeAdapter implements RuntimeAdapter {
  readonly runtimeType: RuntimeType = "mock";

  async health(): Promise<RuntimeHealth> {
    return {
      runtime: this.runtimeType,
      status: "online",
      checkedAt: new Date().toISOString(),
      message: "Mock runtime adapter is online."
    };
  }
}
