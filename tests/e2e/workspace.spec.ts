import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const NODE_IDS = {
  manual: "node-manual-trigger",
  start: "node-start-agent",
  worker: "node-worker-agent",
  end: "node-end-agent",
  output: "node-console-output"
} as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("clawflow.e2e.initialized") !== "true") {
      window.localStorage.setItem("clawflow.locale", "en");
      window.localStorage.setItem("clawflow.workspaceViewMode", "default");
      window.localStorage.setItem("clawflow.nodeDisplayMode", "auto");
      window.localStorage.setItem("clawflow.workspacePreset", "custom");
      window.localStorage.setItem(
        "clawflow.localGatewayConnection",
        JSON.stringify({
          baseUrl: "http://localhost:25311",
          healthPath: "/health",
          status: "idle"
        })
      );
      window.localStorage.setItem(
        "clawflow.gatewayProfiles",
        JSON.stringify([
          {
            id: "openclaw-local",
            name: "OpenClaw Local",
            kind: "openclaw",
            baseUrl: "http://localhost:25311",
            healthPath: "/health",
            status: "idle",
            protected: true
          }
        ])
      );
      window.localStorage.removeItem("clawflow.agentGatewayBindings");
      window.localStorage.setItem(
        "clawflow.workspacePanelState",
        JSON.stringify({
          nodeLibraryCollapsed: false,
          inspectorCollapsed: false,
          runInspectorCollapsed: false
        })
      );
      window.sessionStorage.setItem("clawflow.e2e.initialized", "true");
    }
  });
  await page.goto("/");
  await expect(page.getByTestId("clawflow-canvas")).toBeVisible();
  await expect(page.getByTestId(NODE_IDS.manual)).toBeVisible();
  await expect(page.getByTestId("linear-plan-status")).toContainText("Ready");
});

test("app loads with default workspace nodes and no fatal console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.reload();

  for (const nodeId of Object.values(NODE_IDS)) {
    await expect(page.getByTestId(nodeId)).toBeVisible();
  }
  await expect(page.getByTestId("execution-contract-preview-panel")).toBeVisible();
  await expect(page.getByTestId("execution-contract-preview-panel")).toContainText("Catalog contract");
  await expect(page.getByTestId("execution-contract-preview-panel")).toContainText("Required inputs");
  await expect(page.getByTestId("execution-contract-preview-panel")).toContainText("Outputs");
  await expect(page.getByTestId("linear-execution-plan-panel")).toBeVisible();
  await expect(page.getByTestId("resource-estimate-panel")).toBeVisible();
  await expect(page.getByTestId("resource-estimate-panel")).toContainText("Tokens");
  await expect(page.getByTestId("run-readiness-preview")).toBeVisible();
  await expect(page.getByTestId("run-readiness-status")).toContainText("Ready with warnings");
  await expect(page.getByTestId("pre-run-summary")).toContainText(/Pre-run · \d+ warn/);
  await expect(page.getByTestId("execution-action-strip")).toBeVisible();
  await expectRunButtonInExecutionStrip(page);
  await expect(page.getByTestId("node-display-mode-select")).toHaveValue("auto");
  await expect(page.getByTestId("node-display-mode-control")).toContainText("Node:");
  await expect(page.getByTestId("workspace-preset-select")).toHaveValue("custom");
  await expect(page.getByTestId("workspace-preset-control")).toContainText("Preset:");
  await expect(page.getByTestId(NODE_IDS.worker)).toHaveAttribute("data-node-display-mode", "standard");
  await expect(page.getByTestId("save-flow-button")).toBeVisible();
  await expect(page.getByTestId("export-json-button")).toBeVisible();
  await expect(page.getByTestId("runtime-manager-button")).toBeVisible();
  await expect(page.getByTestId("task-launcher-button")).toBeVisible();
  await expect(page.getByTestId("demo-guide-button")).toBeVisible();
  await expect(page.getByTestId("reset-layout-button")).toBeVisible();
  await expect(page.getByTestId("node-library-content")).toBeVisible();
  await expect(page.getByTestId("session-console-panel")).toBeVisible();
  await expect(page.getByTestId("run-inspector")).toBeVisible();
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("workspace header remains usable across common desktop widths", async ({ page }) => {
  const viewports = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
    { width: 900, height: 768 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.reload();
    await expect(page.getByTestId("clawflow-canvas")).toBeVisible();

    const header = page.getByTestId("top-bar");
    await expect(header).toBeVisible();
    await expect(page.getByTestId("run-button")).toBeVisible();
    await expect(page.getByTestId("pre-run-summary")).toBeVisible();
    await expect(page.getByTestId("execution-action-strip")).toBeVisible();
    await expect(page.getByTestId("workspace-preset-control")).toBeVisible();
    await expect(page.getByTestId("node-display-mode-control")).toBeVisible();
    await expect(page.getByTestId("save-flow-button")).toBeVisible();
    await expect(page.getByTestId("export-json-button")).toBeVisible();
    await expect(page.getByTestId("runtime-manager-button")).toBeVisible();
    await expect(page.getByTestId("task-launcher-button")).toBeVisible();
    await expect(page.getByTestId("demo-guide-button")).toBeVisible();
    await expect(page.getByTestId("reset-layout-button")).toBeVisible();
    await expect(page.getByLabel("Language")).toBeVisible();

    const hasNoHorizontalScrollbar = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    );
    expect(hasNoHorizontalScrollbar).toBe(true);

    const headerItemTestIds = [
      "brand-lockup",
      "top-status",
      "execution-action-strip",
      "run-readiness-preview",
      "workspace-preset-control",
      "view-mode-control",
      "node-display-mode-control",
      "save-flow-button",
      "export-json-button",
      "runtime-manager-button",
      "task-launcher-button",
      "demo-guide-button",
      "reset-layout-button"
    ];

    for (const testId of headerItemTestIds) {
      const item = page.getByTestId(testId);
      await item.evaluate((element) =>
        element.scrollIntoView({ block: "nearest", inline: "center" })
      );
      await expect(item).toBeVisible();
      await expectInsideContainerViewport(item, header);
    }

    const topBarCanScroll = await header.evaluate(
      (element) => element.scrollWidth >= element.clientWidth
    );
    expect(topBarCanScroll).toBe(true);
    const summaryFits = await page
      .getByTestId("pre-run-summary")
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
    expect(summaryFits).toBe(true);
    const nodeViewFits = await page
      .getByTestId("node-display-mode-control")
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
    expect(nodeViewFits).toBe(true);
  }
});

test("demo guide explains the beta path and reset demo flow restores defaults", async ({ page }) => {
  await page.getByLabel("Language").selectOption("en");

  await page.getByTestId("node-library-item-agent-worker").click();
  await expect(page.getByTestId("node-node-agent-worker-2")).toBeVisible();

  await page.getByTestId("demo-guide-button").evaluate((element) =>
    element.scrollIntoView({ block: "nearest", inline: "center" })
  );
  await page.getByTestId("demo-guide-button").click();
  await expect(page.getByTestId("demo-guide-panel")).toBeVisible();
  await expect(page.getByTestId("demo-guide-path")).toContainText("Builder preset");
  await expect(page.getByTestId("demo-guide-path")).toContainText("mock-local");
  await expect(page.getByTestId("beta-limitations")).toContainText("mock-local");
  await expect(page.getByTestId("beta-limitations")).toContainText("Protected dry run");
  await expect(page.getByTestId("beta-limitations")).toContainText("not enabled");

  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("Reset");
    void dialog.accept();
  });
  await page.getByTestId("reset-demo-flow-button").click();

  await expect(page.getByTestId("node-node-agent-worker-2")).toBeHidden();
  for (const nodeId of Object.values(NODE_IDS)) {
    await expect(page.getByTestId(nodeId)).toBeVisible();
  }
  await expect.poll(() => edgeCount(page)).toBe(4);
  await expect(page.getByTestId("run-inspector")).toContainText("No Active Session");

  await page.getByLabel("Language").selectOption("zh-CN");
  await expect(page.getByTestId("demo-guide-panel")).toContainText("Demo 指南");
  await expect(page.getByTestId("beta-limitations")).toContainText("受保护 dry-run");
  await expect(page.getByTestId("beta-limitations")).toContainText("尚未启用");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("demo-guide-panel")).toBeHidden();
});

