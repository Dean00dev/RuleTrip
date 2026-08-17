# Changelog

All notable changes to RuleTrip are documented here.

## [Unreleased]

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

[Unreleased]: https://github.com/Dean00dev/RuleTrip/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Dean00dev/RuleTrip/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Dean00dev/RuleTrip/releases/tag/v0.1.0
