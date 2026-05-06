# AGENTS.md

## Project Name

ClawFlow Studio

## Product Definition

ClawFlow Studio is a WebUI-first visual Agent workflow orchestration workbench.

It borrows interaction patterns from ComfyUI and DaVinci Resolve:
- ComfyUI-style node canvas, node connections, workflow JSON, reusable templates.
- DaVinci-style professional workspace layout with node library, inspector, viewer, timeline/run inspector.

However, ComfyUI and DaVinci Resolve are only UX references in this project. They are not core runtime integrations for the MVP.

The core goal is to make AI Agent execution visible, controllable, debuggable, reusable, and composable.

## Core Architecture Principles

1. Agent is node-level, not flow-level.
2. A Flow does not bind to one single Agent.
3. Each Node can choose a different Agent, Harness, Runtime, Capability, Budget, and Policy.
4. Harness defines execution capability and safety boundary.
5. Runtime is replaceable.
6. Context is projected per node, not globally broadcast.
7. Thinking budget is assigned only to high-value reasoning nodes.
8. All node execution must produce structured RunEvents.
9. High-risk nodes must support approval gates.
10. The MVP must prioritize clarity, debuggability, and stable protocol design over feature quantity.

## Product Concepts

Model:
The underlying LLM or AI model.

Agent:
A role-based intelligent actor with task objective, behavioral strategy, and output format.

Harness:
The execution wrapper that defines tools, permissions, context policy, budget policy, and risk boundary.

Runtime:
The actual backend that executes an Agent or tool, such as OpenClaw, Hermes, Shell, Codex, Claude Code, MCP, or a mock runtime.

Node:
A flow execution unit. Formula:
Node = Agent + Harness + Runtime + Capability + Budget + Policy.

Flow:
A graph composed of nodes and edges.

## MVP Scope

Build a WebUI MVP with:
- React + TypeScript + React Flow.
- Local Meta Gateway using Node.js + TypeScript + Fastify.
- Shared protocol package.
- Mock Flow Engine.
- Mock Runtime Adapter.
- Flow Editor.
- Node Library.
- Inspector Panel.
- Run Inspector.
- Runtime Manager placeholder.
- Flow save/load as JSON.

MVP nodes:
- Manual Trigger
- Start Agent
- Worker Agent
- End Agent
- Console Output

Do not build these in MVP:
- ComfyUI integration
- DaVinci Resolve integration
- Full OpenClaw integration
- Full Hermes integration
- Cloud deployment
- Multi-user collaboration
- Authentication
- Plugin marketplace
- Complex loops
- Parallel execution
- Real shell execution

## Tech Stack

Use:
- pnpm workspace
- TypeScript
- Vite
- React
- React Flow
- Zustand
- TanStack Query
- Tailwind CSS
- shadcn/ui where practical
- Lucide icons
- Fastify
- WebSocket
- better-sqlite3 or in-memory storage for early MVP
- zod
- pino

## Repository Structure

Create this structure:

apps/
  web/
  gateway/

packages/
  protocol/
  flow-engine/
  runtime-registry/
  adapter-mock/
  adapter-openclaw/
  adapter-hermes/
  adapter-shell/

docs/
  PRODUCT_SPEC.md
  AGENT_ARCHITECTURE.md
  FLOW_SPEC.md
  NODE_TYPES.md
  CODEX_IMPLEMENTATION_PLAN.md

## Coding Rules

- Use TypeScript everywhere.
- Prefer explicit types over implicit any.
- Do not introduce unnecessary complexity.
- Keep packages small and focused.
- Shared domain types must live in packages/protocol.
- Flow execution logic must live in packages/flow-engine.
- Runtime-specific logic must live in adapter packages.
- WebUI must not directly execute local commands.
- WebUI talks to gateway through HTTP/WebSocket only.
- All run progress must be represented as RunEvent objects.
- Avoid hardcoding product assumptions around video, image, ComfyUI, or DaVinci.
- The UI should use professional workspace layout: left node library, center canvas, right inspector, bottom run inspector.
- The MVP must be runnable locally.

## Validation

After each major change:
- Run typecheck.
- Run build where available.
- Start web and gateway locally if possible.
- Report what was changed, what was tested, and what remains incomplete.

## Important

Do not attempt to implement everything in one step.
Work in small phases.
Ask for clarification only if blocked by missing information that cannot be reasonably inferred.