test("runtime manager shows OpenClaw dogfood boundary and exports manual task", async ({ page }) => {
  let runRequests = 0;
  let openClawHealthStatus: "online" | "offline" = "online";
  let openClawProbeStatus: "online" | "offline" = "online";

  page.on("request", (request) => {
    if (request.url().endsWith("/api/runs")) {
      runRequests += 1;
    }
  });

  await page.route("**/api/runtimes/openclaw-local/probe", async (route) => {
    const checkedAt = new Date().toISOString();

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        runtimeId: "openclaw-local",
        health: {
          runtimeId: "openclaw-local",
          status: openClawProbeStatus,
          checkedAt,
          latencyMs: 2,
          message:
            openClawProbeStatus === "online"
              ? "OpenClaw local gateway is reachable. Real Agent and Tool execution remains blocked."
              : "OpenClaw local gateway is unavailable. Real execution remains blocked."
        },
        connection: {
          baseUrl: "http://localhost:25311",
          healthPath: "/health",
          healthUrl: "http://localhost:25311/health",
          status: openClawProbeStatus === "online" ? "connected" : "unavailable",
          protected: true,
          checkedAt
        }
      })
    });
  });

  await page.route("**/api/runtimes/health-check", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          runtimeId: "mock-local",
          status: "online",
          checkedAt: new Date().toISOString(),
          latencyMs: 1,
          message: "Mock runtime is online."
        },
        {
          runtimeId: "openclaw-local",
          status: openClawHealthStatus,
          checkedAt: new Date().toISOString(),
          latencyMs: 3,
          message:
            openClawHealthStatus === "online"
              ? "OpenClaw local health endpoint is reachable in this test. Execution remains blocked."
              : "OpenClaw local health endpoint is offline in this test."
        },
        {
          runtimeId: "hermes-local",
          status: "unknown",
          checkedAt: new Date().toISOString(),
          latencyMs: 1,
          message: "Not connected in MVP."
        },
        {
          runtimeId: "shell-local",
          status: "unknown",
          checkedAt: new Date().toISOString(),
          latencyMs: 1,
          message: "Shell execution is disabled."
        }
      ])
    });
  });

  await expect(page.getByTestId("gateway-quick-connect")).toBeVisible();
  await page.getByTestId("gateway-url-input").fill("http://localhost:25311");
  await page.getByTestId("gateway-health-path-input").fill("/health");
  await page.getByTestId("gateway-connect-button").click();
  await expect(page.getByTestId("gateway-quick-connect-status")).toContainText("Connected");
  await expect(page.getByTestId("gateway-quick-connect-message")).toContainText(
    "Local gateway reachable"
  );

  await minimizeWorkspacePanels(page);
  await page.getByTestId(NODE_IDS.worker).click();
  await expect(page.getByTestId("inspector-gateway-section")).toBeVisible();
  await expect(page.getByTestId("inspector-gateway-status")).toContainText("Workspace Default Gateway");
  await expect(page.getByTestId("inspector-gateway-status")).toContainText("Connected");
  await page.getByTestId("inspector-runtime-select").selectOption("openclaw-local");
  await expect(page.getByTestId("inspector-openclaw-protected-note")).toContainText("protected dry-run only");
  await page.getByTestId("inspector-gateway-binding-mode").selectOption("profile");
  await page.getByTestId("inspector-gateway-profile-select").selectOption("openclaw-local");
  await expect(page.getByTestId("inspector-gateway-status")).toContainText("OpenClaw Local");
  await expect(page.getByTestId("inspector-gateway-status")).toContainText("Connected");
  await expect(page.getByTestId(`${NODE_IDS.worker}-gateway-badge`)).toContainText("OpenClaw Local");

  await page.getByTestId("runtime-manager-button").evaluate((element) =>
    element.scrollIntoView({ block: "nearest", inline: "center" })
  );
  await page.getByTestId("runtime-manager-button").click();

  await expect(page.getByTestId("runtime-manager-panel")).toBeVisible();
  await expect(page.getByTestId("gateway-profiles-panel")).toContainText("Gateway Profiles");
  await expect(page.getByTestId("gateway-profile-openclaw-local")).toContainText("OpenClaw Local");
  await expect(page.getByTestId("gateway-profile-openclaw-local")).toContainText("Connected");
  await expect(page.getByTestId("gateway-profile-usage-openclaw-local")).toContainText("Worker Agent");
  await expect(page.getByTestId("runtime-card-mock-local")).toContainText("mock-local");
  await expect(page.getByTestId("runtime-card-openclaw-local")).toContainText("openclaw-local");
  await expect(page.getByTestId("runtime-card-hermes-local")).toContainText("hermes-local");
  await expect(page.getByTestId("runtime-execution-mode-openclaw-local")).toContainText("Protected");
  await expect(page.getByTestId("openclaw-boundary-copy")).toContainText("Protected");
  await expect(page.getByTestId("openclaw-boundary-copy")).toContainText("Real OpenClaw Agent and Tool execution remains blocked");
  await expect(page.getByTestId("runtime-status-openclaw-local")).toContainText("online");
  await expect(page.getByTestId("openclaw-gateway-summary")).toContainText("http://localhost:25311");
  await expect(page.getByTestId("openclaw-export-task-button")).toBeVisible();
  await expect(page.getByTestId("openclaw-copy-task-button")).toBeVisible();

  await page.getByTestId("openclaw-export-task-button").click();
  await expect(page.getByTestId("openclaw-task-preview")).toBeVisible();
  const openClawTaskPayload = JSON.parse(await page.getByTestId("openclaw-task-preview").innerText());
  expect(openClawTaskPayload).toEqual(
    expect.objectContaining({
      targetRuntimeId: "openclaw-local",
      realExecutionBlocked: true,
      protectedDryRun: true
    })
  );
  expect(openClawTaskPayload.targetGateway).toEqual(
    expect.objectContaining({
      baseUrl: "http://localhost:25311",
      healthPath: "/health",
      status: "connected",
      protected: true
    })
  );
  expect(openClawTaskPayload.workspaceDefaultGateway).toEqual(
    expect.objectContaining({
      baseUrl: "http://localhost:25311",
      healthPath: "/health",
      status: "connected",
      protected: true
    })
  );
  expect(openClawTaskPayload.gatewayProfiles).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "openclaw-local",
        name: "OpenClaw Local",
        baseUrl: "http://localhost:25311",
        protected: true
      })
    ])
  );
  expect(openClawTaskPayload.agentGatewayBindings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        nodeId: "node.agent.worker",
        bindingMode: "profile",
        profileId: "openclaw-local",
        resolvedGateway: expect.objectContaining({
          source: "profile",
          baseUrl: "http://localhost:25311",
          protected: true
        })
      })
    ])
  );
  expect(openClawTaskPayload.flow.nodes).toEqual(
    expect.arrayContaining([expect.objectContaining({ label: "Manual Trigger" })])
  );
  expect(openClawTaskPayload.linearExecutionPlan).toEqual(
    expect.objectContaining({ status: expect.any(String) })
  );
  expect(openClawTaskPayload.readiness).toEqual(
    expect.objectContaining({ status: expect.any(String) })
  );

  openClawHealthStatus = "offline";
  openClawProbeStatus = "offline";
  await page.getByTestId("runtime-manager-health-check-button").click();
  await expect(page.getByTestId("runtime-status-openclaw-local")).toContainText("offline");
  await expect(page.getByTestId("openclaw-dogfood-status")).toContainText("Unavailable");
  await expect(page.getByTestId("gateway-profile-openclaw-local")).toContainText("Unavailable");
  await page.getByTestId("runtime-manager-button").click();
  await expect(page.getByTestId("inspector-gateway-warning")).toContainText("Gateway unavailable warning");

  await page.getByTestId("gateway-connect-button").click();
  await expect(page.getByTestId("gateway-quick-connect-status")).toContainText("Unavailable");
  expect(runRequests).toBe(0);
});

test("gateway profile manager creates, binds, exports, and clears custom profiles safely", async ({ page }) => {
  let runRequests = 0;

  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/runs") {
      runRequests += 1;
    }
  });

  await page.route("**/api/runtimes/openclaw-local/probe", async (route) => {
    const body = route.request().postDataJSON() as { baseUrl?: string; healthPath?: string };
    const baseUrl = body.baseUrl ?? "http://localhost:25311";
    const healthPath = body.healthPath ?? "/health";
    const isCustomOfflineProfile = baseUrl.includes("25312");
    const checkedAt = new Date().toISOString();

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        runtimeId: "openclaw-local",
        health: {
          runtimeId: "openclaw-local",
          status: isCustomOfflineProfile ? "offline" : "online",
          checkedAt,
          latencyMs: 2,
          message: isCustomOfflineProfile
            ? "OpenClaw profile is unavailable. Real execution remains blocked."
            : "OpenClaw local gateway is reachable. Real Agent and Tool execution remains blocked."
        },
        connection: {
          baseUrl,
          healthPath,
          healthUrl: `${baseUrl}${healthPath}`,
          status: isCustomOfflineProfile ? "unavailable" : "connected",
          protected: true,
          checkedAt
        }
      })
    });
  });

  await minimizeWorkspacePanels(page);
  await page.getByTestId("runtime-manager-button").click();
  await expect(page.getByTestId("gateway-profile-delete-openclaw-local")).toBeDisabled();
  await expect(page.getByTestId("gateway-profile-default-note-openclaw-local")).toContainText(
    "Cannot delete default gateway profile"
  );

  await page.getByTestId("gateway-profile-add-button").click();
  await expect(page.getByTestId("gateway-profile-openclaw-local-2")).toBeVisible();
  await page.getByTestId("gateway-profile-name-openclaw-local-2").fill("OpenClaw Lab");
  await page.getByTestId("gateway-profile-base-url-openclaw-local-2").fill("http://localhost:25312");
  await page.getByTestId("gateway-profile-health-path-openclaw-local-2").fill("/health");
  await expect(page.getByTestId("gateway-profile-name-openclaw-local-2")).toHaveValue("OpenClaw Lab");
  await expect(page.getByTestId("gateway-profile-base-url-openclaw-local-2")).toHaveValue(
    "http://localhost:25312"
  );

  await page.getByTestId("gateway-profile-check-openclaw-local-2").click();
  await expect(page.getByTestId("gateway-profile-openclaw-local-2")).toContainText("Unavailable");
  expect(runRequests).toBe(0);

  await page.getByTitle("Close Runtime Manager").click();
  await page.getByTestId(NODE_IDS.worker).click();
  await page.getByTestId("inspector-runtime-select").selectOption("openclaw-local");
  await page.getByTestId("inspector-gateway-binding-mode").selectOption("profile");
  await page.getByTestId("inspector-gateway-profile-select").selectOption("openclaw-local-2");
  await expect(page.getByTestId("inspector-gateway-status")).toContainText("OpenClaw Lab");
  await expect(page.getByTestId("inspector-gateway-status")).toContainText("Unavailable");
  await expect(page.getByTestId("inspector-gateway-warning")).toContainText("Gateway unavailable warning");
  await expect(page.getByTestId(`${NODE_IDS.worker}-gateway-badge`)).toContainText("OpenClaw Lab");

  await page.getByTestId("runtime-manager-button").click();
  await expect(page.getByTestId("gateway-profile-usage-openclaw-local-2")).toContainText("Worker Agent");
  await expect(page.getByTestId("gateway-profile-usage-openclaw-local")).toContainText(
    "No agents using this gateway"
  );

  await page.getByTestId("openclaw-export-task-button").click();
  await expect(page.getByTestId("openclaw-task-preview")).toBeVisible();
  const openClawTaskPayload = JSON.parse(await page.getByTestId("openclaw-task-preview").innerText());
  expect(openClawTaskPayload).toEqual(
    expect.objectContaining({
      schemaVersion: "clawflow.openclaw.manual-task.v0",
      source: "clawflow-studio",
      targetRuntimeId: "openclaw-local",
      executionMode: "manual_export",
      realExecutionBlocked: true,
      protectedDryRun: true
    })
  );
  expect(Date.parse(openClawTaskPayload.generatedAt)).not.toBeNaN();
  expect(openClawTaskPayload.gatewayProfiles).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "openclaw-local" }),
      expect.objectContaining({
        id: "openclaw-local-2",
        name: "OpenClaw Lab",
        baseUrl: "http://localhost:25312",
        status: "unavailable",
        protected: true
      })
    ])
  );
  expect(openClawTaskPayload.agentGatewayBindings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        nodeId: "node.agent.worker",
        label: "Worker Agent",
        bindingMode: "profile",
        profileId: "openclaw-local-2",
        resolvedGateway: expect.objectContaining({
          source: "profile",
          profileId: "openclaw-local-2",
          name: "OpenClaw Lab",
          status: "unavailable",
          protected: true
        })
      })
    ])
  );
  expect(runRequests).toBe(0);

  await page.getByTitle("Close Runtime Manager").click();
  await page.getByTitle("Close JSON export").evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
  await expect(page.getByTestId("openclaw-task-preview")).toHaveCount(0);
  await page.getByTestId("reset-layout-button").click();
  await expect(page.getByTestId("view-mode-select")).toHaveValue("default");
  await expect(page.getByTestId("node-display-mode-select")).toHaveValue("auto");
  await page.getByTestId("runtime-manager-button").click();
  await expect(page.getByTestId("gateway-profile-openclaw-local-2")).toBeVisible();
  await page.getByTitle("Close Runtime Manager").click();

  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.getByTestId("demo-guide-button").click();
  await page.getByTestId("reset-demo-flow-button").click();
  await page.keyboard.press("Escape");
  await page.getByTestId(NODE_IDS.worker).click();
  await expect(page.getByTestId("inspector-gateway-binding-mode")).toHaveValue("workspace-default");
  await expect(page.getByTestId(`${NODE_IDS.worker}-gateway-badge`)).toBeHidden();

  const storedState = await page.evaluate(() => ({
    profiles: JSON.parse(window.localStorage.getItem("clawflow.gatewayProfiles") ?? "[]") as Array<{
      id: string;
    }>,
    bindings: window.localStorage.getItem("clawflow.agentGatewayBindings")
  }));
  expect(storedState.profiles).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: "openclaw-local-2" })])
  );
  expect(storedState.bindings).toBeNull();

  await page.getByTestId("runtime-manager-button").click();
  await page.getByTestId("gateway-profile-delete-openclaw-local-2").click();
  await expect(page.getByTestId("gateway-profile-openclaw-local-2")).toHaveCount(0);
  expect(runRequests).toBe(0);
});

