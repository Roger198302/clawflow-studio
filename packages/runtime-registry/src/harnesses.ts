import type {
  HarnessCapability,
  HarnessCompatibilityResult,
  HarnessExecutionMode,
  HarnessToolRequirement,
  NodeHarnessProfile,
  NodeHarnessRef,
  RuntimeSpec
} from "@clawflow/protocol";

export interface RuntimeLookup {
  getRuntime(id: string): RuntimeSpec | undefined;
}

const builtInHarnessProfiles: NodeHarnessProfile[] = [
  {
    id: "chat.basic",
    kind: "chat",
    label: "Basic Chat",
    description: "General text conversation harness for low-risk agent turns.",
    riskLevel: "low",
    requiredCapabilities: [required("text_generation", "Generate text responses.")],
    recommendedCapabilities: [recommended("reasoning", "Improve task understanding and planning.")],
    compatibleRuntimes: [
      runtimeFit("mock-local", "good", ["mock", "dry_run"], "Mock runtime can simulate chat turns."),
      runtimeFit("openclaw-local", "good", ["protected"], "OpenClaw is registered for protected chat dry runs."),
      runtimeFit("hermes-local", "partial", ["protected"], "Hermes may support chat later, but is unavailable in MVP."),
      runtimeFit("shell-local", "unsupported", [], "Shell runtime cannot provide chat execution.")
    ],
    defaultExecutionMode: "dry_run"
  },
  {
    id: "browser.research",
    kind: "browser",
    label: "Browser Research",
    description: "Research harness for browser or web-search assisted investigation.",
    riskLevel: "medium",
    requiredCapabilities: [required("browser_control", "Control or inspect browser-like research surfaces.")],
    recommendedCapabilities: [
      recommended("web_search", "Search current web sources."),
      recommended("reasoning", "Synthesize findings."),
      recommended("memory", "Reuse session context.")
    ],
    compatibleRuntimes: [
      runtimeFit("openclaw-local", "best", ["protected"], "OpenClaw has protected browser-control capability metadata."),
      runtimeFit("mock-local", "partial", ["dry_run", "mock"], "Mock runtime can only simulate browser research."),
      runtimeFit("hermes-local", "partial", ["protected"], "Hermes may support research later, but is unavailable in MVP."),
      runtimeFit("shell-local", "unsupported", [], "Shell runtime cannot provide browser research in MVP.")
    ],
    defaultExecutionMode: "protected"
  },
  {
    id: "code.local",
    kind: "code",
    label: "Local Code",
    description: "High-risk local code harness requiring file and command capabilities.",
    riskLevel: "high",
    requiredCapabilities: [
      required("file_read", "Read local project files."),
      required("file_write", "Modify local project files."),
      required("code_run", "Run code or tests.")
    ],
    recommendedCapabilities: [recommended("code_edit", "Apply structured code edits.")],
    compatibleRuntimes: [
      runtimeFit("shell-local", "unsupported", [], "Shell execution is disabled in the MVP."),
      runtimeFit("openclaw-local", "partial", ["protected"], "OpenClaw can only represent protected code intent in this phase."),
      runtimeFit("mock-local", "partial", ["dry_run", "mock"], "Mock runtime can simulate local code steps only."),
      runtimeFit("hermes-local", "unsupported", [], "Hermes is not connected for code execution in MVP.")
    ],
    defaultExecutionMode: "protected"
  },
  {
    id: "research.agent",
    kind: "research",
    label: "Research Agent",
    description: "Agent research harness for reasoning over gathered context.",
    riskLevel: "medium",
    requiredCapabilities: [
      required("reasoning", "Plan and synthesize research findings."),
      required("web_search", "Gather external research context.")
    ],
    recommendedCapabilities: [recommended("memory", "Use prior session context.")],
    compatibleRuntimes: [
      runtimeFit("hermes-local", "partial", ["protected"], "Hermes may support research and memory later, but is unavailable in MVP."),
      runtimeFit("openclaw-local", "good", ["protected"], "OpenClaw can represent protected research-agent intent."),
      runtimeFit("mock-local", "partial", ["dry_run", "mock"], "Mock runtime can simulate research output.")
    ],
    defaultExecutionMode: "protected"
  },
  {
    id: "approval.human",
    kind: "approval",
    label: "Human Approval",
    description: "Human checkpoint harness for explicit user approval.",
    riskLevel: "low",
    requiredCapabilities: [required("human_approval", "Request or record a human approval decision.")],
    compatibleRuntimes: [
      runtimeFit("mock-local", "good", ["mock", "dry_run"], "Mock runtime can simulate approval checkpoints."),
      runtimeFit("openclaw-local", "partial", ["protected"], "OpenClaw can represent protected approval intent."),
      runtimeFit("hermes-local", "unsupported", [], "Hermes approval execution is unavailable in MVP."),
      runtimeFit("shell-local", "unsupported", [], "Shell runtime cannot provide human approval.")
    ],
    defaultExecutionMode: "dry_run"
  },
  {
    id: "critic.basic",
    kind: "critic",
    label: "Critic / Review",
    description: "Review harness for critique and quality checks.",
    riskLevel: "low",
    requiredCapabilities: [
      required("critique", "Review generated results."),
      required("reasoning", "Explain findings and recommendations.")
    ],
    compatibleRuntimes: [
      runtimeFit("mock-local", "good", ["mock", "dry_run"], "Mock runtime can simulate critique output."),
      runtimeFit("openclaw-local", "good", ["protected"], "OpenClaw can represent protected review intent."),
      runtimeFit("hermes-local", "partial", ["protected"], "Hermes may support critique later, but is unavailable in MVP.")
    ],
    defaultExecutionMode: "dry_run"
  },
  {
    id: "comfyui.workflow",
    kind: "comfyui",
    label: "ComfyUI Workflow",
    description:
      "Workflow API harness placeholder for media workflow metadata preview. Real ComfyUI execution is disabled.",
    riskLevel: "medium",
    requiredCapabilities: [
      required("workflow_api", "Call a graph/workflow API."),
      required("image_generation", "Generate image outputs through a workflow.")
    ],
    recommendedCapabilities: [recommended("video_generation", "Generate video outputs through a workflow.")],
    compatibleRuntimes: [
      runtimeFit("mock-local", "partial", ["dry_run", "mock"], "Mock runtime can simulate workflow API output."),
      runtimeFit("openclaw-local", "partial", ["protected"], "OpenClaw can represent protected workflow intent."),
      runtimeFit("hermes-local", "unsupported", [], "Hermes workflow execution is unavailable in MVP."),
      runtimeFit("shell-local", "unsupported", [], "Shell workflow execution is disabled in MVP.")
    ],
    defaultExecutionMode: "protected"
  }
];

