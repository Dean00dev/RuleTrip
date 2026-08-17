# Report Comparison

RuleTrip v0.2 can compare two saved `ruletrip-report.json` files produced at different commits.

```bash
ruletrip compare --before before.json --after after.json
```

The comparison key is `guard-id/canary-id`. For baseline-only failures it uses `guard-id/$baseline`.

Results are classified as:

- `REGRESSION` — the same experiment moved to a worse RuleTrip outcome;
- `IMPROVEMENT` — the same experiment moved to a better outcome;
- `ADDED` — the later report contains a new experiment;
- `REMOVED` — the later report no longer contains an experiment;
- `UNCHANGED` — recorded outcome is identical.

Outcome severity follows RuleTrip's existing overall ordering: `BROKEN` > `DEAD` > `INCONCLUSIVE` > `ALIVE`.

Use `--fail-on-regression` when a worsened existing experiment should return exit code 1. Added or removed experiments are reported separately rather than guessed to be good or bad.

Use `--json` to emit the comparison object for another tool.

Comparison is evidence diffing, not causal analysis. It cannot determine whether a changed status came from a stronger guard, a weaker guard, changed dependencies, a changed canary, or unrelated repository state; inspect the commits and reports together.
