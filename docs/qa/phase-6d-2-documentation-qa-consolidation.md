# Phase 6D-2 Documentation and QA Consolidation

## Summary

Phase 6D-2 consolidates the current architecture, QA, and release-readiness state after Phase 6A, 6B, 6C, and 6D stabilization work.

This phase is documentation-only. It does not change source code, runtime behavior, protocol types, gateway routes, UI behavior, or tests.

## Current Release Boundary

ClawFlow Studio is currently a local MVP workbench.

Implemented and safe to demonstrate:

- React Flow workspace editing.
- Node dragging and edge editing.
- Branching, fan-in, and cycle graph creation for diagnostics.
- Mock run execution through `mock-local`.
- Protected dry-run behavior for `openclaw-local`.
- Unavailable runtime rejection for `hermes-local`.
- Runtime Manager visibility and health checks.
- Session Console, turns, steps, and interventions.
- Harness metadata and compatibility badges.
- Execution Contract Preview.
- Contract-aware Linear Execution Plan.
- Static Resource Estimate preview.
- Advisory Run Readiness preview and Run button context.
- Playwright E2E regression coverage.

Not implemented:

- Real OpenClaw Agent Chat or Tool Call execution.
- Real Hermes adapter.
- Shell/browser/filesystem execution.
- MCP, RAG, ComfyUI, provider API, billing, pricing registry, optimizer, auth, or database integration.
- Full DAG execution, parallel execution, loops, or fan-in merge execution.

## Documentation Index

Architecture:

- `docs/architecture/session-harness-runtime.md`
- `docs/architecture/session-harness-runtime-intervention.md`
- `docs/architecture/phase-6a-node-contract-schema-proposal.md`
- `docs/architecture/phase-6b-token-cost-latency-estimator-proposal.md`

QA and validation:

- `docs/qa/phase-5-milestone-summary.md`
- `docs/qa/phase-5j-preflight-bug-scan.md`
- `docs/qa/phase-5j-validation-report.md`
- `docs/qa/phase-5k-e2e-validation-report.md`
- `docs/qa/phase-6a-1-validation-report.md`
- `docs/qa/phase-6a-2-validation-report.md`
- `docs/qa/phase-6b-3-validation-report.md`
- `docs/qa/phase-6c-1-validation-report.md`
- `docs/qa/phase-6d-1-launch-polish.md`
- `docs/qa/phase-6d-2-documentation-qa-consolidation.md`

## Acceptance Gate

Every future phase must run:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

Acceptance requires all three to pass unless a phase explicitly documents why a check is not applicable.

## QA Checklist

Before accepting a demo/release candidate:

- WebUI starts with `pnpm dev:web`.
- Gateway starts with `pnpm dev:gateway`.
- `GET /health` returns healthy status.
- Default five-node flow renders.
- Nodes can be dragged.
- Edges can be deleted and reconnected.
- Branching/fan-in/cycle graphs produce diagnostics without crashing.
- Default mock run reaches success.
- Run Inspector receives RunEvents.
- Session Console remains visible and usable.
- Runtime Manager opens and lists runtimes.
- `mock-local` succeeds.
- `openclaw-local` remains protected dry-run only.
- `hermes-local` remains `runtime_unavailable`.
- Execution Contract Preview renders.
- Linear Execution Plan renders.
- Resource Estimate renders and treats unknown cost as non-fatal.
- Run Readiness renders advisory status and does not block Run.
- English and Simplified Chinese labels render for core readiness/estimate/workspace surfaces.

## Current Known Limitations

- Workspace panels are floating/minimizable/draggable but not dockable, resizable, or persisted.
- Preflight panels can physically overlap node handles until moved.
- Contract, plan, estimate, and readiness previews are advisory unless existing runtime/session validation already gates a path.
- Some deeper diagnostic details still contain technical English payloads for debugging.
- Resource estimates are heuristic and not billing-grade.
- Cost is usually unknown without provider/model pricing metadata.
- Linear planning supports simple chains only.
- Session and intervention data are in-memory only.
- No production persistence, auth, multi-user, or deployment story exists yet.

## Source Behavior Guarantees

The current safety line must remain intact:

- Do not call real OpenClaw Agent Chat or Tool Call APIs.
- Do not call Hermes.
- Do not execute shell commands from WebUI or Gateway runtime paths.
- Do not access browser/filesystem capabilities as runtime execution.
- Do not call provider pricing, billing, model, MCP, RAG, or ComfyUI APIs.
- Do not make estimates/readiness into hidden execution gates without an explicit phase.

## Recommended Next Phase

Recommended next phase: begin Phase 6E or a scoped Phase 6D-3 only if there is a specific launch blocker.

Potential next work:

- Add screenshots or short demo GIFs to README only after explicit public launch approval. Keep draft assets private for private beta.
- Add a concise release checklist script.
- Add focused unit tests for flow-engine preview/planning/estimate/readiness pure functions.
- Improve workspace panel layout persistence.
- Prepare Phase 6 bridge design without enabling real external execution.
