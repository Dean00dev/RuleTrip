import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { runRuleTrip } from '../src/engine.js';
import { createGitFixture, tempDirectory } from '../test-support/helpers.js';

const defaults = { timeoutMs: 2_000, maxOutputBytes: 4_096, confirmRuns: 2, linkPaths: [] };

function configFor(canary, command = 'node gate.js') {
  return {
    version: 1,
    defaults,
    guards: [{
      id: 'sensor-gate',
      name: 'Sensor gate',
      command,
      confirmRuns: 2,
      timeoutMs: 2_000,
      maxOutputBytes: 4_096,
      canaries: [canary]
    }]
  };
}

test('requires the declared sensor before a non-zero exit can be ALIVE', async (t) => {
  const root = await createGitFixture({
    'gate.js': "import fs from 'node:fs';\nif (fs.existsSync('canary.flag')) { console.error('UNRELATED_FAILURE'); process.exit(7); }\n"
  });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = configFor({
    id: 'flag',
    name: 'Expected trip signal',
    type: 'create',
    path: 'canary.flag',
    content: 'trip\n',
    overwrite: false,
    sensor: { stream: 'combined', includes: 'EXPECTED_RULETRIP_SIGNAL' }
  });

  const report = await runRuleTrip({ root, config, configPath: '.ruletrip.json' });
  const canary = report.guards[0].canaries[0];
  assert.equal(canary.status, 'inconclusive');
  assert.equal(canary.sensor.matched, false);
  assert.equal(canary.confirmation.completedRuns, 2);
  assert.equal(canary.confirmation.stable, true);
  assert.deepEqual(report.attribution, {
    sensorsConfigured: 1,
    sensorsMatched: 0,
    sensorsMissing: 1,
    sensorsUnattributed: 0,
    exitOnly: 0
  });
  assert.match(canary.reason, /required sensor was observed in only 0\/2 runs/u);
  assert.doesNotMatch(JSON.stringify(report), /UNRELATED_FAILURE/u);
});

test('classifies a repeated rejection with the required sensor as ALIVE', async (t) => {
  const root = await createGitFixture({
    'gate.js': "import fs from 'node:fs';\nif (fs.existsSync('canary.flag')) { console.error('EXPECTED_RULETRIP_SIGNAL'); process.exit(7); }\n"
  });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = configFor({
    id: 'flag',
    name: 'Expected trip signal',
    type: 'create',
    path: 'canary.flag',
    content: 'trip\n',
    overwrite: false,
    sensor: { stream: 'stderr', includes: 'EXPECTED_RULETRIP_SIGNAL' }
  });

  const report = await runRuleTrip({ root, config, configPath: '.ruletrip.json' });
  const canary = report.guards[0].canaries[0];
  assert.equal(canary.status, 'alive');
  assert.equal(canary.sensor.matched, true);
  assert.equal(canary.sensor.baselineClear, true);
  assert.equal(canary.sensor.baselineMatchedRuns, 0);
  assert.equal(canary.sensor.mutationMatchedRuns, 2);
  assert.equal(report.attribution.sensorsMatched, 1);
  assert.equal(canary.attempts.length, 2);
  assert.ok(canary.attempts.every((attempt) => attempt.sensor.matched));
});

test('refuses to attribute a sensor that already appears on the clean baseline', async (t) => {
  const root = await createGitFixture({
    'gate.js': "import fs from 'node:fs';\nconsole.error('EXPECTED_RULETRIP_SIGNAL');\nif (fs.existsSync('canary.flag')) process.exit(7);\n"
  });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = configFor({
    id: 'flag',
    name: 'Pre-existing signal',
    type: 'create',
    path: 'canary.flag',
    content: 'trip\n',
    overwrite: false,
    sensor: { stream: 'stderr', includes: 'EXPECTED_RULETRIP_SIGNAL' }
  });

  const report = await runRuleTrip({ root, config, configPath: '.ruletrip.json' });
  const canary = report.guards[0].canaries[0];
  assert.equal(canary.status, 'inconclusive');
  assert.equal(canary.sensor.baselineClear, false);
  assert.equal(canary.sensor.baselineMatchedRuns, 2);
  assert.equal(canary.sensor.mutationMatchedRuns, 2);
  assert.equal(canary.sensor.matched, false);
  assert.equal(report.attribution.sensorsUnattributed, 1);
  assert.match(canary.reason, /sensor already appeared in 2\/2 clean baseline runs/u);
});

