# Phase 6A-2 Validation Report: Catalog-backed Node UX and Contract Diagnostics

## 1. Summary

Phase 6A-2 exposes the Phase 6A-1 catalog-backed node contract metadata more clearly in the Web UI. Node cards now show compact contract source, category, port, and readiness badges. Execution Contract Preview separates catalog, placeholder, and inferred contracts, and it displays required inputs, recommended inputs, optional inputs, outputs, readiness, and node-level warnings/errors. Linear Execution Plan now highlights missing required input mappings directly on affected steps.

No runtime execution behavior changed. `mock-local`, `openclaw-local` protected dry-run, and unavailable runtime rejection remain on the existing paths.

## 2. Changed Files

- `packages/protocol/src/index.ts`
- `packages/flow-engine/src/index.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/components/ClawFlowNode.tsx`
- `apps/web/src/components/ExecutionContractPreviewPanel.tsx`
- `apps/web/src/components/LinearExecutionPlanPanel.tsx`
- `apps/web/src/i18n/en.ts`
- `apps/web/src/i18n/zh-CN.ts`
- `apps/web/src/styles.css`
- `tests/e2e/workspace.spec.ts`
- `docs/qa/phase-6a-2-validation-report.md`

## 3. UI and Diagnostic Improvements

Node card contract visibility:

- Adds catalog/inferred contract source badge.
- Shows category and execution mode compactly.
- Shows compact input/output summaries.
- Shows readiness as ready, warning, or blocked.
- Keeps existing type, role, runtime, harness, and plan badges.

Execution Contract Preview:

- Distinguishes catalog contracts from placeholder and inferred contracts.
- Displays required inputs, recommended inputs, optional inputs, and outputs.
- Displays readiness per node.
- Keeps existing errors, warnings, runtime, provider, category, execution mode, and risk metadata.
- Unknown node types continue to appear as inferred contracts with warning diagnostics.

Linear Execution Plan:

- Adds a compact missing required inputs callout on affected steps.
- Keeps branching, fan-in, cycle, invalid-edge, and unsupported-structure diagnostics intact.
- Does not block canvas editing.

I18n:

- Added English and Simplified Chinese labels for catalog/inferred contracts, inputs, outputs, required/optional/recommended ports, readiness, and warnings.

## 4. Validation Commands and Results

Commands run:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

Results:

- `pnpm typecheck`: passed
- `pnpm build`: passed
- `pnpm test:e2e`: passed, 9/9 Chromium tests

## 5. E2E Results

Existing Phase 5K/5J regression coverage remains passing:

- app loads
- default nodes render
- node drag remains usable
- edge delete and reconnect works
- branching diagnostics render
- fan-in diagnostics render
- cycle diagnostics render
- floating panels minimize, restore, and drag
- mock run reaches success and live step status updates
- runtime protection smoke paths remain unchanged

Added E2E assertion:

- Execution Contract Preview shows catalog contract information for the default flow, including catalog contract, required inputs, and outputs.

## 6. Known Limitations

- Node catalog still covers only the five MVP default node types.
- Placeholder and unknown nodes remain preview/diagnostic only.
- No real OpenClaw, Hermes, Shell, Browser, filesystem, MCP, RAG, or ComfyUI execution was added.
- No full node marketplace or catalog browser was added.
- No token/cost estimator was added.
- No DAG execution or non-linear execution support was added.
- Node cards intentionally show compact summaries instead of full port schemas.

## 7. Recommended Next Phase

Recommended Phase 6A-3 or Phase 6B preparation:

- Add catalog-backed node inspector details for full input/output schema inspection.
- Add focused flow-engine unit tests for catalog contract source, missing required inputs, and unknown fallback behavior.
- Start estimator metadata surfacing only after catalog schema stabilizes further.
- Keep `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` as mandatory acceptance gates.
