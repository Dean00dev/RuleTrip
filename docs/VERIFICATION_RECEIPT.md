# RuleTrip v0.3.0 verification receipt

This receipt separates locally executed evidence from hosted checks that remain pending until the candidate commit reaches GitHub Actions.

## Candidate

- version: `0.3.0`;
- configuration schema: `1` (backward compatible additions);
- report schema: `1` (backward compatible additions);
- runtime dependencies: zero;
- required runtime: Node.js 20 or newer.

## Locally executed — 2026-08-20

`npm run verify` completed successfully:

- syntax check: 28 JavaScript files;
- tests: 36 passed, 0 failed, 0 skipped;
- hostile cases include unrelated non-zero output, missing sensors, pre-existing clean signals, truncated clean output, mixed confirmation exits, and unstable baselines.

`node src/cli.js run` then exercised RuleTrip against its own committed configuration:

- conclusion: **ALIVE**;
- canaries: 2 alive, 0 dead, 0 broken, 0 inconclusive;
- sensors: 2 configured and 2 differentially attributed;
- each clean control and mutation completed 2/2 confirmation runs;
- exit-only canaries: 0.

`npm pack --dry-run --json` reported:

- package: `ruletrip@0.3.0`;
- entries: 30;
- packed size: 30,659 bytes;
- unpacked size: 106,865 bytes;
- runtime dependencies: 0;
- social-preview PNG excluded from the package.

The separately reviewed social preview is a `1280×640` RGBA PNG, 138,770 bytes, with SHA-256 `4f54d6454daeb545d79686a9428a1b4cb005fa5783c10c7c829e991aca029b16`.

The npm archive checksum is intentionally not embedded here: this receipt is itself packaged, so embedding the archive's digest would change the archive. Generate and record that checksum only after the tagged source is frozen.

## Hosted verification pending

The GitHub Actions candidate expands to nine jobs:

- Node.js 20 and 24 tests on Ubuntu, macOS, and Windows (six jobs);
- RuleTrip executed through `uses: ./` on Ubuntu, macOS, and Windows (three jobs).

These remain unverified until the hosted run is observed green. A green local run does not substitute for that evidence.

## Boundaries that remain open

- Marketplace acceptance for `v0.3.0`;
- performance on large repositories and maximum configured time/output caps;
- false-attribution and false-negative rates across unrelated public repositories;
- independent JSON Schema, SARIF, and JUnit consumer validation;
- statistical reliability beyond the configured one-to-five observations;
- process isolation, network isolation, or containment of trusted guard commands.
