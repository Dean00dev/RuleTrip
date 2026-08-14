# Configuration

RuleTrip reads `.ruletrip.json` by default. JSON keeps the runtime dependency-free and makes the executed policy explicit.

## Top level

```json
{
  "version": 1,
  "defaults": {
    "timeoutMs": 120000,
    "maxOutputBytes": 65536,
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
  "canaries": []
}
```

`command` runs through the platform shell inside a detached worktree. Treat the configuration exactly like a workflow file: review changes and do not run an untrusted privileged version.

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

## Policy-scanner examples

### Unpinned GitHub Action

Pair this canary with the command for your existing workflow policy scanner:

```json
{
  "id": "unpinned-action",
  "type": "create",
  "path": ".github/workflows/ruletrip-unpinned.yml",
  "content": "name: RuleTrip canary\non: workflow_dispatch\njobs:\n  canary:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n"
}
```

### Forbidden file

```json
{
  "id": "forbidden-key",
  "type": "create",
  "path": "ruletrip-canary.pem",
  "content": "RULETRIP_INERT_TEST_MATERIAL_NOT_A_REAL_KEY\n"
}
```

### Synthetic secret pattern

Use a scanner-specific documented test token. Never use a live or previously live credential. Label the content as synthetic and scope it to the disposable experiment.

## CLI

```text
ruletrip init [--force]
ruletrip list [--config PATH]
ruletrip run [--config PATH] [--report-dir PATH] [--fail-on LIST]
```

`--fail-on` accepts a comma-separated subset of `dead`, `broken`, and `inconclusive`. **ALIVE** never fails the run.