test("task launcher generates protected template flows and manual export metadata", async ({ page }) => {
  let runRequests = 0;

  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/runs") {
      runRequests += 1;
    }
  });

  await page.getByTestId("task-launcher-button").evaluate((element) =>
    element.scrollIntoView({ block: "nearest", inline: "center" })
  );
  await page.getByTestId("task-launcher-button").click();
  await expect(page.getByTestId("task-launcher-panel")).toBeVisible();
  await expect(page.getByTestId("task-template-gallery")).toContainText(
    "Excel to Word / Markdown / Summary"
  );
  await expect(page.getByTestId("task-template-preview")).toContainText("Manual export only");

  await page.getByTestId("task-template-excel-report").click();
  await page.getByTestId("task-excel-name-input").fill("Finance workbook brief");
  await page.getByTestId("task-excel-path-input").fill("/Users/demo/input.xlsx");
  await page.getByTestId("task-output-folder-input").fill("/Users/demo/out");
  await page.getByTestId("task-safety-mode-select").selectOption("controlled-write");
  await expect(page.getByTestId("task-gateway-default")).toContainText(
    "Follow Workspace Default Gateway"
  );

  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("Template will replace");
    void dialog.accept();
  });
  await page.getByTestId("task-create-flow-button").click();
  await expect(page.getByTestId("task-launcher-panel")).toHaveCount(0);
  await expect(page.getByTestId("node-template-excel-planner")).toBeVisible();
  await expect(page.getByTestId("node-template-excel-reader")).toBeVisible();
  await expect(page.getByTestId("node-template-excel-word-writer")).toBeVisible();
  await expect(page.getByTestId("node-template-excel-markdown-writer")).toBeVisible();
  await expect(page.getByTestId("node-template-excel-summary")).toBeVisible();

  await minimizeWorkspacePanels(page);
  await page.getByTestId("node-template-excel-reader").click();
  await expect(page.getByTestId("inspector-gateway-section")).toBeVisible();
  await expect(page.getByTestId("inspector-gateway-binding-mode")).toHaveValue("workspace-default");
  await expect(page.getByTestId("inspector-gateway-status")).toContainText(
    "Workspace Default Gateway"
  );

  await page.getByTestId("export-json-button").evaluate((element) =>
    element.scrollIntoView({ block: "nearest", inline: "center" })
  );
  await page.getByTestId("export-json-button").click();
  await page.getByTestId("export-tab-openclaw-task").click();
  await expect(page.getByTestId("openclaw-task-preview")).toBeVisible();
  const openClawTaskPayload = JSON.parse(await page.getByTestId("openclaw-task-preview").innerText());

  expect(openClawTaskPayload).toEqual(
    expect.objectContaining({
      schemaVersion: "clawflow.openclaw.manual-task.v0",
      targetRuntimeId: "openclaw-local",
      realExecutionBlocked: true,
      protectedDryRun: true,
      template: expect.objectContaining({
        templateId: "excel-report",
        templateName: "Excel to Word / Markdown / Summary",
        safetyMode: "controlled-write",
        userInputs: expect.objectContaining({
          taskName: "Finance workbook brief",
          inputExcelPath: "/Users/demo/input.xlsx",
          outputFolder: "/Users/demo/out"
        }),
        expectedOutputs: expect.arrayContaining(["report.docx", "report.md", "summary.md"])
      })
    })
  );
  expect(openClawTaskPayload.agentGatewayBindings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        nodeId: "template.excel.reader",
        label: "Excel Reader Agent",
        bindingMode: "workspace-default",
        resolvedGateway: expect.objectContaining({
          source: "workspace-default",
          protected: true
        })
      })
    ])
  );
  expect(openClawTaskPayload.flow.nodes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "template.excel.reader",
        data: expect.objectContaining({
          template: expect.objectContaining({ templateId: "excel-report" }),
          gatewayBinding: "workspace-default"
        })
      })
    ])
  );
  expect(runRequests).toBe(0);

  await page.getByTitle("Close JSON export").evaluate((element) => {
    (element as HTMLButtonElement).click();
  });

  await createTemplateFlow(page, "task-template-local-file-summary", async () => {
    await page.getByTestId("task-local-file-path-input").fill("/Users/demo/notes");
    await page.getByTestId("task-output-markdown-input").fill("/Users/demo/summary.md");
  });
  await expect(page.getByTestId("node-template-local-file-reader")).toBeVisible();
  await expect(page.getByTestId("node-template-local-file-summary")).toBeVisible();

  await createTemplateFlow(page, "task-template-multi-agent-planning", async () => {
    await page.getByTestId("task-planning-goal-input").fill("Plan a private beta bug triage cycle");
    await page.getByTestId("task-worker-count-input").fill("3");
  });
  await expect(page.getByTestId("node-template-planning-planner")).toBeVisible();
  await expect(page.getByTestId("node-template-planning-worker-1")).toBeVisible();
  await expect(page.getByTestId("node-template-planning-worker-3")).toBeVisible();
  await expect(page.getByTestId("node-template-planning-reviewer")).toBeVisible();
  await expect(page.getByTestId("node-template-planning-summary")).toBeVisible();
  expect(runRequests).toBe(0);
});

test("first-run empty states give actionable local demo guidance", async ({ page }) => {
  await page.getByLabel("Language").selectOption("en");

  await minimizeWorkspacePanels(page);
  await openCanvasContextMenu(page);
  await page.getByTestId("context-menu-clear-selection").click();

  await expect(page.getByTestId("inspector-pane")).toContainText("No Node Selected");
  await expect(page.getByTestId("inspector-pane")).toContainText("Open Guide");
  await expect(page.getByTestId("run-inspector")).toContainText("Click Run to execute the safe mock demo");
  await expect(page.getByTestId("run-inspector")).toContainText("Run the mock flow");
  await expect(page.getByTestId("run-readiness-preview")).toContainText("Advisory preflight");
});

test("workspace view modes hide, restore, and persist layout preferences", async ({ page }) => {
  const viewModeSelect = page.getByTestId("view-mode-select");

  await expect(viewModeSelect).toHaveValue("default");
  await expect(page.getByTestId("node-library")).toBeVisible();
  await expect(page.getByTestId("inspector-pane")).toBeVisible();
  await expect(page.getByTestId("session-console-panel")).toBeVisible();
  await expect(page.getByTestId("execution-contract-preview-panel")).toBeVisible();
  await expect(page.getByTestId("linear-execution-plan-panel")).toBeVisible();
  await expect(page.getByTestId("resource-estimate-panel")).toBeVisible();
  await expect(page.getByTestId("run-inspector")).toBeVisible();
  await expect(page.getByTestId("execution-action-strip")).toBeVisible();
  await expectRunButtonInExecutionStrip(page);
  await expectTopBarControlsReachable(page);

  await viewModeSelect.selectOption("focus");
  await expect(page.getByTestId("studio-shell")).toHaveAttribute("data-workspace-mode", "focus");
  await expect(page.getByTestId("node-library")).toBeHidden();
  await expect(page.getByTestId("inspector-pane")).toBeHidden();
  await expect(page.getByTestId("session-console-panel")).toBeHidden();
  await expect(page.getByTestId("execution-contract-preview-panel")).toBeHidden();
  await expect(page.getByTestId("linear-execution-plan-panel")).toBeHidden();
  await expect(page.getByTestId("resource-estimate-panel")).toBeHidden();
  await expect(page.getByTestId("run-inspector")).toBeHidden();
  await expect(page.getByTestId("execution-action-strip")).toBeVisible();
  await expect(page.getByTestId("clawflow-canvas")).toBeVisible();
  await expectTopBarControlsReachable(page);

  await page.reload();
  await expect(page.getByTestId("studio-shell")).toHaveAttribute("data-workspace-mode", "focus");
  await expect(page.getByTestId("view-mode-select")).toHaveValue("focus");
  await expect(page.getByTestId("execution-action-strip")).toBeVisible();
  await expectTopBarControlsReachable(page);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("studio-shell")).toHaveAttribute("data-workspace-mode", "default");
  await expect(page.getByTestId("node-library")).toBeVisible();
  await expect(page.getByTestId("run-inspector")).toBeVisible();
  await expect(page.getByTestId("execution-action-strip")).toBeVisible();

  await page.getByTestId("view-mode-select").selectOption("run-monitor");
  await expect(page.getByTestId("studio-shell")).toHaveAttribute(
    "data-workspace-mode",
    "run-monitor"
  );
  await expect(page.getByTestId("session-console-panel")).toBeVisible();
  await expect(page.getByTestId("run-inspector")).toBeVisible();
  await expect(page.getByTestId("execution-action-strip")).toBeVisible();
  await expect(page.getByTestId("node-library")).toBeHidden();
  await expect(page.getByTestId("inspector-pane")).toBeHidden();
  await expect(page.getByTestId("execution-contract-preview-panel")).toBeHidden();
  await expectTopBarControlsReachable(page);

  await page.getByTestId("view-mode-select").selectOption("debug");
  await expect(page.getByTestId("studio-shell")).toHaveAttribute("data-workspace-mode", "debug");
  await expect(page.getByTestId("session-console-panel")).toBeVisible();
  await expect(page.getByTestId("execution-contract-preview-panel")).toBeVisible();
  await expect(page.getByTestId("inspector-pane")).toBeVisible();
  await expect(page.getByTestId("run-inspector")).toBeVisible();
  await expect(page.getByTestId("linear-execution-plan-panel")).toBeHidden();
  await expectTopBarControlsReachable(page);

  await page.getByTestId("view-mode-select").selectOption("default");
  await expect(page.getByTestId("studio-shell")).toHaveAttribute("data-workspace-mode", "default");
  await expect(page.getByTestId("node-library")).toBeVisible();
  await expect(page.getByTestId("linear-execution-plan-panel")).toBeVisible();
  await expect(page.getByTestId("resource-estimate-panel")).toBeVisible();
  await expect(page.getByTestId("run-inspector")).toBeVisible();
});

