# Phase 6K Simple Node Setup Proposal

## Goal

Reduce the first-run and per-node configuration cost by adding a beginner-friendly setup layer above the existing Inspector controls. The default node editing model should read as:

1. Task: what this node should do.
2. Connection: where the node gets or sends work.
3. Output: what kind of result the user expects.

The existing Runtime, Harness, Gateway Profile, Contract, Budget, and Risk controls remain available as Advanced Settings.

## Current Problem

The current Inspector exposes the implementation model directly. This is useful for debugging, but new users must understand Runtime, Harness, Gateway Binding, Contract, Budget, and Risk before they can perform simple actions. That makes the product feel workflow-builder first, even after Task Launcher improvements.

## Proposed UX Model

Add a Simple Setup card at the top of the Inspector for selected nodes.

For Agent nodes:

- Task: short text describing the node's job.
- Connection type:
  - Workspace Gateway
  - Gateway Profile
  - URL
  - API
  - Manual input
- Connection value when needed.
- Output format:
  - Console
  - Markdown
  - JSON
  - Summary
- Status copy explaining mock-safe, protected, or manual-only behavior.

For non-Agent nodes:

- Keep the card lightweight.
- Explain the node role and output behavior.
- Avoid showing runtime internals unless Advanced Settings is opened.

## Data Model

Phase 6K keeps this frontend-first and protocol-compatible by using existing `FlowNode.data`.

Suggested shape:

```ts
simpleSetup: {
  task?: string;
  connectionType?: "workspace-gateway" | "gateway-profile" | "url" | "api" | "manual";
  connectionValue?: string;
  outputFormat?: "console" | "markdown" | "json" | "summary";
}
```

Local Gateway URLs and Gateway Profiles remain UI preferences. A user-entered URL or API endpoint in Simple Setup is task metadata only and does not trigger network calls.

## Runtime Safety

Phase 6K does not change runtime execution behavior.

- No automatic OpenClaw execution.
- No provider API calls.
- No shell, browser, filesystem, MCP, RAG, or ComfyUI execution.
- No `/api/runs` call from editing Simple Setup.
- No change to protected dry-run behavior.
- No change to mock run semantics.

## MVP Boundary

Phase 6K-1 should implement:

- Simple Setup card in the Inspector.
- Advanced Settings disclosure for existing runtime/harness/gateway/policy controls.
- i18n labels for English and Simplified Chinese.
- E2E coverage for editing Task / Connection / Output and opening Advanced Settings.

Non-goals:

- No backend changes.
- No protocol package changes.
- No credential storage.
- No automatic API or URL fetching.
- No custom tool execution.
- No new runtime adapter behavior.

## Future Follow-Up

After 6K-1, later phases can add:

- Connection Presets as a first-class UI concept.
- URL Summary and API Call templates.
- Node setup wizard from the node context menu.
- Beginner / Advanced workspace mode.
