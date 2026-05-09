# Local OpenClaw Dogfood Guide

This guide is for the maintainer's local dogfood workflow. It makes local OpenClaw reachability visible in Clawflow Studio and generates a manual task payload for OpenClaw, but it does not enable automatic OpenClaw execution.

## Safety Boundary

- Clawflow Studio does not call OpenClaw Agent Chat or Tool Call execution endpoints in Phase 6I.
- Runtime Manager health checks probe only a local health URL.
- `openclaw-local` remains a protected runtime in Clawflow Studio.
- Copy / Export OpenClaw Task creates text for manual use only.
- Manual CLI execution is controlled by the maintainer outside Clawflow Studio.
- OpenClaw may have host-level capabilities depending on local configuration. Do not expose local OpenClaw remotely without a security review.

## Prerequisites

- Local OpenClaw installed and started by the maintainer.
- Clawflow Studio dependencies installed with `pnpm install`.
- Local gateway and WebUI running on loopback.

## Quick Connect From The WebUI

Phase 6I-1 adds the preferred dogfood path:

1. Start local OpenClaw.
2. Start Clawflow Studio gateway and WebUI.
3. Open `http://localhost:5173`.
4. In the Node Library, use the Gateway card.
5. Enter:
   - Gateway URL: `http://localhost:25311`
   - Health Path: `/health`
6. Click Connect.
7. Confirm the card shows Connected.
8. Open Runtime Manager and confirm `openclaw-local` shows Connected / Protected.
9. Use Copy Task or Export Task to generate a manual OpenClaw payload.

The current maintainer-local OpenClaw health response is expected to look like:

```json
{"ok":true,"status":"live"}
```

Clawflow Studio only checks the HTTP status code. It does not use the response body for execution.

Quick Connect restrictions:

- only `http://` and `https://` are accepted;
- only loopback hosts are accepted by the gateway probe, such as `localhost`, `127.0.0.1`, and `::1`;
- only health-style paths are accepted, including `/health`, `/api/health`, `/ready`, `/readiness`, `/live`, `/liveness`, and `/status`;
- redirects are not followed;
- no credentials, headers, cookies, task payloads, or execution requests are sent.

The Quick Connect value is a WebUI preference stored in localStorage as `clawflow.localGatewayConnection`. It is not written to saved Flow JSON.

## Gateway Profiles And Agent Binding

Phase 6I-2 keeps the Node Library Gateway card as the Workspace Default Gateway. Agent nodes use this default unless a node-level override is selected in the Inspector.

Gateway profile behavior:

- `OpenClaw Local` is the default profile for local dogfood.
- Runtime Manager can add additional local Gateway Profiles for multiple local OpenClaw gateways.
- Each profile has a name, kind, base URL, health path, reachability status, and protected boundary.
- Gateway profile data is stored as UI preference in localStorage under `clawflow.gatewayProfiles`.
- Agent bindings are stored as UI preference in localStorage under `clawflow.agentGatewayBindings`.
- Local gateway addresses are not written to saved Flow JSON.
- Profiles do not store credentials, tokens, cookies, or custom headers.
- Profile health checks use the same loopback-only, health-path-limited probe as Quick Connect.
- The default `OpenClaw Local` profile is pinned and cannot be deleted.
- Deleting a custom profile clears Agent bindings that referenced it back to Follow Workspace Default.
- Reset Demo Flow clears per-node gateway bindings back to Follow Workspace Default, but it preserves saved Gateway Profiles.
- Reset Layout does not delete Gateway Profiles or Agent bindings.

Example local profile setup:

| Profile | Gateway URL | Health Path | Intended Use |
| --- | --- | --- | --- |
| OpenClaw Local | `http://localhost:25311` | `/health` | Workspace default dogfood gateway |
| OpenClaw Lab | `http://localhost:25312` | `/health` | Optional second local gateway for selected Agent nodes |

Agent binding workflow:

1. Connect the Workspace Default Gateway from the Node Library Gateway card.
2. Open Runtime Manager if you need to add or edit Gateway Profiles.
3. Add an additional profile when an Agent should target a different local gateway for manual export metadata.
4. Select an Agent node, such as Start Agent or Worker Agent.
5. In the Inspector Gateway section, choose either:
   - Follow Workspace Default
   - Use Gateway Profile
6. If using a profile, select `OpenClaw Local` or another local profile.
7. Confirm the resolved status is Connected / Protected or Unavailable / Protected.
8. Open Runtime Manager to see Gateway Profiles and which Agent nodes use each profile.

Agent-level binding is metadata for manual dogfood export only. It does not enable automatic OpenClaw execution and it does not change `/api/runs` behavior.

## Start From A Task Template

Phase 6J adds a Task Launcher for creating common protected dogfood flows without manually building every node.

Recommended template workflow:

1. Optional: connect the Workspace Default Gateway from the Node Library Gateway card.
2. Click **Templates** in the top bar.
3. Choose a task template:
   - Excel to Word / Markdown / Summary
   - Local File Summary
   - Multi-Agent Planning
4. Fill the required fields and choose a safety mode.
5. Click Create Flow and confirm replacement of the current canvas flow.
6. Inspect the generated flow, Run Readiness, and Linear Execution Plan.
7. Open Runtime Manager and export the manual OpenClaw task payload.

Template-generated flows are still protected. Clawflow Studio does not read local files, write reports, call OpenClaw execution endpoints, or call `/api/runs` during template creation or export. The manual export payload includes template metadata, selected user inputs, expected outputs, workspace gateway metadata, and per-Agent gateway bindings for review.

More detail: [Task Launcher And Template Gallery](task-templates.md).

## Optional Environment Configuration

Quick Connect is usually easier than restarting the gateway with environment variables. Use env configuration only when you want the gateway's default Runtime Manager health check to point at a fixed local OpenClaw endpoint.

Default Phase 6I health probe:

```bash
OPENCLAW_BASE_URL=http://localhost:18789
OPENCLAW_HEALTH_PATH=/health
```

If your local OpenClaw uses a different port or path, start the gateway with:

```bash
OPENCLAW_BASE_URL=http://localhost:<port> OPENCLAW_HEALTH_PATH=<path> pnpm dev:gateway
```

The health check sends:

```text
GET ${OPENCLAW_BASE_URL}${OPENCLAW_HEALTH_PATH}
```

It does not call task, agent, tool, shell, browser, filesystem, MCP, RAG, ComfyUI, or provider endpoints.

Legacy fallback:

```bash
CLAWFLOW_OPENCLAW_ENDPOINT=ws://127.0.0.1:18789 pnpm dev:gateway
```

Use the legacy WebSocket endpoint only if your local OpenClaw exposes health through that older reachability path.

## Start Clawflow Studio

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

Gateway health:

```bash
curl http://localhost:8787/health
```

## Verify Runtime Manager

1. Open Runtime Manager.
2. Find `OpenClaw Local Gateway` / `openclaw-local`.
3. Click Health Check.
4. Read the OpenClaw dogfood status:
   - Connected: the local health endpoint is reachable.
   - Unavailable: the health endpoint could not be reached.
   - Protected: Clawflow still blocks real execution.

Connected means local reachability only. It does not mean Clawflow has permission to run OpenClaw tasks.

## Generate An OpenClaw Task Payload

1. Keep or restore the default demo flow.
2. Inspect Run Readiness and Linear Execution Plan.
3. Connect to local OpenClaw from the Node Library Gateway card, or use env configuration.
4. Open Runtime Manager.
5. In the OpenClaw card, click Export Task.
6. Copy the visible OpenClaw Manual Task JSON from the export panel.

The payload includes:

- flow id/name;
- node list and edge list;
- selected runtime refs;
- harness/context/budget/risk policies;
- linear execution plan summary and steps;
- run readiness status and issues;
- connected target gateway metadata when Quick Connect is connected;
- workspace default gateway metadata;
- Gateway Profiles used by Agent nodes;
- per-Agent resolved gateway binding metadata;
- `realExecutionBlocked: true`;
- `protectedDryRun: true`;
- a safety policy requiring manual review and confirmation.

## Manually Run Through OpenClaw CLI

There is no universal OpenClaw CLI command in this repository. Use the command required by your local OpenClaw installation and paste or pass the exported payload manually.

Before running anything through OpenClaw:

- review the payload;
- confirm the selected local OpenClaw profile and permissions;
- avoid secrets and sensitive files;
- ask for confirmation before risky shell, browser, filesystem, network, or tool actions.

## Known Limitations

- No automatic OpenClaw execution from Clawflow Studio.
- No OpenClaw protocol handshake beyond health reachability.
- No auth, token, credential, or secrets UI.
- No shell, browser, filesystem, MCP, RAG, ComfyUI, provider API, or billing integration.
- No persistence beyond current local UI state.
- Copy Task uses the browser clipboard when available; Export Task always leaves the payload visible for manual copy.

## Troubleshooting

- Runtime Manager says Unavailable: confirm OpenClaw is running and the health path is correct.
- Runtime Manager remains Protected: expected; Clawflow still blocks real execution.
- Gateway card says Invalid or Unavailable: confirm the URL is loopback-only, for example `http://localhost:25311`, and the health path is `/health`.
- `OPENCLAW_BASE_URL` changed but UI still shows old endpoint: restart `pnpm dev:gateway`.
- Browser clipboard copy fails: use Export Task and manually copy the visible payload.
- Mock run should still work through `mock-local`; use it to verify Clawflow itself is healthy.