test("node display modes switch, auto-map workspace modes, and persist", async ({ page }) => {
  const nodeDisplaySelect = page.getByTestId("node-display-mode-select");
  const viewModeSelect = page.getByTestId("view-mode-select");
  const workerNode = page.getByTestId(NODE_IDS.worker);

  await expect(nodeDisplaySelect).toHaveValue("auto");
  await expect(page.getByTestId("node-display-mode-control")).toContainText("Node:");
  await expect(page.getByTestId("node-display-mode-hint")).toContainText("Auto follows workspace mode");
  await expect(nodeDisplaySelect.locator("option")).toHaveText([
    "Auto",
    "Compact",
    "Standard",
    "Detailed",
    "Trace"
  ]);
  await expect(workerNode).toHaveAttribute("data-node-display-mode", "standard");
  await expect(page.getByTestId(`${NODE_IDS.worker}-meta`)).toBeVisible();
  await expect(page.getByTestId(`${NODE_IDS.worker}-estimate-badge`)).toBeVisible();

  await nodeDisplaySelect.selectOption("compact");
  await expect(workerNode).toHaveAttribute("data-node-display-mode", "compact");
  await expect(page.getByTestId(`${NODE_IDS.worker}-compact-meta`)).toBeVisible();
  await expect(page.getByTestId(`${NODE_IDS.worker}-meta`)).toBeHidden();
  await expect(page.getByTestId(`${NODE_IDS.worker}-contract-badges`)).toBeHidden();
  await expect(page.getByTestId(`${NODE_IDS.worker}-estimate-badge`)).toBeHidden();
  await expect(page.getByTestId(`${NODE_IDS.worker}-companion-slot`)).toBeHidden();

  await nodeDisplaySelect.selectOption("detailed");
  await expect(workerNode).toHaveAttribute("data-node-display-mode", "detailed");
  await expect(page.getByTestId(`${NODE_IDS.worker}-meta`)).toBeVisible();
  await expect(page.getByTestId(`${NODE_IDS.worker}-contract-badges`)).toBeVisible();
  await expect(page.getByTestId(`${NODE_IDS.worker}-estimate-badge`).locator("span")).toHaveCount(4);

  await nodeDisplaySelect.selectOption("trace");
  await expect(workerNode).toHaveAttribute("data-node-display-mode", "trace");
  await expect(page.getByTestId(`${NODE_IDS.worker}-trace-status`)).toBeVisible();
  await expect(page.getByTestId(`${NODE_IDS.worker}-meta`)).toBeHidden();
  await expect(page.getByTestId(`${NODE_IDS.worker}-estimate-badge`)).toBeHidden();

  await nodeDisplaySelect.selectOption("auto");
  await expect(workerNode).toHaveAttribute("data-node-display-mode", "standard");

  await viewModeSelect.selectOption("focus");
  await expect(workerNode).toHaveAttribute("data-node-display-mode", "compact");

  await viewModeSelect.selectOption("debug");
  await expect(workerNode).toHaveAttribute("data-node-display-mode", "detailed");

  await viewModeSelect.selectOption("run-monitor");
  await expect(workerNode).toHaveAttribute("data-node-display-mode", "trace");

  await viewModeSelect.selectOption("default");
  await nodeDisplaySelect.selectOption("detailed");
  await page.reload();
  await expect(page.getByTestId("node-display-mode-select")).toHaveValue("detailed");
  await expect(page.getByTestId(NODE_IDS.worker)).toHaveAttribute("data-node-display-mode", "detailed");
});

test("workspace presets apply scenario layouts and reset restores the default shell", async ({ page }) => {
  const presetSelect = page.getByTestId("workspace-preset-select");
  const nodeDisplaySelect = page.getByTestId("node-display-mode-select");
  const viewModeSelect = page.getByTestId("view-mode-select");

  await expect(presetSelect).toHaveValue("custom");

  await presetSelect.selectOption("builder");
  await expect(page.getByTestId("studio-shell")).toHaveAttribute("data-workspace-preset", "builder");
  await expect(viewModeSelect).toHaveValue("default");
  await expect(nodeDisplaySelect).toHaveValue("standard");
  await expect(page.getByTestId("node-library")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId("inspector-pane")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId("run-inspector")).toHaveAttribute("data-collapsed", "true");

  await presetSelect.selectOption("runner");
  await expect(page.getByTestId("studio-shell")).toHaveAttribute("data-workspace-preset", "runner");
  await expect(viewModeSelect).toHaveValue("run-monitor");
  await expect(nodeDisplaySelect).toHaveValue("trace");
  await expect(page.getByTestId("session-console-panel")).toBeVisible();
  await expect(page.getByTestId("run-inspector")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId(NODE_IDS.worker)).toHaveAttribute("data-node-display-mode", "trace");

  await presetSelect.selectOption("reviewer");
  await expect(page.getByTestId("studio-shell")).toHaveAttribute("data-workspace-preset", "reviewer");
  await expect(viewModeSelect).toHaveValue("debug");
  await expect(nodeDisplaySelect).toHaveValue("detailed");
  await expect(page.getByTestId("inspector-pane")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId("run-inspector")).toHaveAttribute("data-collapsed", "false");

  await presetSelect.selectOption("presenter");
  await expect(page.getByTestId("studio-shell")).toHaveAttribute("data-workspace-preset", "presenter");
  await expect(viewModeSelect).toHaveValue("focus");
  await expect(nodeDisplaySelect).toHaveValue("compact");
  await expect(page.getByTestId("node-library")).toBeHidden();
  await expect(page.getByTestId("inspector-pane")).toBeHidden();
  await expect(page.getByTestId("run-inspector")).toBeHidden();

  const resetButton = page.getByTestId("reset-layout-button");
  await resetButton.evaluate((element) =>
    element.scrollIntoView({ block: "nearest", inline: "center" })
  );
  await resetButton.click();
  await expect(page.getByTestId("studio-shell")).toHaveAttribute("data-workspace-preset", "custom");
  await expect(viewModeSelect).toHaveValue("default");
  await expect(nodeDisplaySelect).toHaveValue("auto");
  await expect(page.getByTestId("node-library")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId("inspector-pane")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId("run-inspector")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId(NODE_IDS.worker)).toHaveAttribute("data-node-display-mode", "standard");
});

test("run readiness preview shows localized advisory issues", async ({ page }) => {
  await expect(page.getByTestId("run-readiness-status")).toContainText("Ready with warnings");
  await expect(page.getByTestId("run-readiness-issue-count")).not.toContainText("0");

  await expect(page.getByTestId("run-readiness-issue-summary")).toBeHidden();
  await page.getByTestId("run-readiness-preview").locator("summary").click();
  const summary = page.getByTestId("run-readiness-issue-summary");

  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Advisory preflight only");
  await expect(page.getByTestId("run-readiness-count-error")).toContainText("Error");
  await expect(page.getByTestId("run-readiness-count-warning")).toContainText("Warning");
  await expect(page.getByTestId("run-readiness-count-info")).toContainText("Info");
  await expect(page.getByTestId("run-readiness-group-warning")).toContainText("Advisory warnings");
  await expect(page.getByTestId("run-readiness-group-info")).toContainText("Preview notes");
  await expect(summary).toContainText("Pricing metadata is unavailable.");
  await expect(summary).not.toContainText("runReadiness.issue");
  await expect(summary).not.toContainText("estimator.warning");

  await page.getByLabel("Language").selectOption("zh-CN");
  await expect(page.getByTestId("run-readiness-status")).toContainText("可运行，有提示");
  await expect(page.getByTestId("pre-run-summary")).toContainText(/预检 · \d+ 警告/);
  await expect(summary).toContainText("仅为建议性预检");
  await expect(page.getByTestId("run-readiness-count-warning")).toContainText("警告");
  await expect(page.getByTestId("run-readiness-group-warning")).toContainText("建议性提示");
  await expect(summary).toContainText("定价元数据不可用");
  await expect(summary).not.toContainText("runReadiness.issue");
  await expect(summary).not.toContainText("estimator.warning");

  await page.getByTestId("run-readiness-preview").locator("summary").click();
  await expect(summary).toBeHidden();
});

test("run readiness refreshes for semantic graph changes but not node position drags", async ({ page }) => {
  await expect(page.getByTestId("run-readiness-status")).toContainText("Ready with warnings");

  let readinessRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/flows/run-readiness")) {
      readinessRequests += 1;
    }
  });

  await minimizeWorkspacePanels(page);

  const node = page.getByTestId(NODE_IDS.manual);
  const before = await getBoundingBox(node);

  await dragFromBox(page, before, {
    startOffsetX: 36,
    startOffsetY: 36,
    deltaX: 70,
    deltaY: 42
  });

  await page.waitForTimeout(500);
  expect(readinessRequests).toBe(0);

  await connectHandles(
    page,
    `${NODE_IDS.start}-source-handle`,
    `${NODE_IDS.end}-target-handle`
  );

  await expect.poll(() => readinessRequests).toBeGreaterThan(0);
  await expect(page.getByTestId("run-readiness-status")).toContainText("Needs fixes");
  await expect(page.getByTestId("pre-run-summary")).toContainText(/Pre-run · \d+ fix/);
  await expect(page.getByTestId("run-button")).toBeEnabled();
  await page.getByTestId("run-readiness-preview").locator("summary").click();
  await expect(page.getByTestId("run-readiness-group-error")).toContainText("Fix before reliable run");
  await page.getByLabel("Language").selectOption("zh-CN");
  await expect(page.getByTestId("run-readiness-status")).toHaveText("需修正");
  await expect(page.getByTestId("pre-run-summary")).toContainText(/预检 · \d+ 修正/);
  await expect(page.getByTestId("run-readiness-group-error")).toContainText("建议先修正");
});

test("run readiness preview can render a clean ready state", async ({ page }) => {
  await page.route("**/api/flows/run-readiness", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        issues: [
          {
            code: "resource_estimate.preview_only",
            severity: "info",
            messageKey: "runReadiness.issue.resourceEstimatePreviewOnly"
          }
        ],
        sources: {
          diagnostics: true,
          executionPlan: true,
          resourceEstimate: true
        },
        summary: {
          totalIssues: 1,
          errorIssues: 0,
          warningIssues: 0,
          infoIssues: 1,
          diagnosticIssueCount: 0,
          executionPlanIssueCount: 0,
          resourceEstimateWarningCount: 1
        }
      })
    });
  });

  await page.reload();
  await expect(page.getByTestId("clawflow-canvas")).toBeVisible();

  await expect(page.getByTestId("run-readiness-status")).toHaveText("Ready");
  await expect(page.getByTestId("run-readiness-issue-count")).toContainText("0");
  await expect(page.getByTestId("pre-run-summary")).toHaveText("Pre-run · OK");
});

