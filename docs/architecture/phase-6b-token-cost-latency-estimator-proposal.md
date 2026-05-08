# Phase 6B-0: Token / Cost / Latency Estimator Design Proposal

## 1. Executive Summary

Phase 6B proposes a local, optional, non-blocking Token / Cost / Latency Estimator for Clawflow Studio. The estimator should help users understand likely resource usage before running a flow by combining node catalog contracts, runtime metadata, model/provider hints, and user input hints.

The estimator is preview-only at MVP. It must not perform billing, fetch live pricing, call external providers, or block canvas editing. It should communicate uncertainty clearly and remain separate from actual run telemetry.

## 2. Why the Estimator Is Needed

Users need a practical preview of resource usage before running an agent workflow:

- Flow authors expect to understand approximate token, cost, and latency impact before clicking Run.
- Model/provider selection will become easier when users can compare rough usage profiles.
- Thinking/reasoning intensity needs visible tradeoffs, especially for high-value reasoning nodes.
- Protected dry-run becomes more useful when it can show what real execution might cost later.
- Real adapter work needs a stable contract boundary for model, provider, context, tool, and artifact assumptions before live calls exist.

## 3. Non-goals

Phase 6B must not implement:

- real billing
- payment or subscription systems
- live provider pricing API calls
- live external runtime execution
- exact guarantees of actual token, cost, or latency usage
- hard execution blocking based only on estimates
- network calls from the estimator
- provider-specific lock-in

## 4. Estimator Principles

- Local-first: use local catalog, runtime, model, and prompt metadata only.
- Optional: estimates should enhance understanding, not be required to edit flows.
- Preview-only at MVP: estimation is part of contract/plan preview, not execution.
- Explain uncertainty: every estimate should include confidence and warnings where appropriate.
- Avoid false precision: prefer ranges over single exact values.
- Separate estimate from actual telemetry: actual run usage should be a separate future data path.
- Do not block canvas editing: invalid or unsupported flows can still be edited freely.

## 5. Required Input Sources

The estimator should consume these sources when available:

- `NodeTypeDefinition.estimateHints`
- input/output contract data types
- required, recommended, and optional input metadata
- provider metadata
- `modelRef`, `modelFamily`, and `contextWindowTokens`
- `runtimeRef` and runtime compatibility
- user prompt/input length
- session context hints
- thinking level / reasoning intensity
- tool-use flags
- artifact flags such as image, video, file, or workflow outputs

Missing metadata should reduce confidence rather than fail estimation.

## 6. Proposed Protocol Types

Suggested shared protocol types:

```ts
export type EstimateConfidence = "high" | "medium" | "low" | "unknown";

export type EstimateUnit = "tokens" | "ms" | "usd" | "count" | "bytes" | "unknown";

export type CostEstimateStatus = "known" | "zero" | "unknown" | "not_applicable";

export interface EstimateRange {
  min?: number;
  expected?: number;
  max?: number;
  unit: EstimateUnit;
}

export type EstimatorSource =
  | "node-catalog"
  | "runtime-registry"
  | "model-metadata"
  | "user-input"
  | "session-context"
  | "static-default"
  | "inferred";

export interface EstimatorWarning {
  code: string;
  messageKey: string;
  details?: Record<string, unknown>;
  nodeId?: string;
  source?: EstimatorSource;
}

export interface TokenEstimateBreakdown {
  inputTokens: EstimateRange;
  outputTokens: EstimateRange;
  reasoningTokens?: EstimateRange;
  toolCallOverheadTokens?: EstimateRange;
  contextCarryoverTokens?: EstimateRange;
}

export interface CostEstimateBreakdown {
  status: CostEstimateStatus;
  inputCost?: EstimateRange;
  outputCost?: EstimateRange;
  reasoningCost?: EstimateRange;
  toolCost?: EstimateRange;
  totalCost?: EstimateRange;
  currency?: string;
}

export interface LatencyEstimateBreakdown {
  queueLatencyMs?: EstimateRange;
  modelLatencyMs?: EstimateRange;
  toolLatencyMs?: EstimateRange;
  totalLatencyMs: EstimateRange;
}

export interface NodeEstimateResult {
  nodeId: string;
  nodeType: string;
  label?: string;
  runtimeRef?: string;
  modelRef?: string;
  confidence: EstimateConfidence;
  tokenConfidence: EstimateConfidence;
  costConfidence: EstimateConfidence;
  latencyConfidence: EstimateConfidence;
  sources: EstimatorSource[];
  tokens: TokenEstimateBreakdown;
  cost?: CostEstimateBreakdown;
  latency: LatencyEstimateBreakdown;
  warnings: EstimatorWarning[];
}

export interface FlowEstimateResult {
  flowId?: string;
  confidence: EstimateConfidence;
  tokenConfidence: EstimateConfidence;
  costConfidence: EstimateConfidence;
  latencyConfidence: EstimateConfidence;
  nodes: NodeEstimateResult[];
  totals: {
    tokens: TokenEstimateBreakdown;
    cost?: CostEstimateBreakdown;
    latency: LatencyEstimateBreakdown;
  };
  warnings: EstimatorWarning[];
  partial: boolean;
}
```

