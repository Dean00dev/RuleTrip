import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { runRuleTrip, shouldFail } from '../src/engine.js';
import { createGitFixture } from '../test-support/helpers.js';

const defaults = { timeoutMs: 2_000, maxOutputBytes: 1024, linkPaths: [] };

test('classifies alive, dead, broken, and inconclusive without changing the source checkout', async (t) => {
  const root = await createGitFixture({
    'gate.js': "process.stdout.write('clean\\n');\n",
    'broken.js': 'process.exit(7);\n'
  });
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const config = {
    version: 1,
    defaults,
    guards: [
      {
        id: 'mixed', name: 'Mixed guard', command: 'node gate.js', timeoutMs: 2_000,
        maxOutputBytes: 1024,
        canaries: [
          { id: 'alive', name: 'Detected syntax failure', type: 'append', path: 'gate.js', content: '\nthis is invalid !!!\n' },
          { id: 'dead', name: 'Ignored file', type: 'create', path: 'ignored.txt', content: 'violation', overwrite: false },
          { id: 'inconclusive', name: 'Impossible replacement', type: 'replace', path: 'gate.js', search: 'not present', replacement: 'x', replaceAll: false }
        ]
      },
      {
        id: 'broken', name: 'Broken baseline', command: 'node broken.js', timeoutMs: 2_000,
        maxOutputBytes: 1024,
        canaries: [{ id: 'unused', name: 'Not run', type: 'create', path: 'x', content: 'x', overwrite: false }]
      }
    ]
  };

  const original = await fs.readFile(path.join(root, 'gate.js'), 'utf8');
  const report = await runRuleTrip({ root, config, configPath: '.ruletrip.json' });

  assert.deepEqual(report.counts, { alive: 1, dead: 1, broken: 1, inconclusive: 1 });
  assert.equal(report.conclusion, 'broken');
  assert.equal(report.guards[0].canaries[0].status, 'alive');
  assert.equal(report.guards[0].canaries[1].status, 'dead');
  assert.equal(report.guards[0].canaries[2].status, 'inconclusive');
  assert.equal(report.guards[1].status, 'broken');
  assert.equal(shouldFail(report, ['dead']), true);
  assert.equal(await fs.readFile(path.join(root, 'gate.js'), 'utf8'), original);
  await assert.rejects(fs.access(path.join(root, 'ignored.txt')), /ENOENT/u);
});

test('classifies a clean baseline timeout as inconclusive', async (t) => {
  const root = await createGitFixture({ 'slow.js': 'setTimeout(() => {}, 5_000);\n' });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = {
    version: 1,
    defaults: { ...defaults, timeoutMs: 30 },
    guards: [{
      id: 'slow', name: 'Slow guard', command: 'node slow.js', timeoutMs: 30,
      maxOutputBytes: 1024,
      canaries: [{ id: 'unused', name: 'Not run', type: 'create', path: 'x', content: 'x', overwrite: false }]
    }]
  };
  const report = await runRuleTrip({ root, config, configPath: '.ruletrip.json' });
  assert.equal(report.conclusion, 'inconclusive');
  assert.equal(report.counts.inconclusive, 1);
  assert.equal(report.guards[0].reason, 'clean baseline timed out');
});
