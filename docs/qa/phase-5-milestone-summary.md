# Phase 5 Milestone Stabilization Summary

Date: 2026-05-07

Status: Phase 5J and Phase 5K complete.

## 1. Executive Summary

Phase 5 moved Clawflow Studio from a mock run workbench into a session-aware, harness-aware, contract-aware workflow studio foundation. The milestone now has the core local MVP pieces needed before larger Phase 6 capability bridge work: Flow Sessions, Human Intervention Controls, Runtime Manager, Harness metadata, Execution Contract Preview, Linear Execution Plan diagnostics, restored React Flow edge editing, floating workspace panel stabilization, and Playwright E2E regression coverage.

The system remains intentionally local, safe, and in-memory. `mock-local` is the only runtime that performs mock execution. `openclaw-local` is recognized and health-checkable but remains protected dry-run only. `hermes-local` and unavailable runtimes are rejected before execution. No real OpenClaw, Hermes, Shell, Browser, filesystem, MCP, RAG, ComfyUI, database, or authentication integration is active.

## 2. Completed Phase 5 Capabilities

- Runtime Manager MVP with runtime registry, health checks, execution modes, and capability metadata.
- OpenClaw adapter skeleton and health reachability path without real Agent Chat or Tool Call execution.
- Lightweight i18n foundation for English and Simplified Chinese presentation copy.
- Protected dry-run path for protected runtimes such as `openclaw-local`.
- Flow Sessions, Session Turns, Session Steps, and session-bound run support.
- Floating Session Console for session history, task context, and user messages.
- Pluggable Node Harness Contract with built-in harness profiles and compatibility evaluation.
- Canvas harness badges and Harness Inspector.
- Human Intervention Controls:
  - pause session;
  - resume session;
  - cancel session;
  - retry step;
  - skip step;
  - edit step input;
  - add constraint.
- Execution Contract Preview for deterministic, side-effect-free node/run intent inspection.
- Contract-aware Linear Execution Plan for simple linear chains and unsupported graph diagnostics.
- React Flow edge editing restoration:
  - connect nodes;
  - delete edges;
  - delete and reconnect edges;
  - create branching, fan-in, and cycle graphs for diagnostics.
- Workspace panel stabilization:
  - Session Console minimize/restore/drag;
  - Execution Contract Preview minimize/restore/drag;
  - Linear Execution Plan minimize/restore/drag.
- Playwright E2E regression scaffold and smoke coverage.

## 3. Current Architecture State

The current object model is:

```text
Project
  -> Flow
      -> Session
          -> Run
              -> Step
          -> Turn
          -> Intervention
```

Core boundaries:

- Flow defines structure: nodes, edges, and node configuration.
- Session holds task context and user/runtime history.
- Run records one execution attempt.
- Step records node-level execution progress inside a Session.
- Turn records user, system, assistant, or runtime messages.
- Intervention records explicit human control actions.
- Harness declares intended execution capability, risk, and compatibility expectations.
- Runtime represents the available backend or provider.
- Compatibility explains whether a selected Harness and Runtime pairing is safe and suitable.
- Execution Contract Preview explains what would happen before execution.
- Linear Execution Plan turns contract metadata and graph structure into a simple ordered plan when possible.

All persistence remains in memory. This is an MVP architecture foundation, not a production persistence or multi-user system.

## 4. Current Workspace Interaction State

The React Flow canvas is interactive again:

- Default nodes render with real React Flow handles.
- Nodes are draggable.
- Edges can be created from source to target handles.
- Edges can be deleted with Delete/Backspace.
- Deleted edges can be reconnected.
- Branching, fan-in, and cycle graphs can be created on the canvas.
- Invalid graph shapes are not blocked during editing.
- Linear Execution Plan reports unsupported or invalid graph diagnostics instead of preventing user edits.

Floating workspace panels are usable but still MVP-level:

- Session Console, Execution Contract Preview, and Linear Execution Plan can minimize and restore.
- All three panels can be dragged by header.
- Panels stay above the canvas and can be moved away when they cover handles.
- Panels still physically block canvas interactions where they overlap nodes or handles. There is no docking, snapping, resizing, or persistent layout yet.

The node card status and linear plan status are now visually separated:

- `Preflight` indicates the static plan artifact.
- `Live` indicates run-derived step status from `execution.step.*` RunEvents.

## 5. Current Runtime, Session, and Intervention State

Runtime state:

- `mock-local` executes through `MockRuntimeAdapter`.
- `openclaw-local` can be registered, configured, and health checked, but execution remains protected dry-run.
- `hermes-local` remains unavailable and returns `runtime_unavailable`.
- `shell-local` is not used for real execution.
- Runtime IDs, capability IDs, event types, API paths, protocol fields, and logs remain English and stable.

Session state:

- Sessions are in-memory only.
- A Session can bind to a Flow and Run.
- Session detail includes turns, steps, interventions, and execution metadata.
- Session Console displays current run, current node, turns, steps, and interventions.
- Session-bound runs are gated when a Session is paused, cancelled, or already running.
- Raw `/api/runs` remains backward compatible.

Intervention state:

- Pause and resume update Session state and create intervention history.
- Cancel marks a Session cancelled, records an intervention, and blocks future session-bound runs.
- Retry records intent and creates or updates pending retry metadata, but does not automatically re-run a node.
- Skip marks the selected step skipped and records an intervention.
- Edit Step Input changes stored metadata, but does not execute the edited input.
- Add Constraint appends a user turn and records intervention history.

These controls are audit/history controls first. They do not interrupt real external processes because no real external processes are running yet.

## 6. Current Execution Planning and Contract Preview State

Execution Contract Preview:

