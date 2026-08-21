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
  assert.match(found.guards[0].canaries[0].sensor.includes, /RULETRIP_CANARY/u);
  assert.equal(found.guards[0].canaries[0].control.path, 'tests/ruletrip-canary.test.js');
  assert.equal(found.guards[1].canaries[0].sensor.stream, 'combined');
  assert.match(found.guards[1].canaries[0].control.content, /string = 'RULETRIP_CANARY'/u);
  assert.match(found.guards[2].canaries[0].control.content, /const RULETRIP_CANARY = true/u);
  assert.equal(found.discoveries[1].commandSource, 'package.json scripts.typecheck');
});

test('workflow-pin preset is inert and contains the intended unpinned reference', () => {
  const found = discoverCanaryPacks({ scripts: { 'check:workflows': 'node scan-workflows.js' } });
  const canary = found.guards[0].canaries[0];
  assert.equal(canary.path, '.github/workflows/ruletrip-unpinned-canary.yml');
  assert.match(canary.content, /if: \$\{\{ false \}\}/u);
  assert.match(canary.content, /actions\/checkout@main/u);
  assert.equal(canary.control.path, canary.path);
  assert.match(canary.control.content, /actions\/checkout@[0-9a-f]{40}/u);
});

test('generic policy pack does not invent a scanner-independent neutral control', () => {
  const found = discoverCanaryPacks({ scripts: { policy: 'node policy.js' } });
  const canary = found.guards[0].canaries[0];
  assert.equal(canary.sensor, undefined);
  assert.equal(canary.control, undefined);
});
