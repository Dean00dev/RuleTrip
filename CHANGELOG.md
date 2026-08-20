# Changelog

All notable changes to RuleTrip are documented here.

## [Unreleased]

## [0.3.0] - 2026-08-20

### Added

- differential stdout, stderr, or combined-output sensors that require a literal signal to be absent on clean controls and present on mutations without persisting raw command output;
- bounded `confirmRuns` support (one to five) for clean baselines and canary experiments in fresh worktrees;
- explicit confirmation and sensor evidence in Markdown, JSON, and SARIF, while JUnit retains the conservative outcome projection;
- hostile tests for unrelated non-zero failures, pre-existing and truncated baseline signals, matched sensors, and unstable repeated outcomes;
- Action-as-an-Action CI verification on Ubuntu, macOS, and Windows.

### Changed

- generated starter configurations now request two confirmation runs and attach sensors to packs with stable literal signals;
- a mixed repeated response is `INCONCLUSIVE`, never promoted to `ALIVE` or `DEAD`;
- a non-zero result with a missing, pre-existing, or baseline-obscured sensor is `INCONCLUSIVE`, not `ALIVE`;
- baseline infrastructure failures are classified as `INCONCLUSIVE` rather than mislabelled as a broken guard;
- repository paths and report-facing names reject control characters, and workflow-command errors are escaped before reaching GitHub logs;
- package and runtime version advanced to `0.3.0`.

## [0.2.0] - 2026-08-17

### Added

- five bounded canary-pack families for test, type-check, lint, workflow-pin, and repository-policy guards;
- side-effect-free `ruletrip init --dry-run` with multi-guard discovery provenance and full generated-config preview;
- `ruletrip presets` catalogue command;
- JUnit XML report output and GitHub Action `junit_report` output;
- stable v1 JSON Schemas for RuleTrip configuration and report evidence;
- `ruletrip compare --before ... --after ...` for cross-commit evidence comparison, with optional `--fail-on-regression` and `--json` output;
- regression tests for canary discovery, report comparison, JUnit generation, schema publication, and dry-run behaviour.

### Changed

- package and runtime version advanced to `0.2.0`;
- npm package contents now include `docs/` and `schema/`;
- generated starter configuration may contain multiple discovered guards rather than only `npm test`.

## [0.1.0] - 2026-08-14

### Added

- clean-baseline control before every guard experiment;
- fresh detached Git worktree for every baseline and canary;
- `create`, `append`, `replace`, and `delete` mutations;
- `ALIVE`, `DEAD`, `BROKEN`, and `INCONCLUSIVE` classifications;
- Markdown, JSON, and SARIF reports with bounded proof language;
- zero-dependency Node.js CLI and Node 24 GitHub Action;
- refusal of privileged `pull_request_target` execution;
- traversal and external-symlink mutation defences;
- hostile tests for false greens, broken controls, timeouts, and source preservation;
- Node 24-native, SHA-pinned CI actions across Linux, macOS, and Windows.

[Unreleased]: https://github.com/Dean00dev/RuleTrip/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Dean00dev/RuleTrip/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Dean00dev/RuleTrip/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Dean00dev/RuleTrip/releases/tag/v0.1.0