test("preview panels ignore stale slower responses after a newer semantic refresh", async ({ page }) => {
  const pendingResponses = await installControlledPreviewRoutes(page);

  await page.reload();
  await expect(page.getByTestId("clawflow-canvas")).toBeVisible();
  await waitForPendingPreviewResponses(pendingResponses, 1);

  await page.getByTestId("node-library-item-manual-trigger").click();
  await waitForPendingPreviewResponses(pendingResponses, 2);

  await fulfillPreviewResponses(pendingResponses, 1, createPreviewResponseSet("latest"));

  await expect(page.getByTestId("execution-contract-preview-panel")).toContainText("latest-contract");
  await expect(page.getByTestId("linear-execution-plan-panel")).toContainText("latest-plan");
  await expect(page.getByTestId("resource-estimate-panel")).toContainText("latest-estimate");
  await expect(page.getByTestId("run-readiness-status")).toHaveText("Ready");
  await expect(page.getByTestId("pre-run-summary")).toHaveText("Pre-run · OK");

  await fulfillPreviewResponses(pendingResponses, 0, createPreviewResponseSet("stale"));
  await page.waitForTimeout(150);

  await expect(page.getByTestId("execution-contract-preview-panel")).toContainText("latest-contract");
  await expect(page.getByTestId("execution-contract-preview-panel")).not.toContainText("stale-contract");
  await expect(page.getByTestId("linear-execution-plan-panel")).toContainText("latest-plan");
  await expect(page.getByTestId("linear-execution-plan-panel")).not.toContainText("stale-plan");
  await expect(page.getByTestId("resource-estimate-panel")).toContainText("latest-estimate");
  await expect(page.getByTestId("resource-estimate-panel")).not.toContainText("stale-estimate");
  await expect(page.getByTestId("run-readiness-status")).toHaveText("Ready");
  await expect(page.getByTestId("pre-run-summary")).toHaveText("Pre-run · OK");
});

test("resource estimate panel shows summaries, localized warnings, and unknown cost as non-fatal", async ({ page }) => {
  const panel = page.getByTestId("resource-estimate-panel");

  await expect(panel).toBeVisible();
  await expect(page.getByTestId("resource-estimate-tokens")).toContainText("Tokens");
  await expect(page.getByTestId("resource-estimate-tokens")).toContainText("tokens");
  await expect(page.getByTestId("resource-estimate-cost")).toContainText("Unknown");
  await expect(page.getByTestId("resource-estimate-latency")).toContainText(/ms|s/);
  await expect(page.getByTestId("resource-estimate-confidence")).toContainText(/High|Medium|Low|Unknown/);
  await expect(page.getByTestId("resource-estimate-status")).toContainText("Partial");
  await expect(page.getByTestId("resource-estimate-cost-note")).toContainText("not an execution error");
  await expect(panel).toContainText("Pricing metadata is unavailable.");
  await expect(panel).not.toContainText("estimator.warning");
  await expect(page.getByTestId(`${NODE_IDS.worker}-estimate-badge`)).toContainText("Estimate");

  await page.getByLabel("Language").selectOption("zh-CN");
  await expect(panel).toContainText("定价元数据不可用");
  await expect(panel).toContainText("这不是执行错误");
  await expect(panel).not.toContainText("estimator.warning");
});

test("resource estimate refreshes for semantic graph changes but not node position drags", async ({ page }) => {
  await expect(page.getByTestId("resource-estimate-status")).toContainText(/Partial|Complete/);

  let estimateRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/flows/estimate")) {
      estimateRequests += 1;
    }
  });

  await minimizeWorkspacePanels(page);

  const node = page.getByTestId(NODE_IDS.manual);
  const before = await getBoundingBox(node);

  await dragFromBox(page, before, {
    startOffsetX: 36,
    startOffsetY: 36,
    deltaX: 70,
    deltaY: 42
  });

  await page.waitForTimeout(500);
  expect(estimateRequests).toBe(0);

  await connectHandles(
    page,
    `${NODE_IDS.start}-source-handle`,
    `${NODE_IDS.end}-target-handle`
  );

  await expect.poll(() => estimateRequests).toBeGreaterThan(0);
});

test("node dragging keeps the node interactable", async ({ page }) => {
  await minimizeWorkspacePanels(page);

  const node = page.getByTestId(NODE_IDS.manual);
  const before = await getBoundingBox(node);

  await dragFromBox(page, before, {
    startOffsetX: 36,
    startOffsetY: 36,
    deltaX: 80,
    deltaY: 58
  });

  const after = await getBoundingBox(node);
  expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(20);
  await expect(node).toContainText("Manual Trigger");
});

test("edge deletion and delete-plus-reconnect path works", async ({ page }) => {
  await minimizeWorkspacePanels(page);

  await expect(edgeLocator(page, "edge.manual.trigger.agent.start")).toBeVisible();
  const beforeEdges = await edgeCount(page);

  await edgeLocator(page, "edge.manual.trigger.agent.start").click({ force: true });
  await page.keyboard.press("Delete");
  await expect.poll(() => edgeCount(page)).toBe(beforeEdges - 1);

  await connectHandles(
    page,
    `${NODE_IDS.manual}-source-handle`,
    `${NODE_IDS.start}-target-handle`
  );
  await expect.poll(() => edgeCount(page)).toBe(beforeEdges);
  await expect(page.getByTestId(NODE_IDS.start)).toBeVisible();
});

test("empty canvas context menu opens and adds a node", async ({ page }) => {
  await minimizeWorkspacePanels(page);

  await openCanvasContextMenu(page);

  await expect(page.getByTestId("canvas-context-menu")).toBeVisible();
  await expect(page.getByTestId("context-menu-group-create-node")).toContainText("Create Node");
  await expect(page.getByTestId("context-menu-group-canvas-actions")).toContainText("Canvas Actions");
  await expect(page.getByTestId("context-menu-add-manual-trigger")).toBeVisible();
  await expect(page.getByTestId("context-menu-fit-view")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("canvas-context-menu")).toBeHidden();

  await openCanvasContextMenu(page);
  await page.getByTestId("context-menu-add-worker-agent").click();
  await expect(page.getByTestId("node-node-agent-worker-2")).toBeVisible();
});

test("node context menu can inspect, duplicate, and delete nodes", async ({ page }) => {
  await minimizeWorkspacePanels(page);

  await page.getByTestId(NODE_IDS.worker).click({ button: "right" });
  await expect(page.getByTestId("canvas-context-menu")).toBeVisible();
  await expect(page.getByTestId("context-menu-group-node-actions")).toContainText("Node Actions");
  await expect(page.getByTestId("context-menu-group-node-display")).toContainText("Node Display");
  await expect(page.getByTestId("context-menu-group-danger")).toContainText("Danger");
  await expect(page.getByTestId("context-menu-inspect-node")).toBeVisible();
  await expect(page.getByTestId("context-menu-display-follow-global")).toBeVisible();
  await expect(page.getByTestId("context-menu-display-follow-global")).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("context-menu-display-compact")).toBeVisible();
  await expect(page.getByTestId("context-menu-display-standard")).toBeVisible();
  await expect(page.getByTestId("context-menu-display-detailed")).toBeVisible();
  await expect(page.getByTestId("context-menu-display-trace")).toBeVisible();
  await expect(page.getByTestId("context-menu-hide-details")).toBeVisible();
  await expect(page.getByTestId("context-menu-show-details")).toBeVisible();
  await page.getByTestId("context-menu-inspect-node").click();
  await expect(page.getByTestId(NODE_IDS.worker)).toHaveClass(/is-selected/);

  await page.getByTestId(NODE_IDS.worker).click({ button: "right" });
  await page.getByTestId("context-menu-hide-details").click();
  await expect(page.getByTestId(NODE_IDS.worker)).toHaveAttribute("data-node-display-mode", "compact");
  await expect(page.getByTestId(`${NODE_IDS.worker}-meta`)).toBeHidden();

  await page.getByTestId(NODE_IDS.worker).click({ button: "right" });
  await page.getByTestId("context-menu-show-details").click();
  await expect(page.getByTestId(NODE_IDS.worker)).toHaveAttribute("data-node-display-mode", "standard");
  await expect(page.getByTestId(`${NODE_IDS.worker}-meta`)).toBeVisible();

  await page.getByTestId(NODE_IDS.worker).click({ button: "right" });
  await page.getByTestId("context-menu-display-detailed").click();
  await expect(page.getByTestId(NODE_IDS.worker)).toHaveAttribute("data-node-display-mode", "detailed");
  await expect(page.getByTestId(`${NODE_IDS.worker}-contract-badges`)).toBeVisible();

  await page.getByTestId(NODE_IDS.worker).click({ button: "right" });
  await expect(page.getByTestId("context-menu-display-detailed")).toHaveAttribute("data-active", "true");
  await page.getByTestId("context-menu-display-follow-global").click();
  await expect(page.getByTestId(NODE_IDS.worker)).toHaveAttribute("data-node-display-mode", "standard");

  await page.getByTestId(NODE_IDS.worker).click({ button: "right" });
  await page.getByTestId("context-menu-duplicate-node").click();
  await expect(page.getByTestId("node-node-agent-worker-2")).toBeVisible();

  await page.getByTestId("node-node-agent-worker-2").click({ button: "right" });
  await page.getByTestId("context-menu-delete-node").click();
  await expect(page.getByTestId("node-node-agent-worker-2")).toBeHidden();
});

test("edge context menu can delete an edge", async ({ page }) => {
  await minimizeWorkspacePanels(page);

  const beforeEdges = await edgeCount(page);
  await edgeLocator(page, "edge.manual.trigger.agent.start").click({ button: "right", force: true });
  await expect(page.getByTestId("canvas-context-menu")).toBeVisible();

  await page.getByTestId("context-menu-delete-edge").click();
  await expect.poll(() => edgeCount(page)).toBe(beforeEdges - 1);
});

test("context menu works in focus mode", async ({ page }) => {
  await page.getByTestId("view-mode-select").selectOption("focus");
  await expect(page.getByTestId("studio-shell")).toHaveAttribute("data-workspace-mode", "focus");
  await expect(page.getByTestId("node-library")).toBeHidden();

  await openCanvasContextMenu(page);
  await expect(page.getByTestId("canvas-context-menu")).toBeVisible();
  await page.getByTestId("context-menu-add-console-output").click();

  await expect(page.getByTestId("node-node-output-console-2")).toBeVisible();
  await expect(page.getByTestId("studio-shell")).toHaveAttribute("data-workspace-mode", "focus");
});

test("branching diagnostics are shown without crashing the canvas", async ({ page }) => {
  await minimizeWorkspacePanels(page);

  await connectHandles(
    page,
    `${NODE_IDS.start}-source-handle`,
    `${NODE_IDS.end}-target-handle`
  );
  await restoreLinearPlanPanel(page);

  await expect(page.getByTestId("linear-plan-status")).toContainText("Unsupported");
  await expect(page.getByTestId("linear-execution-plan-panel")).toContainText("Branching");
  await expect(page.getByTestId("clawflow-canvas")).toBeVisible();
});

test("fan-in diagnostics are shown without crashing the canvas", async ({ page }) => {
  await minimizeWorkspacePanels(page);

  await connectHandles(
    page,
    `${NODE_IDS.start}-source-handle`,
    `${NODE_IDS.end}-target-handle`
  );
  await restoreLinearPlanPanel(page);

  await expect(page.getByTestId("linear-plan-status")).toContainText("Unsupported");
  await expect(page.getByTestId("linear-execution-plan-panel")).toContainText("Fan-in");
  await expect(page.getByTestId("clawflow-canvas")).toBeVisible();
});

