# Phase 6A Node Type Expansion and Contract Schema Proposal

Status: proposal only. No application source code has been changed for this document.

Phase 6A implementation should be a schema and catalog foundation only. It should not introduce full adapter execution, real external runtime invocation, or a complete node marketplace. The goal is to make node contracts explicit enough for safer previews, planning, validation, estimation, and later adapter work.

## 1. Current Node Model Summary

The current MVP node model is centered on five default node concepts:

- Manual Trigger
- Start Agent
- Worker Agent
- End Agent
- Console Output

The shared `FlowNode` model already contains useful foundations:

- stable node id
- `type`
- `role`
- label
- optional `runtimeRef`
- optional agent and harness metadata
- context, budget, and risk policies
- position
- free-form `data`

Phase 5 added related metadata layers:

- Runtime registry and execution modes
- Harness registry and compatibility results
- Execution Contract Preview
- Linear Execution Plan
- Session steps and interventions

The canvas is now permissive after Phase 5J. Users can create unsupported graphs, while planning panels explain unsupported structure.

## 2. Problems With the Current Fixed Demo Node Model

The current five-node model is useful for proving the workspace, but it is too narrow for Phase 6 capability bridge work.

Main issues:

- Node types are still oriented around one demo agent chain.
- Input and output contracts are inferred rather than declared as durable node metadata.
- Required and optional inputs are not consistently represented.
- Runtime compatibility is mostly runtime/harness metadata, not a first-class node catalog contract.
- Capability providers such as CLI, MCP, RAG, Browser, API, and ComfyUI exist as preview concepts but are not represented as a structured catalog.
- Model/provider metadata is not explicit enough to support later token, cost, latency, or safety estimates.
- Validation can detect some graph structure issues, but it cannot fully explain node-specific contract problems.
- The current node library cannot grow safely without a stable schema for node definitions.

## 3. Proposed Extensible Node Type System

Introduce an extensible node type system based on catalog-defined node definitions.

Each node type should have:

- stable type id
- display metadata
- category
- role
- input contract
- output contract
- capability provider metadata
- default runtime compatibility
- default harness recommendation
- allowed execution modes or a default execution mode
- risk metadata
- budget and estimate hints
- validation rules
- UI grouping metadata

Example type ids:

- `manual.trigger`
- `agent.start`
- `agent.worker`
- `agent.end`
- `output.console`
- `human.approval`
- `api.call`
- `browser.action`
- `cli.command`
- `mcp.tool`
- `mcp.resource`
- `mcp.prompt`
- `rag.query`
- `rag.context`
- `comfyui.workflow`
- `utility.transform`

These ids remain stable English protocol identifiers. User-facing labels and descriptions should continue to use i18n dictionary keys.

## 4. Node Categories

Node categories describe broad product behavior and planning expectations.

Recommended categories:

- `trigger`: starts a flow or session run.
- `agent`: agent reasoning or response generation.
- `capability`: external or provider-backed action.
- `knowledge`: retrieval, memory, or context projection.
- `control`: approval, routing, gating, or human intervention.
- `output`: terminal display, artifact, or export destination.
- `utility`: deterministic transform, formatting, or helper operation.

Categories are broader than roles. They help UI grouping, risk explanation, and execution planning.

## 5. Node Roles

Node roles describe responsibility inside the flow graph.

Current roles should remain valid:

- `trigger`
- `start`
- `process`
- `end`
- `tool`
- `control`
- `output`
- `safety`
- `memory`

Recommended usage:

- `category` explains what kind of node it is.
- `role` explains what responsibility it has in a flow.
- `type` identifies the concrete node implementation contract.

Examples:

- `manual.trigger`: category `trigger`, role `trigger`
- `agent.worker`: category `agent`, role `process`
- `human.approval`: category `control`, role `control`
- `rag.query`: category `knowledge`, role `memory`
- `output.console`: category `output`, role `output`

