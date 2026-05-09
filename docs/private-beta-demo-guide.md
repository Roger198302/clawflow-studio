# Private Beta Demo Guide

This guide is for invited private beta testers using the local ClawFlow Studio MVP. Keep the repository URL, screenshots, recordings, logs, and feedback private.

## What This MVP Is

ClawFlow Studio is a local WebUI-first Agent workflow workbench. The private beta demonstrates a visual workflow canvas, mock execution, protected dry-run boundaries, session/run observation, advisory diagnostics, and workspace controls.

Current safe execution boundary:

- `mock-local` performs local mock execution for the demo flow.
- `openclaw-local` is registration, health, and protected dry-run only.
- `hermes-local` remains unavailable and rejects execution.
- Contract Preview, Linear Execution Plan, Resource Estimate, and Run Readiness are advisory preview surfaces.

## What This MVP Is Not

This beta does not include real OpenClaw, Hermes, Shell, Browser, filesystem, MCP, RAG, ComfyUI, provider API, billing, database, authentication, production persistence, or multi-user execution.

Do not use the beta with secrets, credentials, sensitive files, or production workflows.

## Install And Start

Run from the repository root:

```bash
pnpm install
pnpm dev:gateway
pnpm dev:web
```

Open:

```text
http://localhost:5173
```

Gateway health:

```bash
curl http://localhost:8787/health
```

Validation commands:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

## Recommended Five-Minute Demo

1. Start with the Builder preset.
2. Inspect the default five-node flow: Manual Trigger, Start Agent, Worker Agent, End Agent, Console Output.
3. Check Run Readiness, Contract Preview, Linear Execution Plan, and Resource Estimate.
4. Click Run with the default `mock-local` runtime.
5. Switch to the Runner preset and inspect Session Console plus Run Inspector.
6. Try Focus / Presenter layout for a canvas-first view.
7. Try Debug / Reviewer layout for richer contract and inspector context.
8. Try Node Display modes: Auto, Compact, Standard, Detailed, Trace.
9. Right-click the canvas and nodes to try context menu editing actions.
10. Select `openclaw-local` for an agent node and confirm protected dry-run behavior.
11. Select `hermes-local` for an agent node and confirm unavailable-runtime rejection.

## In-App Guide

Use the top-bar Guide button for a compact in-app demo path, panel map, beta limitations, Runtime Manager shortcut, and Reset Demo Flow action.

Reset Demo Flow restores the default five-node graph and clears local run/event UI state. It does not change backend state or saved repository files.

## Panel Map

- Runtime Manager: shows mock, protected, and unavailable runtime boundaries.
- Run Readiness: advisory pre-run status near the Run action.
- Contract Preview: per-node runtime, harness, capability, and risk intent.
- Linear Execution Plan: whether the graph fits the current simple linear executor.
- Resource Estimate: local heuristic token, cost, latency, and confidence ranges.
- Session Console: session turns, steps, interventions, and constraints.
- Run Inspector: RunEvents, node IO, and live run status.
- Workspace Presets: Builder, Runner, Reviewer, Presenter, and Custom layouts.
- View Mode: Default, Focus, Run, and Debug workspace body layouts.
- Node Display Mode: Auto, Compact, Standard, Detailed, and Trace node density.

## Known Limitations

- No real external runtime execution is enabled.
- No auth, database, production persistence, or multi-user collaboration.
- Linear execution supports simple chains only; unsupported DAG shapes are diagnostics for now.
- Readiness, estimates, contracts, and plans are advisory previews.
- Node Pets / Agent Companions are reserved but not animated.
- Run From Here, branch execution, subflow conversion, semantic zoom, and cost heatmap are future work.
- Existing Vite chunk-size warnings during build are known and non-blocking.

## Troubleshooting

- Wrong directory: run commands from the repository root that contains `package.json`.
- Missing dependencies: run `pnpm install`.
- Gateway unavailable: start `pnpm dev:gateway` and check `http://localhost:8787/health`.
- Web app unavailable: start `pnpm dev:web` and open `http://localhost:5173`.
- Port mismatch: confirm the gateway is on `8787` and the WebUI is on `5173`.
- Confusing workspace state: use Reset Layout, then open Guide and Reset Demo Flow.

## Feedback

Use the private feedback template or GitHub issue templates. Include browser/device info, commit SHA, reproduction steps, terminal output, and screenshots when useful. Share attachments only in the private repository or an approved private feedback channel.
