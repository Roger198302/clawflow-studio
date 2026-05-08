# Phase 6E-0 Code Audit and Simplification Review

## Summary

Phase 6E-0 performed a lightweight code audit before private beta packaging. The goal was to reduce obvious code risk without adding features or changing runtime behavior.

This phase does not add product functionality, external runtime execution, provider calls, auth, database persistence, billing, pricing registry, optimizer, model recommendation, deployment, or public publishing.

## Changed Files

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/i18n/en.ts`
- `apps/web/src/i18n/zh-CN.ts`
- `apps/web/package.json`
- `apps/gateway/src/index.ts`
- `packages/runtime-registry/src/harnesses.ts`
- `playwright.config.ts`
- `tests/e2e/workspace.spec.ts`
- `README.md`
- `docs/demo/clean-clone-checklist.md`
- `docs/demo/private-beta-test-plan.md`
- `docs/qa/phase-6e-0-code-audit-simplification-review.md`

## Code Issues Found

Low-risk issues found:

- `apps/web/src/App.tsx` imported `HarnessCompatibilityResult` without using it.
- `apps/web/src/App.tsx` logged the full FlowSpec to the browser console when Save Flow was clicked.
- Dev services were binding to `0.0.0.0` by default, which was too broad for a private local beta without auth.
- Gateway CORS allowed all origins during local development.
- An E2E readiness fixture used stale summary field names.
- ComfyUI harness copy could be read as implying execution rather than metadata-only preview.
- `apps/web/src/styles.css` retained unused legacy Run Inspector selectors.

Audit notes:

- English and Simplified Chinese i18n dictionaries have matching key counts and shape validation through `I18nDictionary`.
- A strict Web TypeScript pass with `--noUnusedLocals --noUnusedParameters` passes after cleanup.
- Readiness, estimate, contract, and plan request stale-response guards remain in `flowStore`.
- The app still contains large files and CSS sections that are maintainability risks, but refactoring them now would be higher risk than appropriate for a beta gate.

## What Was Simplified

- Removed the unused `HarnessCompatibilityResult` type import.
- Removed the Save Flow `console.log` debug output while preserving the existing save notice behavior.
- Changed local dev server defaults to loopback binding.
- Replaced permissive gateway CORS with a local dev origin allowlist.
- Updated Playwright server URLs to loopback addresses.
- Updated stale E2E fixture summary keys.
- Clarified ComfyUI harness copy as metadata preview only.
- Removed unused legacy Run Inspector CSS selectors.

## What Was Intentionally Left Unchanged

- No runtime invocation behavior.
- No `/api/runs` behavior.
- No Flow Engine execution routing.
- No readiness gating.
- No session/intervention behavior.
- No large CSS consolidation.
- No App.tsx decomposition.
- No gateway route extraction.
- No i18n architecture changes.
- No public exposure action.

## Validation

Targeted validation run during audit:

```bash
pnpm --filter @clawflow/web exec tsc -p tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters
```

Result: passed.

Full validation is recorded in the final Phase 6E packaging report.

## Risks and Future Refactor Candidates

- `apps/web/src/App.tsx` is large and mixes canvas orchestration, run handling, inspector rendering, and helper formatting. A later phase should extract focused components/hooks behind E2E coverage.
- `apps/web/src/styles.css` is large and has many workspace/panel/node styles in one file. A later phase could split by surface or introduce CSS modules without changing visual behavior.
- `apps/gateway/src/index.ts` is large and combines routes, in-memory stores, run/session/intervention handling, and preview endpoints. A later phase should extract stores/routes after private beta.
- Flow-engine preview, planning, estimate, and readiness logic is growing. Add pure-function unit tests before larger refactors.
- `flowStore` contains repeated stale-response guarded request logic. It is working and protected by E2E tests, but a later phase can extract a typed request helper.
- Runtime execution-mode checks appear in both UI and gateway contexts. A later protocol helper could reduce drift, but changing that before beta would carry unnecessary risk.

## Confirmation

No new functionality or public exposure was added.
