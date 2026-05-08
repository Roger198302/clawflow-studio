# Private Beta Walkthrough

This walkthrough is for invited private beta testers only. Keep the repository URL, screenshots, recordings, logs, and feedback private.

## What This MVP Is

ClawFlow Studio is a local WebUI-first Agent workflow workbench. This MVP focuses on canvas editing, local mock execution, session history, intervention controls, advisory diagnostics, and private beta feedback.

The current beta runs locally with:

- WebUI at `http://localhost:5173`;
- local Gateway at `http://localhost:8787`;
- `mock-local` mock execution;
- `openclaw-local` protected dry-run behavior;
- `hermes-local` unavailable-runtime rejection;
- advisory Contract Preview, Linear Execution Plan, Resource Estimate, and Run Readiness surfaces.

## What It Is Not

This beta is not a production release and does not include real external runtime execution.

It does not execute real OpenClaw, Hermes, Shell, Browser, filesystem, MCP, RAG, ComfyUI, provider API, billing, database, or authentication workflows.

Leave `CLAWFLOW_OPENCLAW_ENDPOINT` unset for zero external OpenClaw reachability probes. If configured, `openclaw-local` health checks only probe endpoint reachability and still do not execute agents or tools.

## Install and Start

```bash
git clone <private-repo-url> clawflow-studio
cd clawflow-studio
pnpm install
```

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

Check gateway health:

```bash
curl http://localhost:8787/health
```

## Inspect Runtime Manager

Open the Runtime Manager and verify:

- `mock-local` is available for mock execution;
- `openclaw-local` is protected dry-run only;
- `hermes-local` is unavailable;
- unavailable runtimes are clearly labeled and should not execute.

## Inspect Run Readiness

Look near the Run controls for the advisory pre-run status.

Expected states:

- Ready: no blocking pre-run issues found.
- Ready with warnings: runnable with advisory limitations.
- Needs fixes: diagnostics indicate the current graph is not ready for the supported linear mock/protected path.

Readiness is advisory. It explains pre-run concerns and does not introduce real runtime execution.

## Run Mock Mode

1. Keep the default Flow connected as a simple chain.
2. Keep agent nodes on `mock-local`.
3. Click `Run`.
4. Confirm the run reaches success.
5. Inspect Run Inspector and Session Console for local RunEvents and session activity.

Expected: local mock output only.

## Test Protected Dry Run

1. Select an agent node.
2. Change its runtime to `openclaw-local`.
3. Click `Run`.
4. Confirm protected dry-run metadata appears.

Expected: no real OpenClaw Agent Chat, Tool Call, or external execution occurs.

## Confirm Unavailable Runtime Rejection

1. Select an agent node.
2. Change its runtime to `hermes-local`.
3. Click `Run`.
4. Confirm the run is rejected with `runtime_unavailable` or equivalent UI copy.

Expected: unavailable runtime rejection happens before real execution.

## Inspect Preview Surfaces

Review:

- Execution Contract Preview;
- Linear Execution Plan;
- Resource Estimate;
- Run Readiness;
- node badges and inspector metadata.

These surfaces should explain what the current Flow means. They are preview/advisory surfaces, not real adapter execution.

## Submit Feedback

Use one of:

- [Private Beta Feedback Template](private-beta-feedback-template.md)
- GitHub issue template: Bug report
- GitHub issue template: Private beta feedback
- GitHub issue template: Feature request

Include browser/device info, commit SHA, reproduction steps, terminal output, and screenshots when useful. Attach beta material only inside the private repository or an approved private feedback channel.

## Screenshots and GIFs To Add Later

Useful future launch assets:

- clean clone install;
- default workspace overview;
- edge editing;
- mock run success;
- protected dry-run metadata;
- unavailable runtime rejection;
- Session Console activity;
- Contract Preview, Linear Plan, Resource Estimate, and Run Readiness.

Do not publish these assets publicly during the private beta.
