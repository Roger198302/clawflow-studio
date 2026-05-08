# Phase 5K E2E Validation Report

Date: 2026-05-07

Phase: Playwright E2E Regression Scaffold

## 1. Summary

Phase 5K added a minimal repo-level Playwright E2E scaffold for the core Clawflow Studio workspace. The scaffold starts or reuses the local Gateway and Web app, exercises React Flow canvas behavior in a real browser, and covers the main Phase 5J regression risks: node dragging, edge deletion/reconnection, invalid graph diagnostics, floating panel interaction, mock run telemetry, and runtime protection paths.

No runtime architecture or product execution behavior was changed.

## 2. Changed Files

- `package.json`
- `pnpm-lock.yaml`
- `.gitignore`
- `playwright.config.ts`
- `tests/e2e/workspace.spec.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/components/ClawFlowNode.tsx`
- `apps/web/src/components/SessionConsole.tsx`
- `apps/web/src/components/ExecutionContractPreviewPanel.tsx`
- `apps/web/src/components/LinearExecutionPlanPanel.tsx`
- `docs/qa/phase-5k-e2e-validation-report.md`

## 3. Added Tests

The new E2E suite is in `tests/e2e/workspace.spec.ts`.

Coverage:

- App loads, default workspace nodes render, and no fatal browser console errors are emitted.
- Manual Trigger node can be dragged and remains interactable.
- Existing edge can be deleted and reconnected.
- Branching graph can be created and Linear Execution Plan reports unsupported branching.
- Fan-in graph can be created and Linear Execution Plan reports fan-in diagnostics.
- Cycle graph can be created and Linear Execution Plan reports `Invalid` / `Cycle detected`.
- Session Console, Execution Contract Preview, and Linear Execution Plan panels minimize/restore and drag by header.
- Mock run reaches success, Run Inspector receives events, and linear plan/node badges show `Live: Completed`.
- Runtime protection API smoke:
  - `mock-local` run request returns a run id;
  - `openclaw-local` still returns a protected dry-run run id;
  - `hermes-local` still returns `runtime_unavailable`.

## 4. Playwright Setup

Added root dev dependency:

```bash
@playwright/test
```

Added root scripts:

```bash
pnpm test:e2e
pnpm test:e2e:headed
```

Added `playwright.config.ts` with:

- `testDir: ./tests/e2e`
- Chromium desktop project
- `baseURL: http://localhost:5173`
- `trace: retain-on-failure`
- `reuseExistingServer: true`
- Gateway web server health URL: `http://localhost:8787/health`
- Web app server URL: `http://localhost:5173`

Browser binaries were already available locally; `pnpm exec playwright install` was not needed.

## 5. Stable Selectors Added

Added minimal `data-testid` selectors for reliable tests:

- `clawflow-canvas`
- `react-flow-canvas`
- `run-button`
- `run-inspector`
- `node-manual-trigger`
- `node-start-agent`
- `node-worker-agent`
- `node-end-agent`
- `node-console-output`
- node source/target handle test ids
- `session-console-panel`
- `session-console-header`
- `session-console-toggle`
- `execution-contract-preview-panel`
- `execution-contract-preview-header`
- `execution-contract-preview-toggle`
- `linear-execution-plan-panel`
- `linear-execution-plan-header`
- `linear-execution-plan-toggle`
- `linear-plan-status`

Selectors were added only where semantic selectors were too ambiguous or React Flow internals would otherwise make tests brittle.

## 6. Commands Run and Results

Command:

```bash
pnpm typecheck
```

Result: passed.

Command:

```bash
pnpm build
```

Result: passed.

Command:

```bash
pnpm test:e2e
```

Result: passed.

Final E2E result:

```text
9 passed
```

An initial E2E run exposed two test stability issues caused by floating panels physically covering drag targets in headless Chromium. The tests were adjusted to minimize or move panels before node/linear-plan drag checks. The final run passed.

## 7. E2E Test Results

- App load smoke: passed.
- Node drag smoke: passed.
- Edge delete and reconnect smoke: passed.
- Branching diagnostics: passed.
- Fan-in diagnostics: passed.
- Cycle diagnostics: passed.
- Floating panel minimize/restore/drag: passed.
- Mock run success and live step status: passed.
- Runtime protection smoke: passed.

## 8. Known Limitations

- The edge reconnect coverage validates the stable delete + reconnect workflow. Direct drag-reconnect of an existing edge is wired in the app, but not separately asserted in this initial scaffold.
- The tests intentionally use English UI labels for some assertions. Protocol ids, runtime ids, event names, and JSON payload keys remain English by design.
- The floating panel drag test keeps the implementation honest but does not cover every overlap/docking case. There is still no full dock, resize, snap, or persistent layout system.
- The runtime protection smoke checks run creation responses. It does not attach WebSocket listeners for the `openclaw-local` protected dry-run path because real OpenClaw execution remains disabled.
- The E2E suite is intentionally serial and small. It is meant as a regression floor, not exhaustive interaction coverage.

## 9. Recommended Next Phase

Before larger Phase 6 capability bridge work:

- Add one direct edge reconnect test if React Flow reconnect remains reliable in headless mode.
- Add a session-bound run E2E path once session fixtures are stabilized.
- Add screenshot-on-failure retention only if CI artifact storage is configured.
- Keep future execution planner tests separate from canvas editing tests so unsupported DAG diagnostics remain explicit and debuggable.
