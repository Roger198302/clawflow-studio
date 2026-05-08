---
name: Bug report
about: Report a private beta bug or regression
title: "[Bug]: "
labels: bug, private-beta
assignees: ""
---

## Summary

What broke?

## Environment

- OS:
- Browser and version:
- Node.js version:
- pnpm version:
- Git commit SHA:
- Screen size:

## App Surface

Choose one or more:

- [ ] WebUI / canvas
- [ ] Gateway
- [ ] Session Console
- [ ] Runtime Manager
- [ ] Execution Contract Preview
- [ ] Linear Execution Plan
- [ ] Resource Estimate
- [ ] Run Readiness
- [ ] Documentation
- [ ] E2E tests

## Runtime / Flow Context

- Runtime selected: `mock-local` / `openclaw-local` / `hermes-local` / other:
- Flow shape: default chain / branch / fan-in / cycle / imported JSON:
- Session active: yes / no:

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

What should have happened?

## Actual Behavior

What happened instead?

## Logs and Evidence

- Browser console errors:
- Gateway terminal errors:
- Web terminal errors:
- RunEvent excerpt:
- Screenshot or recording, attached only in the private repository or approved private feedback channel:

Do not include secrets, credentials, private files, or public links.

## Validation Already Tried

- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`
- [ ] `curl http://localhost:8787/health`
- [ ] Browser refresh

## Safety Boundary Check

- [ ] This did not involve real OpenClaw/Hermes/Shell/Browser/filesystem/MCP/RAG/ComfyUI execution.
- [ ] If it appeared to invoke a real external runtime, describe exactly what happened:
