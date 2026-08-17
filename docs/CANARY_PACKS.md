# Canary Packs

RuleTrip v0.2 includes a small built-in catalogue of **canary pack families**. A pack is a reviewed mutation template plus conservative discovery metadata. Packs do not certify a guard and they do not replace repository-specific threat modelling.

Run `ruletrip presets` to inspect the catalogue and `ruletrip init --dry-run` to see which packs would be selected for the current repository without writing a file.

| Pack | Detected package scripts | Planted violation |
| --- | --- | --- |
| `test` | `test` | failing `node:test` file in the detected `test`/`tests` directory |
| `typecheck` | `typecheck`, `type-check`, `check:types`, `check-types` | TypeScript assignment mismatch |
| `lint` | `lint` | JavaScript parse error |
| `workflow-pin` | `check:workflows`, `workflow:check`, `lint:workflows`, `actionlint` | inert workflow with `actions/checkout@main` |
| `policy` | `policy`, `policy:check`, `check:policy` | inert `.ruletrip-policy-canary` marker |

## Audit boundary

The shipped templates are intentionally inert and declarative. The workflow-pin canary uses `workflow_dispatch`, an empty permission set, an `if: ${{ false }}` job, and exists only in a disposable worktree during the experiment.

Pack discovery is deliberately narrow. RuleTrip does not guess arbitrary script semantics. If no supported script is found, `init` generates one explicit manual guard with `REPLACE_WITH_YOUR_GUARD_COMMAND` rather than inventing a command.

A preset can still be **DEAD** because the repository command excludes the canary path, because the scanner policy does not cover that defect, or because the command is not the guard the user thought it was. That is the experiment RuleTrip is meant to expose.

## Adding a repository-specific canary

Treat the generated `.ruletrip.json` as a starting point. Prefer the smallest mutation that expresses one concrete failure mode, keep synthetic data inert, and run a clean baseline before interpreting any canary result.
