# ClawFlow Studio

ClawFlow Studio is a WebUI-first visual Agent workflow orchestration workbench.

The MVP focuses on a local WebUI, a Fastify gateway, a shared protocol package, and mock flow execution primitives. DaVinci Resolve and ComfyUI are interaction references only; they are not runtime integrations for this phase.

## Workspace

- `apps/web` - Vite, React, TypeScript, React Flow workspace UI
- `apps/gateway` - Fastify local gateway
- `packages/protocol` - shared flow, node, runtime, and run event types
- `packages/flow-engine` - mock flow engine skeleton
- `packages/runtime-registry` - runtime registry skeleton
- `packages/adapter-mock` - mock runtime adapter skeleton
- `packages/adapter-openclaw` - placeholder only, outside MVP runtime integration
- `packages/adapter-hermes` - placeholder only, outside MVP runtime integration
- `packages/adapter-shell` - placeholder only, outside MVP runtime integration

## Commands

```bash
pnpm install
pnpm dev:web
pnpm dev:gateway
pnpm typecheck
pnpm build
```

The web app defaults to `http://localhost:5173`.
The gateway defaults to `http://localhost:8787`.