test("cycle diagnostics are shown without crashing the canvas", async ({ page }) => {
  await minimizeWorkspacePanels(page);

  // React Flow loose connections support this reverse drag path reliably for back edges.
  await connectHandles(
    page,
    `${NODE_IDS.start}-target-handle`,
    `${NODE_IDS.end}-source-handle`
  );
  await restoreLinearPlanPanel(page);

  await expect(page.getByTestId("linear-plan-status")).toContainText("Invalid");
  await expect(page.getByTestId("linear-execution-plan-panel")).toContainText("Cycle detected");
  await expect(page.getByTestId("clawflow-canvas")).toBeVisible();
});

test("floating panels minimize, restore, and drag by header", async ({ page }) => {
  await assertPanelToggle(page, "session-console-panel", "session-console-toggle");
  await assertPanelToggle(
    page,
    "execution-contract-preview-panel",
    "execution-contract-preview-toggle"
  );
  await assertPanelToggle(
    page,
    "linear-execution-plan-panel",
    "linear-execution-plan-toggle"
  );
  await assertPanelToggle(page, "resource-estimate-panel", "resource-estimate-toggle");

  await assertPanelDrag(page, "session-console-panel", "session-console-header");
  await page.getByTestId("session-console-toggle").click();

  await assertPanelDrag(
    page,
    "execution-contract-preview-panel",
    "execution-contract-preview-header"
  );
  await page.getByTestId("execution-contract-preview-toggle").click();

  await assertPanelDrag(page, "linear-execution-plan-panel", "linear-execution-plan-header");
  await page.getByTestId("linear-execution-plan-toggle").click();

  await assertPanelDrag(page, "resource-estimate-panel", "resource-estimate-header");

  await expect(page.getByTestId("clawflow-canvas")).toBeVisible();
});

test("node library, inspector, and run inspector collapse and restore", async ({ page }) => {
  await minimizeWorkspacePanels(page);

  const canvas = page.getByTestId("clawflow-canvas");
  await expect(page.getByTestId("node-library")).toBeVisible();
  await expect(page.getByTestId("node-library-body")).toBeVisible();
  await expect(page.getByTestId("node-library-content")).toBeVisible();
  const expandedCanvas = await getBoundingBox(canvas);
  await page.getByTestId("node-library-toggle").click();
  await expect(page.getByTestId("node-library")).toBeHidden();
  await expect(page.getByTestId("node-library-body")).toBeHidden();
  await expect(page.getByTestId("node-library-content")).toBeHidden();
  await expect(page.getByTestId("node-library-collapsed")).toBeVisible();
  await expect(page.getByTestId("node-library-collapsed")).toContainText("Node Library");
  const leftReclaimedCanvas = await getBoundingBox(canvas);
  expect(leftReclaimedCanvas.x).toBeLessThan(expandedCanvas.x - 20);
  expect(leftReclaimedCanvas.width).toBeGreaterThan(expandedCanvas.width + 20);
  await openCanvasContextMenuAt(
    page,
    leftReclaimedCanvas.x + 24,
    leftReclaimedCanvas.y + leftReclaimedCanvas.height * 0.5
  );
  await expect(page.getByTestId("canvas-context-menu")).toBeVisible();
  await expect(page.getByTestId("context-menu-group-create-node")).toContainText("Create Node");
  await page.keyboard.press("Escape");
  await page.getByTestId("node-library-collapsed").click();
  await expect(page.getByTestId("node-library")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId("node-library-body")).toBeVisible();
  await expect(page.getByTestId("node-library-content")).toBeVisible();

  await page.getByTestId(NODE_IDS.worker).click();
  await expect(page.getByTestId("inspector-pane")).toBeVisible();
  await expect(page.getByTestId("inspector-summary")).toContainText("Worker Agent");
  await expect(page.getByTestId("inspector-body")).toBeVisible();
  await expect(page.getByTestId("inspector-content")).toBeVisible();

  const inspectorExpandedCanvas = await getBoundingBox(canvas);
  await page.getByTestId("inspector-toggle").click();
  await expect(page.getByTestId("inspector-pane")).toBeHidden();
  await expect(page.getByTestId("inspector-body")).toBeHidden();
  await expect(page.getByTestId("inspector-content")).toBeHidden();
  await expect(page.getByTestId("inspector-collapsed")).toBeVisible();
  await expect(page.getByTestId("inspector-collapsed-summary")).toContainText("Worker Agent");
  const rightReclaimedCanvas = await getBoundingBox(canvas);
  expect(rightReclaimedCanvas.width).toBeGreaterThan(inspectorExpandedCanvas.width + 20);
  expect(rightReclaimedCanvas.x + rightReclaimedCanvas.width).toBeGreaterThan(
    inspectorExpandedCanvas.x + inspectorExpandedCanvas.width + 20
  );
  await openCanvasContextMenuAt(
    page,
    inspectorExpandedCanvas.x + inspectorExpandedCanvas.width + 24,
    rightReclaimedCanvas.y + rightReclaimedCanvas.height * 0.35
  );
  await expect(page.getByTestId("canvas-context-menu")).toBeVisible();
  await expect(page.getByTestId("context-menu-fit-view")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("inspector-collapsed").click();
  await expect(page.getByTestId("inspector-pane")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId("inspector-body")).toBeVisible();
  await expect(page.getByTestId("inspector-content")).toBeVisible();

  const restoredCanvas = await getBoundingBox(canvas);
  await page.getByTestId("node-library-toggle").click();
  await page.getByTestId("inspector-toggle").click();
  await expect(page.getByTestId("node-library-collapsed")).toBeVisible();
  await expect(page.getByTestId("inspector-collapsed")).toBeVisible();
  const bothCollapsedCanvas = await getBoundingBox(canvas);
  expect(bothCollapsedCanvas.width).toBeGreaterThan(restoredCanvas.width + 250);
  await page.getByTestId("node-library-collapsed").click();
  await page.getByTestId("inspector-collapsed").click();

  await expect(page.getByTestId("run-inspector")).toBeVisible();
  await expect(page.getByTestId("run-inspector-body")).toBeVisible();
  await expect(page.getByTestId("run-inspector-content")).toBeVisible();
  const expandedRunInspector = await getBoundingBox(page.getByTestId("run-inspector"));

  await page.getByTestId("run-inspector-toggle").click();
  await expect(page.getByTestId("run-inspector")).toHaveAttribute("data-collapsed", "true");
  await expect(page.getByTestId("run-inspector-body")).toBeHidden();
  await expect(page.getByTestId("run-inspector-content")).toBeHidden();
  await expect(page.getByTestId("run-inspector")).toContainText("No Active Session");
  const collapsedRunInspector = await getBoundingBox(page.getByTestId("run-inspector"));
  expect(collapsedRunInspector.height).toBeLessThan(expandedRunInspector.height);

  await page.getByTestId("run-inspector-toggle").click();
  await expect(page.getByTestId("run-inspector")).toHaveAttribute("data-collapsed", "false");
  await expect(page.getByTestId("run-inspector-body")).toBeVisible();
  await expect(page.getByTestId("run-inspector-content")).toBeVisible();
});

test("panel bodies scroll independently without moving the canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 460 });
  await page.evaluate(() => {
    window.localStorage.setItem("clawflow.workspaceViewMode", "default");
    window.localStorage.setItem("clawflow.nodeDisplayMode", "auto");
    window.localStorage.setItem("clawflow.workspacePreset", "custom");
    window.localStorage.setItem(
      "clawflow.workspacePanelState",
      JSON.stringify({
        nodeLibraryCollapsed: false,
        inspectorCollapsed: false,
        runInspectorCollapsed: false
      })
    );
  });
  await page.reload();
  await expect(page.getByTestId("clawflow-canvas")).toBeVisible();
  await minimizeWorkspacePanels(page);

  await expectScrollablePanelBody(page, "node-library-body");
  await page.getByTestId("node-library-toggle").click();
  await expect(page.getByTestId("node-library-body")).toBeHidden();
  await expect(page.getByTestId("node-library-body")).toHaveCount(0);
  await page.getByTestId("node-library-collapsed").click();
  await expect(page.getByTestId("node-library-body")).toBeVisible();

  await page.getByTestId(NODE_IDS.worker).click();
  await page.getByTestId("node-display-mode-select").selectOption("detailed");
  await expectScrollablePanelBody(page, "inspector-body");
  await page.getByTestId("inspector-toggle").click();
  await expect(page.getByTestId("inspector-body")).toBeHidden();
  await expect(page.getByTestId("inspector-body")).toHaveCount(0);
  await page.getByTestId("inspector-collapsed").click();
  await expect(page.getByTestId("inspector-body")).toBeVisible();

  await page.getByTestId("run-inspector-content").evaluate((element) => {
    const fixture = document.createElement("div");
    fixture.dataset.testid = "run-inspector-scroll-fixture";
    fixture.style.gridColumn = "1 / -1";
    fixture.style.minHeight = "520px";
    fixture.textContent = "Run inspector scroll fixture";
    element.appendChild(fixture);
  });
  await expectScrollablePanelBody(page, "run-inspector-body");
  await page.getByTestId("run-inspector-toggle").click();
  await expect(page.getByTestId("run-inspector-body")).toBeHidden();
  await expectNoBoundingBox(page.getByTestId("run-inspector-body"));
  await page.getByTestId("run-inspector-toggle").click();
  await expect(page.getByTestId("run-inspector-body")).toBeVisible();
});

test("mock run reaches success and updates live step status", async ({ page }) => {
  await page.getByTestId("run-button").click();

  await expect(page.locator(".top-status")).toContainText("success", { timeout: 15_000 });
  await expect(page.getByTestId("run-inspector")).toContainText("run.completed");
  await expect(page.getByTestId("run-inspector")).toContainText("execution.plan.completed");
  await expect(page.getByTestId("linear-execution-plan-panel")).toContainText("Live: Completed");
  await expect(page.getByTestId(NODE_IDS.worker)).toContainText("success");
});

test("runtime protection smoke paths stay unchanged", async ({ request }) => {
  const rawMockResponse = await request.post("http://localhost:8787/api/runs", {
    data: createApiFlow("mock-local")
  });
  expect(rawMockResponse.status()).toBe(200);
  await expectRunId(rawMockResponse);

  const mockResponse = await createRun(request, "mock-local");
  expect(mockResponse.status()).toBe(200);
  await expectRunId(mockResponse);

  const openclawResponse = await createRun(request, "openclaw-local");
  expect(openclawResponse.status()).toBe(200);
  await expectRunId(openclawResponse);

  const hermesResponse = await createRun(request, "hermes-local");
  expect(hermesResponse.status()).toBe(400);
  const hermesBody = await hermesResponse.json();
  expect(hermesBody).toEqual(
    expect.objectContaining({
      error: expect.objectContaining({
        code: "runtime_unavailable"
      })
    })
  );
});

