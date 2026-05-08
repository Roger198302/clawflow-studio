# Private Beta Tester Guide

This guide is for invited private beta testers. Keep all beta material private.

## Setup

```bash
git clone <private-repo-url> clawflow-studio
cd clawflow-studio
pnpm install
pnpm typecheck
pnpm build
pnpm test:e2e
```

If Playwright browser binaries are missing:

```bash
pnpm exec playwright install
pnpm test:e2e
```

Start local services:

```bash
pnpm dev:gateway
pnpm dev:web
```

Open `http://localhost:5173`.

## Test Checklist

- Confirm default five nodes load.
- Drag nodes.
- Delete and reconnect edges.
- Create a branch, fan-in, or cycle and confirm diagnostics appear without crashing the canvas.
- Run the default `mock-local` Flow.
- Change an agent node to `openclaw-local` and confirm protected dry-run behavior.
- Change an agent node to `hermes-local` and confirm unavailable-runtime rejection.
- Inspect Runtime Manager.
- Inspect Contract Preview.
- Inspect Linear Execution Plan.
- Inspect Resource Estimate.
- Inspect Run Readiness.
- Create a Session and test message, constraint, pause, resume, cancel, retry, skip, and edit input controls.

## Expected Behavior

- `mock-local` performs local mock execution only.
- `openclaw-local` remains protected dry-run only.
- `hermes-local` remains unavailable.
- Preview surfaces explain readiness, contracts, plans, and estimates without claiming real external execution.
- Session and intervention data are local and in-memory.

## Known Limitations

- No production persistence.
- No auth, multi-user support, billing, pricing registry, provider API, optimizer, or model recommendation.
- No real OpenClaw Agent Chat or Tool Call execution.
- No real Hermes adapter.
- No shell, browser, filesystem, MCP, RAG, ComfyUI, or external API execution.
- Linear execution supports simple chains only; DAG execution is diagnostic-only.
- Readiness, estimates, contracts, and plans are advisory previews.
- Screenshots and launch walkthrough assets are still pending.

Leave `CLAWFLOW_OPENCLAW_ENDPOINT` unset for zero external OpenClaw reachability probes. If configured, `openclaw-local` health checks only probe endpoint reachability and still do not execute agents or tools.

## Feedback Format

Use [Private Beta Feedback Template](private-beta-feedback-template.md) or the GitHub issue templates.

Include:

- Git commit SHA;
- OS and browser version;
- Node.js and pnpm versions;
- screen size;
- steps to reproduce;
- expected behavior;
- actual behavior;
- browser console or terminal errors;
- screenshot or short recording when useful.

## Attachment Privacy

Attach screenshots, recordings, logs, and terminal output only inside the private repository or approved private feedback channel.

Do not post repository links, screenshots, recordings, logs, packages, or beta notes publicly.
