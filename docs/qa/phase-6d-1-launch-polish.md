# Phase 6D-1 Demo Readiness / GitHub Launch Polish

## Summary

Phase 6D-1 updates launch-facing documentation so the repository accurately describes the current local MVP state and safety boundaries.

This phase is documentation-only. It does not change runtime behavior, gateway behavior, protocol types, UI logic, or tests.

## Changed Files

- `README.md`
- `docs/qa/phase-6d-1-launch-polish.md`

## What Changed

- Rewrote the README from early skeleton wording to current pre-release MVP wording.
- Added quick-start commands for local gateway and WebUI.
- Added validation commands, including Playwright E2E.
- Documented current supported behaviors:
  - React Flow workspace editing;
  - mock-local execution;
  - openclaw-local protected dry-run;
  - hermes-local unavailable behavior;
  - Session Console;
  - Run Readiness;
  - Execution Contract Preview;
  - Linear Execution Plan;
  - Resource Estimate preview.
- Documented safety boundaries and explicit non-integrations.
- Added links to architecture and QA checkpoint documents.

## What Was Intentionally Not Changed

- No real OpenClaw execution.
- No real Hermes execution.
- No shell, browser, filesystem, MCP, RAG, ComfyUI, provider API, billing, or auth integration.
- No runtime invocation behavior changes.
- No UI changes.
- No test changes.

## Launch Readiness Notes

The README now avoids claiming real external runtime support. It positions ClawFlow Studio as a local, safe, mock/protected workflow studio foundation.

Before any future public demo or GitHub launch is explicitly approved, run:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

## Known Limitations

- Documentation is still phase-oriented and may need a shorter product landing section later.
- Screenshots or short demo GIFs are not included yet. Keep any draft assets private until explicit public launch approval.
- The README links to current architecture/QA docs but does not duplicate their full details.

## Recommended Next Step

Phase 6D-2 should consolidate architecture and QA documentation into a clearer release checklist and current-state index.