`NodeEstimateHints` already exists from Phase 6A-1 and should remain the catalog-level static hint surface. Phase 6B should extend it only if needed, not replace it.

Warning messages should be i18n-friendly. `EstimatorWarning.code` is the stable diagnostic identifier, `messageKey` is the UI translation key, and `details` carries structured values for interpolation or debug display. English text should not be the primary API contract.

`EstimateRange.unit` should use the fixed `EstimateUnit` vocabulary:

- `tokens`
- `ms`
- `usd`
- `count`
- `bytes`
- `unknown`

`CostEstimateStatus` distinguishes zero-cost internal nodes from unknown provider pricing:

- `known`: pricing metadata exists and cost ranges are meaningful
- `zero`: the node is internal or otherwise estimated to have no provider cost
- `unknown`: provider/model pricing is missing
- `not_applicable`: cost is not meaningful for this node or dimension

Confidence should exist both globally and per dimension. Overall confidence summarizes the estimate as a whole, while token, cost, and latency confidence can diverge. For example, a mock runtime may have high latency confidence, medium token confidence, and unknown cost confidence.

## 7. Estimation Dimensions

The estimator should model:

- input tokens
- output tokens
- reasoning/thinking tokens
- tool-call overhead
- context carryover
- artifact size or artifact complexity
- latency range
- cost range
- overall confidence
- token confidence
- cost confidence
- latency confidence

Each dimension should support unknown values. Unknown cost should not prevent token or latency estimates from being shown.

## 8. Per-node Estimation

`manual.trigger`:
Estimate user-provided input length when available. Otherwise use a small default event payload estimate. Cost is normally unknown or zero because this node is internal.

`agent.start`:
Estimate input tokens from trigger/session context and output tokens from planning response hints. Thinking level may increase reasoning token range.

`agent.worker`:
Estimate higher input/output ranges than `agent.start` because this node performs work over upstream context. Tool-use flags should add overhead later.

`agent.end`:
Estimate summarization-style input and output. Output range should usually be lower than worker output, unless catalog hints say otherwise.

`output.console`:
Estimate near-zero model cost and low latency. It displays or records output and should not imply runtime model usage.

Future `api.call`:
Token estimate may be low, but latency and cost confidence should be low unless API metadata exists. Side-effect warnings should be shown for write-like APIs later.

Future `browser.action`:
Estimate high uncertainty latency. Browser control may include page load, action, and observation overhead. Cost may remain unknown.

Future `cli.command`:
Estimate should be blocked or low-confidence preview-only. Shell execution must not be modeled as executable until a safe bridge exists.

Future `mcp.tool`:
Estimate depends on tool schema and provider metadata. Unknown tools should show low confidence and possible tool-call overhead.

Future `rag.query`:
Estimate query input, retrieved context carryover, and answer output separately. Vector DB or embedding estimates are future work and should be optional.

Future `comfyui.workflow`:
Token cost may be irrelevant or low, but artifact/latency estimates can be high uncertainty. Image/video outputs should use artifact complexity hints, not token-only assumptions.

Future `human.approval`:
Estimate near-zero machine cost but unknown human wait time. Latency should be represented as human-dependent and low confidence.

## 9. Per-flow Estimation

For MVP linear chains, aggregate node estimates in execution order from the Linear Execution Plan.

Flow-level totals should include:

- summed token ranges
- summed known cost ranges where pricing exists
- latency range as a simple serial sum for linear execution
- warnings collected from all nodes
- partial flag when some nodes cannot be estimated confidently

Branching, fan-in, cycles, loops, and parallel execution should be partial or unsupported for now. The estimator should still estimate individual nodes where possible and report unsupported graph warnings.

## 10. Pricing Model Strategy

Pricing should be local and optional.

Recommended strategy:

- Add a static local price table later only when model/provider metadata is stable.
- Allow provider/model pricing metadata to be registered locally in a future registry.
- Do not fetch pricing over the network in MVP.
- Allow cost to be unknown while token and latency estimates are still shown.
- Use `CostEstimateStatus` so internal nodes can report `zero` or `not_applicable` instead of being confused with unknown provider pricing.
- Keep currency formatting in UI helpers, not in the core estimate math.
- Store ranges as numeric values with units rather than preformatted strings.

## 11. Latency Model Strategy

Initial latency should use simple static hints:

- mock mode should be near-instant.
- protected dry-run is not equivalent to real runtime latency.
- runtime-required or external side-effect nodes should show unknown or low-confidence latency.
- model family may adjust baseline latency later.
- tool and artifact nodes should include overhead ranges when metadata exists.