- Deterministic and side-effect free.
- Does not create runs or sessions.
- Does not call external runtimes.
- Describes per-node:
  - category;
  - ports;
  - provider;
  - runtime reference;
  - execution mode;
  - risk level;
  - required input issues;
  - warnings;
  - errors;
  - port compatibility issues.
- Includes placeholder capability providers for CLI, MCP, RAG, ComfyUI, API, Browser, and Human flows without enabling execution.

Linear Execution Plan:

- Deterministic and side-effect free.
- Reuses Execution Contract Preview.
- Supports only simple linear chains in the current phase.
- Reports plan status and step metadata.
- Detects and reports:
  - empty flow;
  - missing or multiple triggers;
  - branching;
  - fan-in;
  - cycles;
  - blocked nodes;
  - missing required inputs;
  - invalid edges;
  - unknown nodes.
- Emits additive plan-aware RunEvents during mock/protected execution:
  - `execution.plan.created`;
  - `execution.step.queued`;
  - `execution.step.started`;
  - `execution.step.completed`;
  - `execution.step.blocked` where applicable;
  - `execution.plan.completed`.

Current execution planning does not perform DAG execution, branch scheduling, fan-in merging, loops, concurrency, or real capability invocation.

## 7. Current E2E Regression Coverage

Phase 5K added `@playwright/test`, root E2E scripts, `playwright.config.ts`, and `tests/e2e/workspace.spec.ts`.

Commands:

```bash
pnpm test:e2e
pnpm test:e2e:headed
```

Current E2E coverage:

- App loads and default nodes render.
- No fatal browser console errors during load smoke.
- Node drag works.
- Edge deletion works.
- Delete and reconnect edge path works.
- Branching graph can be created and diagnosed.
- Fan-in graph can be created and diagnosed.
- Cycle graph can be created and diagnosed.
- Session Console minimize, restore, and drag works.
- Execution Contract Preview minimize, restore, and drag works.
- Linear Execution Plan minimize, restore, and drag works.
- Mock run reaches success.
- Run Inspector receives events.
- Linear plan or node badges show `Live: Completed`.
- Runtime protection smoke confirms:
  - `mock-local` returns a run id;
  - `openclaw-local` returns a protected dry-run run id;
  - `hermes-local` returns `runtime_unavailable`.

The E2E suite is intentionally small and serial. It is a regression floor, not exhaustive product coverage.

## 8. Known Limitations

- No DB persistence.
- No authentication.
- No multi-user support.
- No real OpenClaw Agent Chat or Tool Call execution.
- No real Hermes adapter.
- No Shell execution.
- No Browser execution.
- No filesystem execution.
- No MCP client/server bridge.
- No RAG embeddings, vector database, or document ingestion.
- No ComfyUI workflow execution.
- No real external runtime interruption.
- No dedicated Session event stream.
- Retry does not automatically re-run node execution.
- Step input edits do not trigger execution.
- No full Harness Dock.
- No panel docking, resizing, snapping, or persistent panel layout.
- Floating panels still block handles where they physically overlap the graph.
- Direct drag-reconnect of an existing edge is wired but not covered by the initial E2E scaffold.
- Linear Execution Plan supports only simple linear chains.
- Branching, fan-in, fan-out, loops, and parallel execution are diagnostic-only.
- Debug/protocol logs are not localized; this is intentional for stable developer semantics.

## 9. Risks Before Phase 6

- Capability bridge work can accidentally blur preview/protected/live boundaries. Phase 6 must keep preview-only providers non-executing until explicit bridge contracts and approval gates are stable.
- Runtime protection could regress if `openclaw-local` health status is mistaken for permission to execute real OpenClaw actions.
- Session and intervention stores are in-memory only; refreshes and gateway restarts lose state.
- Floating panel overlap can still interfere with canvas interactions in dense graphs.
- Linear-only planning may produce confusing diagnostics once users build richer DAGs unless Phase 6 preserves clear unsupported-state messaging.
- E2E coverage is useful but small; future features need tests before acceptance.
- RunEvent ordering and WebSocket completion behavior remain important compatibility surfaces for Session Console, Run Inspector, and live plan status.
- Direct external capability providers such as CLI, MCP, RAG, Browser, Shell, and ComfyUI carry safety risk and must remain preview/protected until explicit approval and execution contracts exist.

## 10. Recommended Phase 6 Roadmap

Recommended sequence:

1. Capability Bridge Foundation
   - Define shared provider contract for external capabilities.
   - Keep all providers preview-only or protected by default.
   - Preserve deterministic contract preview before any invocation.

2. Execution Contract Decision Gates
   - Add approve/reject decision flow for high-risk or live-like actions.
   - Record approval decisions as interventions.
   - Block live/high-risk actions without explicit approval.

3. Basic DAG Planning
   - Add branch-aware graph analysis.
   - Keep fan-in merge semantics explicit.
   - Continue to reject cycles unless a loop contract is designed.

4. Session Event Stream and Replay
   - Add a dedicated session event stream.
   - Support timeline replay and step-level trace inspection.

5. CLI/MCP/RAG/ComfyUI Bridges
   - Implement one bridge at a time.
   - Start with preview and dry-run contracts.
   - Add guarded execution only after tests and approval gates exist.

6. Workspace Interaction Hardening
   - Add direct edge reconnect E2E coverage.
   - Consider panel docking or persistent layout only after capability bridge scope is stable.

## 11. Required Development Rule

Every future phase must pass the following commands before acceptance:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

If a phase intentionally cannot run one of these commands, the phase report must state:

- which command was not run;
- the exact reason;
- the residual risk;
- the follow-up required before merge or acceptance.

No future phase should be considered complete if it changes workspace interactions, runtime behavior, session behavior, execution planning, or protocol semantics without updating or adding E2E coverage where appropriate.
