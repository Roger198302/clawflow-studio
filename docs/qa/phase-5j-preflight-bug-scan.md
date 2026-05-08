# Phase 5J Preflight Bug Scan

Date: 2026-05-07

Scope: static code audit, local command validation, API smoke checks, and lightweight browser smoke checks for the current Phase 5I state before Phase 5J.

No application source code was changed in this pass.

## 1. Executive summary

The project builds and the current mock/protected runtime paths are still operational. `pnpm typecheck` and `pnpm build` both pass. The gateway and Vite web app respond on the expected localhost ports. The execution contract preview and linear execution plan APIs return valid data for the default five-node flow, and the raw mock run still reaches success in the browser.

The main usability blocker before Phase 5J is canvas edge editing. The node handles are real React Flow handles, but the canvas explicitly disables user connections and has no `onConnect`, `onEdgesChange`, or edge mutation actions in the store. This explains why users cannot freely connect node inputs/outputs, delete edges, reconnect edges, create branches, create fan-in graphs, or create cycles for diagnostic testing.

The next set of issues is floating panel interaction maturity. The Session Console can collapse but cannot be dragged. The Execution Contract Preview and Linear Execution Plan panels render but cannot collapse/minimize. These panels sit above the React Flow canvas and can intercept pointer interaction where they overlap nodes or handles.

The run path is healthy, but Phase 5I added a visible state mismatch: node cards update to `success` after a run, while the linear-plan step indicators on node cards and in the panel remain `pending` because they are derived from preflight plan state rather than live run events.

## 2. Confirmed bugs

### BUG-001: React Flow connections are disabled

Severity: P1

Evidence:
- `apps/web/src/App.tsx` renders `<ReactFlow ... nodesConnectable={false} ...>`.
- The same React Flow instance does not pass `onConnect`.
- `apps/web/src/store/flowStore.ts` has no edge mutation action such as `addEdge`, `deleteEdge`, `removeEdge`, or `reconnectEdge`.
- `apps/web/src/components/ClawFlowNode.tsx` does render real `<Handle>` components, so the primary issue is canvas/store wiring, not missing handle elements.

Impact:
- Users cannot connect Manual Trigger to Start Agent manually.
- Users cannot create new edges for added nodes.
- Users cannot create invalid graphs needed to test Phase 5I diagnostics.

Recommended fix direction:
- Add `onConnect` in `App.tsx`.
- Add a typed store action to append a `FlowEdge`.
- Re-enable `nodesConnectable`.
- Decide whether edge source/target handle ids should be explicit now or deferred until typed multi-port nodes arrive.

### BUG-002: Edge deletion and reconnection are not supported

Severity: P1

Evidence:
- `App.tsx` derives `canvasEdges` from `flow.edges`.
- There is no `onEdgesChange` handler.
- There is no edge delete/reconnect state mutation in `flowStore.ts`.

Impact:
- Users cannot delete an edge.
- Users cannot reconnect a deleted edge.
- Branching, fan-in, and cycle diagnostics cannot be verified through the UI.

Recommended fix direction:
- Add `onEdgesChange` and map React Flow edge removals back to `FlowSpec.edges`.
- Consider adding `edgesReconnectable` or explicit reconnect support if using React Flow's reconnect API.
- Keep invalid graphs allowed on the canvas; diagnostics should explain execution limitations instead of blocking canvas edits.

### BUG-003: Session Console can minimize but cannot be dragged

Severity: P2

Evidence:
- `apps/web/src/components/SessionConsole.tsx` has local `isCollapsed` state only.
- There is no position state, pointer capture, drag handle, or drag event handling.
- CSS positions `.session-console` at `top: 14px; left: 14px`.

Impact:
- The panel can cover nodes/handles and cannot be moved out of the way.
- Users cannot inspect/edit left-side canvas nodes comfortably when the console is expanded.

Recommended fix direction:
- Add a small fixed-position drag system scoped to the Session Console header.
- Clamp to the canvas pane bounds.
- Stop propagation on pointer down inside the panel so panel gestures do not pan/drag the canvas.

### BUG-004: Execution Contract Preview panel cannot minimize

Severity: P2

Evidence:
- `apps/web/src/components/ExecutionContractPreviewPanel.tsx` has no collapsed/minimized state or prop.
- Header exposes only Refresh.
- CSS positions `.execution-preview-panel` as a fixed top-right overlay.

Impact:
- The panel consumes a large top-right region of the canvas.
- It can block interaction with nodes or handles underneath.

Recommended fix direction:
- Add a local collapsed state or lift panel collapsed state into `App.tsx`.
- Retain summary visibility in collapsed mode if useful.

### BUG-005: Linear Execution Plan panel cannot minimize

Severity: P2