test("openclaw quick connect probe rejects non-local and execution-looking targets", async ({ request }) => {
  const remoteResponse = await request.post("http://localhost:8787/api/runtimes/openclaw-local/probe", {
    data: {
      baseUrl: "http://169.254.169.254",
      healthPath: "/health"
    }
  });
  expect(remoteResponse.status()).toBe(400);

  const executionPathResponse = await request.post(
    "http://localhost:8787/api/runtimes/openclaw-local/probe",
    {
      data: {
        baseUrl: "http://localhost:25311",
        healthPath: "/api/tasks/run"
      }
    }
  );
  expect(executionPathResponse.status()).toBe(400);
});

test("run readiness endpoint reports ready, warning, and blocked preflight states", async ({ request }) => {
  const readyResponse = await createRunReadinessReport(request, createReadyInternalFlow());
  expect(readyResponse.status()).toBe(200);
  const readyBody = await readyResponse.json();
  expect(readyBody).toEqual(
    expect.objectContaining({
      status: "ready",
      sources: {
        diagnostics: true,
        executionPlan: true,
        resourceEstimate: true
      }
    })
  );
  expect(readyBody.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "resource_estimate.preview_only",
        severity: "info"
      })
    ])
  );

  const warningResponse = await createRunReadinessReport(request, createApiFlow("mock-local"));
  expect(warningResponse.status()).toBe(200);
  const warningBody = await warningResponse.json();
  expect(warningBody.status).toBe("warning");
  expect(warningBody.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        severity: "warning",
        messageKey: "estimator.warning.unknownPricing"
      })
    ])
  );

  const blockedResponse = await createRunReadinessReport(request, createEmptyFlow());
  expect(blockedResponse.status()).toBe(200);
  const blockedBody = await blockedResponse.json();
  expect(blockedBody.status).toBe("blocked");
  expect(blockedBody.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "execution_plan.unsupported.empty-flow",
        severity: "error"
      })
    ])
  );
});

async function minimizeWorkspacePanels(page: Page): Promise<void> {
  for (const testId of [
    "session-console-toggle",
    "execution-contract-preview-toggle",
    "linear-execution-plan-toggle",
    "resource-estimate-toggle"
  ]) {
    await page.getByTestId(testId).click({ force: true });
  }
}

async function createTemplateFlow(
  page: Page,
  templateTestId: string,
  configure: () => Promise<void>
): Promise<void> {
  await page.getByTestId("task-launcher-button").evaluate((element) =>
    element.scrollIntoView({ block: "nearest", inline: "center" })
  );
  await page.getByTestId("task-launcher-button").click();
  await expect(page.getByTestId("task-launcher-panel")).toBeVisible();
  await page.getByTestId(templateTestId).click();
  await configure();

  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("Template will replace");
    void dialog.accept();
  });
  await page.getByTestId("task-create-flow-button").click();
  await expect(page.getByTestId("task-launcher-panel")).toHaveCount(0);
}

async function openCanvasContextMenu(page: Page): Promise<void> {
  const canvas = await getBoundingBox(page.getByTestId("clawflow-canvas"));

  await openCanvasContextMenuAt(
    page,
    canvas.x + canvas.width * 0.5,
    canvas.y + canvas.height * 0.86
  );
}

async function openCanvasContextMenuAt(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.click(x, y, { button: "right" });
}

async function restoreLinearPlanPanel(page: Page): Promise<void> {
  const panel = page.getByTestId("linear-execution-plan-panel");

  if (!(await panel.textContent()).includes("Plan status")) {
    await page.getByTestId("linear-execution-plan-toggle").click();
  }
}

type PreviewEndpointKey = "contract" | "plan" | "estimate" | "readiness";

interface PendingPreviewResponse {
  fulfill: (body: unknown) => Promise<void>;
}

type PendingPreviewResponses = Record<PreviewEndpointKey, PendingPreviewResponse[]>;

interface PreviewResponseSet {
  contract: unknown;
  plan: unknown;
  estimate: unknown;
  readiness: unknown;
}

async function installControlledPreviewRoutes(page: Page): Promise<PendingPreviewResponses> {
  const pendingResponses: PendingPreviewResponses = {
    contract: [],
    plan: [],
    estimate: [],
    readiness: []
  };

  await page.route("**/api/flows/execution-contract-preview", async (route) => {
    await new Promise<void>((resolve) => {
      pendingResponses.contract.push({
        fulfill: async (body) => {
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(body)
          });
          resolve();
        }
      });
    });
  });

  await page.route("**/api/flows/linear-execution-plan", async (route) => {
    await new Promise<void>((resolve) => {
      pendingResponses.plan.push({
        fulfill: async (body) => {
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(body)
          });
          resolve();
        }
      });
    });
  });

  await page.route("**/api/flows/estimate", async (route) => {
    await new Promise<void>((resolve) => {
      pendingResponses.estimate.push({
        fulfill: async (body) => {
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(body)
          });
          resolve();
        }
      });
    });
  });

  await page.route("**/api/flows/run-readiness", async (route) => {
    await new Promise<void>((resolve) => {
      pendingResponses.readiness.push({
        fulfill: async (body) => {
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(body)
          });
          resolve();
        }
      });
    });
  });

  return pendingResponses;
}

async function waitForPendingPreviewResponses(
  pendingResponses: PendingPreviewResponses,
  expectedCount: number
): Promise<void> {
  await expect
    .poll(() => Math.min(...Object.values(pendingResponses).map((responses) => responses.length)))
    .toBeGreaterThanOrEqual(expectedCount);
}

async function fulfillPreviewResponses(
  pendingResponses: PendingPreviewResponses,
  responseIndex: number,
  responses: PreviewResponseSet
): Promise<void> {
  const endpointKeys: PreviewEndpointKey[] = ["contract", "plan", "estimate", "readiness"];

  await Promise.all(
    endpointKeys.map((endpointKey) => {
      const pendingResponse = pendingResponses[endpointKey][responseIndex];

      if (pendingResponse === undefined) {
        throw new Error(`Missing pending ${endpointKey} response at index ${responseIndex}.`);
      }

      return pendingResponse.fulfill(responses[endpointKey]);
    })
  );
}

function edgeLocator(page: Page, edgeId: string) {
  return page.locator(`[data-testid="rf__edge-${edgeId}"]`);
}

async function edgeCount(page: Page): Promise<number> {
  return page.locator('[data-testid^="rf__edge"]').count();
}

async function connectHandles(
  page: Page,
  sourceHandleTestId: string,
  targetHandleTestId: string
): Promise<void> {
  const beforeEdges = await edgeCount(page);
  const source = await getBoundingBox(page.getByTestId(sourceHandleTestId));
  const target = await getBoundingBox(page.getByTestId(targetHandleTestId));

  await page.mouse.move(centerX(source), centerY(source));
  await page.mouse.down();
  await page.mouse.move(centerX(target), centerY(target), { steps: 16 });
  await page.mouse.up();

  if ((await edgeCount(page)) > beforeEdges) {
    return;
  }

  await page.mouse.move(centerX(target), centerY(target));
  await page.mouse.down();
  await page.mouse.move(centerX(source), centerY(source), { steps: 16 });
  await page.mouse.up();
}

async function assertPanelToggle(
  page: Page,
  panelTestId: string,
  toggleTestId: string
): Promise<void> {
  const panel = page.getByTestId(panelTestId);
  const expandedHeight = (await getBoundingBox(panel)).height;

  await page.getByTestId(toggleTestId).click();
  await expect.poll(async () => (await getBoundingBox(panel)).height).toBeLessThan(expandedHeight);

  await page.getByTestId(toggleTestId).click();
  await expect.poll(async () => (await getBoundingBox(panel)).height).toBeGreaterThan(expandedHeight - 4);
}

async function assertPanelDrag(
  page: Page,
  panelTestId: string,
  headerTestId: string
): Promise<void> {
  const panel = page.getByTestId(panelTestId);
  const header = page.getByTestId(headerTestId);
  const beforePanel = await getBoundingBox(panel);
  const headerBox = await getBoundingBox(header);

  await page.mouse.move(headerBox.x + 90, headerBox.y + 16);
  await page.mouse.down();
  await page.mouse.move(headerBox.x + 150, headerBox.y + 42, { steps: 8 });
  await page.mouse.up();

  const afterPanel = await getBoundingBox(panel);
  expect(Math.abs(afterPanel.x - beforePanel.x) + Math.abs(afterPanel.y - beforePanel.y)).toBeGreaterThan(8);
}

async function expectRunButtonInExecutionStrip(page: Page): Promise<void> {
  await expect(page.getByTestId("run-button")).toBeVisible();

  const placement = await page.getByTestId("run-button-context").evaluate((element) => ({
    inExecutionStrip: element.closest('[data-testid="execution-action-strip"]') !== null,
    inWorkspaceActions: element.closest('[data-testid="workspace-actions"]') !== null
  }));

  expect(placement).toEqual({
    inExecutionStrip: true,
    inWorkspaceActions: false
  });
}

async function expectTopBarControlsReachable(page: Page): Promise<void> {
  const topBar = page.getByTestId("top-bar");

  for (const testId of [
    "workspace-preset-control",
    "view-mode-control",
    "node-display-mode-control",
    "save-flow-button",
    "export-json-button",
    "runtime-manager-button",
    "task-launcher-button",
    "demo-guide-button",
    "reset-layout-button"
  ]) {
    const control = page.getByTestId(testId);
    await control.evaluate((element) =>
      element.scrollIntoView({ block: "nearest", inline: "center" })
    );
    await expect(control).toBeVisible();
    await expectInsideContainerViewport(control, topBar);
  }
}

async function expectInsideContainerViewport(
  locator: ReturnType<Page["locator"]>,
  container: ReturnType<Page["locator"]>
): Promise<void> {
  const itemBox = await getBoundingBox(locator);
  const containerBox = await getBoundingBox(container);

  expect(itemBox.x).toBeGreaterThanOrEqual(containerBox.x - 1);
  expect(itemBox.x + itemBox.width).toBeLessThanOrEqual(containerBox.x + containerBox.width + 1);
}

async function expectScrollablePanelBody(page: Page, bodyTestId: string): Promise<void> {
  const body = page.getByTestId(bodyTestId);
  await expect(body).toBeVisible();
  await body.evaluate((element) => {
    element.scrollTop = 0;
  });

  const metrics = await body.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

  const canvasTransformBefore = await getCanvasTransform(page);
  await body.hover();
  await page.mouse.wheel(0, 220);
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect.poll(() => getCanvasTransform(page)).toBe(canvasTransformBefore);
}

async function getCanvasTransform(page: Page): Promise<string> {
  return page.locator(".react-flow__viewport").first().evaluate((element) => {
    return window.getComputedStyle(element).transform;
  });
}

async function expectNoBoundingBox(locator: ReturnType<Page["locator"]>): Promise<void> {
  await expect.poll(async () => (await locator.boundingBox()) === null).toBe(true);
}

