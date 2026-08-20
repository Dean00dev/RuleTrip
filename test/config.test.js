import assert from 'node:assert/strict';
import test from 'node:test';
import { validateConfig } from '../src/config.js';

function validConfig() {
  return {
    version: 1,
    guards: [
      {
        id: 'tests',
        command: 'npm test',
        canaries: [
          { id: 'failing-test', type: 'create', path: 'test/canary.js', content: 'fail();' }
        ]
      }
    ]
  };
}

test('validates and supplies conservative defaults', () => {
  const config = validateConfig(validConfig());
  assert.equal(config.version, 1);
  assert.equal(config.guards[0].timeoutMs, 120_000);
  assert.equal(config.guards[0].confirmRuns, 1);
  assert.deepEqual(config.defaults.linkPaths, ['node_modules']);
});

test('validates bounded confirmation runs and literal output sensors', () => {
  const raw = validConfig();
  raw.defaults = { confirmRuns: 2 };
  raw.guards[0].canaries[0].sensor = {
    stream: 'stderr',
    includes: 'RULETRIP_EXPECTED_FAILURE'
  };
  const config = validateConfig(raw);
  assert.equal(config.guards[0].confirmRuns, 2);
  assert.deepEqual(config.guards[0].canaries[0].sensor, raw.guards[0].canaries[0].sensor);

  raw.defaults.confirmRuns = 6;
  assert.throws(() => validateConfig(raw), /confirmRuns/u);

  const invalidSensor = validConfig();
  invalidSensor.guards[0].canaries[0].sensor = { stream: 'network', includes: 'x' };
  assert.throws(() => validateConfig(invalidSensor), /sensor\.stream/u);
});

test('rejects traversal, absolute, git, and Windows escape paths', () => {
  for (const value of ['../outside', '/tmp/outside', '.git/config', 'C:\\outside', 'reports\ninjected=value']) {
    const config = validConfig();
    config.guards[0].canaries[0].path = value;
    assert.throws(() => validateConfig(config), /inside the repository|may not target .git/u);
  }
});

test('rejects control characters in report-facing display names', () => {
  const config = validConfig();
  config.guards[0].name = 'Tests\n## forged report';
  assert.throws(() => validateConfig(config), /control characters/u);
});

test('rejects duplicate guard and canary identifiers', () => {
  const duplicateCanary = validConfig();
  duplicateCanary.guards[0].canaries.push({
    id: 'failing-test', type: 'delete', path: 'other.js'
  });
  assert.throws(() => validateConfig(duplicateCanary), /duplicate canary/u);

  const duplicateGuard = validConfig();
  duplicateGuard.guards.push(structuredClone(duplicateGuard.guards[0]));
  assert.throws(() => validateConfig(duplicateGuard), /duplicate guard/u);
});

test('requires declarative mutation fields', () => {
  const config = validConfig();
  config.guards[0].canaries[0] = { id: 'replace', type: 'replace', path: 'file.js' };
  assert.throws(() => validateConfig(config), /requires a non-empty search string/u);
});
