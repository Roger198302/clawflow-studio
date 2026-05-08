# Clean Clone Checklist

Use this checklist before inviting or unblocking private beta testers.

The repository URL and clone should remain private. Do not mirror, publish, package, release, deploy, or upload this beta.

## Prerequisites

- Git installed.
- Node.js available.
- pnpm available through Corepack or local installation.
- A Chromium-based browser, Chrome, Edge, or Safari/Firefox for manual UI checks.
- No external OpenClaw, Hermes, Shell, Browser, filesystem, MCP, RAG, ComfyUI, provider, billing, database, or auth service is required.
- Leave `CLAWFLOW_OPENCLAW_ENDPOINT` unset for zero external OpenClaw reachability probes.
- Gateway and WebUI dev servers bind to loopback by default.

Check local versions:

```bash
node --version
pnpm --version
git --version
```

## Clone

```bash
git clone <private-repo-url> clawflow-studio
cd clawflow-studio
git status --short
```

Expected:

- Worktree is clean.
- No local-only files are required for startup.

## Install

```bash
pnpm install
```

Expected:

- Dependencies install without manual package edits.
- `pnpm-lock.yaml` is used as the source of dependency versions.

If install fails:

- Capture the full terminal output.
- Record Node and pnpm versions.
- Retry only after documenting the first failure.

## Static Validation

```bash
pnpm typecheck
pnpm build
```

Expected:

- Both commands pass.
- Vite may report a chunk-size warning; that is currently informational.

## E2E Validation

```bash
pnpm test:e2e
```

Expected:

- Playwright starts or reuses the gateway and WebUI.
- The current E2E suite passes.

If browsers are missing:

```bash
pnpm exec playwright install
pnpm test:e2e
```

## Manual Local Startup

Terminal 1:

```bash
pnpm dev:gateway
```

Terminal 2:

```bash
pnpm dev:web
```

Open:

```text
http://localhost:5173
```

Check gateway:

```bash
curl http://localhost:8787/health
```

Expected:

- WebUI loads.
- Gateway health is healthy.
- Default Flow appears.

## Manual Smoke Test

- Run the default `mock-local` Flow.
- Confirm `run.completed` appears in Run Inspector.
- Confirm Contract Preview renders.
- Confirm Linear Execution Plan renders.
- Confirm Resource Estimate renders.
- Confirm Run Readiness renders.
- Confirm Session Console renders.
- Select `openclaw-local` and confirm protected dry-run behavior only.
- Select `hermes-local` and confirm unavailable runtime rejection.

## Clean Clone Pass Criteria

The clone is ready for private beta testing when:

- install passes;
- typecheck passes;
- build passes;
- E2E passes;
- gateway and WebUI start locally;
- mock run succeeds;
- protected/unavailable runtime boundaries are intact.

## Known Non-Requirements

- No production deployment.
- No database setup.
- No auth setup.
- No external runtime setup.
- No provider API keys.
- No billing/pricing account.
- No screenshots or demo GIFs are required for this checklist.
