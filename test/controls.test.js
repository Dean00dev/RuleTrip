import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { runRuleTrip } from '../src/engine.js';
import { createGitFixture } from '../test-support/helpers.js';

const defaults = { timeoutMs: 2_000, maxOutputBytes: 4_096, confirmRuns: 2, linkPaths: [] };

function configFor(command, sensor = { stream: 'combined', includes: 'EXPECTED_DEFECT' }) {
  return {
    version: 1,
    defaults,
    guards: [{
      id: 'specificity',
      name: 'Specificity guard',
      command,
      confirmRuns: 2,
      timeoutMs: 2_000,
      maxOutputBytes: 4_096,
      canaries: [{
        id: 'defect',
        name: 'Defect with matched control',
        type: 'create',
        path: 'canary.flag',
        content: 'DEFECT\n',
        overwrite: false,
        sensor,
        control: {
          type: 'create',
          path: 'canary.flag',
          content: 'CONTROL\n',
          overwrite: false
        }
      }]
    }]
  };
}

test('attributes ALIVE only when the defect fails and its matched control passes', async (t) => {
  const root = await createGitFixture({
    'gate.js': "import fs from 'node:fs';\nif (fs.existsSync('canary.flag') && fs.readFileSync('canary.flag', 'utf8').includes('DEFECT')) { console.error('EXPECTED_DEFECT'); process.exit(9); }\n"
  });
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const report = await runRuleTrip({
    root,
    config: configFor('node gate.js'),
    configPath: '.ruletrip.json'
  });
  const canary = report.guards[0].canaries[0];
  assert.equal(canary.status, 'alive');
  assert.equal(canary.control.status, 'passed');
  assert.equal(canary.control.passedRuns, 2);
  assert.equal(canary.control.sensorClear, true);
  assert.equal(report.attribution.controlsPassed, 1);
  assert.match(canary.reason, /matched control passed 2\/2/u);
});

test('refuses causal attribution when the guard rejects any file at the canary path', async (t) => {
  const root = await createGitFixture({
    'gate.js': "import fs from 'node:fs';\nif (fs.existsSync('canary.flag')) { console.error('EXPECTED_DEFECT'); process.exit(9); }\n"
  });
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const report = await runRuleTrip({
    root,
    config: configFor('node gate.js'),
    configPath: '.ruletrip.json'
  });
  const canary = report.guards[0].canaries[0];
  assert.equal(canary.status, 'inconclusive');
  assert.equal(canary.control.status, 'rejected');
  assert.equal(report.attribution.controlsRejected, 1);
  assert.match(canary.reason, /also rejected the matched control/u);
});

test('refuses attribution when the violation sensor appears in a passing control', async (t) => {
  const root = await createGitFixture({
    'gate.js': "import fs from 'node:fs';\nif (!fs.existsSync('canary.flag')) process.exit(0);\nconsole.error('EXPECTED_DEFECT');\nif (fs.readFileSync('canary.flag', 'utf8').includes('DEFECT')) process.exit(9);\n"
  });
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const report = await runRuleTrip({
    root,
    config: configFor('node gate.js'),
    configPath: '.ruletrip.json'
  });
  const canary = report.guards[0].canaries[0];
  assert.equal(canary.status, 'inconclusive');
  assert.equal(canary.control.status, 'inconclusive');
  assert.equal(canary.control.sensorMatchedRuns, 2);
  assert.equal(report.attribution.controlsInconclusive, 1);
});

test('does not spend control runs after a violation already escaped', async (t) => {
  const root = await createGitFixture({ 'gate.js': 'process.exit(0);\n' });
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const report = await runRuleTrip({
    root,
    config: configFor('node gate.js', null),
    configPath: '.ruletrip.json'
  });
  const canary = report.guards[0].canaries[0];
  assert.equal(canary.status, 'dead');
  assert.equal(canary.control.status, 'not-run');
  assert.equal(canary.control.completedRuns, 0);
});