Evidence:
- `apps/web/src/components/LinearExecutionPlanPanel.tsx` has no collapsed/minimized state or prop.
- Header exposes only Refresh.
- CSS positions `.linear-plan-panel` as a fixed bottom-right overlay.

Impact:
- The panel consumes the lower-right canvas area and competes with React Flow controls/minimap and node handles.

Recommended fix direction:
- Add the same compact collapse pattern planned for the contract preview panel.
- Keep the full plan visible on demand, not always occupying the canvas.

### BUG-006: Linear plan step status remains pending after successful run

Severity: P2

Evidence:
- Browser smoke showed node cards changing to `success` after Run.
- The same node cards still showed `Step 1 pending` through `Step 5 pending`.
- `flowStore.ts` updates `nodeStatuses` for `node.started`, `node.completed`, and `node.failed`, but the visible linear plan step data comes from preflight `linearExecutionPlan`.

Impact:
- Users see contradictory execution state: node status says success while step status says pending.

Recommended fix direction:
- Keep preflight plan status visually distinct from live run step status, or update a separate live plan-step status map from `execution.step.*` RunEvents.
- Avoid mutating the immutable preflight plan if it is intended as a planning artifact.

### BUG-007: Preview endpoints are requested on every flow position update

Severity: P2

Evidence:
- `App.tsx` requests both execution contract preview and linear execution plan from effects keyed on `flow`.
- `flowStore.updateNodePosition()` touches the flow on every node position update.

Impact:
- Dragging a node can trigger repeated gateway calls for preview and plan updates.
- This is likely to feel sluggish as graphs grow.

Recommended fix direction:
- Debounce preview/plan refresh while nodes are being dragged.
- Optionally split structural flow changes from position-only changes for execution diagnostics.

### BUG-008: Floating panels can block canvas interactions where they overlap the graph

Severity: P2

Evidence:
- `.session-console` uses `z-index: 10`.
- `.execution-preview-panel` and `.linear-plan-panel` use `z-index: 9`.
- `.react-flow__handle` is styled normally but lives inside the React Flow layer below these overlays.

Impact:
- When panels cover nodes or handles, pointer events go to the panel instead of the canvas.
- The problem becomes more visible after edge editing is enabled.

Recommended fix direction:
- Add minimize/drag support first.
- Consider panel `pointer-events` rules only if they do not break panel controls.
- Reserve safe canvas zones or add panel docking later; do not implement a full dock system in Phase 5J.

### BUG-009: Some node-card metadata labels are still hardcoded

Severity: P3

Evidence:
- Browser snapshot showed node card metadata labels `type`, `role`, and `runtime` in English.
- `ClawFlowNode.tsx` contains these literal display labels.

Impact:
- i18n is incomplete for user-facing node metadata.

Recommended fix direction:
- Add i18n keys for node-card metadata labels.
- Keep protocol ids, node ids, runtime ids, event names, and JSON/log payloads in English as designed.

## 3. Likely root causes

The React Flow issue is caused by three missing pieces at once: user connection is disabled, the connection callback is absent, and the Zustand store has no edge mutation API. The handle components are real, so replacing the node handles is not the main fix.

The panel issues come from Phase 5 features being added as fixed absolute overlays. That was reasonable for fast feature delivery, but these panels now need minimal workspace behavior: collapse/restore, optional Session Console drag, and event propagation containment.

The plan status mismatch is a model clarity issue. The linear plan is a preflight artifact, while run events are live execution telemetry. The UI currently presents both on the same node card without clearly separating preflight `pending` from live `success`.

The preview request performance risk comes from using the entire `flow` object as the refresh trigger. Position updates are useful for layout but should not necessarily trigger contract or plan recomputation for every drag frame.

## 4. High-risk regression areas

- Edge persistence: adding interactive edges must preserve `FlowSpec.edges` as the single source of truth.
- Invalid graph editing: Phase 5I diagnostics should report unsupported branching/fan-in/cycles without preventing canvas editing.
- Run validation: the existing Run button should still block non-runnable flows, but canvas editing should remain permissive.
- Runtime execution protection: openclaw-local must stay protected dry-run, and hermes-local/shell-local must remain unavailable.
- Session-bound run gating: paused/cancelled sessions should still reject future session-bound runs.
- WebSocket event ordering: the client closes the stream on `run.completed`/`run.failed`; future post-completion events would be lost.
- Panel pointer interaction: drag/minimize controls must not accidentally pan the canvas or select nodes.
- i18n shape: adding UI labels must preserve the English dictionary as the source shape and `zh-CN` parity.

## 5. Files requiring changes in Phase 5J