Latency should remain a range and should not be presented as a guarantee.

## 12. UI Integration Plan

Recommended UI surfaces:

- Node card compact estimate badge:
  - estimated tokens
  - latency range
  - confidence

- Execution Contract Preview estimate section:
  - per-node token/cost/latency ranges
  - warnings when confidence is low
  - source list such as catalog, runtime, model metadata, inferred

- Linear Execution Plan per-step estimate:
  - step-level token/latency preview
  - plan-level total summary for linear chains

- Flow-level estimate summary:
  - total input/output/reasoning token range
  - known/unknown cost status
  - latency range
  - confidence and warnings

Copy should be explicit:

- Estimated
- Range
- Confidence
- Unknown cost
- Low confidence

## 13. API / Architecture Placement

Recommended placement:

- Core estimator logic belongs in `packages/flow-engine` because it consumes FlowSpec, node contracts, and linear plans.
- Shared estimate result types belong in `packages/protocol`.
- Gateway can expose a preview endpoint such as:

```http
POST /api/flows/estimate
```

Input:

- `flow`
- optional user/session estimate hints
- optional runtime/model metadata hints

Output:

- `FlowEstimateResult`

Web UI should store estimate preview state in the existing flow store or a small estimate store. The estimator must not call providers directly and must not depend on runtime execution.

Refresh rules should be conservative:

- Recompute estimates when nodes, edges, node type, runtimeRef, harnessRef, model metadata, budget/thinking settings, session-context hints, or user estimate inputs change.
- Do not recompute estimates for position-only node drags.
- Keep manual Refresh available.
- If automatic refresh is added, debounce it separately from canvas position updates.

## 14. Validation Behavior

Estimator validation should produce warnings, not hard errors.

Rules:

- missing required input reduces confidence and adds a warning
- unknown model/provider returns unknown or low-confidence cost
- unknown runtime returns low-confidence latency/cost
- unsupported graph returns partial estimates where possible
- blocked nodes can still have preview estimates with blocked warnings
- estimates must not block canvas editing
- estimates must not replace Flow validation, Execution Contract Preview, or Linear Execution Plan diagnostics

## 15. Migration Plan

Phase 6B-1:

- Add estimator protocol types.
- Add static local estimator in `packages/flow-engine`.
- Optionally add a Gateway preview endpoint if the API shape is stable.
- Support five MVP nodes only.
- Return token and latency confidence ranges.
- Cost can be unknown unless static metadata exists.
- No complex UI beyond whatever is necessary to manually inspect returned estimates during development.
- No billing, provider pricing API calls, execution blocking, or runtime invocation changes.

Phase 6B-2:

- Add Web store state for estimate previews.
- Add UI estimate preview surfaces.
- Surface node-level and flow-level token, cost, latency, and confidence ranges.
- Use `NodeTypeDefinition.estimateHints`, user prompt length, runtime mode, and thinking level in the UI.

Phase 6B-3:

- Add E2E regression coverage.
- Add UX polish for low-confidence warnings and unknown cost states.
- Verify estimate panel renders, default flow estimates are stable, and existing run behavior remains unchanged.

Future:

- Add local model/provider price registry.
- Add optional actual run telemetry comparison.
- Add provider-specific estimator adapters only after real runtime bridges exist.

## 16. Risks

- False precision: users may interpret estimates as exact values.
- Model pricing changes: static tables can drift quickly.
- User misunderstanding: cost estimates may be mistaken for billing data.
- Provider overfitting: estimator must not assume one model family or vendor.
- UI clutter: estimate data can overwhelm the workspace if not compact.
- Preview performance: estimation must not slow every canvas drag or edge edit.
- Privacy: future estimator work must not send prompts or session context externally without explicit design and consent.

## 17. Recommended Phase 6B-1 Implementation Boundary

Phase 6B-1 should implement only:

- shared estimator protocol types
- static local estimator in `packages/flow-engine`
- optional Gateway estimate endpoint if it stays side-effect-free
- five MVP node support
- token and latency ranges with confidence
- unknown cost support
- warning output for missing metadata or unsupported graph shapes
- no real billing
- no provider pricing API calls
- no runtime execution changes
- no execution blocking based on estimates
- no major UI redesign
- preservation of all existing Playwright E2E tests

## 18. Acceptance Criteria

- Proposal-only document is created at `docs/architecture/phase-6b-token-cost-latency-estimator-proposal.md`.
- No application source code is modified.
- Non-goals are explicit.
- Estimator principles are explicit.
- Required input sources are defined.
- Proposed protocol types are documented.
- Phase 6B-1 implementation boundary is clear.
- Future pricing, latency, UI, API, and validation strategy are described without implying current implementation.
