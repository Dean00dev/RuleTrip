# Roadmap

The roadmap is ordered by evidence value, not feature count.

## v0.2 — Canary packs — shipped 2026-08-17

- built-in bounded packs for test, type-check, lint, workflow-pin, and policy guards;
- explicit script discovery with complete generated config visible through `init --dry-run`;
- JUnit output alongside Markdown, JSON, and SARIF;
- stable v1 JSON Schemas for configuration and report evidence;
- report comparison across commits with optional regression exit status.

## v0.3 — Sensor coverage

- map canaries to the guards expected to catch them;
- detect accidental cross-guard failures;
- optional two-step confirmation to reduce unrelated non-zero classifications;
- custom patch canaries with checksum-bound source context.

## Later research

- container-backed execution providers;
- organization policy bundles with signed provenance;
- architecture-invariant canaries;
- mutation minimisation for dead guards;
- longitudinal harness health without source telemetry.

No roadmap item changes the central non-claim: RuleTrip tests observable guard behaviour; it does not certify a repository.
