# Private Beta Patch Policy

This policy defines what can and cannot change during Private Beta Patch 1. Keep the beta private and local. Do not publish, release, deploy, upload, mirror, or announce beta artifacts publicly.

## Patch Goals

Allowed beta patches should preserve the current MVP boundary:

- local WebUI + local Gateway;
- `mock-local` mock execution;
- `openclaw-local` protected dry-run / health reachability only;
- `hermes-local` unavailable-runtime rejection;
- advisory Contract Preview, Linear Execution Plan, Resource Estimate, and Run Readiness;
- in-memory Session Console and intervention history.

## Allowed Changes

Allowed during Private Beta Patch 1:

- install and setup documentation fixes;
- broken local Markdown link fixes;
- copy clarification;
- private beta safety-boundary clarification;
- small UI clarity fixes;
- test stability fixes;
- obvious bug fixes in existing mock/protected flows;
- fixes that preserve current E2E behavior and private beta scope.

Examples:

- correcting command typos;
- clarifying protected dry-run wording;
- fixing a panel label that truncates badly;
- fixing a broken local doc link;
- stabilizing a flaky E2E assertion without reducing coverage;
- fixing a regression in `mock-local` run creation.

## Not Allowed

Do not add during Private Beta Patch 1:

- real OpenClaw execution;
- real Hermes execution;
- Shell, Browser, filesystem, MCP, RAG, ComfyUI, provider API, or external bridge execution;
- auth;
- database or production persistence;
- billing;
- provider pricing API;
- pricing registry;
- optimizer or model recommendation logic;
- public deployment;
- package/image publishing;
- public release or public launch materials;
- major component rewrites;
- broad UI redesign;
- full node marketplace or major palette expansion;
- execution gating beyond existing runtime/session validation.

## Validation Required After Any Patch

Run:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

If docs changed, also run a local Markdown link check.

Patch acceptance requires:

- validation passes;
- runtime behavior remains mock/protected/unavailable only;
- docs remain private-beta accurate;
- no public exposure action was performed.

## Patch Review Checklist

- [ ] Does the patch fit the allowed-change list?
- [ ] Does it avoid all not-allowed categories?
- [ ] Does it preserve `mock-local`, `openclaw-local`, and `hermes-local` behavior?
- [ ] Does it avoid public publishing or deployment?
- [ ] Does it keep repository and tester materials private?
- [ ] Does it include validation results?
- [ ] Does it update docs only when docs need clarification?

## Deferral Rule

If a change is useful but expands scope, mark it as future work instead of implementing it in Private Beta Patch 1.

Use the feedback triage guide to classify those requests as P3 or out of scope.
