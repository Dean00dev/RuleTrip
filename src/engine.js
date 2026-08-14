import { STATUS, STATUS_ORDER, VERSION } from './constants.js';
import { currentCommit } from './git.js';
import { applyCanary } from './mutation.js';
import { runCommand } from './process.js';
import { cleanupSandbox, createSandbox } from './sandbox.js';

function commandFacts(execution) {
  return {
    exitCode: execution.code,
    signal: execution.signal,
    timedOut: execution.timedOut,
    spawnError: execution.spawnError,
    durationMs: execution.durationMs,
    outputCaptured: false,
    outputTruncated: execution.stdoutTruncated || execution.stderrTruncated
  };
}

async function executeInSandbox(root, defaults, guard, mutate) {
  const sandbox = await createSandbox(root, defaults.linkPaths);
  try {
    let target = null;
    if (mutate) target = await mutate(sandbox.worktree);
    const execution = await runCommand(guard.command, {
      cwd: sandbox.worktree,
      timeoutMs: guard.timeoutMs,
      maxOutputBytes: guard.maxOutputBytes
    });
    return { execution, target };
  } finally {
    await cleanupSandbox(root, sandbox);
  }
}

function classifyGuard(canaries) {
  for (const status of [STATUS.DEAD, STATUS.INCONCLUSIVE, STATUS.ALIVE]) {
    if (canaries.some((canary) => canary.status === status)) return status;
  }
  return STATUS.INCONCLUSIVE;
}

async function runGuard(root, defaults, guard, progress) {
  progress?.({ phase: 'baseline', guard });
  let baseline;
  try {
    baseline = await executeInSandbox(root, defaults, guard, null);
  } catch (error) {
    return {
      id: guard.id,
      name: guard.name,
      command: guard.command,
      status: STATUS.BROKEN,
      reason: `baseline infrastructure failed: ${error.message}`,
      baseline: null,
      canaries: []
    };
  }

  const baselineFacts = commandFacts(baseline.execution);
  if (baseline.execution.timedOut) {
    return {
      id: guard.id,
      name: guard.name,
      command: guard.command,
      status: STATUS.INCONCLUSIVE,
      reason: 'clean baseline timed out',
      baseline: baselineFacts,
      canaries: []
    };
  }
  if (baseline.execution.spawnError || baseline.execution.code !== 0) {
    return {
      id: guard.id,
      name: guard.name,
      command: guard.command,
      status: STATUS.BROKEN,
      reason: baseline.execution.spawnError
        ? `clean baseline could not start: ${baseline.execution.spawnError}`
        : `clean baseline exited ${baseline.execution.code}`,
      baseline: baselineFacts,
      canaries: []
    };
  }

  const canaries = [];
  for (const canary of guard.canaries) {
    progress?.({ phase: 'canary', guard, canary });
    try {
      const run = await executeInSandbox(root, defaults, guard, (worktree) =>
        applyCanary(worktree, canary)
      );
      let status;
      let reason;
      if (run.execution.timedOut || run.execution.spawnError || run.execution.code === null) {
        status = STATUS.INCONCLUSIVE;
        reason = run.execution.timedOut
          ? 'guard timed out after mutation'
          : `guard execution failed: ${run.execution.spawnError || run.execution.signal || 'unknown error'}`;
      } else if (run.execution.code === 0) {
        status = STATUS.DEAD;
        reason = 'guard returned zero after the controlled violation';
      } else {
        status = STATUS.ALIVE;
        reason = `guard rejected the controlled violation with exit ${run.execution.code}`;
      }
      canaries.push({
        id: canary.id,
        name: canary.name,
        type: canary.type,
        target: run.target,
        status,
        reason,
        execution: commandFacts(run.execution)
      });
    } catch (error) {
      canaries.push({
        id: canary.id,
        name: canary.name,
        type: canary.type,
        target: canary.path,
        status: STATUS.INCONCLUSIVE,
        reason: `mutation infrastructure failed: ${error.message}`,
        execution: null
      });
    }
  }

  return {
    id: guard.id,
    name: guard.name,
    command: guard.command,
    status: classifyGuard(canaries),
    reason: null,
    baseline: baselineFacts,
    canaries
  };
}

function summarize(guards) {
  const counts = { alive: 0, dead: 0, broken: 0, inconclusive: 0 };
  for (const guard of guards) {
    if (guard.status === STATUS.BROKEN) counts.broken += 1;
    if (guard.status === STATUS.INCONCLUSIVE && guard.canaries.length === 0) {
      counts.inconclusive += 1;
    }
    for (const canary of guard.canaries) {
      if (Object.hasOwn(counts, canary.status)) counts[canary.status] += 1;
    }
  }

  const conclusion = STATUS_ORDER.find((status) => counts[status] > 0) ?? STATUS.ALIVE;
  return { conclusion, counts };
}

export async function runRuleTrip({ root, config, configPath, progress }) {
  const commit = await currentCommit(root);
  const guards = [];
  for (const guard of config.guards) {
    guards.push(await runGuard(root, config.defaults, guard, progress));
  }

  const summary = summarize(guards);
  return {
    schemaVersion: 1,
    tool: { name: 'RuleTrip', version: VERSION },
    generatedAt: new Date().toISOString(),
    source: { commit, configPath },
    semantics: {
      alive: 'the configured command rejected the planted violation',
      dead: 'the configured command returned zero after the planted violation',
      broken: 'the configured command failed on the clean baseline',
      inconclusive: 'RuleTrip could not classify the experiment safely'
    },
    ...summary,
    guards
  };
}

export function shouldFail(report, failOn) {
  return failOn.some((status) => report.counts[status] > 0);
}
