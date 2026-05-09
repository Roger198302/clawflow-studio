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

## Configure Local OpenClaw Health

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
3. Open Runtime Manager.
4. In the OpenClaw card, click Export Task.
5. Copy the visible OpenClaw Manual Task JSON from the export panel.

The payload includes:

- flow id/name;
- node list and edge list;
- selected runtime refs;
- harness/context/budget/risk policies;
- linear execution plan summary and steps;
- run readiness status and issues;
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
- `OPENCLAW_BASE_URL` changed but UI still shows old endpoint: restart `pnpm dev:gateway`.
- Browser clipboard copy fails: use Export Task and manually copy the visible payload.
- Mock run should still work through `mock-local`; use it to verify Clawflow itself is healthy.