## 6. Input Contract Schema

Each node definition should declare input ports.

Proposed input port fields:

- `id`: stable port id such as `in`, `prompt`, `context`, or `image`.
- `labelKey`: i18n key for display.
- `descriptionKey`: optional i18n key.
- `dataType`: `text`, `json`, `event`, `artifact`, or `any` for Phase 6A-1.
- `required`: boolean.
- `recommended`: optional boolean.
- `multiple`: boolean.
- `defaultValue`: optional static default.
- `resolutionSource`: optional hint, such as `upstream`, `session`, `constant`, or `user`.
- `schema`: optional JSON-schema-like metadata.
- `examples`: optional small examples for docs and test fixtures.

Port ids should be stable because saved flows and React Flow handles may refer to them.

The broader protocol can preserve `image`, `video`, and `file` as future-compatible enum values, but Phase 6A-1 should initially implement and validate only the minimal practical set: `text`, `json`, `event`, `artifact`, and `any`.

## 7. Output Contract Schema

Each node definition should declare output ports.

Proposed output port fields:

- `id`: stable port id such as `out`, `result`, `artifact`, or `event`.
- `labelKey`: i18n key for display.
- `descriptionKey`: optional i18n key.
- `dataType`: `text`, `json`, `event`, `artifact`, or `any` for Phase 6A-1.
- `multiple`: boolean.
- `schema`: optional JSON-schema-like metadata.
- `artifactKind`: optional hint, such as `log`, `image`, `report`, `patch`, or `workflow`.
- `previewable`: whether the UI can show a compact preview.

The contract preview and linear planner should use declared outputs before falling back to inferred defaults.

As with input ports, the protocol may preserve `image`, `video`, and `file` as future-compatible values while the Phase 6A-1 implementation focuses on the smaller safe set.

## 8. Required vs Optional Inputs

Required input behavior:

- A required input without a resolved upstream, default, or session/user resolution source should produce a validation error.
- The canvas should still allow the node and graph to exist.
- Run or plan validation should explain the missing input clearly.

Optional input behavior:

- Optional inputs should not block planning.
- Missing optional inputs should not produce warnings by default.
- Missing optional inputs may produce warnings when `recommended: true`.
- Optional inputs can be used for context, constraints, examples, or additional artifacts.

This keeps the workspace permissive while making execution readiness explicit.

## 9. Runtime Compatibility Model

Each node definition should describe runtime compatibility independently from the current selected runtime.

Recommended compatibility fields:

- `supportedRuntimeTypes`: runtime types such as `mock`, `openclaw`, `hermes`, `shell`, `mcp`, `http`, or `custom`.
- `defaultRuntimeRef`: usually `mock-local` for MVP-safe nodes.
- `requiredCapabilities`: stable capability codes.
- `recommendedCapabilities`: optional capability codes.
- `allowedExecutionModes`: allowed modes such as `mock`, `dry_run`, `protected`, or `live`.
- `defaultExecutionMode`: optional preferred mode for this node/runtime pairing.
- `protectedByDefault`: boolean for high-risk or external providers.
- `unavailableReasonKey`: optional i18n key when a node is intentionally preview-only.

Runtime compatibility resolution should have three layers:

1. The node catalog defines theoretical compatibility for a node type.
2. The runtime registry defines current runtime availability, health, capabilities, and execution mode.
3. The flow engine resolves final execution readiness by combining the node definition, selected `runtimeRef`, and runtime registry status.

This means a catalog may say a node can theoretically run on OpenClaw, while the current `openclaw-local` runtime still resolves to protected dry-run only. Runtime health does not imply permission to execute live actions.

Current behavior must remain:

- `mock-local` can execute mock flows.
- `openclaw-local` can only protected dry-run.
- `hermes-local` remains unavailable.
- Shell and external providers must not execute.

## 10. Model and Provider Metadata Fields

Future estimation and runtime adapters need explicit metadata without forcing real execution.

