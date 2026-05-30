import { Braces, Play, Server, Sparkles } from "lucide-react";
import type { ReactElement } from "react";
import { t, type Locale } from "../i18n";
import type { LocalGatewayConnection } from "../store/runtimeStore";

interface BeginnerStartCardProps {
  locale: Locale;
  localGatewayConnection: LocalGatewayConnection;
  onStartHelloWorld: () => void;
  onConnectGateway: () => void;
  onExportTask: () => void;
}

export function BeginnerStartCard({
  locale,
  localGatewayConnection,
  onStartHelloWorld,
  onConnectGateway,
  onExportTask
}: BeginnerStartCardProps): ReactElement {
  return (
    <section className="beginner-start-card" data-testid="beginner-start-card">
      <div className="beginner-start-header">
        <span>
          <Sparkles aria-hidden="true" size={15} />
          <strong>{t(locale, "beginnerStart.title")}</strong>
        </span>
        <small>{t(locale, "beginnerStart.subtitle")}</small>
      </div>

      <div className="beginner-start-steps">
        <button type="button" data-testid="start-card-hello-world" onClick={onStartHelloWorld}>
          <Play aria-hidden="true" size={15} />
          <span>
            <strong>{t(locale, "beginnerStart.helloTitle")}</strong>
            <small>{t(locale, "beginnerStart.helloBody")}</small>
          </span>
        </button>
        <button
          type="button"
          data-testid="start-card-connect-gateway"
          disabled={localGatewayConnection.status === "checking"}
          onClick={onConnectGateway}
        >
          <Server aria-hidden="true" size={15} />
          <span>
            <strong>{t(locale, "beginnerStart.gatewayTitle")}</strong>
            <small>
              {localGatewayConnection.status === "connected"
                ? t(locale, "beginnerStart.gatewayConnected")
                : t(locale, "beginnerStart.gatewayBody")}
            </small>
          </span>
        </button>
        <button type="button" data-testid="start-card-export-task" onClick={onExportTask}>
          <Braces aria-hidden="true" size={15} />
          <span>
            <strong>{t(locale, "beginnerStart.exportTitle")}</strong>
            <small>{t(locale, "beginnerStart.exportBody")}</small>
          </span>
        </button>
      </div>
    </section>
  );
}
