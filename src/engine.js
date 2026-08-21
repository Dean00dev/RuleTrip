import { STATUS, STATUS_ORDER, VERSION } from './constants.js';
import { currentCommit } from './git.js';
import { applyCanary } from './mutation.js';
import { runCommand } from './process.js';
import { cleanupSandbox, createSandbox } from './sandbox.js';

function sensorObservation(execution, sensor) {
  if (!sensor) return null;
  let observed;
  if (sensor.stream === 'stdout') observed = execution.stdout;
  else if (sensor.stream === 'stderr') observed = execution.stderr;
  else observed = `${execution.stdout}\n${execution.stderr}`;

  const outputTruncated = sensor.stream === 'stdout'
    ? execution.stdoutTruncated
    : sensor.stream === 'stderr'
      ? execution.stderrTruncated
      : execution.stdoutTruncated || execution.stderrTruncated;

  return {
    stream: sensor.stream,
    matched: observed.includes(sensor.includes),
    outputTruncated
  };
}

function commandFacts(execution, sensor = null) {
  return {
    exitCode: execution.code,
    signal: execution.signal,
    timedOut: execution.timedOut,
    spawnError: execution.spawnError,
    durationMs: execution.durationMs,
    outputCaptured: false,
    outputTruncated: execution.stdoutTruncated || execution.stderrTruncated,
    sensor: sensorObservation(execution, sensor)
  };
}