test('does not infer clean sensor absence from truncated baseline output', async (t) => {
  const root = await createGitFixture({
    'gate.js': "import fs from 'node:fs';\nconsole.error('x'.repeat(100) + 'EXPECTED_RULETRIP_SIGNAL');\nif (fs.existsSync('canary.flag')) process.exit(7);\n"
  });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = configFor({
    id: 'flag',
    name: 'Truncated signal',
    type: 'create',
    path: 'canary.flag',
    content: 'trip\n',
    overwrite: false,
    sensor: { stream: 'stderr', includes: 'EXPECTED_RULETRIP_SIGNAL' }
  });
  config.guards[0].maxOutputBytes = 16;

  const report = await runRuleTrip({ root, config, configPath: '.ruletrip.json' });
  const canary = report.guards[0].canaries[0];
  assert.equal(canary.status, 'inconclusive');
  assert.equal(canary.sensor.baselineClear, false);
  assert.equal(canary.sensor.baselineMatchedRuns, 0);
  assert.equal(report.attribution.sensorsUnattributed, 1);
  assert.match(canary.reason, /baseline output was truncated/u);
});

test('marks mixed confirmation outcomes INCONCLUSIVE instead of choosing a convenient result', async (t) => {
  const external = await tempDirectory();
  const counter = path.join(external, 'counter.txt');
  const script = [
    "import fs from 'node:fs';",
    "if (!fs.existsSync('canary.flag')) process.exit(0);",
    `const counter = ${JSON.stringify(counter)};`,
    "let value = 0; try { value = Number(fs.readFileSync(counter, 'utf8')); } catch {}",
    "value += 1; fs.writeFileSync(counter, String(value));",
    "process.exit(value === 1 ? 9 : 0);"
  ].join('\n');
  const root = await createGitFixture({ 'gate.js': `${script}\n` });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  t.after(() => fs.rm(external, { recursive: true, force: true }));
  const config = configFor({
    id: 'flag', name: 'Flaky trip', type: 'create', path: 'canary.flag', content: 'trip\n', overwrite: false
  });

  const report = await runRuleTrip({ root, config, configPath: '.ruletrip.json' });
  const canary = report.guards[0].canaries[0];
  assert.equal(canary.status, 'inconclusive');
  assert.equal(canary.confirmation.stable, false);
  assert.match(canary.reason, /unstable: rejected 1\/2/u);
});

test('refuses an unstable clean baseline before planting a canary', async (t) => {
  const external = await tempDirectory();
  const counter = path.join(external, 'baseline-counter.txt');
  const script = [
    "import fs from 'node:fs';",
    `const counter = ${JSON.stringify(counter)};`,
    "let value = 0; try { value = Number(fs.readFileSync(counter, 'utf8')); } catch {}",
    "value += 1; fs.writeFileSync(counter, String(value));",
    "process.exit(value === 1 ? 0 : 8);"
  ].join('\n');
  const root = await createGitFixture({ 'gate.js': `${script}\n` });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  t.after(() => fs.rm(external, { recursive: true, force: true }));
  const config = configFor({
    id: 'never-run', name: 'Never planted', type: 'create', path: 'canary.flag', content: 'trip\n', overwrite: false
  });

  const report = await runRuleTrip({ root, config, configPath: '.ruletrip.json' });
  const guard = report.guards[0];
  assert.equal(guard.status, 'inconclusive');
  assert.equal(guard.canaries.length, 0);
  assert.match(guard.reason, /clean baseline was unstable: passed 1\/2/u);
});
