# Phase 6B-3 Resource Estimate E2E and UX Polish Validation Report

## Summary

Phase 6B-3 strengthened the Resource Estimate UI with clearer preview-only copy, explicit unknown-cost messaging, localized warning display, and stable test selectors. It also added Playwright coverage for resource estimate behavior and refresh rules.

Runtime execution behavior was not changed. Estimates remain local, heuristic, non-blocking, and preview-only.

## Changed Files

- `apps/web/src/components/ResourceEstimatePanel.tsx`
- `apps/web/src/components/ClawFlowNode.tsx`
- `apps/web/src/i18n/en.ts`
- `apps/web/src/i18n/zh-CN.ts`
- `apps/web/src/styles.css`
- `tests/e2e/workspace.spec.ts`
- `docs/qa/phase-6b-3-validation-report.md`

## UX Changes

- Added preview-only helper copy to the Resource Estimate panel.
- Added friendly loading text for estimate generation.
- Added a clear unknown-cost note explaining that missing pricing metadata is not an execution error.
- Added a compact `Node estimates` section label.
- Preserved compact node-level estimate badges and added stable `data-testid` selectors.
- Kept the panel draggable/minimizable and visually aligned with existing floating workspace panels.

## E2E Coverage Added

New Playwright assertions cover:

- Flow-level Resource Estimate summary fields:
  - tokens
  - cost
  - latency
  - confidence
  - status
  - warning count
- Unknown cost rendering as a non-fatal estimate state.
- Localized estimator warning labels instead of raw `messageKey` values.
- zh-CN warning and unknown-cost copy.
- Node-level estimate badge presence.
- Position-only node drag does not trigger `/api/flows/estimate`.
- Semantic graph changes trigger `/api/flows/estimate`.

The existing floating-panel minimize/restore coverage continues to include the Resource Estimate panel.

## Validation Commands and Results

- `pnpm typecheck`: passed.
- `pnpm build`: passed.
- `pnpm test:e2e`: passed, 11/11 tests.

## Known Limitations

- Estimates are still heuristic and can be low confidence.
- Cost remains `Unknown` when provider/model pricing metadata is unavailable.
- No provider pricing registry exists yet.
- No billing logic exists.
- No provider pricing APIs are called.
- Estimates do not block execution.
- The Resource Estimate panel is compact and text-based; no charts or optimizer UI exist.

## Recommended Next Phase

Proceed to the next Phase 6B step by introducing a local model/provider price metadata design or static registry only if the product needs more specific cost estimates. Keep all pricing metadata local and optional until real runtime adapters are ready.
