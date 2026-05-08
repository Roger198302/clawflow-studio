# Clawflow Studio Session, Harness, Runtime, and Intervention Architecture

## Status

- Current phase: after Phase 5G, with Phase 5H Execution Contract Preview added.
- Execution mode: local MVP.
- Persistence: in-memory only.
- Real runtime execution: not implemented.
- Safety boundary: `openclaw-local` is recognized but uses protected dry-run only.
- Human intervention: implemented as session state and audit history, not real external process interruption.

## Core Object Model

```text
Project
  -> Flow
      -> Session
          -> Run
              -> Step
          -> Turn
          -> Intervention
```

- Flow: structural workflow graph. It defines nodes, edges, and node configuration.
- Session: long-running task context for a Flow.
- Run: one execution attempt within a Session, or a raw flow execution when no Session is bound.
- Turn: user, system, assistant, or runtime message recorded in a Session.
- Step: node-level execution record derived from RunEvents.
- Intervention: human control action recorded against a Session, Step, Run, or Node.
- Harness: node execution capability contract. It declares intent, risk, capabilities, and runtime fit.
- Runtime: actual backend, agent, or tool environment, such as `mock-local` or `openclaw-local`.
- Compatibility: deterministic evaluation between Harness and Runtime.

## Design Principle

Flow defines structure.  
Session holds context.  
Run records execution attempts.  
Node represents a work unit.  
Harness declares execution capability.  
Runtime provides actual backend capability.  
Compatibility explains whether the chosen pairing is safe and suitable.  
Intervention records human control.  
Execution Contract, implemented in Phase 5H, explains what a node would do before execution.

## Current Execution Flow

1. The user creates or selects a Flow.
2. The user creates a Session.
3. The user runs the Session.
4. The Gateway creates or binds a Run.
5. The Flow Engine emits RunEvents.
6. The Gateway maps RunEvents into Session Turns and Session Steps.
7. Harness compatibility metadata informs the UI and session step details.
8. The Web UI displays the Session Console, Run Inspector, Event Log, canvas node state, and harness badges.
9. The user can intervene through the Session Console with pause, resume, cancel, retry step, skip step, edit step input, and add constraint.

Session updates are currently derived from existing RunEvents, not a dedicated Session event stream. Interventions are recorded in memory. Retry does not automatically re-run a node. Pause, resume, and cancel do not interrupt real external processes because real external processes are not implemented.

## Safety Boundaries

- `mock-local` executes safely through `MockRuntimeAdapter`.
- `openclaw-local` is recognized but only enters protected dry-run.
- `hermes-local` is unavailable and rejected with `runtime_unavailable`.
- `shell-local` is not used for real execution.
- No browser, filesystem, shell, auth, or database integrations are active.
- Raw `/api/runs` remains backward compatible.
- Session-bound runs are gated when a Session is paused, cancelled, or already running.

## Harness Architecture

Harness is not execution routing yet. It is a metadata and compatibility contract that describes intended execution mode, required capabilities, recommended capabilities, risk level, and runtime fit.

Current built-in harness profiles:

- `chat.basic`: low-risk general text conversation.
- `browser.research`: browser or web-search assisted investigation.
- `code.local`: high-risk local code work requiring file or command capabilities.
- `research.agent`: reasoning over gathered research context.
- `approval.human`: explicit human checkpoint.
- `critic.basic`: critique and quality review.
- `comfyui.workflow`: preview placeholder for image or video workflow APIs.

## Compatibility Evaluation

Compatibility is deterministic. It evaluates `harnessRef` plus selected runtime id and returns:

- `best`
- `good`
- `partial`
- `unsupported`
- `unknown`

The result includes reasons, missing capabilities, effective execution mode, risk level, and protected dry-run status. In Phase 5F and Phase 5G it informs UI and metadata only. It does not block execution except for existing runtime unavailability and session gating logic.

## Human Intervention Controls

- Pause Session: marks the Session paused and records an intervention. It does not pause an external process.
- Resume Session: moves a paused or waiting Session back to idle or running and records an intervention.
- Cancel Session: marks the Session cancelled, records an intervention, updates pending or running steps, and blocks future session-bound runs.
- Retry Step: records a retry intervention and creates a pending retry step. It does not automatically execute the node again.
- Skip Step: marks the selected step skipped and records an intervention.
- Edit Step Input: updates stored step input metadata and records an intervention. It does not rerun completed steps.
- Add Constraint: appends a user turn and records a constraint intervention.