async function getBoundingBox(locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();

  if (box === null) {
    throw new Error("Expected locator to have a bounding box.");
  }

  return box;
}

async function dragFromBox(
  page: Page,
  box: { x: number; y: number },
  options: {
    startOffsetX: number;
    startOffsetY: number;
    deltaX: number;
    deltaY: number;
  }
): Promise<void> {
  const startX = box.x + options.startOffsetX;
  const startY = box.y + options.startOffsetY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + options.deltaX, startY + options.deltaY, { steps: 12 });
  await page.mouse.up();
}

function centerX(box: { x: number; width: number }): number {
  return box.x + box.width / 2;
}

function centerY(box: { y: number; height: number }): number {
  return box.y + box.height / 2;
}

async function createRun(request: APIRequestContext, runtimeRef: string) {
  return request.post("http://localhost:8787/api/runs", {
    data: {
      flow: createApiFlow(runtimeRef)
    }
  });
}

async function createRunReadinessReport(request: APIRequestContext, flow: ReturnType<typeof createApiFlow>) {
  return request.post("http://localhost:8787/api/flows/run-readiness", {
    data: {
      flow
    }
  });
}

async function expectRunId(response: { json: () => Promise<unknown> }): Promise<void> {
  const body = await response.json();

  expect(body).toEqual(
    expect.objectContaining({
      runId: expect.any(String)
    })
  );
}

function createApiFlow(runtimeRef: string) {
  const now = new Date().toISOString();
  const node = (
    id: string,
    type: string,
    role: string,
    label: string,
    x: number
  ) => ({
    id,
    type,
    role,
    label,
    runtimeRef: role === "trigger" ? "mock-local" : runtimeRef,
    contextPolicy: {
      mode: "upstream",
      includeRunHistory: false
    },
    budgetPolicy: {
      thinking: "low"
    },
    riskPolicy: {
      level: "low",
      requiresApproval: false
    },
    position: {
      x,
      y: 120
    }
  });

  return {
    schemaVersion: "0.1",
    id: `e2e-${runtimeRef}`,
    name: `E2E ${runtimeRef}`,
    nodes: [
      node("node.manual.trigger", "manual.trigger", "trigger", "Manual Trigger", 60),
      node("node.agent.start", "agent.start", "start", "Start Agent", 220),
      node("node.agent.worker", "agent.worker", "process", "Worker Agent", 380),
      node("node.agent.end", "agent.end", "end", "End Agent", 540),
      node("node.output.console", "output.console", "output", "Console Output", 700)
    ],
    edges: [
      { id: "edge.manual.trigger.agent.start", source: "node.manual.trigger", target: "node.agent.start" },
      { id: "edge.agent.start.agent.worker", source: "node.agent.start", target: "node.agent.worker" },
      { id: "edge.agent.worker.agent.end", source: "node.agent.worker", target: "node.agent.end" },
      { id: "edge.agent.end.output.console", source: "node.agent.end", target: "node.output.console" }
    ],
    createdAt: now,
    updatedAt: now
  };
}

function createReadyInternalFlow(): ReturnType<typeof createApiFlow> {
  const now = new Date().toISOString();

  return {
    schemaVersion: "0.1",
    id: "e2e-readiness-ready",
    name: "E2E Readiness Ready",
    nodes: [
      {
        id: "node.manual.trigger",
        type: "manual.trigger",
        role: "trigger",
        label: "Manual Trigger",
        runtimeRef: "mock-local",
        contextPolicy: {
          mode: "upstream",
          includeRunHistory: false
        },
        budgetPolicy: {
          thinking: "low"
        },
        riskPolicy: {
          level: "low",
          requiresApproval: false
        },
        position: {
          x: 60,
          y: 120
        }
      },
      {
        id: "node.output.console",
        type: "output.console",
        role: "output",
        label: "Console Output",
        runtimeRef: "mock-local",
        contextPolicy: {
          mode: "upstream",
          includeRunHistory: false
        },
        budgetPolicy: {
          thinking: "low"
        },
        riskPolicy: {
          level: "low",
          requiresApproval: false
        },
        position: {
          x: 220,
          y: 120
        }
      }
    ],
    edges: [
      {
        id: "edge.manual.trigger.output.console",
        source: "node.manual.trigger",
        target: "node.output.console",
        sourceHandle: "out",
        targetHandle: "in"
      }
    ],
    createdAt: now,
    updatedAt: now
  };
}

function createEmptyFlow(): ReturnType<typeof createApiFlow> {
  const now = new Date().toISOString();

  return {
    schemaVersion: "0.1",
    id: "e2e-readiness-empty",
    name: "E2E Readiness Empty",
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now
  };
}

function createPreviewResponseSet(labelPrefix: "latest" | "stale"): PreviewResponseSet {
  const isStale = labelPrefix === "stale";

  return {
    contract: createExecutionContractPreview(`${labelPrefix}-contract`, isStale),
    plan: createLinearExecutionPlan(`${labelPrefix}-plan`, isStale),
    estimate: createFlowEstimate(`${labelPrefix}-estimate`, isStale),
    readiness: createRunReadinessBody(isStale ? "blocked" : "ready")
  };
}

function createExecutionContractPreview(label: string, isBlocked: boolean) {
  return {
    flowId: `e2e-${label}`,
    nodes: [
      {
        nodeId: `node.${label}`,
        nodeType: "agent.worker",
        label,
        category: "agent",
        contractSource: "catalog",
        inputs: [],
        outputs: [],
        executionMode: isBlocked ? "blocked" : "mock-executable",
        capability: {
          provider: "runtime",
          runtimeRef: "mock-local",
          riskLevel: isBlocked ? "dangerous" : "safe",
          description: "Controlled E2E preview response."
        },
        missingRequiredInputs: [],
        warnings: isBlocked ? [`${label} warning`] : [],
        errors: [],
        isExecutable: !isBlocked,
        isPreviewable: true
      }
    ],
    warnings: isBlocked ? [`${label} warning`] : [],
    errors: [],
    summary: {
      totalNodes: 1,
      executableNodes: isBlocked ? 0 : 1,
      blockedNodes: isBlocked ? 1 : 0,
      previewOnlyNodes: 0,
      triggerNodes: 0,
      outputNodes: 0,
      riskCounts: {
        safe: isBlocked ? 0 : 1,
        medium: 0,
        dangerous: isBlocked ? 1 : 0
      }
    }
  };
}

function createLinearExecutionPlan(label: string, isBlocked: boolean) {
  return {
    flowId: `e2e-${label}`,
    status: isBlocked ? "blocked" : "ready",
    steps: [
      {
        stepId: `step.${label}`,
        order: 1,
        nodeId: `node.${label}`,
        nodeType: "agent.worker",
        label,
        category: "agent",
        executionMode: isBlocked ? "blocked" : "mock-executable",
        provider: "runtime",
        runtimeRef: "mock-local",
        riskLevel: isBlocked ? "dangerous" : "safe",
        upstreamNodeIds: [],
        downstreamNodeIds: [],
        inputMappings: [],
        outputMappings: [],
        status: isBlocked ? "blocked" : "pending",
        blockingReasons: isBlocked ? ["blocked-node"] : [],
        warnings: [],
        errors: []
      }
    ],
    warnings: [],
    errors: [],
    unsupportedReasons: isBlocked ? ["blocked-node"] : [],
    summary: {
      totalSteps: 1,
      runnableSteps: isBlocked ? 0 : 1,
      blockedSteps: isBlocked ? 1 : 0,
      outputSteps: 0,
      triggerSteps: 0,
      protectedSteps: 0,
      mockExecutableSteps: isBlocked ? 0 : 1,
      previewOnlySteps: 0
    }
  };
}

function createFlowEstimate(label: string, isPartial: boolean) {
  const tokenRange = createEstimateRange("tokens", isPartial ? 220 : 120, isPartial ? 120 : 80, isPartial ? 420 : 180);
  const latencyRange = createEstimateRange("ms", isPartial ? 480 : 120, isPartial ? 220 : 80, isPartial ? 900 : 180);

  return {
    flowId: `e2e-${label}`,
    confidence: isPartial ? "low" : "high",
    tokenConfidence: isPartial ? "low" : "high",
    costConfidence: isPartial ? "unknown" : "high",
    latencyConfidence: isPartial ? "low" : "high",
    nodes: [
      {
        nodeId: `node.${label}`,
        nodeType: "agent.worker",
        label,
        runtimeRef: "mock-local",
        contractSource: "catalog",
        confidence: isPartial ? "low" : "high",
        tokenConfidence: isPartial ? "low" : "high",
        costConfidence: isPartial ? "unknown" : "high",
        latencyConfidence: isPartial ? "low" : "high",
        sources: ["static-default"],
        tokens: {
          inputTokens: tokenRange,
          outputTokens: tokenRange
        },
        cost: isPartial
          ? {
              status: "unknown"
            }
          : {
              status: "zero",
              totalCost: createEstimateRange("usd", 0, 0, 0),
              currency: "USD"
            },
        latency: {
          totalLatencyMs: latencyRange
        },
        warnings: isPartial
          ? [
              {
                code: "unknown_pricing",
                messageKey: "estimator.warning.unknownPricing",
                source: "static-default"
              }
            ]
          : [],
        partial: isPartial
      }
    ],
    totals: {
      tokens: {
        inputTokens: tokenRange,
        outputTokens: tokenRange
      },
      cost: isPartial
        ? {
            status: "unknown"
          }
        : {
            status: "zero",
            totalCost: createEstimateRange("usd", 0, 0, 0),
            currency: "USD"
          },
      latency: {
        totalLatencyMs: latencyRange
      }
    },
    warnings: isPartial
      ? [
          {
            code: "unknown_pricing",
            messageKey: "estimator.warning.unknownPricing",
            source: "static-default"
          }
        ]
      : [],
    partial: isPartial
  };
}

function createEstimateRange(unit: string, expected: number, min: number, max: number) {
  return {
    unit,
    expected,
    min,
    max
  };
}

function createRunReadinessBody(status: "ready" | "blocked") {
  const isBlocked = status === "blocked";

  return {
    status,
    issues: isBlocked
      ? [
          {
            code: "execution_plan.unsupported.blocked-node",
            severity: "error",
            messageKey: "runReadiness.issue.executionPlanUnsupported"
          }
        ]
      : [],
    sources: {
      diagnostics: true,
      executionPlan: true,
      resourceEstimate: true
    },
    summary: {
      totalIssues: isBlocked ? 1 : 0,
      infoIssues: 0,
      warningIssues: 0,
      errorIssues: isBlocked ? 1 : 0,
      diagnosticIssueCount: 0,
      executionPlanStatus: isBlocked ? "blocked" : "ready",
      executionPlanIssueCount: isBlocked ? 1 : 0,
      resourceEstimateWarningCount: 0,
      resourceEstimateConfidence: "high",
      resourceEstimateCostStatus: "zero"
    }
  };
}