Likely required:
- `apps/web/src/App.tsx`
- `apps/web/src/store/flowStore.ts`
- `apps/web/src/components/ClawFlowNode.tsx`
- `apps/web/src/components/SessionConsole.tsx`
- `apps/web/src/components/ExecutionContractPreviewPanel.tsx`
- `apps/web/src/components/LinearExecutionPlanPanel.tsx`
- `apps/web/src/i18n/en.ts`
- `apps/web/src/i18n/zh-CN.ts`
- `apps/web/src/styles.css`

Possibly required:
- `packages/protocol/src/index.ts` if edge/handle ids become part of the shared FlowEdge contract.
- `packages/flow-engine/src/index.ts` if diagnostics need to treat handle-specific ports rather than node-only edges.
- `apps/gateway/src/index.ts` only if API smoke tests reveal plan/preview behavior depends on edge shape changes.

Proposed test-only files:
- `playwright.config.ts`
- `tests/e2e/workspace.spec.ts`
- root `package.json` script updates
- root dev dependency `@playwright/test`

## 6. Recommended Phase 5J fix order

1. Enable safe edge editing on the canvas:
   - add `onConnect`;
   - add `onEdgesChange`;
   - add typed edge add/remove actions in `flowStore.ts`;
   - keep graph edits permissive.

2. Preserve diagnostics behavior:
   - ensure branching returns `unsupported`;
   - ensure fan-in returns `unsupported`;
   - ensure cycles return `invalid` or `unsupported` without crashing;
   - keep Run validation separate from canvas editing.

3. Add panel collapse/restore:
   - Execution Contract Preview;
   - Linear Execution Plan;
   - retain Session Console collapse.

4. Add lightweight Session Console dragging:
   - header-only drag;
   - clamp to canvas;
   - stop pointer propagation;
   - do not implement docking/resizing yet.

5. Clarify live run status versus preflight plan status:
   - either label plan badges as preflight;
   - or add live step status derived from `execution.step.*` events.

6. Add debounce or structural-change filtering for preview/plan requests.

7. Add Playwright E2E smoke coverage before moving into Phase 5J feature work.

## 7. Proposed Playwright E2E scaffold

Playwright is not currently a project dependency. The local QA smoke used the Codex Playwright CLI wrapper via `npx`, but the repo does not define `@playwright/test`, `playwright.config.ts`, or E2E scripts.

Minimal proposed dev dependency:

```json
{
  "devDependencies": {
    "@playwright/test": "^1.52.0"
  }
}
```

Minimal proposed scripts:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed"
  }
}
```

Suggested `playwright.config.ts` shape:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "pnpm dev:gateway",
      url: "http://localhost:8787/health",
      reuseExistingServer: true,
      timeout: 30_000
    },
    {
      command: "pnpm dev:web",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 30_000
    }
  ]
});
```

Recommended `tests/e2e/workspace.spec.ts` coverage:

- app loads without fatal console errors;
- main panels render;
- Session Console minimizes and restores;
- Execution Contract Preview minimizes and restores after Phase 5J fix;
- Linear Execution Plan minimizes and restores after Phase 5J fix;
- default nodes are visible;
- node drag updates position visually;
- edge connection works;
- edge deletion and reconnection work;
- branching/fan-in/cycle diagnostics render without canvas failure;
- mock Run reaches success and Run Inspector receives RunEvents;
- openclaw-local remains protected dry-run;
- hermes-local remains rejected as `runtime_unavailable`.

React Flow should be tested with Playwright rather than jsdom-only tests because node placement, handles, and edges depend on real DOM layout measurements.

## 8. Commands run and results

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm typecheck` | Passed | All workspace TypeScript checks completed successfully. |
| `pnpm build` | Passed | Web production build and gateway/package builds completed successfully. |
| `curl -sS http://localhost:8787/health` | Passed | Returned `{"status":"ok","service":"clawflow-gateway",...}`. |
| `curl -sS -I http://localhost:5173/` | Passed | Returned HTTP 200 from Vite dev server. |
| `POST /api/flows/execution-contract-preview` | Passed | Returned 5 total nodes, 5 executable nodes, 0 blocked nodes. |
| `POST /api/flows/linear-execution-plan` | Passed | Returned `ready` with 5 total/runnable steps. |
| Branching flow to `POST /api/flows/linear-execution-plan` | Passed | Returned `unsupported` with `branching-not-supported` and `fan-in-not-supported`. |
| `POST /api/runs` with mock-local flow | Passed | Returned a run id. |
| `POST /api/sessions` then `POST /api/sessions/:id/run` | Passed | Returned a session id and then a run id. |
| `POST /api/runs` with openclaw-local flow | Passed | Returned a run id for protected dry-run behavior. |
| `POST /api/runs` with hermes-local flow | Passed | Returned 400 with `runtime_unavailable`. |
| `rg -n "@playwright/test\|playwright" package.json apps/*/package.json packages/*/package.json pnpm-lock.yaml` | No matches | No repository-level Playwright test dependency or scripts found. |

