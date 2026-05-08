# Private Beta Feedback Template

Use this template for private beta feedback. Attach screenshots, terminal output, or short recordings only inside the private repository or approved private feedback channel when they clarify the report.

## Tester and Environment

- Tester name or handle:
- Date:
- Git commit SHA:
- Operating system:
- Browser and version:
- Node.js version:
- pnpm version:
- Screen size:
- Fresh clone or existing checkout:

## Setup Result

- `pnpm install` result:
- `pnpm dev:gateway` result:
- `pnpm dev:web` result:
- `curl http://localhost:8787/health` result:
- Any install/startup errors:

## Workspace Feedback

- Did the default Flow load?
- Could you drag nodes?
- Could you delete and reconnect edges?
- Did panels overlap important controls?
- Did the layout work at your screen size?
- Confusing labels or copy:

## Runtime Boundary Feedback

- Did `mock-local` run successfully?
- Did `openclaw-local` clearly show protected dry-run behavior?
- Did `hermes-local` clearly show unavailable behavior?
- Did anything appear to claim real OpenClaw/Hermes/Shell/Browser/filesystem/MCP/RAG/ComfyUI execution?

## Preview and Diagnostics Feedback

- Execution Contract Preview clarity:
- Linear Execution Plan clarity:
- Resource Estimate clarity:
- Run Readiness clarity:
- Were warnings understandable and non-alarming?
- Did any preview look like a hard execution failure when it was only advisory?

## Session Console Feedback

- Could you create a Session?
- Could you run a Session?
- Could you add a message or constraint?
- Could you use pause/resume/cancel?
- Could you use retry/skip/edit step input?
- Did intervention history make sense?

## Bugs

For each bug:

```text
Title:
Steps to reproduce:
Expected:
Actual:
Frequency:
Console errors:
Terminal errors:
Screenshots/recording:
```

## Suggestions

- Most valuable improvement before a future demo:
- Most confusing surface:
- Missing documentation:
- Missing workflow:
- Other notes:

## Safety Boundary Check

Confirm:

- I did not expect or test real external runtime execution.
- I understand this beta is local, in-memory, and mock/protected only.
- Any feature request for real runtime execution is for a future phase.
- I did not publish repository links, screenshots, recordings, logs, or packages publicly.
