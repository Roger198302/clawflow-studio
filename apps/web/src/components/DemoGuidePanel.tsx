import { BookOpen, RotateCcw, Server, X } from "lucide-react";
import type { ReactElement } from "react";
import { t, type I18nKey, type Locale } from "../i18n";

interface DemoGuidePanelProps {
  locale: Locale;
  onClose: () => void;
  onOpenRuntimeManager: () => void;
  onResetDemoFlow: () => void;
}

const demoPathKeys: I18nKey[] = [
  "demoGuide.path.builder",
  "demoGuide.path.inspectFlow",
  "demoGuide.path.readiness",
  "demoGuide.path.mockRun",
  "demoGuide.path.runner",
  "demoGuide.path.focus",
  "demoGuide.path.debug",
  "demoGuide.path.contextMenu",
  "demoGuide.path.protectedDryRun"
];

const panelGuideKeys: I18nKey[] = [
  "demoGuide.panel.runtimeManager",
  "demoGuide.panel.runReadiness",
  "demoGuide.panel.linearPlan",
  "demoGuide.panel.resourceEstimate",
  "demoGuide.panel.sessionConsole",
  "demoGuide.panel.runInspector",
  "demoGuide.panel.contractPreview",
  "demoGuide.panel.presets",
  "demoGuide.panel.viewMode",
  "demoGuide.panel.nodeDisplay",
  "demoGuide.panel.contextMenus"
];

const limitationKeys: I18nKey[] = [
  "demoGuide.limit.mockRuntime",
  "demoGuide.limit.protectedDryRun",
  "demoGuide.limit.noExternalRuntime",
  "demoGuide.limit.noPersistence",
  "demoGuide.limit.nodePets",
  "demoGuide.limit.futureWorkspace"
];

export function DemoGuidePanel({
  locale,
  onClose,
  onOpenRuntimeManager,
  onResetDemoFlow
}: DemoGuidePanelProps): ReactElement {
  return (
    <aside className="demo-guide-panel" aria-label={t(locale, "demoGuide.title")} data-testid="demo-guide-panel">
      <header className="demo-guide-header">
        <div>
          <BookOpen aria-hidden="true" size={18} />
          <span>
            <strong>{t(locale, "demoGuide.title")}</strong>
            <small>{t(locale, "demoGuide.subtitle")}</small>
          </span>
        </div>
        <button type="button" title={t(locale, "common.close")} aria-label={t(locale, "common.close")} onClick={onClose}>
          <X aria-hidden="true" size={16} />
        </button>
      </header>

      <div className="demo-guide-body">
        <section className="demo-guide-card">
          <h2>{t(locale, "demoGuide.whatTitle")}</h2>
          <p>{t(locale, "demoGuide.whatBody")}</p>
        </section>

        <section className="demo-guide-card" data-testid="demo-guide-path">
          <h2>{t(locale, "demoGuide.pathTitle")}</h2>
          <ol>
            {demoPathKeys.map((key) => (
              <li key={key}>{t(locale, key)}</li>
            ))}
          </ol>
        </section>

        <section className="demo-guide-card">
          <h2>{t(locale, "demoGuide.panelsTitle")}</h2>
          <ul>
            {panelGuideKeys.map((key) => (
              <li key={key}>{t(locale, key)}</li>
            ))}
          </ul>
        </section>

        <section className="demo-guide-card beta-limitations" data-testid="beta-limitations">
          <h2>{t(locale, "demoGuide.limitationsTitle")}</h2>
          <ul>
            {limitationKeys.map((key) => (
              <li key={key}>{t(locale, key)}</li>
            ))}
          </ul>
        </section>

        <section className="demo-guide-card">
          <h2>{t(locale, "demoGuide.resetTitle")}</h2>
          <p>{t(locale, "demoGuide.resetBody")}</p>
        </section>
      </div>

      <footer className="demo-guide-actions">
        <button type="button" data-testid="demo-guide-runtime-button" onClick={onOpenRuntimeManager}>
          <Server aria-hidden="true" size={15} />
          {t(locale, "demoGuide.openRuntimeManager")}
        </button>
        <button type="button" data-testid="reset-demo-flow-button" onClick={onResetDemoFlow}>
          <RotateCcw aria-hidden="true" size={15} />
          {t(locale, "demoGuide.resetFlow")}
        </button>
      </footer>
    </aside>
  );
}
