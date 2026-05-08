# ClawFlow Studio

ClawFlow Studio is a WebUI-first visual Agent workflow orchestration workbench.

It borrows interaction patterns from node graph tools and professional creative workspaces, but the current MVP is intentionally local and safe:

- WebUI + local Gateway.
- Shared TypeScript protocol.
- Mock Flow Engine.
- Runtime Registry with mock/protected/unavailable modes.
- Session, Harness, Execution Contract, Linear Plan, Resource Estimate, and Run Readiness previews.
- No real OpenClaw, Hermes, Shell, Browser, filesystem, MCP, RAG, ComfyUI, database, or authentication integration.

## Current Status

This repository is in a local MVP / pre-release stabilization phase.

Supported local behavior:

- Edit the default five-node Flow on a React Flow canvas.
- Create, delete, reconnect, and inspect edges.
- Run the default mock flow through `mock-local`.
- Select `openclaw-local` and observe protected dry-run behavior.
- Observe unavailable runtime rejection for `hermes-local`.
- Use Session Console, intervention history, harness metadata, contract preview, linear plan diagnostics, resource estimates, and advisory run readiness.
- Run Playwright E2E regression tests for the core workspace interactions.

Safety boundary:

- `mock-local` is the only runtime that performs mock execution.
- `openclaw-local` is registration/health/protected-dry-run only.
- `hermes-local` and unavailable runtimes remain rejected.
- Local dev services bind to loopback by default.
- No external agent/tool execution, shell, browser, file, model provider, billing, or pricing API is invoked.
- Leave `CLAWFLOW_OPENCLAW_ENDPOINT` unset for zero external OpenClaw reachability probes. If configured, `openclaw-local` health checks only probe endpoint reachability and still do not execute agents or tools.

## Private Beta / MVP Boundary

ClawFlow Studio is currently suitable for a private, local-only hidden beta focused on setup, workspace interaction, diagnostics, and feedback. It performs mock execution only; external runtimes and capability providers are represented as protected, unavailable, or metadata-only previews unless a later phase explicitly enables a guarded bridge.

Beta testers should use the private beta materials:

- [Private Beta Tester Guide](docs/demo/private-beta-tester-guide.md)
- [Private Beta Walkthrough](docs/demo/private-beta-walkthrough.md)
- [Private Beta Test Plan](docs/demo/private-beta-test-plan.md)
- [Private Beta Feedback Template](docs/demo/private-beta-feedback-template.md)
- [Clean Clone Checklist](docs/demo/clean-clone-checklist.md)
- [Private Beta Invite Message](docs/demo/private-beta-invite-message.md)

Do not use this beta for production work, secrets, credentials, sensitive files, or real external agent/tool execution.

Keep the repository, beta links, screenshots, recordings, logs, and feedback private to invited testers. Do not publish packages, images, releases, websites, public announcements, or public mirrors from this beta.

## Workspace

- `apps/web` - Vite, React, TypeScript, React Flow workspace UI.
- `apps/gateway` - Fastify local gateway and WebSocket RunEvent stream.
- `packages/protocol` - shared flow, node, runtime, session, harness, readiness, estimate, and run event types.
- `packages/flow-engine` - mock/protected execution planning, contract preview, linear plan, estimates, and readiness aggregation.
- `packages/runtime-registry` - runtime registry and built-in harness metadata.
- `packages/adapter-mock` - mock runtime adapter.
- `packages/adapter-openclaw` - OpenClaw adapter skeleton and health reachability only.
- `packages/adapter-hermes` - placeholder only.
- `packages/adapter-shell` - placeholder only.
- `docs` - architecture notes, QA reports, and phase proposals.

## Quick Start

```bash
pnpm install
pnpm dev:gateway
pnpm dev:web
```

Open the WebUI at:

```text
http://localhost:5173
```

The gateway defaults to:

```text
http://localhost:8787
```

Health check:

```bash
curl http://localhost:8787/health
```

## Validation

Run the full local acceptance suite before accepting a phase:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

Useful scripts:

```bash
pnpm dev:web
pnpm dev:gateway
pnpm build
pnpm typecheck
pnpm test:e2e
pnpm test:e2e:headed
```

## Core Concepts

```text
Flow defines structure.
Session holds context.
Run records execution attempts.
Node represents a work unit.
Harness declares execution capability.
Runtime provides actual backend capability.
Compatibility explains whether the chosen pairing is safe and suitable.
Intervention records human control.
Execution Contract explains intent before execution.
Run Readiness summarizes advisory pre-run signals.
```

## MVP Node Types

- `manual.trigger`
- `agent.start`
- `agent.worker`
- `agent.end`
- `output.console`

Future provider placeholders such as CLI, MCP, RAG, ComfyUI, Browser, API, and Human Approval are preview/metadata-only unless a later phase explicitly enables a safe bridge.

## Current Limitations

- No production persistence.
- No auth or multi-user support.
- No real OpenClaw Agent Chat or Tool Call execution.
- No real Hermes adapter.
- No shell/browser/filesystem execution.
- No MCP, RAG, ComfyUI, or provider API bridge.
- No billing, provider pricing registry, optimizer, or model recommendation logic.
- Linear execution supports simple chains only; DAG execution is diagnostic-only for now.
- Readiness, estimates, contracts, and plans are advisory previews unless existing runtime/session validation already gates a path.
- Launch screenshots, GIFs, and guided walkthrough assets are still pending.

## Key Documents

- [Session, Harness, Runtime, and Intervention Architecture](docs/architecture/session-harness-runtime-intervention.md)
- [Phase 5 Milestone Summary](docs/qa/phase-5-milestone-summary.md)
- [Phase 5J Validation Report](docs/qa/phase-5j-validation-report.md)
- [Phase 5K E2E Validation Report](docs/qa/phase-5k-e2e-validation-report.md)
- [Phase 6C-1 Readiness Validation Report](docs/qa/phase-6c-1-validation-report.md)
- [Phase 6D-2 Documentation and QA Consolidation](docs/qa/phase-6d-2-documentation-qa-consolidation.md)
- [Phase 6D-3A Private Beta Readiness](docs/qa/phase-6d-3a-private-beta-readiness.md)
