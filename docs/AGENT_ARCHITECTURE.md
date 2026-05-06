# Agent Architecture

Agent behavior is configured at the node level.

Each node can choose its own Agent, Harness, Runtime, Capability, Budget, and Policy. A Flow does not bind to one global Agent. This keeps execution boundaries explicit and makes each node independently inspectable.

## Concepts

- Model: underlying AI model.
- Agent: role-based actor with objective, strategy, and output format.
- Harness: execution wrapper that defines tools, permissions, context policy, budget policy, and risk boundary.
- Runtime: backend that executes a node capability.
- Node: execution unit composed from Agent, Harness, Runtime, Capability, Budget, and Policy.
- Flow: graph of nodes and edges.

## MVP Runtime Boundary

Only the mock runtime adapter is active in Phase 1. OpenClaw, Hermes, and shell adapters are placeholders and do not execute work.
