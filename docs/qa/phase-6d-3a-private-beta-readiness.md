# Phase 6D-3A Private Beta Readiness

## Summary

Phase 6D-3A prepares ClawFlow Studio for a private GitHub hidden beta. This phase adds tester-facing documentation, feedback collection templates, clean-clone guidance, GitHub issue templates, and README boundary wording.

This phase is documentation and repository hygiene only. It does not change runtime behavior, gateway behavior, protocol types, WebUI logic, tests, or execution paths.

## Changed Files

- `README.md`
- `docs/demo/private-beta-test-plan.md`
- `docs/demo/private-beta-feedback-template.md`
- `docs/demo/clean-clone-checklist.md`
- `.github/ISSUE_TEMPLATE/bug_report.md`
- `.github/ISSUE_TEMPLATE/feedback.md`
- `.github/ISSUE_TEMPLATE/feature_request.md`
- `docs/qa/phase-6d-3a-private-beta-readiness.md`

## Private Beta Materials Added

- Private beta test plan covering clean clone install, local startup, mock run, protected dry-run, unavailable runtime rejection, preview panels, run readiness, session controls, and feedback capture.
- Feedback template for tester environment, setup results, workspace behavior, runtime boundaries, preview diagnostics, session controls, bugs, and suggestions.
- Clean clone checklist for install, typecheck, build, E2E, gateway/WebUI startup, health check, and manual smoke testing.

## README Changes

The README now includes a Private Beta / MVP Boundary section linking to the beta test plan, feedback template, and clean clone checklist.

The wording explicitly states that the beta is local-only, mock/protected, and not for production work, secrets, sensitive files, or real external agent/tool execution.

## GitHub Issue Template Changes

Added simple Markdown issue templates:

- Bug report
- Private beta feedback
- Feature request

The templates collect environment, runtime context, flow shape, validation commands, evidence, and safety-boundary notes.

## Accuracy Safeguards

The beta materials avoid claiming:

- production readiness;
- real OpenClaw Agent Chat or Tool Call execution;
- real Hermes execution;
- Shell/CLI execution;
- browser or filesystem automation;
- MCP, RAG, ComfyUI, provider API, billing, pricing registry, optimizer, database, or auth support.

The docs consistently describe:

- `mock-local` as the only mock execution path;
- `openclaw-local` as protected dry-run / health reachability only;
- `hermes-local` as unavailable;
- Contract Preview, Linear Plan, Resource Estimate, and Run Readiness as advisory preview surfaces.

## What Was Intentionally Not Changed

- No runtime invocation behavior.
- No real external runtime execution.
- No provider API calls.
- No billing or pricing registry.
- No optimizer or model recommendation logic.
- No UI redesign.
- No screenshots, GIFs, or large binary assets.
- No claim of public launch readiness.

## Validation Results

Validation for this phase:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

Final results:

- `pnpm typecheck`: passed.
- `pnpm build`: passed. Vite reported the existing chunk-size warning only.
- `pnpm test:e2e`: passed, 17/17 tests.

## Link Check

README beta links should resolve to:

- `docs/demo/private-beta-test-plan.md`
- `docs/demo/private-beta-feedback-template.md`
- `docs/demo/clean-clone-checklist.md`
- `docs/qa/phase-6d-3a-private-beta-readiness.md`

## Known Limitations

- No screenshots or GIF walkthrough assets are included yet.
- Private beta feedback is collected through Markdown templates and GitHub issues; there is no automated feedback pipeline.
- Clean clone validation still depends on local Node/pnpm/browser availability.
- The project remains local, in-memory, mock/protected, and preview-oriented.

## Private Beta Readiness

Private GitHub beta can start after validation passes and the maintainer confirms the hidden repository access list.
