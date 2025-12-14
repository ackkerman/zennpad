<!--
Sync Impact Report
- Version: 0.0.0 -> 1.0.0
- Modified principles: N/A (initial authoring)
- Added sections: Core Principles, Architecture Guardrails, Development Workflow & Quality Gates, Governance
- Removed sections: None
- Templates requiring updates: .specify/templates/plan-template.md ✅; .specify/templates/spec-template.md ✅; .specify/templates/tasks-template.md ✅
- Follow-up TODOs: None
-->

# ZennPad Constitution

## Core Principles

### I. Layered Separation (UI · FS · Sync · Preview)
UI, filesystem adapters, sync pipeline, and preview backend MUST stay isolated behind typed interfaces; cross-layer calls only through explicit contracts; shared utilities remain side-effect free; UI never directly mutates GitHub state—only issues intents to the sync layer; preview reads from mirrored state, not live GitHub.

### II. Safe GitHub Sync & Deploy Reliability
GitHub interactions MUST be idempotent, sha-verified, and conflict-aware; work branch is the sole target for auto-sync, while main deploys require deliberate promotion; retries use bounded backoff with explicit user messaging; data loss prevention takes priority over latency.

### III. Intentional Deploy & Rate Protection
Deploys to main MUST require explicit confirmation and surface target branch/account; batch commits with debounced pushes to avoid excessive deploys; default to pause/confirm behavior after errors; expose clear status and countdowns before any automated publish.

### IV. Predictable VS Code UX
Commands, menus, keybindings, and visuals MUST follow VS Code conventions (namespacing, iconography, context keys, accessibility); no surprise modals or destructive defaults; status and progress indicators live in the status bar/notifications consistent with platform patterns.

### V. Testable, Deterministic Core
Sync, caching, path resolution, and mapping logic MUST be deterministic and unit-testable without the VS Code UI; time, randomness, and IO dependencies are injected; contract tests cover branch switching, cache hits/misses, and path transforms.

### VI. Explicit Error Handling & Recovery
Authentication failures, rate limits, preview startup errors, and proxy failures MUST return actionable messages with recovery steps; implement retries with limits, fallback flows, and clear user prompts; log structured errors for diagnosis without exposing secrets.

## Architecture Guardrails

- Auto-sync targets the work branch; main deploys are user-initiated and confirm branch/account before execution.
- Sync queue debounces writes, deduplicates identical content, and surfaces pending state in UI; flush is manual and logged.
- Preview runs against a mirrored workspace; failure to start or proxy should degrade gracefully with retry guidance.
- Caches include versioning and expiry; stale/failed parses trigger safe fallback to live fetch with user notice.
- File operations respect separation of concerns: FS layer handles path normalization, sync layer handles GitHub semantics, UI layer displays state only.

## Development Workflow & Quality Gates

- All changes MUST include automated tests covering sync flows, cache behavior, path resolution, and error handling; UI changes follow VS Code UX patterns.
- Lint, format, and `pnpm test` MUST pass before merge; long-running network-bound tests should be isolated/mocked.
- Deploy or publish-affecting changes require dual review focusing on safety (idempotency, rate limiting, rollback signals).
- UI changes MUST generate updated preview screenshots via `make screenshot-web` (uses `scripts/capture_screenshot.py`) and attach artifacts for review.
- Configuration for GitHub auth and tokens MUST support recovery (sign-out/sign-in) without manual file edits; secrets never logged.

## Governance

- This constitution supersedes conflicting process docs for ZennPad; PRs must include a Constitution Check confirming principle compliance.
- Amendments require a PR describing rationale, migration/UX impact, and test updates; maintain changelog entries when workflows change.
- Versioning follows SemVer: MAJOR for principle removals/redefinitions, MINOR for new/expanded principles or guardrails, PATCH for clarifications.
- Compliance reviews: reviewers verify separation-of-concerns boundaries, sync/deploy safety, UX predictability, test coverage for core logic, and error-recovery paths.
- Constitution file stays as the source of truth; templates under `.specify/templates/` must be updated in the same PR when governance changes.

**Version**: 1.0.0 | **Ratified**: 2025-12-15 | **Last Amended**: 2025-12-15
