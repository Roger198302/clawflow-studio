# Phase 6E-2 Clean Clone Verification

## Summary

Phase 6E-2 verified that the private beta package can be cloned from a local private Git state and run from a fresh directory.

No public repository, release, upload, deployment, package publishing, or public announcement was created.

## Clone Source

- Source branch: `codex/private-beta-packaging`
- Source commit: `eb58665`
- Clone command used a local `file://` URL.
- Temporary clone path: `/tmp/clawflow-clean-78yM8c/clawflow-studio`

The source repository remained private/local. No remote push was performed.

## Commands Run

In the clean clone:

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm test:e2e
```

Manual startup:

```bash
pnpm dev:gateway
pnpm dev:web
curl http://127.0.0.1:8787/health
curl -I http://127.0.0.1:5173/
```

API smoke:

- `POST /api/runs` with `mock-local`
- `POST /api/runs` with `openclaw-local`
- `POST /api/runs` with `hermes-local`

## Results

- `pnpm install`: passed.
- `pnpm typecheck`: passed.
- `pnpm build`: passed. Vite reported the existing chunk-size warning only.
- `pnpm test:e2e`: passed, 17/17 tests.
- Gateway health: passed.
- WebUI HTTP response: passed.
- `mock-local` run creation: passed, returned run id.
- `openclaw-local` protected dry-run run creation: passed, returned run id.
- `hermes-local` unavailable runtime rejection: passed, returned `runtime_unavailable`.

## Observations

- `pnpm install` printed the standard pnpm ignored-build-scripts warning for `esbuild`. No manual package edits were required.
- Gateway and WebUI started on loopback addresses.
- E2E started and stopped local web servers successfully.
- Manual dev server sessions were stopped after the smoke check.

## Known Limitations

- Clean clone verification used a local `file://` clone, not a push to a remote repository.
- No public exposure action was performed.
- The beta remains local, in-memory, mock/protected, and preview-oriented.
- OpenClaw endpoint reachability remains opt-in through `CLAWFLOW_OPENCLAW_ENDPOINT`; it should be left unset for zero external OpenClaw reachability probes.

## Recommendation

The clean clone is ready for private beta testers after the maintainer confirms private repository access and tester invite scope.
