# Phase 5J Validation Report

Date: 2026-05-07

Phase: Canvas Edge Editing & Workspace Interaction Stabilization

## 1. Summary

Phase 5J restored interactive React Flow edge editing and stabilized the main workspace overlays without changing runtime architecture. Canvas edits are now permissive: users can connect nodes, delete edges, reconnect edges, and create unsupported graph shapes for diagnostics. Linear execution constraints remain diagnostic-only in the plan panel and do not block canvas editing.

Floating panels now support minimize/restore. The Session Console, Execution Contract Preview, and Linear Execution Plan panels share lightweight header-only drag behavior with viewport/canvas clamping. The linear plan UI now separates preflight plan status from live run step status so successful runs no longer leave visible plan badges stuck at `pending`.

No real external runtime execution was introduced.

## 2. Changed Files

- `apps/web/src/App.tsx`
- `apps/web/src/store/flowStore.ts`
- `apps/web/src/components/ClawFlowNode.tsx`
- `apps/web/src/components/SessionConsole.tsx`
- `apps/web/src/components/ExecutionContractPreviewPanel.tsx`
- `apps/web/src/components/LinearExecutionPlanPanel.tsx`
- `apps/web/src/hooks/useFloatingPanelDrag.ts`
- `apps/web/src/i18n/en.ts`
- `apps/web/src/i18n/zh-CN.ts`
- `apps/web/src/styles.css`
- `docs/qa/phase-5j-validation-report.md`

## 3. Fixed Issues

- Re-enabled React Flow node connections.
- Added `onConnect` wiring and persisted new edges into `FlowSpec.edges`.
- Added typed edge store actions for add, remove, and reconnect.
- Added basic safe connection rules:
  - no self-connections;
  - no exact duplicate source/sourceHandle/target/targetHandle edges;
  - branching, fan-in, and cycles remain allowed on canvas.
- Added `onEdgesChange` removal support and Delete/Backspace edge deletion.
- Added stable `in` and `out` React Flow handle ids on nodes.
- Added minimize/restore controls to Execution Contract Preview and Linear Execution Plan.
- Added shared lightweight drag behavior for Session Console, Execution Contract Preview, and Linear Execution Plan.
- Reduced floating panel interference by allowing panels to be minimized and dragged away from handles when physically overlapping the graph.
- Added live plan step status mapping from `execution.step.*` RunEvents.
- Updated node and plan badges to show `Preflight: ...` or `Live: ...` status explicitly.
- Debounced structural preview/plan refreshes and stopped position-only changes from triggering preview/plan API calls.
- Localized node card metadata labels for Type, Role, and Runtime.

## 4. Known Limitations

- Floating panels still block node handles while they physically overlap them. The Phase 5J mitigation is minimize/restore and drag, not a full docking or layout system.
- Direct edge reconnect support is wired through React Flow, but manual validation focused on delete + reconnect, which is the reliable fallback path.
- Dragging is intentionally header-only and simple. There is no resize, docking, snapping, or persistent panel layout.
- Preview and linear plan refreshes are debounced and structurally keyed, but in-flight preview requests are not cancelled.
- Invalid graphs are allowed on the canvas. Run validation and plan diagnostics remain responsible for explaining non-runnable graph states.
- Playwright E2E project scaffolding was not added in this phase to keep the stabilization pass focused.

## 5. Validation Commands and Results

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

Gateway health:

```bash
curl -sS http://localhost:8787/health
```

Result: returned `{"status":"ok","service":"clawflow-gateway",...}`.

Web app health:

```bash
curl -sS -I http://localhost:5173/
```

Result: returned HTTP 200.

Runtime API smoke:

- `openclaw-local` run request returned HTTP 200 with a `runId`, preserving protected dry-run behavior.
- `hermes-local` run request returned HTTP 400 with `runtime_unavailable`.

Browser console:

- No browser console errors were observed.
- One React Flow warning appeared during automated drag testing: `trying to drag a node that is not initialized`. The tested drag completed successfully and the warning was non-fatal.

## 6. Manual Browser Test Results

Browser target: `http://localhost:5173/`

Results:

- Page loaded successfully.
- Default five nodes were visible.
- Node dragging worked with pointer drag.
- Manual Trigger output was reconnected to Start Agent input after deleting the original edge.
- Edge deletion worked with Delete.
- Deleted edge could be reconnected.
- Branching edge could be created.
- Fan-in edge could be created.
- Linear Execution Plan reported unsupported branching and fan-in diagnostics without crashing.
- Cycle edge could be created.
- Linear Execution Plan reported `Invalid` with `Cycle detected`.
- Valid default mock run reached `success`.
- Run Inspector displayed `execution.plan.created`, `execution.step.*`, `node.*`, `execution.plan.completed`, and `run.completed` events.
- Node cards updated to `success`.
- Linear plan panel and node plan badges displayed `Live: Completed` after run.
- Session Console minimized and restored.
- Session Console dragged by its header.
- Execution Contract Preview minimized and restored.
- Execution Contract Preview dragged by its header.
- Linear Execution Plan minimized and restored.
- Linear Execution Plan dragged by its header after overlapping panels were moved/collapsed.
- Panel dragging did not pan the React Flow canvas.
- Canvas interaction did not drag panels.
- Panels only blocked handles where they physically overlapped the graph.
- Node card metadata labels showed localized UI labels: `Type`, `Role`, and `Runtime`.
- No obvious desktop layout clipping was observed during smoke testing.

## 7. Whether Playwright Was Added

Playwright was not added as a project dependency.

Validation used the Codex Playwright CLI wrapper against the running Vite app. A repo-level `@playwright/test` scaffold remains recommended before larger Phase 6 work, but it was intentionally deferred to avoid expanding this stabilization pass.

## 8. Recommended Next Phase

Recommended Phase 5K or early Phase 6 preparation:

- Add a minimal Playwright E2E scaffold for workspace smoke tests.
- Cover edge connect/delete/reconnect, panel minimize/restore, invalid graph diagnostics, and mock run success.
- Add targeted tests for runtime protection:
  - `mock-local` succeeds;
  - `openclaw-local` stays protected dry-run;
  - `hermes-local` remains unavailable.
- Consider persistent panel layout only after the interaction model stabilizes.
- Keep DAG execution work separate from canvas editing. Canvas should stay permissive while execution planners explain what is supported.
