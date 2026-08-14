# Roadmap

The roadmap is ordered by evidence value, not feature count.

## v0.2 — Canary packs

- audited presets for common test, type, lint, workflow-pin, and policy scanners;
- explicit framework discovery with generated config shown before execution;
- JUnit output and stable JSON Schema;
- report comparison across commits.

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