export function listHarnessProfiles(): NodeHarnessProfile[] {
  return builtInHarnessProfiles.map(cloneHarnessProfile);
}

export function getHarnessProfile(harnessId: string): NodeHarnessProfile | undefined {
  const profile = builtInHarnessProfiles.find((harnessProfile) => harnessProfile.id === harnessId);

  return profile === undefined ? undefined : cloneHarnessProfile(profile);
}

export function evaluateHarnessCompatibility(
  harnessRef: NodeHarnessRef | undefined,
  runtimeId: string | undefined,
  runtimeRegistry: RuntimeLookup
): HarnessCompatibilityResult {
  if (harnessRef === undefined || harnessRef.harnessId.trim() === "") {
    return {
      harnessId: "none",
      runtimeId,
      fit: "unknown",
      riskLevel: "low",
      effectiveExecutionMode: "dry_run",
      reasons: ["No harness selected."],
      missingCapabilities: [],
      protectedDryRun: false
    };
  }

  const profile = getHarnessProfile(harnessRef.harnessId);

  if (profile === undefined) {
    return {
      harnessId: harnessRef.harnessId,
      runtimeId,
      fit: "unknown",
      riskLevel: "medium",
      effectiveExecutionMode: harnessRef.executionMode ?? "dry_run",
      reasons: [`Harness profile not found: ${harnessRef.harnessId}.`],
      missingCapabilities: [],
      protectedDryRun: harnessRef.executionMode === "protected"
    };
  }

  if (runtimeId === undefined || runtimeId.trim() === "") {
    const effectiveExecutionMode = harnessRef.executionMode ?? profile.defaultExecutionMode;

    return {
      harnessId: profile.id,
      fit: "unknown",
      riskLevel: profile.riskLevel,
      effectiveExecutionMode,
      reasons: ["No runtime selected."],
      missingCapabilities: profile.requiredCapabilities
        .filter((capability) => capability.required)
        .map((capability) => capability.capability),
      protectedDryRun: effectiveExecutionMode === "protected"
    };
  }

  const runtime = runtimeRegistry.getRuntime(runtimeId);

  if (runtime === undefined) {
    const effectiveExecutionMode = harnessRef.executionMode ?? profile.defaultExecutionMode;

    return {
      harnessId: profile.id,
      runtimeId,
      fit: "unknown",
      riskLevel: profile.riskLevel,
      effectiveExecutionMode,
      reasons: [`Runtime is not loaded or registered: ${runtimeId}.`],
      missingCapabilities: profile.requiredCapabilities
        .filter((capability) => capability.required)
        .map((capability) => capability.capability),
      protectedDryRun: effectiveExecutionMode === "protected"
    };
  }

  const runtimeFitResult =
    profile.compatibleRuntimes.find((candidate) => candidate.runtimeId === runtime.id) ??
    runtimeFit(runtime.id, "unsupported", [], "Runtime is not listed for this harness.");
  const availableCapabilities = createHarnessCapabilitySet(runtime);
  const missingCapabilities = profile.requiredCapabilities
    .filter((capability) => capability.required && !availableCapabilities.has(capability.capability))
    .map((capability) => capability.capability);
  const effectiveExecutionMode = resolveEffectiveExecutionMode(
    harnessRef.executionMode,
    profile.defaultExecutionMode,
    runtimeFitResult.allowedExecutionModes
  );
  const reasons = createCompatibilityReasons(profile, runtime, runtimeFitResult, missingCapabilities);
  const protectedDryRun =
    effectiveExecutionMode === "protected" || runtime.executionMode === "protected";

  return {
    harnessId: profile.id,
    runtimeId: runtime.id,
    fit: runtime.executionMode === "unavailable" ? "unsupported" : runtimeFitResult.fit,
    riskLevel: profile.riskLevel,
    effectiveExecutionMode,
    reasons,
    missingCapabilities,
    protectedDryRun
  };
}

