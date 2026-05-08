# Private Beta Feedback Triage Guide

Use this guide to classify incoming private beta feedback without expanding the beta scope. Keep all reports, screenshots, logs, recordings, and discussions private.

## Triage Priorities

### P0: Install, Start, or Run Blocker

Use P0 when a tester cannot complete the core local beta path.

Examples:

- `pnpm install` fails on a supported local environment.
- `pnpm dev:gateway` or `pnpm dev:web` cannot start.
- `pnpm test:e2e` fails in a clean clone.
- `mock-local` default run cannot complete.
- `openclaw-local` no longer stays protected dry-run.
- `hermes-local` no longer returns unavailable-runtime rejection.

Response template:

```text
Thanks. This looks like a P0 private beta blocker. Please attach OS, Node/pnpm versions, commit SHA, the exact command, full terminal output, and whether this was a clean clone. Do not include secrets or public links.
```

### P1: Comprehension or Safety Boundary Blocker

Use P1 when testers misunderstand what the beta can safely do, or docs/UI imply the wrong runtime boundary.

Examples:

- tester thinks real OpenClaw/Hermes/Shell/Browser/filesystem/MCP/RAG/ComfyUI execution is enabled;
- protected dry-run wording is unclear;
- unavailable runtime rejection looks like an app crash;
- docs imply production readiness, public launch readiness, billing, auth, or persistence;
- Run Readiness or Resource Estimate warnings look like hard execution errors.

Response template:

```text
Thanks. This is a P1 clarity/safety-boundary issue. Please point us to the exact UI text or doc section that caused confusion, plus a screenshot if possible inside the private repo or approved private channel.
```

### P2: UX Friction or Minor Behavior Issue

Use P2 for issues that do not block setup or core mock/protected smoke testing but make the beta harder to use.

Examples:

- confusing button label;
- panel overlap;
- unclear diagnostic grouping;
- awkward edge editing behavior that has a workaround;
- minor layout clipping on a common desktop size;
- stale copy or missing helper text.

Response template:

```text
Thanks. This is useful P2 beta UX feedback. Please include the browser, screen size, steps, expected behavior, actual behavior, and whether refresh changes the result.
```

### P3: Feature Request or Future Idea

Use P3 for ideas that are valuable but not needed to validate the local private beta.

Examples:

- new node types;
- real runtime bridges;
- persistence;
- auth;
- collaboration;
- hosted deployment;
- dashboards, analytics, screenshots, demos, or marketing assets.

Response template:

```text
Thanks. This is a good future-phase idea. We are keeping the private beta focused on local mock/protected behavior, setup, workspace usability, and preview clarity. We will track this as P3 unless it blocks the current beta path.
```

### Invalid or Out of Scope

Use this when the report expects unsupported behavior that is explicitly outside the private beta.

Examples:

- expecting real OpenClaw Agent Chat or Tool Call execution;
- expecting real Hermes, Shell, Browser, filesystem, MCP, RAG, ComfyUI, provider API, billing, auth, database, or deployment support;
- asking for public release, package publish, hosted demo, or public announcement;
- requesting use of secrets, production data, or sensitive local files.

Response template:

```text
Thanks for the note. This is outside the current private beta scope. The beta is local, private, mock/protected, and preview-oriented. We are not enabling real external runtime execution, provider APIs, billing, auth, persistence, deployment, or public release work in this beta patch.
```

## When Not to Implement Feedback Immediately

Do not implement immediately when feedback:

- requires real external runtime execution;
- requires auth, database persistence, billing, provider APIs, pricing registry, optimizer, model recommendation, public deployment, or public publishing;
- requires broad UI redesign or major component rewrites;
- conflicts with clean clone stability;
- cannot be reproduced and lacks enough environment details;
- would invalidate current E2E coverage or private beta documentation without a clear beta-critical reason.

Prefer documenting the feedback as P3 or future-phase work unless it blocks private beta setup, comprehension, or existing mock/protected behavior.

## Triage Workflow

1. Confirm the report is private and contains no secrets.
2. Classify as P0, P1, P2, P3, or out of scope.
3. Ask for missing environment details when needed.
4. Reproduce on the current private beta branch when practical.
5. Apply only patch-policy-compliant fixes during Private Beta Patch 1.
6. Run required validation before accepting any patch.
7. Update known limitations or docs when the right fix is clarification rather than code.
