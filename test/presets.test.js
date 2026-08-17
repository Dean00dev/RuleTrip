import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverCanaryPacks, listCanaryPacks } from '../src/presets.js';

test('lists five bounded canary pack families', () => {
  const packs = listCanaryPacks();
  assert.deepEqual(packs.map((pack) => pack.id), ['test', 'typecheck', 'lint', 'workflow-pin', 'policy']);
  assert.ok(packs.every((pack) => pack.description.length > 20));
});

test('discovers supported package scripts without inventing absent guards', () => {
  const found = discoverCanaryPacks({ scripts: { test: 'node --test', lint: 'eslint .', typecheck: 'tsc --noEmit' } }, { testDirectory: 'tests' });
  assert.deepEqual(found.guards.map((guard) => guard.id), ['tests', 'typecheck', 'lint']);
  assert.equal(found.guards[0].command, 'npm test');
  assert.equal(found.guards[0].canaries[0].path, 'tests/ruletrip-canary.test.js');
  assert.equal(found.discoveries[1].commandSource, 'package.json scripts.typecheck');
});

test('workflow-pin preset is inert and contains the intended unpinned reference', () => {
  const found = discoverCanaryPacks({ scripts: { 'check:workflows': 'node scan-workflows.js' } });
  const canary = found.guards[0].canaries[0];
  assert.equal(canary.path, '.github/workflows/ruletrip-unpinned-canary.yml');
  assert.match(canary.content, /if: \$\{\{ false \}\}/u);
  assert.match(canary.content, /actions\/checkout@main/u);
});