function createCompatibilityReasons(
  profile: NodeHarnessProfile,
  runtime: RuntimeSpec,
  runtimeFit: NodeHarnessProfile["compatibleRuntimes"][number],
  missingCapabilities: HarnessCapability[]
): string[] {
  const reasons: string[] = [];

  if (runtimeFit.fit === "best") {
    reasons.push("Runtime is listed as best fit.");
  } else if (runtimeFit.fit === "good") {
    reasons.push("Runtime is listed as good fit.");
  } else if (runtimeFit.fit === "partial") {
    reasons.push("Runtime only supports partial or dry-run behavior for this harness.");
  } else {
    reasons.push("Runtime is unsupported for this harness.");
  }

  if (runtimeFit.reason !== undefined) {
    reasons.push(runtimeFit.reason);
  }

  if (runtime.executionMode === "protected") {
    reasons.push("Runtime is protected; real execution remains blocked in this phase.");
  }

  if (runtime.executionMode === "unavailable") {
    reasons.push("Runtime is currently unavailable.");
  }

  if (runtimeFit.allowedExecutionModes.length > 0 && runtimeFit.allowedExecutionModes.every((mode) => mode !== "live")) {
    reasons.push("Runtime only supports dry-run or protected execution for this harness.");
  }

  if (profile.riskLevel === "high" || profile.riskLevel === "critical") {
    reasons.push("Harness requires high-risk capabilities.");
  }

  if (missingCapabilities.length > 0) {
    reasons.push("Runtime is missing required harness capabilities.");
  }

  return reasons;
}

