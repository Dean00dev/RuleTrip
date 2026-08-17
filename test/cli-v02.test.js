import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL('../src/cli.js', import.meta.url));

function report(commit, status) {
  return {
    schemaVersion: 1,
    source: { commit },
    conclusion: status,
    guards: [{ id: 'tests', name: 'Tests', status, canaries: [{ id: 'c', name: 'Canary', status }] }]
  };
}

test('presets command lists the shipped pack families without requiring Git', async () => {
  const { stdout } = await execFileAsync(process.execPath, [cliPath, 'presets']);
  assert.match(stdout, /test: Test discovery/u);
  assert.match(stdout, /workflow-pin: Workflow pin policy/u);
  assert.match(stdout, /policy: Repository policy scanner/u);
});

test('compare command can fail on a recorded regression without requiring Git', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ruletrip-compare-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const before = path.join(root, 'before.json');
  const after = path.join(root, 'after.json');
  await fs.writeFile(before, JSON.stringify(report('a'.repeat(40), 'alive')), 'utf8');
  await fs.writeFile(after, JSON.stringify(report('b'.repeat(40), 'dead')), 'utf8');

  await assert.rejects(
    execFileAsync(process.execPath, [cliPath, 'compare', '--before', before, '--after', after, '--fail-on-regression']),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stdout, /REGRESSION tests\/c: alive -> dead/u);
      return true;
    }
  );
});
