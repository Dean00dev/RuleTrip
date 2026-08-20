# Threat model

RuleTrip tests whether trusted repository commands reject declared file mutations. It reduces one class of false confidence; it is not a general-purpose sandbox or security certification system.

## Assets

- the source checkout and Git history;
- CI credentials and tokens;
- guard-command integrity;
- experiment results;
- runner availability.

## Trust assumptions

1. The selected commit, `.ruletrip.json`, and guard commands are reviewed together.
2. Git and Node.js are trusted components of the runner.
3. A non-zero exit code is the guard's documented failure signal.
4. Canary content is controlled, inert, and contains no real secret.

## Defences in v0.1

- each baseline and canary runs in a fresh detached Git worktree;
- configured canary paths must be repository-relative and cannot target `.git`;
- mutations cannot cross a symlink that points outside the worktree;
- create mutations refuse accidental overwrite by default;
- baseline failure prevents false **ALIVE** classifications;
- timeouts and infrastructure errors become **INCONCLUSIVE**, not success;
- command output is bounded in memory and excluded from persisted reports;
- the GitHub Action refuses `pull_request_target`;
- the Action requests no permissions and documentation specifies `contents: read`.

## Important non-defences

Git worktrees isolate tracked file changes, not processes. A configured command can access the network, environment, filesystem, linked dependencies, and credentials available to its runner. RuleTrip does not constrain syscalls or provide container/VM isolation.

`defaults.linkPaths` creates links to directories in the source checkout. RuleTrip's mutation engine refuses to target those external paths, but a guard command can still write to them.

## Untrusted pull requests

Use `pull_request` with a read-only token and no secrets. Do not use `pull_request_target` to run the pull request's configuration or commands. For high-risk repositories, run RuleTrip in an ephemeral runner with outbound network controls and no persistent credentials.

## Synthetic secret canaries

Secret-scanner experiments should use vendor-documented test values or visibly inert patterns. Never plant a real credential. Some scanners transmit findings to services; understand that data path before enabling such a canary.

## Report honesty

An exit-only **ALIVE** result states only that one command returned non-zero after one mutation. It does not establish causality beyond that process response.

v0.3 sensors can require a declared literal to be absent on every clean control and present in every mutation confirmation. This differential check reduces—but does not eliminate—unrelated-failure attribution: another mutation-only failure could emit the same literal, and the guard itself controls its output. Use specific inert markers and minimal canaries. RuleTrip deliberately records sensor match facts rather than raw command output. Truncated clean output is inconclusive because absence cannot be established.

Repeated confirmation exposes some flaky responses but is not statistical reliability evidence. Two matching runs are two observations, not proof of future behaviour.

## Reporting a vulnerability

Follow [SECURITY.md](../SECURITY.md). Do not include live credentials, private source, or exploit details in a public issue.
