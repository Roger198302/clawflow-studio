import type { FlowNode } from "@clawflow/protocol";
import type { ChangeEvent, ReactElement } from "react";
import { t, type I18nKey, type Locale } from "../i18n";
import type {
  AgentGatewayBinding,
  GatewayProfile,
  LocalGatewayConnection
} from "../store/runtimeStore";

export type SimpleNodeConnectionType =
  | "workspace-gateway"
  | "gateway-profile"
  | "url"
  | "api"
  | "manual";

export type SimpleNodeOutputFormat = "console" | "markdown" | "json" | "summary";

export interface SimpleNodeSetupData {
  task: string;
  connectionType: SimpleNodeConnectionType;
  connectionValue: string;
  outputFormat: SimpleNodeOutputFormat;
}

interface SimpleNodeSetupPanelProps {
  locale: Locale;
  node: FlowNode;
  gatewayProfiles: GatewayProfile[];
  gatewayBinding: AgentGatewayBinding;
  localGatewayConnection: LocalGatewayConnection;
  selectedGatewayProfile: GatewayProfile | null;
  onSetupChange: (patch: Partial<SimpleNodeSetupData>) => void;
  onConnectionTypeChange: (connectionType: SimpleNodeConnectionType) => void;
  onGatewayProfileChange: (profileId: string) => void;
}

const connectionTypes: SimpleNodeConnectionType[] = [
  "workspace-gateway",
  "gateway-profile",
  "url",
  "api",
  "manual"
];

const outputFormats: SimpleNodeOutputFormat[] = ["console", "markdown", "json", "summary"];

export function SimpleNodeSetupPanel({
  locale,
  node,
  gatewayProfiles,
  gatewayBinding,
  localGatewayConnection,
  selectedGatewayProfile,
  onSetupChange,
  onConnectionTypeChange,
  onGatewayProfileChange
}: SimpleNodeSetupPanelProps): ReactElement {
  const setup = readSimpleNodeSetup(node, gatewayBinding);
  const isAgent = node.type.startsWith("agent.");
  const connectionStatus = createConnectionStatusText(
    locale,
    setup.connectionType,
    localGatewayConnection,
    selectedGatewayProfile
  );

  return (
    <section className="inspector-card simple-node-setup-card" data-testid="simple-node-setup">
      <div className="simple-node-setup-header">
        <div>
          <h2>{t(locale, "simpleSetup.title")}</h2>
          <p>{t(locale, isAgent ? "simpleSetup.agentSubtitle" : "simpleSetup.nodeSubtitle")}</p>
        </div>
        <span>{t(locale, "simpleSetup.safeBadge")}</span>
      </div>

      <div className="field-stack">
        <label className="field-control">
          <span>{t(locale, "simpleSetup.task")}</span>
          <textarea
            data-testid="simple-task-input"
            value={setup.task}
            rows={3}
            onChange={(event) => onSetupChange({ task: event.target.value })}
          />
        </label>

        <label className="field-control">
          <span>{t(locale, "simpleSetup.connection")}</span>
          <select
            data-testid="simple-connection-type-select"
            value={setup.connectionType}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onConnectionTypeChange(event.target.value as SimpleNodeConnectionType)
            }
          >
            {connectionTypes.map((connectionType) => (
              <option key={connectionType} value={connectionType}>
                {t(locale, getConnectionTypeLabelKey(connectionType))}
              </option>
            ))}
          </select>
        </label>

        {setup.connectionType === "gateway-profile" ? (
          <label className="field-control">
            <span>{t(locale, "simpleSetup.gatewayProfile")}</span>
            <select
              data-testid="simple-gateway-profile-select"
              value={gatewayBinding.mode === "profile" ? gatewayBinding.profileId : gatewayProfiles[0]?.id ?? ""}
              onChange={(event) => onGatewayProfileChange(event.target.value)}
            >
              {gatewayProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} / {t(locale, getGatewayStatusLabelKey(profile.status))}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {setup.connectionType === "url" || setup.connectionType === "api" || setup.connectionType === "manual" ? (
          <label className="field-control">
            <span>{t(locale, getConnectionValueLabelKey(setup.connectionType))}</span>
            <input
              data-testid="simple-connection-value-input"
              value={setup.connectionValue}
              placeholder={t(locale, getConnectionValuePlaceholderKey(setup.connectionType))}
              onChange={(event) => onSetupChange({ connectionValue: event.target.value })}
            />
          </label>
        ) : null}

        <label className="field-control">
          <span>{t(locale, "simpleSetup.output")}</span>
          <select
            data-testid="simple-output-format-select"
            value={setup.outputFormat}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onSetupChange({ outputFormat: event.target.value as SimpleNodeOutputFormat })
            }
          >
            {outputFormats.map((outputFormat) => (
              <option key={outputFormat} value={outputFormat}>
                {t(locale, getOutputFormatLabelKey(outputFormat))}
              </option>
            ))}
          </select>
        </label>

        <div className="simple-node-setup-status" data-testid="simple-setup-status">
          <strong>{t(locale, "simpleSetup.status")}</strong>
          <span>{connectionStatus}</span>
          <small>{t(locale, "simpleSetup.noAutoExecution")}</small>
        </div>
      </div>
    </section>
  );
}

