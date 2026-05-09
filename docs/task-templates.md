# Task Launcher And Template Gallery

Phase 6J adds a protected Task Launcher for generating preconfigured Agent flows from common local dogfood scenarios. It is a WebUI-first shortcut for users who want to start with a task shape instead of manually assembling nodes.

## Safety Boundary

- Task templates create editable Flow nodes only.
- Generated flows remain manual-only for OpenClaw dogfood export.
- Clawflow Studio does not send template tasks to OpenClaw automatically.
- Template creation does not call `/api/runs`.
- Local gateway addresses and Agent Gateway bindings remain UI preferences and are not written into saved Flow JSON.
- Real OpenClaw, Hermes, Shell, Browser, filesystem, MCP, RAG, ComfyUI, provider API, billing, and deployment execution remain disabled.

## How To Use

1. Start the local gateway and WebUI:

   ```bash
   pnpm dev:gateway
   pnpm dev:web
   ```

2. Open `http://localhost:5173`.
3. Optional: connect the Workspace Default Gateway from the Node Library Gateway card.
4. Click **Templates** in the top bar.
5. Choose a template.
6. Fill the required fields.
7. Click **Create Flow** and confirm replacement of the current canvas flow.
8. Inspect the generated nodes, Run Readiness, Linear Execution Plan, and Contract Preview.
9. Open Runtime Manager and export the manual OpenClaw task payload.

## Templates

### Excel To Word / Markdown / Summary

Purpose: generate a multi-Agent reporting flow from workbook path metadata.

Inputs:

- Task name
- Input Excel path
- Output folder
- Generate Word report
- Generate Markdown report
- Generate Summary file
- Safety mode: Plan-only, Read-only, or Controlled write

Generated flow:

- Manual Trigger
- Scenario Planner Agent
- Excel Reader Agent
- Word Writer Agent when enabled
- Markdown Writer Agent when enabled
- Summary Agent when enabled
- Report Review Agent
- Console Output

Expected manual outputs include `report.docx`, `report.md`, `summary.md`, warnings, and next steps depending on selected report formats.

### Local File Summary

Purpose: generate a safe summary flow for a local file or folder reference.

Inputs:

- Input file or folder path
- Summary style
- Output markdown path
- Safety mode

Generated flow:

- Manual Trigger
- File Reader Agent
- Summary Agent
- Summary Review Agent
- Console Output

Clawflow Studio does not read local files directly. The generated flow explains that content or metadata must be provided by the user or handled manually outside Clawflow.

### Multi-Agent Planning

Purpose: generate a sequential planning flow for a goal.

Inputs:

- Goal
- Worker Agent count
- Reviewer enabled
- Safety mode

Generated flow:

- Manual Trigger
- Planner Agent
- Worker Agent nodes
- Reviewer Agent when enabled
- Summary Agent
- Planning Review Agent
- Console Output

## Gateway Behavior

Generated Agent nodes default to Follow Workspace Default Gateway through UI preference state. Template flows do not embed local gateway URLs in Flow JSON. OpenClaw manual export includes template metadata and resolved gateway binding metadata for review.

## Known Limitations

- No user-defined custom templates in Phase 6J.
- Templates replace the current flow after confirmation instead of merging into the canvas.
- Generated node labels and objectives are static starter text.
- There is no automatic OpenClaw execution or Send to OpenClaw action.
- Template metadata is included for manual export context, not for runtime execution.
