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
    window.localStorage.setItem("clawflow.locale", "en");
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
    const headerBox = await getBoundingBox(header);
    const headerItems = [
      page.getByTestId("brand-lockup"),
      page.getByTestId("top-status"),
      page.getByTestId("run-readiness-preview"),
      page.getByTestId("workspace-actions"),
      page.getByTestId("run-button-context")
    ];

    await expect(header).toBeVisible();
    await expect(page.getByTestId("run-button")).toBeVisible();
    await expect(page.getByTestId("pre-run-summary")).toBeVisible();
    await expect(page.getByLabel("Language")).toBeVisible();

    const hasNoHorizontalScrollbar = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    );
    expect(hasNoHorizontalScrollbar).toBe(true);

    for (const item of headerItems) {
      await expect(item).toBeVisible();
      const box = await getBoundingBox(item);
      expect(box.x).toBeGreaterThanOrEqual(headerBox.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(headerBox.x + headerBox.width + 1);
    }

    const readinessBox = await getBoundingBox(page.getByTestId("run-readiness-preview"));
    const runContextBox = await getBoundingBox(page.getByTestId("run-button-context"));
    expect(boxesOverlap(readinessBox, runContextBox)).toBe(false);

    const summaryFits = await page
      .getByTestId("pre-run-summary")
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
    expect(summaryFits).toBe(true);
  }
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
    await page.getByTestId(testId).click();
  }
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

function boxesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
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
