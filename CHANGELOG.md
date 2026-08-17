# Changelog

All notable changes to RuleTrip are documented here.

## [Unreleased]

### Added

- side-effect-free starter configuration discovery for `ruletrip init`;
- `ruletrip init --dry-run` to preview the detected guard command, test directory, and complete generated configuration without writing `.ruletrip.json`;
- explicit discovery provenance showing whether the starter command came from `package.json scripts.test` or still requires manual configuration.

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
- hostile tests for false greens, broken controls, timeouts, and source preservation.
- Node 24-native, SHA-pinned CI actions across Linux, macOS, and Windows.

[Unreleased]: https://github.com/Dean00dev/RuleTrip/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Dean00dev/RuleTrip/releases/tag/v0.1.0
