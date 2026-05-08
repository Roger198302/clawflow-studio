import type {
  FlowNode,
  HarnessCompatibilityResult,
  HarnessToolRequirement,
  NodeHarnessProfile,
  NodeHarnessRef,
  RuntimeSpec
} from "@clawflow/protocol";
import {
  evaluateHarnessCompatibility,
  getHarnessProfile,
  listHarnessProfiles
} from "@clawflow/runtime-registry/harnesses";
import type { ChangeEvent, ReactElement } from "react";
import {
  formatHarnessCapability,
  formatHarnessDescription,
  formatHarnessExecutionMode,
  formatHarnessFit,
  formatHarnessLabel,
  formatHarnessRisk
} from "../harnessUi";
import { t, type Locale } from "../i18n";

export interface HarnessInspectorProps {
  locale: Locale;
  node: FlowNode;
  runtimes: RuntimeSpec[];
  onChange: (harnessRef: NodeHarnessRef | null) => void;
}

const harnessProfiles = listHarnessProfiles();

export function HarnessInspector({
  locale,
  node,
  runtimes,
  onChange
}: HarnessInspectorProps): ReactElement {
  const selectedProfile = getHarnessProfile(node.harnessRef?.harnessId ?? "");
  const compatibility = evaluateHarnessCompatibility(
    node.harnessRef,
    node.runtimeRef ?? "mock-local",
    createRuntimeLookup(runtimes)
  );

  const handleHarnessChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const harnessId = event.target.value;

    if (harnessId === "") {
      onChange(null);
      return;
    }

    const profile = getHarnessProfile(harnessId);

    onChange({
      harnessId,
      executionMode: profile?.defaultExecutionMode
    });
  };

  return (
    <section className="inspector-card harness-inspector-card">
      <h2>{t(locale, "harness.title")}</h2>

      <label className="field-control">
        <span>{t(locale, "harness.selected")}</span>
        <select value={node.harnessRef?.harnessId ?? ""} onChange={handleHarnessChange}>
          <option value="">{t(locale, "harness.noHarness")}</option>
          {harnessProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {formatHarnessLabel(locale, profile)}
            </option>
          ))}
        </select>
      </label>

      {selectedProfile === undefined ? (
        <div className="harness-empty-state">
          <strong>{t(locale, "harness.noHarness")}</strong>
          <span>{t(locale, "harness.noHarnessSelected")}</span>
        </div>
      ) : (
        <>
          <div className="harness-meta-grid">
            <span>{t(locale, "harness.kind")}</span>
            <code>{selectedProfile.kind}</code>
            <span>{t(locale, "harness.riskLevel")}</span>
            <strong className={`harness-risk-badge risk-${selectedProfile.riskLevel}`}>
              {formatHarnessRisk(locale, selectedProfile.riskLevel)}
            </strong>
            <span>{t(locale, "harness.defaultExecutionMode")}</span>
            <code>{formatHarnessExecutionMode(locale, selectedProfile.defaultExecutionMode)}</code>
            <span>{t(locale, "harness.runtimeFit")}</span>
            <strong className={`harness-fit-badge fit-${compatibility.fit}`}>
              {formatHarnessFit(locale, compatibility.fit)}
            </strong>
            <span>{t(locale, "harness.executionMode")}</span>
            <code>{formatHarnessExecutionMode(locale, compatibility.effectiveExecutionMode)}</code>
          </div>

          <p className="harness-description">
            {formatHarnessDescription(locale, selectedProfile)}
          </p>

          <CapabilitySection
            locale={locale}
            title={t(locale, "harness.requiredCapabilities")}
            capabilities={selectedProfile.requiredCapabilities}
            missingCapabilities={compatibility.missingCapabilities}
          />
          <CapabilitySection
            locale={locale}
            title={t(locale, "harness.recommendedCapabilities")}
            capabilities={selectedProfile.recommendedCapabilities ?? []}
            missingCapabilities={[]}
          />
          <CompatibilityReasons locale={locale} compatibility={compatibility} profile={selectedProfile} />
        </>
      )}
    </section>
  );
}

function CapabilitySection({
  locale,
  title,
  capabilities,
  missingCapabilities
}: {
  locale: Locale;
  title: string;
  capabilities: HarnessToolRequirement[];
  missingCapabilities: HarnessCompatibilityResult["missingCapabilities"];
}): ReactElement {
  return (
    <div className="harness-capability-section">
      <strong>{title}</strong>
      {capabilities.length === 0 ? (
        <span className="harness-muted">{t(locale, "common.notAvailable")}</span>
      ) : (
        <div className="harness-capability-chip-list">
          {capabilities.map((capability) => {
            const isMissing = missingCapabilities.includes(capability.capability);

            return (
              <span
                className={`harness-capability-chip ${isMissing ? "is-missing" : ""}`}
                key={capability.capability}
                title={capability.description}
              >
                {formatHarnessCapability(locale, capability.capability)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CompatibilityReasons({
  locale,
  compatibility,
  profile
}: {
  locale: Locale;
  compatibility: HarnessCompatibilityResult;
  profile: NodeHarnessProfile;
}): ReactElement {
  return (
    <div className="harness-compatibility-detail">
      <strong>{t(locale, "harness.compatibilityReasons")}</strong>
      {compatibility.missingCapabilities.length > 0 ? (
        <div className="harness-missing-capabilities">
          <span>{t(locale, "harness.missingCapabilities")}</span>
          <div className="harness-capability-chip-list">
            {compatibility.missingCapabilities.map((capability) => (
              <span className="harness-capability-chip is-missing" key={capability}>
                {formatHarnessCapability(locale, capability)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <ul>
        {compatibility.reasons.map((reason) => (
          <li key={`${profile.id}.${reason}`}>{reason}</li>
        ))}
      </ul>
    </div>
  );
}

function createRuntimeLookup(runtimes: RuntimeSpec[]): {
  getRuntime: (id: string) => RuntimeSpec | undefined;
} {
  const runtimeById = new Map(runtimes.map((runtime) => [runtime.id, runtime]));

  return {
    getRuntime: (id) => runtimeById.get(id)
  };
}
