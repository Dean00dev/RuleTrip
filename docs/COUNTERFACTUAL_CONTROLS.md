# Matched Counterfactual Controls

## The attribution problem

Traditional mutation testing seeds a change and asks whether the test suite kills it. RuleTrip applies that idea one layer higher: it seeds a repository violation and asks whether the configured feedback control rejects it. A rejection alone still leaves a confounder—the command may be reacting to the canary's path, marker, or mere existence rather than its intended defect.

RuleTrip v0.4 introduces an optional matched control. The control uses the same declarative mutation type and repository path as the violation but contains user-declared neutral content. The experiment becomes:

1. clean repository passes;
2. violating mutation is rejected consistently;
3. any literal sensor is absent on clean runs and present on violation runs;
4. matched neutral mutation passes consistently;
5. the violation sensor is absent from bounded matched-control output.

Failure of steps 3–5 is **INCONCLUSIVE**, not `ALIVE`.

## Research basis

Mutation-testing systems such as [Stryker](https://stryker-mutator.io/docs/) and [PIT](https://pitest.org/) distinguish killed mutations from surviving mutations, while also documenting equivalent or unhelpful mutants as a real interpretation problem. Google's published work on [test efficacy](https://testing.googleblog.com/2018/09/efficacy-presubmit.html) likewise treats reliable breakage signals and tests that never fail as different evidence classes.

Matched controls are RuleTrip's inference from those established concerns: observe both the defective and neutralised forms rather than treating every non-zero response as equally specific. This is not a claim that Stryker, PIT, or Google use RuleTrip's exact control design.

## Evidence boundary

RuleTrip can establish:

- the two mutations used the same declared operation and path;
- the clean, violation, and control process facts observed at one commit;
- whether configured literal-sensor and repetition contracts held.

RuleTrip cannot establish:

- that violation and control differ only in one semantic property;
- that the control is genuinely benign for every repository policy;
- that the canary represents a production incident;
- that a passing experiment certifies the guard or repository;
- future reliability beyond the recorded runs.

The control author remains responsible for semantic quality. A bad control should be reviewed like a bad test fixture: preserve it when it exposes ambiguity, and improve it without rewriting historical receipts.

## Why controls run last

Matched controls add command executions. RuleTrip therefore runs them only after a violation would otherwise qualify as `ALIVE`. A violation that escapes is already `DEAD`; running the neutral form cannot rescue that result. Reports mark its configured control `not-run` so absence of control evidence is explicit.
