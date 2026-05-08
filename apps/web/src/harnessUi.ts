import type {
  HarnessCapability,
  HarnessCompatibilityResult,
  HarnessExecutionMode,
  HarnessRiskLevel,
  NodeHarnessProfile
} from "@clawflow/protocol";
import { t, type I18nKey, type Locale } from "./i18n";

export const harnessLabelKeys: Record<string, I18nKey> = {
  "chat.basic": "harness.profile.chatBasic",
  "browser.research": "harness.profile.browserResearch",
  "code.local": "harness.profile.localCode",
  "research.agent": "harness.profile.researchAgent",
  "approval.human": "harness.profile.humanApproval",
  "critic.basic": "harness.profile.criticReview",
  "comfyui.workflow": "harness.profile.comfyuiWorkflow"
};

export const harnessDescriptionKeys: Record<string, I18nKey> = {
  "chat.basic": "harness.profile.chatBasic.description",
  "browser.research": "harness.profile.browserResearch.description",
  "code.local": "harness.profile.localCode.description",
  "research.agent": "harness.profile.researchAgent.description",
  "approval.human": "harness.profile.humanApproval.description",
  "critic.basic": "harness.profile.criticReview.description",
  "comfyui.workflow": "harness.profile.comfyuiWorkflow.description"
};

export const harnessFitLabelKeys: Record<HarnessCompatibilityResult["fit"], I18nKey> = {
  best: "harness.fit.best",
  good: "harness.fit.good",
  partial: "harness.fit.partial",
  unsupported: "harness.fit.unsupported",
  unknown: "harness.fit.unknown"
};

export const harnessExecutionModeLabelKeys: Record<HarnessExecutionMode, I18nKey> = {
  mock: "harness.executionMode.mock",
  dry_run: "harness.executionMode.dryRun",
  protected: "harness.executionMode.protected",
  live: "harness.executionMode.live"
};

export const harnessRiskLabelKeys: Record<HarnessRiskLevel, I18nKey> = {
  low: "harness.risk.low",
  medium: "harness.risk.medium",
  high: "harness.risk.high",
  critical: "harness.risk.critical"
};

export const harnessCapabilityLabelKeys: Record<HarnessCapability, I18nKey> = {
  text_generation: "harness.capability.textGeneration",
  reasoning: "harness.capability.reasoning",
  web_search: "harness.capability.webSearch",
  browser_control: "harness.capability.browserControl",
  file_read: "harness.capability.fileRead",
  file_write: "harness.capability.fileWrite",
  shell_exec: "harness.capability.shellExec",
  code_edit: "harness.capability.codeEdit",
  code_run: "harness.capability.codeRun",
  image_generation: "harness.capability.imageGeneration",
  video_generation: "harness.capability.videoGeneration",
  workflow_api: "harness.capability.workflowApi",
  human_approval: "harness.capability.humanApproval",
  memory: "harness.capability.memory",
  multi_agent_coordination: "harness.capability.multiAgentCoordination",
  critique: "harness.capability.critique"
};

export function formatHarnessLabel(locale: Locale, profile: NodeHarnessProfile | undefined): string {
  if (profile === undefined) {
    return t(locale, "harness.noHarness");
  }

  const labelKey = harnessLabelKeys[profile.id];
  return labelKey === undefined ? profile.label : t(locale, labelKey);
}

export function formatHarnessDescription(
  locale: Locale,
  profile: NodeHarnessProfile | undefined
): string {
  if (profile === undefined) {
    return t(locale, "harness.noHarnessSelected");
  }

  const descriptionKey = harnessDescriptionKeys[profile.id];
  return descriptionKey === undefined ? profile.description ?? profile.label : t(locale, descriptionKey);
}

export function formatHarnessFit(
  locale: Locale,
  fit: HarnessCompatibilityResult["fit"]
): string {
  return t(locale, harnessFitLabelKeys[fit]);
}

export function formatHarnessExecutionMode(locale: Locale, mode: HarnessExecutionMode): string {
  return t(locale, harnessExecutionModeLabelKeys[mode]);
}

export function formatHarnessRisk(locale: Locale, riskLevel: HarnessRiskLevel): string {
  return t(locale, harnessRiskLabelKeys[riskLevel]);
}

export function formatHarnessCapability(locale: Locale, capability: HarnessCapability): string {
  return t(locale, harnessCapabilityLabelKeys[capability]);
}