`pnpm install` was not run because dependencies are already installed and both typecheck and build succeeded.

`pnpm dev:gateway` and `pnpm dev:web` were not started by this pass; existing localhost services were already running and responded.

## 9. Manual test results

Manual/browser smoke used `http://localhost:5173/` with a real browser session.

| # | Test | Result | Notes |
| --- | --- | --- | --- |
| 1 | Page loads without console errors | Pass | Only React DevTools info log appeared. |
| 2 | Initial nodes are visible | Pass | Five default nodes visible. |
| 3 | Nodes can be dragged | Static pass | `nodesDraggable` is enabled; not exhaustively dragged in this pass. |
| 4 | Manual Trigger output can connect to Start Agent input | Fail | Connections disabled. |
| 5 | Start Agent output can connect to Worker Agent input | Fail | Connections disabled. |
| 6 | Worker Agent output can connect to End Agent input | Fail | Connections disabled. |
| 7 | End Agent output can connect to Console Output input | Fail | Connections disabled. |
| 8 | Edge can be deleted | Missing | No `onEdgesChange` or store delete action. |
| 9 | Deleted edge can be reconnected | Missing | No edge deletion/reconnection support. |
| 10 | Branching connection can be created | Missing | Canvas cannot create connections. API diagnostics support branching detection. |
| 11 | Fan-in connection can be created | Missing | Canvas cannot create connections. API diagnostics support fan-in detection. |
| 12 | Cycle can be created | Missing | Canvas cannot create connections. |
| 13 | Invalid graph is allowed on canvas but shown as non-linearly executable | Partial | API returns unsupported diagnostics for a handcrafted branch; UI cannot create invalid graph yet. |
| 14 | Mock run works for valid linear chain | Pass | Browser Run reached success with 39 RunEvents. |
| 15 | Session console records run events | Pass for API/session-bound run | Session-bound run returned a run id; previous Phase 5I behavior remains visible in Session Console. |
| 16 | Pause/resume/cancel controls behave correctly | Static pass | Controls render with status-based disabled state. Full interaction not exhaustively retested. |
| 17 | Step retry/skip/edit controls render correctly | Static pass | Code renders controls per step. Requires active session steps for full browser retest. |
| 18 | Constraint mode UI works | Static pass | Mode selector and add-constraint actions render. |
| 19 | Execution Contract Preview renders correctly | Pass | Summary and per-node contracts visible. |
| 20 | Execution Contract Preview can be minimized/restored | Missing | No minimize control exists. |
| 21 | Linear Execution Plan renders correctly | Pass | Summary and ordered steps visible. |
| 22 | Linear Execution Plan can be minimized/restored | Missing | No minimize control exists. |
| 23 | MVP Agent Flow Session can be minimized/restored | Pass | Collapse button hides panel to a compact Session button. |
| 24 | MVP Agent Flow Session can be dragged | Missing | No drag behavior exists. |
| 25 | Panel dragging does not drag the canvas | Not applicable | Panel dragging is not implemented. |
| 26 | Canvas dragging does not drag panels | Pass | Panels have fixed absolute positions. |
| 27 | Panel z-index does not block node handle interaction unexpectedly | Risk | Overlays sit above React Flow and can intercept pointer events where they overlap. |
| 28 | Browser refresh does not corrupt default flow state | Not exhaustively tested | Static default flow creation is deterministic; no persistence corruption observed. |
| 29 | English and Simplified Chinese labels are present | Partial | Dictionary shape builds, but node-card `type`/`role`/`runtime` labels remain hardcoded. |
| 30 | No obvious layout clipping at common desktop sizes | Partial | Main layout renders, but three canvas overlays are crowded and can cover graph content. |

## 10. Open questions or limitations

- Should Phase 5J allow arbitrary graph editing first, even when the graph cannot run, and keep Run blocked by validation? This is the recommended direction.
- Should FlowEdge grow explicit `sourceHandle` and `targetHandle` now, or wait for multi-port node work?
- Should preview/plan recomputation ignore position-only edits, debounce them, or support manual refresh only?
- Should linear plan step badges on nodes represent preflight order only, or should they become live step execution badges once a run starts?
- Should the Session Console drag position persist in localStorage, or reset each page load for now?
- Should panel collapse state persist between reloads?
- The current browser smoke did not create a full session and exercise every intervention control end-to-end. The API session-bound path was smoke tested, but intervention controls should receive dedicated Playwright coverage.
- The current report did not create Playwright test files. The scaffold above is proposed for a separate test-only change.