function sensorFacts(sensor, baselineObservations, attempts, requiredRuns) {
  if (!sensor) {
    return {
      configured: false,
      stream: null,
      baselineClear: null,
      baselineMatchedRuns: 0,
      mutationMatchedRuns: 0,
      matched: null
    };
  }

  const baselineMatchedRuns = baselineObservations.filter((item) => item.matched).length;
  const baselineClear = baselineObservations.length === requiredRuns
    && baselineMatchedRuns === 0
    && baselineObservations.every((item) => !item.outputTruncated);
  const mutationMatchedRuns = attempts.filter((attempt) => attempt.sensor?.matched).length;
  const mutationMatched = attempts.length === requiredRuns && mutationMatchedRuns === requiredRuns;

  return {
    configured: true,
    stream: sensor.stream,
    baselineClear,
    baselineMatchedRuns,
    mutationMatchedRuns,
    matched: baselineClear && mutationMatched
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

function classifyCanary(attempts, requiredRuns, sensor, observedSensor) {
  if (attempts.length !== requiredRuns) {
    return {
      status: STATUS.INCONCLUSIVE,
      reason: `only ${attempts.length}/${requiredRuns} confirmation runs completed`
    };
  }

  if (attempts.some((attempt) => attempt.timedOut || attempt.spawnError || attempt.exitCode === null)) {
    return {
      status: STATUS.INCONCLUSIVE,
      reason: 'at least one confirmation run timed out or could not execute safely'
    };
  }

  const rejected = attempts.filter((attempt) => attempt.exitCode !== 0).length;
  if (rejected === 0) {
    return {
      status: STATUS.DEAD,
      reason: `guard returned zero in all ${requiredRuns} confirmation run${requiredRuns === 1 ? '' : 's'}`
    };
  }
  if (rejected !== requiredRuns) {
    return {
      status: STATUS.INCONCLUSIVE,
      reason: `guard response was unstable: rejected ${rejected}/${requiredRuns} confirmation runs`
    };
  }

  if (sensor) {
    if (!observedSensor.baselineClear) {
      if (observedSensor.baselineMatchedRuns > 0) {
        return {
          status: STATUS.INCONCLUSIVE,
          reason: `required sensor already appeared in ${observedSensor.baselineMatchedRuns}/${requiredRuns} clean baseline runs`
        };
      }
      return {
        status: STATUS.INCONCLUSIVE,
        reason: 'required sensor absence could not be established because clean baseline output was truncated'
      };
    }
    if (observedSensor.mutationMatchedRuns !== requiredRuns) {
      const truncated = attempts.some((attempt) => attempt.sensor?.outputTruncated);
      return {
        status: STATUS.INCONCLUSIVE,
        reason: truncated
          ? `guard rejected the violation, but the required sensor was observed in only ${observedSensor.mutationMatchedRuns}/${requiredRuns} runs and output was truncated`
          : `guard rejected the violation, but the required sensor was observed in only ${observedSensor.mutationMatchedRuns}/${requiredRuns} runs`
      };
    }
    return {
      status: STATUS.ALIVE,
      reason: `guard rejected the controlled violation; the sensor was absent from ${requiredRuns}/${requiredRuns} clean controls and present in ${requiredRuns}/${requiredRuns} mutation runs`
    };
  }

  return {
    status: STATUS.ALIVE,
    reason: requiredRuns === 1
      ? `guard rejected the controlled violation with exit ${attempts[0].exitCode}`
      : `guard rejected the controlled violation in ${requiredRuns}/${requiredRuns} confirmation runs`
  };
}

function attemptsAreStable(attempts, requiredRuns, sensor) {
  if (attempts.length !== requiredRuns) return false;
  if (attempts.some((attempt) => attempt.timedOut || attempt.spawnError || attempt.exitCode === null)) {
    return false;
  }
  return attempts.every((attempt) =>
    attempt.exitCode === attempts[0].exitCode
    && (!sensor || attempt.sensor?.matched === attempts[0].sensor?.matched)
  );
}

function unrunControl(control, requiredRuns) {
  return {
    configured: Boolean(control),
    status: control ? 'not-run' : 'not-configured',
    target: control?.path ?? null,
    requiredRuns,
    completedRuns: 0,
    passedRuns: 0,
    stable: false,
    sensorClear: null,
    sensorMatchedRuns: 0,
    attempts: []
  };
}

function classifyControl(attempts, requiredRuns, sensor) {
  const facts = {
    configured: true,
    status: 'inconclusive',
    requiredRuns,
    completedRuns: attempts.length,
    passedRuns: attempts.filter((attempt) => attempt.exitCode === 0).length,
    stable: attemptsAreStable(attempts, requiredRuns, sensor),
    sensorClear: sensor
      ? attempts.length === requiredRuns
        && attempts.every((attempt) => !attempt.sensor?.matched && !attempt.sensor?.outputTruncated)
      : null,
    sensorMatchedRuns: sensor
      ? attempts.filter((attempt) => attempt.sensor?.matched).length
      : 0,
    attempts
  };

  if (attempts.length !== requiredRuns) {
    return { ...facts, reason: `matched control completed only ${attempts.length}/${requiredRuns} runs` };
  }
  if (attempts.some((attempt) => attempt.timedOut || attempt.spawnError || attempt.exitCode === null)) {
    return { ...facts, reason: 'matched control timed out or could not execute safely' };
  }
  if (facts.passedRuns !== requiredRuns) {
    return {
      ...facts,
      status: 'rejected',
      reason: `guard also rejected the matched control in ${requiredRuns - facts.passedRuns}/${requiredRuns} runs`
    };
  }
  if (sensor && !facts.sensorClear) {
    return {
      ...facts,
      reason: facts.sensorMatchedRuns > 0
        ? `the violation sensor also appeared in ${facts.sensorMatchedRuns}/${requiredRuns} passing control runs`
        : 'sensor absence could not be established because matched-control output was truncated'
    };
  }
  return {
    ...facts,
    status: 'passed',
    reason: `matched control passed in ${requiredRuns}/${requiredRuns} runs`
  };
}

async function runGuard(root, defaults, guard, progress) {
  const confirmRuns = guard.confirmRuns ?? defaults.confirmRuns ?? 1;
  progress?.({ phase: 'baseline', guard });
  const baselineAttempts = [];
  const baselineExecutions = [];
  for (let attempt = 0; attempt < confirmRuns; attempt += 1) {
    try {
      const baseline = await executeInSandbox(root, defaults, guard, null);
      baselineExecutions.push(baseline.execution);
      baselineAttempts.push(commandFacts(baseline.execution));
    } catch (error) {
      return {
        id: guard.id,
        name: guard.name,
        command: guard.command,
        status: STATUS.INCONCLUSIVE,
        reason: `baseline infrastructure failed: ${error.message}`,
        baseline: baselineAttempts[0] ?? null,
        baselineAttempts,
        confirmRuns,
        canaries: []
      };
    }
  }

  const baselineFacts = baselineAttempts[0];
  if (baselineAttempts.some((attempt) => attempt.timedOut)) {
    return {
      id: guard.id,
      name: guard.name,
      command: guard.command,
      status: STATUS.INCONCLUSIVE,
      reason: 'clean baseline timed out',
      baseline: baselineFacts,
      baselineAttempts,
      confirmRuns,
      canaries: []
    };
  }
  if (baselineAttempts.some((attempt) => attempt.spawnError || attempt.exitCode === null)) {
    return {
      id: guard.id,
      name: guard.name,
      command: guard.command,
      status: STATUS.INCONCLUSIVE,
      reason: 'at least one clean baseline could not execute safely',
      baseline: baselineFacts,
      baselineAttempts,
      confirmRuns,
      canaries: []
    };
  }

  const passingBaselines = baselineAttempts.filter((attempt) => attempt.exitCode === 0).length;
  if (passingBaselines !== confirmRuns) {
    const allFailed = passingBaselines === 0;
    return {
      id: guard.id,
      name: guard.name,
      command: guard.command,
      status: allFailed ? STATUS.BROKEN : STATUS.INCONCLUSIVE,
      reason: allFailed
        ? `clean baseline failed in all ${confirmRuns} confirmation runs`
        : `clean baseline was unstable: passed ${passingBaselines}/${confirmRuns} confirmation runs`,
      baseline: baselineFacts,
      baselineAttempts,
      confirmRuns,
      canaries: []
    };
  }

  const canaries = [];
  for (const canary of guard.canaries) {
    progress?.({ phase: 'canary', guard, canary });
    const attempts = [];
    const baselineSensorObservations = canary.sensor
      ? baselineExecutions.map((execution) => sensorObservation(execution, canary.sensor))
      : [];
    let target = canary.path;
    try {
      for (let attempt = 0; attempt < confirmRuns; attempt += 1) {
        const run = await executeInSandbox(root, defaults, guard, (worktree) =>
          applyCanary(worktree, canary)
        );
        target = run.target;
        attempts.push(commandFacts(run.execution, canary.sensor));
      }
      const observedSensor = sensorFacts(
        canary.sensor,
        baselineSensorObservations,
        attempts,
        confirmRuns
      );
      let classification = classifyCanary(
        attempts,
        confirmRuns,
        canary.sensor,
        observedSensor
      );
      let control = unrunControl(canary.control, confirmRuns);
      if (canary.control && classification.status === STATUS.ALIVE) {
        progress?.({ phase: 'control', guard, canary });
        const controlAttempts = [];
        let controlTarget = canary.control.path;
        try {
          for (let attempt = 0; attempt < confirmRuns; attempt += 1) {
            const run = await executeInSandbox(root, defaults, guard, (worktree) =>
              applyCanary(worktree, canary.control)
            );
            controlTarget = run.target;
            controlAttempts.push(commandFacts(run.execution, canary.sensor));
          }
          control = {
            ...classifyControl(controlAttempts, confirmRuns, canary.sensor),
            target: controlTarget
          };
        } catch (error) {
          control = {
            ...classifyControl(controlAttempts, confirmRuns, canary.sensor),
            target: controlTarget,
            status: 'inconclusive',
            reason: `matched-control infrastructure failed: ${error.message}`
          };
        }
        if (control.status === 'passed') {
          classification = {
            status: STATUS.ALIVE,
            reason: `${classification.reason}; matched control passed ${confirmRuns}/${confirmRuns}`
          };
        } else {
          classification = {
            status: STATUS.INCONCLUSIVE,
            reason: `${classification.reason}; ${control.reason}`
          };
        }
      }
      canaries.push({
        id: canary.id,
        name: canary.name,
        type: canary.type,
        target,
        status: classification.status,
        reason: classification.reason,
        execution: attempts[0] ?? null,
        attempts,
        confirmation: {
          requiredRuns: confirmRuns,
          completedRuns: attempts.length,
          stable: attemptsAreStable(attempts, confirmRuns, canary.sensor)
        },
        sensor: observedSensor,
        control
      });
    } catch (error) {
      canaries.push({
        id: canary.id,
        name: canary.name,
        type: canary.type,
        target: canary.path,
        status: STATUS.INCONCLUSIVE,
        reason: `mutation infrastructure failed: ${error.message}`,
        execution: attempts[0] ?? null,
        attempts,
        confirmation: {
          requiredRuns: confirmRuns,
          completedRuns: attempts.length,
          stable: false
        },
        sensor: sensorFacts(canary.sensor, baselineSensorObservations, attempts, confirmRuns),
        control: unrunControl(canary.control, confirmRuns)
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
    baselineAttempts,
    confirmRuns,
    canaries
  };
}

function summarize(guards) {
  const counts = { alive: 0, dead: 0, broken: 0, inconclusive: 0 };
  const attribution = {
    sensorsConfigured: 0,
    sensorsMatched: 0,
    sensorsMissing: 0,
    sensorsUnattributed: 0,
    exitOnly: 0,
    controlsConfigured: 0,
    controlsPassed: 0,
    controlsRejected: 0,
    controlsInconclusive: 0,
    controlsNotRun: 0
  };
  for (const guard of guards) {
    if (guard.status === STATUS.BROKEN) counts.broken += 1;
    if (guard.status === STATUS.INCONCLUSIVE && guard.canaries.length === 0) {
      counts.inconclusive += 1;
    }
    for (const canary of guard.canaries) {
      if (Object.hasOwn(counts, canary.status)) counts[canary.status] += 1;
      if (canary.sensor?.configured) {
        attribution.sensorsConfigured += 1;
        if (canary.sensor.matched) attribution.sensorsMatched += 1;
        else if (!canary.sensor.baselineClear) attribution.sensorsUnattributed += 1;
        else attribution.sensorsMissing += 1;
      } else {
        attribution.exitOnly += 1;
      }
      if (canary.control?.configured) {
        attribution.controlsConfigured += 1;
        if (canary.control.status === 'passed') attribution.controlsPassed += 1;
        else if (canary.control.status === 'rejected') attribution.controlsRejected += 1;
        else if (canary.control.status === 'not-run') attribution.controlsNotRun += 1;
        else attribution.controlsInconclusive += 1;
      }
    }
  }

  const conclusion = STATUS_ORDER.find((status) => counts[status] > 0) ?? STATUS.ALIVE;
  return { conclusion, counts, attribution };
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
      alive: 'the configured command rejected the planted violation consistently; configured sensors were absent on clean controls and present on mutations; configured matched controls passed',
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
