# Configuration

RuleTrip reads `.ruletrip.json` by default. JSON keeps the runtime dependency-free and makes the executed policy explicit. The published v1 schema is [`schema/ruletrip-config.schema.json`](../schema/ruletrip-config.schema.json).

## Discovery before writing

Use:

```text
ruletrip presets
ruletrip init --dry-run
```

`init --dry-run` is side-effect free and prints every detected guard preset plus the complete configuration it would write. v0.2 recognises bounded package-script names for test, type-check, lint, workflow-pin, and policy guards. See [Canary Packs](CANARY_PACKS.md).

If no supported command is found, RuleTrip writes no invented command during preview; the generated starter contains `REPLACE_WITH_YOUR_GUARD_COMMAND` and requires manual review.

## Top level

```json
{
  "version": 1,
  "defaults": {
    "timeoutMs": 120000,
    "maxOutputBytes": 65536,
    "confirmRuns": 2,
    "linkPaths": ["node_modules"]
  },
  "guards": []
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `version` | yes | Configuration schema; currently `1`. |
| `defaults.timeoutMs` | no | Per-command timeout, 1 ms to 30 minutes. |
| `defaults.maxOutputBytes` | no | In-memory capture cap per stdout/stderr stream. Output is not persisted. |
| `defaults.confirmRuns` | no | Fresh baseline and canary repetitions, from 1 to 5. Default is 1 for backward compatibility; generated v0.3 configurations use 2. |
| `defaults.linkPaths` | no | Repository-relative directories symlinked/junctioned into worktrees when present. |
| `guards` | yes | One or more commands with one or more canaries. |

`linkPaths` improves speed when a guard needs installed dependencies, but linked directories are not isolated from the guard command. Use an empty array for stronger separation.

## Guard

```json
{
  "id": "typecheck",
  "name": "TypeScript compiler",
  "command": "npm run typecheck",
  "timeoutMs": 120000,
  "maxOutputBytes": 65536,
  "confirmRuns": 2,
  "canaries": []
}
```

`command` runs through the platform shell inside a detached worktree. Treat the configuration exactly like a workflow file: review changes and do not run an untrusted privileged version.

`confirmRuns` can override the default per guard. Each clean baseline and each canary attempt uses a fresh worktree. All baselines must pass consistently. Mixed canary exits are **INCONCLUSIVE**, not a convenient majority vote.

## Canary types

### Create

```json
{
  "id": "type-error",
  "name": "A clear type mismatch is rejected",
  "type": "create",
  "path": "src/ruletrip-canary.ts",
  "content": "const ruleTripCanary: string = 42;\n"
}
```

`create` refuses to replace an existing path. Set `"overwrite": true` only when replacement is the intended experiment.

### Append

```json
{
  "id": "syntax-error",
  "type": "append",
  "path": "src/index.js",
  "content": "\nRULETRIP deliberate syntax failure !!!\n"
}
```

### Replace

```json
{
  "id": "flipped-invariant",
  "type": "replace",
  "path": "src/policy.js",
  "search": "return decision === 'allow';",
  "replacement": "return true;",
  "replaceAll": false
}
```

Exact matching makes drift visible. If `search` is absent, the experiment is **INCONCLUSIVE** rather than silently changing nothing.

### Delete

```json
{
  "id": "missing-manifest",
  "type": "delete",
  "path": "policy/required-manifest.json"
}
```

## Synthetic policy material

Use scanner-specific documented test tokens where appropriate. Never use a live or previously live credential. Label synthetic data clearly and scope it to the disposable experiment.

## Literal output sensors

A non-zero exit establishes that the process rejected something; it does not establish that the intended guard produced the failure. A canary can therefore require a literal output signal:

```json
{
  "id": "failing-test",
  "type": "create",
  "path": "test/ruletrip-canary.test.js",
  "content": "throw new Error('RULETRIP_EXPECTED_FAILURE');\n",
  "sensor": {
    "stream": "combined",
    "includes": "RULETRIP_EXPECTED_FAILURE"
  }
}
```

`sensor.stream` accepts `stdout`, `stderr`, or `combined` and defaults to `combined`. Matching is literal and case-sensitive. RuleTrip records only bounded match facts; raw command output and the sensor literal are not copied into reports.

An attributed sensor must be absent from every clean-control capture and present in every mutation capture. A pre-existing clean signal, a missing mutation signal, or truncation that prevents clean absence from being established makes the result **INCONCLUSIVE**. Truncation never turns missing evidence into success.

Sensors should identify the expected guard signal rather than a generic word such as `error`. Configurations without sensors remain valid and provide exit-only evidence.

## CLI

```text
ruletrip init [--force] [--dry-run]
ruletrip presets
ruletrip list [--config PATH]
ruletrip run [--config PATH] [--report-dir PATH] [--fail-on LIST]
ruletrip compare --before REPORT.json --after REPORT.json [--fail-on-regression] [--json]
```

`--fail-on` accepts a comma-separated subset of `dead`, `broken`, and `inconclusive`. **ALIVE** never fails the run.
