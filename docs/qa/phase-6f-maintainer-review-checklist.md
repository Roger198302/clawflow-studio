# Phase 6F Maintainer Review Checklist

Use this checklist before inviting selected private beta testers. Keep the repository private and do not create a public release, public repository, deployment, package publish, mirror, or announcement.

## 1. Local Branch and Commit

Phase 6E baseline before this checklist:

- Branch: `codex/private-beta-packaging`
- Baseline commit: `d0c8043`
- Required local check before push:

```bash
git status --short
git branch --show-current
git rev-parse --short HEAD
```

Expected:

- working tree is clean;
- branch is `codex/private-beta-packaging`;
- current `HEAD` is the intended private beta candidate.

## 2. Safe Maintainer Push Instructions

Only the maintainer should run these commands, and only after confirming the remote repository is private.

```bash
git remote -v
git status --short
git branch --show-current
git rev-parse --short HEAD
```

Confirm in the GitHub UI or repository settings:

- repository visibility is private;
- tester access list is intentional;
- no public fork, mirror, Pages deployment, Release, or package publish is active.

If those checks pass, push only the private beta branch:

```bash
git push -u origin codex/private-beta-packaging
```

Do not push tags, create a GitHub Release, publish packages, deploy a site, or post public announcements as part of this beta.

## 3. Repository Visibility and Access

- [ ] Repository visibility remains private.
- [ ] Selected tester list is confirmed.
- [ ] Tester permissions are intentional and minimal.
- [ ] No public forks, mirrors, Pages deployments, Releases, packages, images, or public links are created.
- [ ] Invite messages clearly state that repository links, screenshots, logs, recordings, and feedback remain private.

## 4. Secret and Credential Safety

- [ ] No secrets, provider tokens, credentials, private keys, or `.env` files are committed.
- [ ] Testers are instructed not to use production data, secrets, credentials, or sensitive files.
- [ ] `CLAWFLOW_OPENCLAW_ENDPOINT` remains unset unless explicitly testing reachability; no real OpenClaw execution is enabled.

## 5. Documentation Readiness

Review:

- [Private Beta Tester Guide](../demo/private-beta-tester-guide.md)
- [Private Beta Walkthrough](../demo/private-beta-walkthrough.md)
- [Private Beta Test Plan](../demo/private-beta-test-plan.md)
- [Private Beta Feedback Template](../demo/private-beta-feedback-template.md)
- [Clean Clone Checklist](../demo/clean-clone-checklist.md)
- [Private Beta Invite Message](../demo/private-beta-invite-message.md)
- [Private Beta Feedback Triage Guide](../demo/private-beta-feedback-triage-guide.md)
- [Private Beta Patch Policy](../demo/private-beta-patch-policy.md)
- [Phase 6E Private Beta Packaging Report](phase-6e-private-beta-packaging-report.md)

Confirm:

- [ ] beta docs are linked and accurate;
- [ ] known limitations are explicit;
- [ ] no docs claim production readiness;
- [ ] no docs claim real OpenClaw, Hermes, Shell, Browser, filesystem, MCP, RAG, ComfyUI, provider API, billing, database, or auth execution;
- [ ] clean clone verification result is current.

## 6. Runtime Boundary

- [ ] `mock-local` remains mock execution only.
- [ ] `openclaw-local` remains protected dry-run / health reachability only.
- [ ] `hermes-local` remains unavailable and rejected.
- [ ] Contract Preview, Linear Execution Plan, Resource Estimate, and Run Readiness remain advisory preview surfaces.
- [ ] Gateway and WebUI remain local loopback defaults.

## 7. Final Validation Before Invites

Run:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

If docs changed, also run the local Markdown link check from the packaging report or equivalent.

Expected:

- [ ] typecheck passes;
- [ ] build passes;
- [ ] E2E passes;
- [ ] link check passes when applicable;
- [ ] no public exposure action was performed.