Recommended provider fields:

- `provider`: `internal`, `runtime`, `cli`, `mcp`, `rag`, `comfyui`, `api`, `browser`, or `human`.
- `providerCapabilityId`: stable capability id, such as `agent.chat`, `tool.call`, `mcp.tool`, or `rag.query`.
- `modelRef`: optional model identifier.
- `modelFamily`: optional broad family for estimates.
- `contextWindowTokens`: optional estimate hint.
- `defaultThinkingLevel`: optional policy hint.
- `supportsStreaming`: optional boolean.
- `supportsToolUse`: optional boolean.
- `supportsArtifacts`: optional boolean.
- `externalSideEffects`: boolean.
- `requiresApproval`: boolean.

These fields are contract metadata only until real adapters are explicitly implemented.

Use `providerCapabilityId?: string` for node/provider capability metadata. Avoid a generic `capabilityId` field in node definitions because it can be confused with runtime capability ids from the runtime registry.

## 11. Validation Rules

Validation should remain explanatory, not canvas-blocking.

Recommended rule groups:

- Structural graph validation:
  - empty flow
  - missing trigger
  - multiple triggers
  - invalid edge references
  - cycles
  - unsupported branching or fan-in for current planner

- Node contract validation:
  - unknown node type
  - missing required input
  - unsupported data type mapping
  - blocked or preview-only execution mode

- Runtime compatibility validation:
  - missing runtime
  - unknown runtime
  - unavailable runtime
  - unsupported runtime type
  - missing runtime capabilities
  - protected/runtime-required mode requiring approval

- Safety validation:
  - high-risk node without approval policy
  - live-like mode selected for protected-only runtime
  - external side-effect capability selected without contract approval

The canvas should permit unsupported graphs. The planner, Run Inspector, Session Console, and contract panels should explain why a graph cannot execute.

## 12. Node Catalog Structure

The node catalog should become the source of truth for node definitions.

Recommended shape:

```ts
interface NodeTypeDefinition {
  type: string;
  category: NodeCategory;
  role: NodeRole;
  labelKey: string;
  descriptionKey?: string;
  groupKey: string;
  icon?: string;
  inputs: NodeInputDefinition[];
  outputs: NodeOutputDefinition[];
  provider: CapabilityProvider;
  providerCapabilityId?: string;
  defaultRuntimeRef?: string;
  defaultHarnessId?: string;
  riskLevel: NodeRiskLevel;
  defaultExecutionMode?: NodeExecutionMode;
  allowedExecutionModes: NodeExecutionMode[];
  runtimeCompatibility: RuntimeCompatibilityDefinition[];
  estimateHints?: NodeEstimateHints;
  experimental?: boolean;
}
```

Recommended catalog groups:

- Triggers
- Agents
- Human Control
- Knowledge
- Tools and Capabilities
- Outputs
- Utilities
- Experimental Providers

Experimental providers can exist in the catalog without appearing in the default MVP palette.

Execution mode semantics:

- Prefer `allowedExecutionModes` on the node definition.
- Use `defaultExecutionMode` only as the catalog-level default when no runtime-specific override is present.
- Runtime-specific execution modes should live inside `runtimeCompatibility`.
- Final execution readiness must be resolved by the flow engine, not assumed from the catalog alone.

## 13. How This Prepares for Token and Cost Estimator

A token and cost estimator needs stable contract metadata before real runtime calls.

This proposal prepares estimator work by defining:

- input data type and required/optional status
- expected output data type
- model/provider metadata
- context size hints
- thinking-level defaults
- streaming/tool/artifact support
- risk level
- external side-effect flags
- runtime compatibility and execution mode

The estimator can initially use static hints and later integrate runtime-specific pricing or model metadata.

Phase 6A-1 should not implement full token pricing integration. It should only add enough schema and static metadata fields for a later estimator to consume.

## 14. How This Prepares for Real Runtime Adapters

