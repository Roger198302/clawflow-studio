# Phase 6H: Private Beta Release Candidate Validation

Date: 2026-05-09

## Current Revision

- Branch: `codex/private-beta-packaging`
- HEAD: `4ce5643`
- Working tree at start: clean

## Scope

Phase 6H was a release-candidate validation pass for the private beta MVP. The pass verified documentation, local startup guidance, workspace demo coverage, runtime safety boundaries, and the existing automated validation suite.

This phase did not add product functionality. The only intended repository change is this RC validation report.

## Validation Commands And Results

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm typecheck` | Passed | All TypeScript workspace projects typechecked. |
| `pnpm build` | Passed | Existing Vite chunk-size warning remains known and non-blocking. |
| `pnpm test:e2e` | Passed | Playwright suite passed, 28/28. |
| Local Markdown link check | Passed | Checked README, linked private beta docs, and this RC report; 21 Markdown files resolved. |
| Gateway health check | Passed | `http://127.0.0.1:8787/health` returned `status: ok`. |
| WebUI HTTP check | Passed | `http://127.0.0.1:5173` returned HTTP 200. |
| Runtime Manager smoke | Passed | Ad hoc Playwright smoke opened Runtime Manager and found `mock-local`, `openclaw-local`, and `hermes-local`. |

## Private Beta Demo Path Validation

| Demo path item | Result | Evidence |
| --- | --- | --- |
| Guide entry point | Passed | E2E opens `demo-guide-panel`, verifies demo path text, beta limitations, Chinese copy, and Escape close. |
| Reset Demo Flow | Passed | E2E disturbs the graph, confirms reset dialog, restores five default nodes and four default edges, and clears local run UI state. |
| Mock Run | Passed | E2E verifies mock run reaches success, Run Inspector receives `run.completed`, linear plan live status completes, and node status updates. |
| Protected Dry Run | Passed | API smoke verifies `openclaw-local` still returns a run id through protected dry-run behavior. Docs explain that real execution remains blocked. |
| Runtime Manager | Passed | Entry button is visible in E2E; ad hoc smoke opened the panel and verified the three expected runtime boundaries. |
| Workspace Presets | Passed | E2E verifies Builder, Runner, Reviewer, Presenter, and Reset Layout behavior. |
| Node Display Modes | Passed | E2E verifies Auto, Compact, Standard, Detailed, Trace, workspace auto-mapping, and persistence. |
| Canvas context menu | Passed | E2E verifies empty-canvas menu, create node actions, grouped canvas actions, and Focus mode behavior. |
| Node context menu | Passed | E2E verifies inspect, display override, hide/show details, duplicate, delete, and active state behavior. |
| Edge context menu | Passed | E2E verifies edge deletion. |
| Session Console / Run Inspector | Passed | E2E verifies mock run events and Run Inspector state; docs describe Session Console as local/in-memory observation. |

## Documentation Validation

Reviewed:

- [README](../../README.md)
- [Private Beta Demo Guide](../private-beta-demo-guide.md)
- [Private Beta Test Plan](../demo/private-beta-test-plan.md)
- [Private Beta Walkthrough](../demo/private-beta-walkthrough.md)
- Linked private beta docs under `docs/demo/`

Results:

- Startup commands match root package scripts: `pnpm dev:gateway`, `pnpm dev:web`, `pnpm typecheck`, `pnpm build`, `pnpm test:e2e`.
- Ports are consistent: WebUI `5173`, gateway `8787`.
- Internal Markdown links resolve.
- Docs consistently describe the project as local MVP / private beta.
- Docs clearly state mock/protected/unavailable runtime boundaries.
- Docs do not claim production readiness or real external runtime execution.

Non-blocking documentation polish:

- A few startup command blocks list `pnpm dev:gateway` followed by `pnpm dev:web` in one code block. The commands are correct, but future docs can consistently label these as Terminal 1 and Terminal 2.

## Code Review Validation

Read-only review found no blockers.

- No `apps/gateway`, protocol, flow-engine, runtime registry, or adapter changes were introduced in this RC pass.
- No runtime invocation behavior, readiness logic, session semantics, or run semantics changed.
- New visible app strings from Phase 6G are routed through i18n.
- No stray `console.*` or `debugger` statements were found in reviewed files.
- `git diff --check` passed after this report was added.

Non-blocking expectation-management note:

- “Node Pets / Agent Companions” appears as future-work limitation copy. This is accurate because the UI only reserves the concept, but it may invite tester questions. Keep it as a known limitation, or simplify copy in a later docs-only patch if tester feedback suggests confusion.

## Known Limitations

- Mock runtime is safe demo execution only.
- Protected dry run blocks real execution.
- Real OpenClaw execution is not enabled.
- Real Hermes execution is not enabled.
- Real Shell execution is not enabled.
- No browser, filesystem, MCP, RAG, ComfyUI, or provider API execution is enabled.
- No auth, database, production persistence, or multi-user collaboration.
- No real external runtime integration.
- Node Pets / Agent Companions are reserved but not animated.
- No Run From Here.
- No branch execution.
- No subflow conversion.
- No semantic zoom.
- No cost heatmap.
- Linear execution supports simple chains only; unsupported graph structures remain diagnostics.
- Readiness, estimates, contracts, and plans remain advisory previews unless existing runtime/session validation already gates a path.

## RC Decision

Ready for private beta testing.

Rationale:

- Required validation commands passed.
- E2E suite passed 28/28.
- Private beta docs are internally consistent and local-only.
- The demo path is covered by automated tests plus targeted smoke checks.
- Runtime safety boundaries remain intact: mock execution succeeds, `openclaw-local` remains protected dry-run only, and `hermes-local` remains unavailable.
- No product/runtime semantics changed during this RC validation phase.

## Follow-Up Recommendations

- Add private screenshots/GIFs for the clean clone, default workspace, mock run success, protected dry-run, and unavailable runtime rejection.
- Keep a lightweight tester feedback triage loop for install blockers, copy confusion, and workspace usability issues.
- Consider an optional private beta tag after maintainer review, without publishing a public release.
- Add persistent E2E coverage that opens Runtime Manager and verifies runtime boundary cards; this was smoke-validated ad hoc in Phase 6H.
- Plan a future real-runtime health-check phase separately from private beta RC validation.