function resolveEffectiveExecutionMode(
  selectedExecutionMode: HarnessExecutionMode | undefined,
  defaultExecutionMode: HarnessExecutionMode,
  allowedExecutionModes: HarnessExecutionMode[]
): HarnessExecutionMode {
  if (selectedExecutionMode !== undefined && allowedExecutionModes.includes(selectedExecutionMode)) {
    return selectedExecutionMode;
  }

  if (allowedExecutionModes.includes(defaultExecutionMode)) {
    return defaultExecutionMode;
  }

  return allowedExecutionModes[0] ?? defaultExecutionMode;
}

function createHarnessCapabilitySet(runtime: RuntimeSpec): Set<HarnessCapability> {
  const capabilities = new Set<HarnessCapability>();

  for (const capability of runtime.capabilities) {
    for (const harnessCapability of mapRuntimeCapabilityToHarnessCapabilities(capability.id)) {
      capabilities.add(harnessCapability);
    }
  }

  if (runtime.type === "mock") {
    capabilities.add("text_generation");
    capabilities.add("reasoning");
    capabilities.add("human_approval");
    capabilities.add("critique");
  }

  if (runtime.type === "openclaw") {
    capabilities.add("text_generation");
    capabilities.add("reasoning");
    capabilities.add("workflow_api");
  }

  return capabilities;
}

function mapRuntimeCapabilityToHarnessCapabilities(runtimeCapabilityId: string): HarnessCapability[] {
  const mappings: Record<string, HarnessCapability[]> = {
    "manual.trigger": ["human_approval"],
    "agent.chat": ["text_generation", "reasoning"],
    "agent.start": ["text_generation", "reasoning"],
    "agent.worker": ["text_generation", "reasoning"],
    "agent.end": ["text_generation", "reasoning", "critique"],
    "output.console": ["workflow_api"],
    "tool.call": ["workflow_api"],
    "gateway.events": ["workflow_api"],
    "canvas.view": ["browser_control"],
    "browser.control": ["browser_control", "web_search"],
    "memory.search": ["memory"],
    "skill.run": ["code_run"],
    "tool.shell": ["shell_exec"]
  };

  return mappings[runtimeCapabilityId] ?? [];
}

function required(capability: HarnessCapability, description: string): HarnessToolRequirement {
  return {
    capability,
    required: true,
    description
  };
}

function recommended(capability: HarnessCapability, description: string): HarnessToolRequirement {
  return {
    capability,
    required: false,
    description
  };
}

function runtimeFit(
  runtimeId: string,
  fit: "best" | "good" | "partial" | "unsupported",
  allowedExecutionModes: HarnessExecutionMode[],
  reason: string
): NodeHarnessProfile["compatibleRuntimes"][number] {
  return {
    runtimeId,
    fit,
    reason,
    allowedExecutionModes
  };
}

function cloneHarnessProfile(profile: NodeHarnessProfile): NodeHarnessProfile {
  return {
    ...profile,
    requiredCapabilities: profile.requiredCapabilities.map((capability) => ({ ...capability })),
    recommendedCapabilities: profile.recommendedCapabilities?.map((capability) => ({ ...capability })),
    compatibleRuntimes: profile.compatibleRuntimes.map((runtime) => ({
      ...runtime,
      allowedExecutionModes: [...runtime.allowedExecutionModes]
    }))
  };
}