export function readSimpleNodeSetup(
  node: FlowNode,
  gatewayBinding: AgentGatewayBinding
): SimpleNodeSetupData {
  const rawSetup = readRecord(node.data?.simpleSetup);
  const connectionType =
    readConnectionType(rawSetup.connectionType) ??
    (node.type.startsWith("agent.") && gatewayBinding.mode === "profile"
      ? "gateway-profile"
      : "workspace-gateway");

  return {
    task: readString(rawSetup.task) ?? readString(node.data?.objective) ?? node.label,
    connectionType,
    connectionValue: readString(rawSetup.connectionValue) ?? "",
    outputFormat: readOutputFormat(rawSetup.outputFormat) ?? inferOutputFormat(node)
  };
}

function createConnectionStatusText(
  locale: Locale,
  connectionType: SimpleNodeConnectionType,
  localGatewayConnection: LocalGatewayConnection,
  selectedGatewayProfile: GatewayProfile | null
): string {
  if (connectionType === "workspace-gateway") {
    return `${t(locale, "gatewayProfiles.workspaceDefault")} / ${t(
      locale,
      getGatewayStatusLabelKey(localGatewayConnection.status)
    )} / ${t(locale, "simpleSetup.protected")}`;
  }

  if (connectionType === "gateway-profile") {
    const profileName = selectedGatewayProfile?.name ?? t(locale, "gatewayProfiles.workspaceDefault");
    const status = selectedGatewayProfile?.status ?? "idle";

    return `${profileName} / ${t(locale, getGatewayStatusLabelKey(status))} / ${t(
      locale,
      "simpleSetup.protected"
    )}`;
  }

  if (connectionType === "url") {
    return t(locale, "simpleSetup.urlManualStatus");
  }

  if (connectionType === "api") {
    return t(locale, "simpleSetup.apiManualStatus");
  }

  return t(locale, "simpleSetup.manualStatus");
}

function inferOutputFormat(node: FlowNode): SimpleNodeOutputFormat {
  if (node.type === "output.console") {
    return "console";
  }

  return "summary";
}

function getConnectionTypeLabelKey(connectionType: SimpleNodeConnectionType): I18nKey {
  if (connectionType === "gateway-profile") {
    return "simpleSetup.connection.gatewayProfile";
  }

  if (connectionType === "url") {
    return "simpleSetup.connection.url";
  }

  if (connectionType === "api") {
    return "simpleSetup.connection.api";
  }

  if (connectionType === "manual") {
    return "simpleSetup.connection.manual";
  }

  return "simpleSetup.connection.workspaceGateway";
}

function getConnectionValueLabelKey(connectionType: SimpleNodeConnectionType): I18nKey {
  if (connectionType === "api") {
    return "simpleSetup.apiEndpoint";
  }

  if (connectionType === "manual") {
    return "simpleSetup.manualInput";
  }

  return "simpleSetup.url";
}

function getConnectionValuePlaceholderKey(connectionType: SimpleNodeConnectionType): I18nKey {
  if (connectionType === "api") {
    return "simpleSetup.apiPlaceholder";
  }

  if (connectionType === "manual") {
    return "simpleSetup.manualPlaceholder";
  }

  return "simpleSetup.urlPlaceholder";
}

function getOutputFormatLabelKey(outputFormat: SimpleNodeOutputFormat): I18nKey {
  if (outputFormat === "markdown") {
    return "simpleSetup.output.markdown";
  }

  if (outputFormat === "json") {
    return "simpleSetup.output.json";
  }

  if (outputFormat === "summary") {
    return "simpleSetup.output.summary";
  }

  return "simpleSetup.output.console";
}

function getGatewayStatusLabelKey(status: LocalGatewayConnection["status"]): I18nKey {
  if (status === "checking") {
    return "gatewayQuickConnect.checking";
  }

  if (status === "connected") {
    return "gatewayQuickConnect.connected";
  }

  if (status === "unavailable") {
    return "gatewayQuickConnect.unavailable";
  }

  if (status === "protected") {
    return "gatewayQuickConnect.protected";
  }

  return "gatewayQuickConnect.idle";
}

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readConnectionType(value: unknown): SimpleNodeConnectionType | undefined {
  return typeof value === "string" && connectionTypes.includes(value as SimpleNodeConnectionType)
    ? (value as SimpleNodeConnectionType)
    : undefined;
}

function readOutputFormat(value: unknown): SimpleNodeOutputFormat | undefined {
  return typeof value === "string" && outputFormats.includes(value as SimpleNodeOutputFormat)
    ? (value as SimpleNodeOutputFormat)
    : undefined;
}
