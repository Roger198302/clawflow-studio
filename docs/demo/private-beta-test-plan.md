# Private Beta Test Plan

## Purpose

This plan is for a private GitHub hidden beta of ClawFlow Studio. The goal is to validate local setup, workspace usability, mock execution, protected dry-run behavior, and preview diagnostics before any public launch work.

This beta is not a production release. It does not include real OpenClaw, Hermes, Shell, Browser, filesystem, MCP, RAG, ComfyUI, provider API, billing, database, or authentication execution.

Keep the repository URL, screenshots, recordings, logs, and feedback private to invited testers and approved maintainers. Do not post beta material publicly.

For a tester-friendly path through the MVP, start with the [Private Beta Demo Guide](../private-beta-demo-guide.md), [Private Beta Tester Guide](private-beta-tester-guide.md), and [Private Beta Walkthrough](private-beta-walkthrough.md).

## Test Boundary

Expected safe behavior:

- `mock-local` can run the default Flow.
- `openclaw-local` can be selected but remains protected dry-run only.
- `hermes-local` remains unavailable and should reject with `runtime_unavailable`.
- Contract Preview, Linear Execution Plan, Resource Estimate, and Run Readiness are advisory preview surfaces.
- Session Console and intervention controls are local, in-memory workflow controls.
- Local dev services bind to loopback by default.
- Leave `CLAWFLOW_OPENCLAW_ENDPOINT` unset for zero external OpenClaw reachability probes. If it is configured, the health check only probes endpoint reachability and still does not execute agents or tools.

Do not test or expect real external runtime execution.

## Environment Capture

Record this before testing:

- Operating system and version:
- Browser and version:
- Node.js version:
- pnpm version:
- Git commit SHA:
- Screen size:
- Any proxy/VPN/security tooling:

## Clean Clone Install

From a fresh directory:

```bash
git clone <private-repo-url> clawflow-studio
cd clawflow-studio
pnpm install
```

If install fails, record:

- Command run.
- Full error output.
- Node and pnpm versions.
- Whether retrying after deleting `node_modules` helped.

## Start Local Services

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

Gateway health check:

```bash
curl http://localhost:8787/health
```

Expected: the WebUI loads and the gateway health endpoint returns a healthy response.

## Core Workspace Checks

- Open Templates and confirm **Hello World Agent Flow** appears first.
- Apply Hello World and confirm it creates:
  - Manual Trigger
  - Hello World Agent
  - Console Output
- Confirm Hello World uses safe `mock-local` execution only.
- Confirm no OpenClaw, Hermes, Shell, filesystem, browser, or external API execution is triggered by creating the template.
- Default five nodes are visible:
  - Manual Trigger
  - Start Agent
  - Worker Agent
  - End Agent
  - Console Output
- Nodes can be dragged.
- Existing edges are visible.
- Edges can be deleted and reconnected.
- Branching, fan-in, and cycle edits should be allowed on the canvas.
- Unsupported graph structures should appear as diagnostics, not as canvas crashes.

## Mock Runtime Flow

1. Start with Hello World Agent Flow for the fastest sanity check.
2. Keep all executable nodes on `mock-local`.
3. Click `Run`.
4. Confirm the run reaches success.
5. Confirm Run Inspector receives RunEvents.
6. Confirm node status badges update.
7. Confirm Session Console can record session-bound run activity if using a Session.

Expected: mock execution succeeds locally with structured mock output only.

## OpenClaw Protected Dry Run

1. Select an agent node.
2. Change `runtimeRef` to `openclaw-local`.
3. Click `Run`.
4. Confirm the UI reports protected dry-run behavior.
5. Confirm the run does not perform real OpenClaw Agent Chat or Tool Call execution.

Expected: protected dry-run metadata appears. No real OpenClaw execution occurs.

## Hermes Unavailable Rejection

1. Select an agent node.
2. Change `runtimeRef` to `hermes-local`.
3. Click `Run`.
4. Confirm the run is rejected with a clear unavailable runtime message.

Expected: `runtime_unavailable` behavior remains intact.

## Preview Surfaces

Inspect these surfaces for clarity, stale data, and layout issues:

- Execution Contract Preview
  - node category
  - execution mode
  - provider/runtime
  - warnings/errors
- Linear Execution Plan
  - plan status
  - ordered steps
  - branching/fan-in/cycle diagnostics
- Resource Estimate
  - token range
  - cost unknown/no external cost states
  - latency range
  - confidence and warnings
- Run Readiness
  - ready/warning/blocked advisory status
  - issue grouping
  - Run-button pre-run context

Expected: these surfaces explain readiness and limitations without implying real external execution.

## Session Console and Intervention Controls

Test:

- Create Session.
- Run Session.
- Add message.
- Add constraint.
- Pause Session.
- Resume Session.
- Cancel Session.
- Retry Step.
- Skip Step.
- Edit Step Input.

Expected: controls update local session state and intervention history. They do not interrupt or invoke real external runtime processes.

## Feedback to Record

For each issue or suggestion, record:

- What you were trying to do.
- What happened.
- What you expected.
- Whether it reproduced after refresh.
- Browser/device info.
- Screenshot or short screen recording if available, shared only in the private repo or approved private feedback channel.
- Console or terminal errors if relevant.

## Exit Criteria

Private beta is acceptable when:

- Clean clone install succeeds for testers.
- Gateway and WebUI start locally.
- Default mock flow runs successfully.
- Protected/unavailable runtime boundaries remain visible and intact.
- Preview panels and readiness diagnostics are understandable.
- No tester reports imply any external runtime actually ran.
