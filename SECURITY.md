# Security policy

## Supported versions

RuleTrip is pre-1.0. Security fixes are applied to the latest release only.

## Reporting

Please use GitHub's private vulnerability reporting for this repository. If that option is unavailable, open a minimal issue asking the maintainer to establish a private contact channel; do not include exploit details.

Do not submit:

- live credentials or tokens;
- private repository contents;
- personal data;
- weaponised proof-of-concept material in a public issue.

## Scope priorities

High-priority reports include mutations escaping the disposable worktree, path/symlink bypasses, unsafe privileged-event behaviour, report-based secret disclosure, and cleanup failures that alter the source checkout.

Configured guard commands are explicitly trusted code and their arbitrary behaviour is outside RuleTrip's sandboxing guarantees.
