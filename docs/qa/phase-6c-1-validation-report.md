# Phase 6C-1 Run Readiness / Preflight Check Foundation Validation Report

## Summary

Phase 6C-1 added a typed, advisory run readiness layer that aggregates existing flow validation, contract-aware linear execution planning, and static resource estimates into a single `ready` / `warning` / `blocked` report.

This phase is foundation-only. Runtime invocation behavior was not changed, and readiness reports do not block `/api/runs`.

## Changed Files

- `packages/protocol/src/index.ts`
- `packages/flow-engine/src/index.ts`
- `apps/gateway/src/index.ts`
- `tests/e2e/workspace.spec.ts`
- `docs/qa/phase-6c-1-validation-report.md`

## Added Protocol Types

- `RunReadinessStatus`
- `RunReadinessIssueSeverity`
- `RunReadinessIssue`
- `RunReadinessReport`

Readiness issues use stable `code` and `messageKey` fields, with optional typed details. Raw diagnostic strings are carried only as `technicalMessage` details.

## Flow Engine Behavior

- Added `buildRunReadinessReport(flow, options)`.
- Reuses existing:
  - `FlowEngine.validate` logic through a shared validator.
  - `buildContractAwareLinearExecutionPlan`.
  - `buildStaticFlowEstimate`.
- Resource estimate limitations such as unknown pricing and low confidence remain warnings, not hard blockers.
- Readiness status is:
  - `blocked` when validation or execution-plan errors exist.
  - `warning` when only non-blocking preflight concerns exist.
  - `ready` when only informational advisory items exist.

## Gateway API

Added:

- `POST /api/flows/run-readiness`

The endpoint accepts the existing FlowSpec or `{ flow }` request shape, passes runtime execution modes from the Runtime Registry, and returns `RunReadinessReport`.

## Validation

- `pnpm typecheck`: passed.
- `pnpm build`: passed.
- `pnpm test:e2e`: passed, 12/12 tests.

## E2E Coverage Added

Added coverage for:

- `ready` readiness report with only informational preview estimate issue.
- `warning` readiness report for normal MVP agent flow with unknown pricing warnings.
- `blocked` readiness report for an empty flow.

Existing runtime smoke tests still pass:

- `mock-local` run succeeds.
- `openclaw-local` protected dry run still returns a run id.
- `hermes-local` remains `runtime_unavailable`.

## Known Limitations

- No Web UI readiness panel yet.
- Readiness is advisory and does not gate raw `/api/runs`.
- No approval or policy enforcement was added.
- No external runtime execution was added.
- Lower-level contract and plan diagnostics still contain some technical English strings; the readiness layer wraps them behind stable issue codes and message keys.

## Recommended Next Phase

Phase 6C-2 should add a compact Web preflight/readiness panel and decide whether session-bound runs should consume readiness as a soft warning or a hard gate. Keep raw `/api/runs` backward compatible unless a separate acceptance decision changes that boundary.
