# Design

## Experiment contract

Every guard follows a controlled sequence:

1. Resolve the current commit.
2. Create a detached worktree.
3. Run the guard unchanged as a clean control.
4. If the control passes, create a new worktree for each canary.
5. Apply exactly one declarative mutation.
6. Run the same guard command.
7. Classify the exit behaviour and destroy the worktree.

This avoids three misleading shortcuts:

- a failing baseline cannot masquerade as canary detection;
- one canary cannot contaminate the next;
- mutation failures cannot be counted as guard successes.

## State model

```mermaid
stateDiagram-v2
    [*] --> Baseline
    Baseline --> Broken: non-zero
    Baseline --> Inconclusive: timeout or infrastructure
    Baseline --> Mutated: zero
    Mutated --> Alive: non-zero
    Mutated --> Dead: zero
    Mutated --> Inconclusive: timeout or infrastructure
```

## Why declarative mutations

Arbitrary mutation scripts would be flexible but difficult to audit and easy to mistake for the guard itself. v0.1 supports four bounded file operations. The guard command remains arbitrary because repositories already express their checks through language-specific commands.

## Why JSON

JSON allows strict parsing with the Node.js standard library and introduces no runtime supply-chain dependency. Schema versioning provides an explicit compatibility boundary.

## Why worktrees

Worktrees preserve the exact committed repository without copying every tracked file, work on all major Git platforms, and make cleanup observable through Git. They are file-state isolation, not process isolation; the threat model makes that boundary explicit.

## Why output is not evidence by default

Guard output can contain source fragments, environment details, or secrets. v0.1 records exit code, signal, timing, timeout, and truncation facts while leaving raw stdout/stderr out of reports. Debug the guard directly when classification needs investigation.