Real adapters need a clear contract boundary before invocation.

This proposal prepares adapters by defining:

- what a node requires
- what a runtime must provide
- what execution mode is allowed
- what inputs are passed
- what outputs are expected
- what side effects may occur
- when approval is required
- how unsupported runtime pairings are explained

Adapters should consume resolved node contracts, not arbitrary UI state. This keeps WebUI, Gateway, Flow Engine, Runtime Registry, and adapter packages decoupled.

Phase 6A-1 should not change adapter invocation behavior. Real runtime adapters should continue to be disabled or protected according to existing Phase 5 behavior.

## 15. Migration Plan From Current Five-Node Default Flow

Migration should be incremental and backward-compatible.

Recommended plan:

1. Keep current `FlowNode.type`, `role`, `runtimeRef`, and `harnessRef` fields.
2. Add node catalog definitions for the current five node types.
3. Map current inferred ports to explicit default ports:
   - `manual.trigger`: output `out` as `event` or `json`
   - `agent.start`: input `in`, output `out`
   - `agent.worker`: input `in`, output `out`
   - `agent.end`: input `in`, output `out`
   - `output.console`: input `in`, no output
4. Keep existing saved flows valid when node catalog metadata is absent.
5. Update Execution Contract Preview to prefer catalog definitions.
6. Update Linear Execution Plan to use catalog input/output contracts.
7. Keep the default five-node flow as the Playwright E2E baseline.
8. Add new node definitions behind catalog groups before exposing them broadly in the palette.
9. Preserve Phase 5K E2E expectations before accepting source changes.

No migration should require rewriting existing flow JSON immediately.

## 16. Phase 6A-1 Implementation Boundary

The first implementation slice should be deliberately narrow.

Phase 6A-1 should do:

1. Add shared protocol schema types for node definitions, input contracts, output contracts, runtime compatibility, model/provider metadata, and estimate hints.
2. Add catalog definitions for the current five default node types.
3. Update Execution Contract Preview to prefer catalog-defined input/output contracts over inferred defaults.
4. Update Linear Execution Plan diagnostics to use catalog-defined contracts for missing inputs, output mappings, and data type compatibility.
5. Preserve the existing default flow JSON shape.
6. Preserve current `FlowNode.type`, `role`, `runtimeRef`, `harnessRef`, and edge shape.
7. Keep canvas editing permissive.
8. Preserve Phase 5K Playwright E2E tests.

Phase 6A-1 should not do:

1. No complete node marketplace or full palette management system.
2. No full token pricing integration.
3. No adapter invocation changes.
4. No real external runtime execution.
5. No new blocking behavior for canvas editing.

Acceptance for Phase 6A-1 should include:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

## 17. Risks and Non-Goals

Risks:

- Over-modeling the schema too early could slow iteration.
- Under-modeling inputs/outputs will make estimators and adapters unsafe later.
- Exposing experimental providers in the palette too soon could confuse users.
- Runtime health being online could be mistaken for permission to execute real actions.
- Directly coupling UI node definitions to adapter implementation details would make future bridges fragile.
- Changing handle ids could break saved flows and E2E tests.

Non-goals:

- No real OpenClaw execution.
- No real Hermes execution.
- No real Shell execution.
- No Browser automation bridge.
- No MCP client/server bridge.
- No RAG ingestion, embeddings, or vector database.
- No ComfyUI workflow execution.
- No database or authentication.
- No complete node marketplace or palette system in Phase 6A-1.
- No full token pricing integration in Phase 6A-1.
- No adapter invocation changes in Phase 6A-1.
- No full DAG execution implementation in this proposal.
- No blocking canvas edits based on validation.
- No replacement of Phase 5J workspace editing behavior.
- No breaking Phase 5K Playwright E2E tests.

Phase 6A implementation should first harden schema and catalog contracts, then update previews and validation to explain readiness. Real runtime adapters should remain future work behind explicit safety gates.
