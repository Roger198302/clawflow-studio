# Clawflow Studio Session, Harness, and Runtime Architecture

## Status

- Current phase: after Phase 5F, before Phase 5G
- Execution mode: local MVP
- Persistence: in-memory only
- Real runtime execution: not implemented
- Safety boundary: protected dry-run for openclaw-local

## Core Object Model

```text
Project
  -> Flow
      -> Session
          -> Run
              -> Step
          -> Turn
          -> Intervention, planned in Phase 5G
```

Flow is the structural workflow graph. It defines nodes, edges, node configuration, runtime references, and optional harness references.

Session is the long-running task context for a Flow. It holds the current task state, user/runtime/system turns, and node-level step history. Sessions are currently stored in memory only.

Run is one execution attempt within a Session. A Session can have multiple Runs over time, but the MVP currently tracks the active/current Run.

Turn is a user, system, assistant, or runtime message inside a Session. Turns are user-facing task history, not low-level engine telemetry.

Step is a node-level execution record inside a Session. Steps are derived from node RunEvents and can contain node input, output, error, runtime id, protected dry-run state, and harness compatibility metadata.

Harness is the node execution capability contract. It describes the intended execution wrapper, capability requirements, risk level, execution mode expectations, and runtime fit.

Runtime is the actual backend, agent, or tool environment selected by a node. Current runtime records include mock-local, openclaw-local, hermes-local, and shell-local.

Compatibility is the deterministic evaluation between a Harness and Runtime. It explains whether a selected pairing is suitable, partial, unsupported, or unknown.

## Current Execution Flow

1. The user creates or selects a Flow in the Web UI.
2. The user creates a Session for the current Flow.
3. The user runs the Session from the Session Console.
4. The Gateway creates a Run and binds it to the Session.
5. The Flow Engine executes the Flow path with the existing mock/protected runtime behavior.
6. The Flow Engine emits structured RunEvents.
7. The Gateway maps RunEvents into Session Turns and Session Steps.
8. The Web UI displays Session Console state, Run Inspector logs, Event timeline, node IO, and canvas node status.

Session updates are currently derived from existing RunEvents. There is not yet a dedicated Session event stream.

## Safety Boundaries

- mock-local executes safely through MockRuntimeAdapter.
- openclaw-local is recognized as a Runtime but only enters protected dry-run.
- hermes-local is unavailable and rejected with runtime_unavailable.
- shell-local is registered as unavailable and is not used for real execution.
- Browser, filesystem, shell, Auth, database, and external runtime integrations are not active.
- No real OpenClaw Agent Chat, Tool Call, or session bridge is implemented.

## Harness Architecture

Harness is not execution yet. It is a metadata contract attached to a node through harnessRef.

A Harness describes:

- intended execution mode
- required capabilities
- recommended capabilities
- risk level
- compatible runtime fits
- default execution mode

Current built-in harness profiles:

- chat.basic: general low-risk text conversation harness.
- browser.research: research harness for browser or web-search assisted investigation.
- code.local: high-risk local code harness requiring file and command capabilities.
- research.agent: research-oriented agent harness for reasoning over gathered context.
- approval.human: human checkpoint harness for explicit user approval.
- critic.basic: review harness for critique and quality checks.
- comfyui.workflow: workflow API placeholder for media workflow metadata preview.

The Harness Inspector displays the selected harness, its requirements, risk level, runtime fit, missing capabilities, and compatibility reasons.

## Compatibility Evaluation

Compatibility evaluation is deterministic. It evaluates harnessRef plus runtimeId and produces a HarnessCompatibilityResult.

The fit value can be:

- best
- good
- partial
- unsupported
- unknown

The result includes:

- compatibility reasons
- missing capabilities
- effective execution mode
- risk level
- protectedDryRun

Compatibility currently informs UI and metadata only. It does not block execution in Phase 5F except where existing runtime unavailability logic already blocks execution, such as hermes-local returning runtime_unavailable.

## Current UI Surfaces

Floating Session Console is the user-facing task history and intervention surface. It shows Session state, turns, steps, current run/node, and compact compatibility metadata when available.

Canvas node harness badges show compact harness label, risk, runtime fit, execution mode, and protected dry-run state where applicable.

Harness Inspector is the right-side node configuration surface for selecting a harness and reviewing capability requirements, compatibility reasons, and missing capabilities.

Runtime Manager shows registered runtimes, health state, execution mode, capabilities, and placeholder connection status.

Event Log / Run Inspector remains the engineering-level observability panel. It shows RunEvents, logs, node IO, payloads, and low-level execution status.

## Current Limitations

- No DB persistence.
- No real OpenClaw session bridge.
- No real Hermes adapter.
- No shell, browser, or filesystem execution.
- No full Harness Dock.
- No drag-and-drop Session Console.
- No Human Intervention Controls yet.
- No dedicated Session event stream.
- No backend locale negotiation for debug or protocol logs.

## Planned Next Phases

- Phase 5G: Human Intervention Controls
  - pause, resume, cancel
  - retry step
  - skip step
  - edit step input
  - add constraint
  - intervention timeline

- Phase 5H: Execution Contract Preview
  - pre-run node execution summary
  - risk explanation
  - approve once / always allow / cancel
  - protected/live/dry-run clarity

- Phase 6A: Real OpenClaw Local Adapter
  - only after Session + Harness + Intervention + Contract Preview are stable

## Design Principle

Flow defines structure.
Session holds context.
Run records execution attempts.
Node represents a work unit.
Harness declares execution capability.
Runtime provides actual backend capability.
Compatibility explains whether the chosen pairing is safe and suitable.
Intervention records human control.
