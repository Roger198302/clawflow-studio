# Phase 6A-1 Validation Report: Node Contract Schema Foundation

## 1. Summary

Phase 6A-1 adds the shared node contract schema foundation and a built-in catalog for the current five MVP node types. Execution Contract Preview and Linear Execution Plan now prefer catalog-backed port and capability metadata for known node types while preserving fallback behavior for unknown and future placeholder nodes.

No real external runtime execution was added. Runtime behavior remains unchanged: `mock-local` executes through the existing mock path, `openclaw-local` remains protected dry-run only, and unavailable runtimes such as `hermes-local` remain rejected.

## 2. Changed Files

- `packages/protocol/src/index.ts`
- `packages/flow-engine/src/nodeCatalog.ts`
- `packages/flow-engine/src/index.ts`
- `apps/web/src/components/ExecutionContractPreviewPanel.tsx`
- `apps/web/src/styles.css`
- `docs/qa/phase-6a-1-validation-report.md`

## 3. Added Schema and Catalog Types

Added shared protocol schema types:

- `NodeTypeDefinition`
- `NodeInputDefinition`
- `NodeOutputDefinition`
- `NodeDataType`
- `RuntimeCompatibilityDefinition`
- `NodeEstimateHints`

Existing Phase 5H contract types were kept compatible:

- `PortDataType` remains available as an alias of `NodeDataType`.
- `NodePortDefinition` remains available as the shared base port shape.
- `NodeCapabilityContract.capabilityId` remains as a deprecated compatibility field while new node/provider contracts should use `providerCapabilityId`.

The node catalog currently defines these five default node types:

- `manual.trigger`
- `agent.start`
- `agent.worker`
- `agent.end`
- `output.console`

Catalog-backed MVP port mapping:

- `manual.trigger`: output `out`
- `agent.start`: input `in`, output `out`
- `agent.worker`: input `in`, output `out`
- `agent.end`: input `in`, output `out`
- `output.console`: input `in`

## 4. Preview and Plan Behavior Changes

Execution Contract Preview now resolves known MVP node types through the catalog first. Unknown node types continue to fall back to generic preview-only contracts.

Linear Execution Plan uses catalog required inputs where available. Missing required inputs from catalog definitions are reported as plan diagnostics, while existing structural diagnostics for branching, fan-in, cycles, invalid edges, and unsupported linear shapes remain intact.

The canvas remains permissive. Unsupported or invalid graph structures are reported by diagnostics and do not block editing.

The Execution Contract Preview UI now shows an explicit per-node readiness chip:

- executable
- preview only
- blocked

## 5. Validation Commands and Results

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

Additional dist smoke check:

- Imported `packages/flow-engine/dist/index.js` with Node ESM.
- Built a five-node sample flow.
- Confirmed catalog ports are `out` / `in`.
- Confirmed preview has no errors.
- Confirmed linear plan status is `ready` with 5 steps.

## 6. E2E Results

Existing Phase 5K Playwright tests all passed:

- app loads
- node dragging remains usable
- edge deletion and reconnect path works
- branching diagnostics render without crashing
- fan-in diagnostics render without crashing
- cycle diagnostics render without crashing
- floating panels minimize, restore, and drag
- mock run reaches success and live step status updates
- runtime protection smoke paths remain unchanged

## 7. Known Limitations

- Catalog is currently limited to the five MVP default node types.
- Future placeholder capability nodes remain preview metadata only.
- No node marketplace or full palette/catalog management UI was added.
- No token pricing or cost estimation is implemented yet.
- Runtime compatibility is static catalog metadata plus existing runtime execution mode resolution.
- No adapter invocation behavior changed.
- No DAG, parallel, loop, fan-in, or fan-out execution was added.

## 8. Recommended Next Phase

Recommended Phase 6A-2:

- Expose catalog metadata to the Web node library without changing the saved Flow JSON shape.
- Add catalog-backed inspector display for node input/output contracts.
- Add focused unit tests for catalog contract resolution and missing-input diagnostics.
- Preserve the Phase 5K E2E suite as the acceptance gate for canvas and runtime regressions.
