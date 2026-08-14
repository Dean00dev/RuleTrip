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
  assert.deepEqual(config.defaults.linkPaths, ['node_modules']);
});

test('rejects traversal, absolute, git, and Windows escape paths', () => {
  for (const value of ['../outside', '/tmp/outside', '.git/config', 'C:\\outside']) {
    const config = validConfig();
    config.guards[0].canaries[0].path = value;
    assert.throws(() => validateConfig(config), /inside the repository|may not target .git/u);
  }
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
