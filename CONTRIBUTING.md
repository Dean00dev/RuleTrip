# Contributing

RuleTrip welcomes small, falsifiable changes.

## Before opening a pull request

1. Explain the failure mode the change detects or prevents.
2. Add a fixture that fails without the change.
3. Run `node scripts/check.js` and `node --test` on Node.js 20 or newer.
4. If behaviour or claims change, update the relevant documentation.
5. Keep runtime dependencies at zero unless there is a documented, reviewed need.

## Canary contributions

A preset must identify:

- the exact violation it plants;
- the guard/tool versions it targets;
- why the content is inert;
- expected false-positive and false-negative boundaries;
- Windows, macOS, and Linux path behaviour where relevant.

## Commit and review expectations

Keep changes focused. Security-sensitive changes should include hostile tests for traversal, symlinks, timeouts, output handling, and baseline contamination as applicable.

By contributing, you agree that your contribution is licensed under the MIT License.
