# Codex Implementation Plan

## Phase 1

- Create pnpm workspace structure.
- Add WebUI, Gateway, Protocol, Flow Engine, Runtime Registry, and adapter package skeletons.
- Add documentation placeholders.
- Validate local typecheck and build.

## Later Phases

- Wire WebUI to Gateway through HTTP.
- Add flow save/load as JSON.
- Add mock run execution and RunEvent streaming.
- Add runtime manager placeholder UI.
- Add focused tests around protocol and flow validation.

## Guardrails

- Do not integrate real OpenClaw, Hermes, ComfyUI, or DaVinci in the MVP.
- Do not add authentication or database storage in Phase 1.
- Do not execute local shell commands from the WebUI.
