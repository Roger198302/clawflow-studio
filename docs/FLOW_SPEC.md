# Flow Spec

A Flow is a graph composed of nodes and edges.

The shared TypeScript definitions live in `packages/protocol`.

## Core Types

- `FlowSpec`
- `FlowNode`
- `FlowEdge`
- `NodeRole`
- `RuntimeType`
- `RunEvent`

## Execution Events

All run progress must be represented as structured `RunEvent` objects. The MVP flow engine currently creates skeleton events only and does not call real Agents or external runtimes.
