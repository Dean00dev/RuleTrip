# RuleTrip v0.4.0 candidate verification receipt

This receipt separates locally executed evidence from hosted checks. Hosted evidence remains pending until the candidate branch runs through GitHub Actions.

## Candidate

- version: `0.4.0`;
- configuration schema: `1` with backward-compatible optional control fields;
- report schema: `1` with additive matched-control facts;
- runtime dependencies: zero;
- required runtime: Node.js 20 or newer.

## Locally executed — 2026-08-21

`npm run verify` completed successfully:

- syntax check: 29 JavaScript files;
- tests: 43 passed, 0 failed, 0 skipped;
- new hostile cases cover path-only rejection, matched-control sensor leakage, escaped violations, and defect-specific rejection;
- retained cases cover unrelated non-zero failures, pre-existing or truncated signals, unstable mutation responses, and unstable clean baselines.

`node src/cli.js run` then exercised RuleTrip against its own committed configuration:

- conclusion: **ALIVE**;
- canaries: 2 alive, 0 dead, 0 broken, 0 inconclusive;
- sensors: 2 configured and 2 differentially attributed;
- matched controls: 2 configured and 2 passed;
- each clean, violation, and matched-control phase completed 2/2 confirmation runs;
- exit-only canaries: 0.

`npm pack --dry-run --json` reported:

- package: `ruletrip@0.4.0`;
- entries: 32;
- runtime dependencies: 0;
- social-preview PNG excluded from the package.

Archive bytes and checksums are intentionally omitted: this receipt is itself packaged, so embedding them would change the archive. Generate immutable archive evidence only after the tagged source is frozen.

## Hosted verification

Pending candidate publication. The workflow must complete:

- Node.js 20 and 24 syntax checks plus all tests on Ubuntu, macOS, and Windows;
- RuleTrip through `uses: ./` on Ubuntu, macOS, and Windows;
- the repository's own two sensor-attributed, matched-control canaries.

Do not convert this section to a passing claim until the hosted run and exact candidate commit are recorded.

## Boundaries that remain open

- Marketplace acceptance for `v0.4.0`;
- semantic equivalence of user-authored violation/control pairs;
- performance on large repositories and maximum configured time/output caps;
- false-attribution and false-negative rates across unrelated public repositories;
- independent JSON Schema, SARIF, and JUnit consumer validation;
- statistical reliability beyond the configured one-to-five observations;
- process isolation, network isolation, or containment of trusted guard commands.
