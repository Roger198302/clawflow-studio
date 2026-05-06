# Product Spec

ClawFlow Studio is a WebUI-first visual Agent workflow orchestration workbench.

The MVP exists to make Agent execution visible, controllable, debuggable, reusable, and composable through a local workspace UI and a local gateway. ComfyUI and DaVinci Resolve are interaction references only and are not runtime integration targets for this phase.

## MVP Scope

- WebUI workspace with node library, flow canvas, inspector, and run inspector.
- Local gateway with health and version endpoints.
- Shared TypeScript protocol package.
- Mock flow engine skeleton.
- Mock runtime adapter skeleton.

## Out Of Scope

- Real OpenClaw integration.
- Real Hermes integration.
- ComfyUI or DaVinci integration.
- Database storage.
- Authentication.
- Cloud deployment.
- Real Agent or shell execution.