## Execution Contract Preview

Implemented in Phase 5H. Execution Contract Preview is a deterministic, side-effect-free inspection layer for a Flow. It explains how each node would theoretically execute without invoking external capabilities.

The preview includes node category, input and output ports, provider, runtime reference when present, execution mode, risk level, missing required inputs, warnings, errors, port compatibility issues, and summary counts. CLI, MCP, RAG, ComfyUI, API, browser, and human capability nodes are represented only as preview placeholders in this phase.

Execution Contract Preview does not introduce real OpenClaw, Hermes, Shell, Browser, MCP, RAG, ComfyUI, filesystem, or API execution. It does not replace Intervention; approvals and richer permission decisions remain planned future work.

## Linear Execution Plan

Implemented in Phase 5I. The Linear Execution Plan derives an ordered, step-by-step plan from the Execution Contract Preview and the current Flow graph.

The plan includes plan status, ordered steps, upstream and downstream node ids, input and output mappings, execution mode, provider, runtime reference, risk level, warnings, errors, unsupported reasons, and summary counts. It is deterministic and side-effect free.

Phase 5I supports only a simple linear chain: one trigger, one outgoing edge per non-terminal node, one incoming edge per non-trigger node, no cycles, no fan-in, no fan-out, and one terminal path. Branches, multiple independent chains, fan-in, cycles, loops, and parallel execution return unsupported or invalid plans instead of being executed as DAGs.

The mock and protected run path can emit plan-aware RunEvents such as `execution.plan.created`, `execution.step.queued`, `execution.step.started`, `execution.step.completed`, and `execution.plan.completed`. These events are additive; existing node and run events remain the primary compatibility surface for current UI and Session updates.

Linear Execution Plan does not introduce real OpenClaw, Hermes, Shell, Browser, MCP, RAG, ComfyUI, filesystem, or API execution. It prepares the architecture for Phase 5J budget/risk estimates, Phase 5K basic DAG support, and Phase 6A capability bridge contracts.

## UI Surfaces

- Floating Session Console: session state, controls, turns, steps, interventions, and message or constraint input.
- Canvas node harness badges: harness, risk, fit, and execution mode.
- Canvas execution contract badges: node category, execution mode, provider, and issue count.
- Canvas linear plan badges: ordered step number and plan step status.
- Harness Inspector: selected harness, capabilities, runtime fit, and compatibility reasons.
- Runtime Manager: runtime availability, health, capabilities, and execution mode.
- Execution Contract Preview panel: flow-level contract summary, per-node contract cards, warnings, errors, and port compatibility issues.
- Linear Execution Plan panel: plan status, unsupported reasons, ordered step cards, and step mappings summary.
- Event Log / Run Inspector: engineering-level RunEvent and payload debugging surface.

These surfaces are current MVP affordances, not final product designs.

## Current Limitations

- No DB persistence.
- No real OpenClaw session bridge.
- No real Hermes adapter.
- No shell, browser, filesystem, MCP, RAG, ComfyUI, or external API execution.
- No real external runtime interruption.
- Retry does not automatically re-run node execution.
- Step input edits do not trigger execution.
- No full Harness Dock.
- No drag-and-drop Session Console.
- No dedicated Session event stream.
- No approval-gated Execution Contract decision workflow yet.
- No DAG execution in Phase 5I; branches, fan-in, fan-out, loops, and parallel execution are detected but not executed.
- No backend locale negotiation for debug or protocol logs.

## Planned Next Phases

- Phase 5J: Estimate / Budget / Risk MVP
  - pre-run cost, budget, and risk estimates
  - clearer user-facing risk explanation
  - approval policies based on risk and execution mode

- Phase 5K: Basic DAG
  - simple branch-aware graph traversal
  - explicit unsupported cycle and concurrency handling

- Phase 6A: Capability Bridge Foundation
  - common bridge contract for external capability providers
  - no real unsafe execution until Session, Harness, Intervention, and Contract Preview boundaries are stable

- Phase 6B: CLI Bridge
  - preview and guarded local command contracts before any live execution

- Phase 6C: MCP Bridge
  - MCP tools, resources, and prompts as capability providers

- Phase 6D: RAG Bridge
  - knowledge base query and context projection preview

- Phase 6E: ComfyUI Bridge
  - workflow API preview before any real workflow execution
