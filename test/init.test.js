import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { buildStarterConfig } from '../src/init.js';

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL('../src/cli.js', import.meta.url));

async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ruletrip-init-'));
  await execFileAsync('git', ['init'], { cwd: root });
  return root;
}

test('starter discovery is side-effect free and detects npm test', async (t) => {
  const root = await makeRoot();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.mkdir(path.join(root, 'tests'));
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ scripts: { test: 'node --test' } }),
    'utf8'
  );

  const starter = await buildStarterConfig(root);

  assert.equal(starter.discovery.command, 'npm test');
  assert.equal(starter.discovery.commandSource, 'package.json scripts.test');
  assert.equal(starter.discovery.testDirectory, 'tests');
  assert.equal(starter.config.guards[0].canaries[0].path, 'tests/ruletrip-canary.test.js');
  await assert.rejects(fs.access(path.join(root, '.ruletrip.json')));
});

test('init --dry-run prints the generated config without writing it', async (t) => {
  const root = await makeRoot();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  await fs.mkdir(path.join(root, 'test'));
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ scripts: { test: 'node --test' } }),
    'utf8'
  );

  const { stdout } = await execFileAsync(process.execPath, [cliPath, 'init', '--dry-run'], {
    cwd: root
  });

  assert.match(stdout, /RuleTrip init preview/u);
  assert.match(stdout, /Detected guard command: npm test/u);
  assert.match(stdout, /Command source: package\.json scripts\.test/u);
  assert.match(stdout, /"path": "test\/ruletrip-canary\.test\.js"/u);
  assert.match(stdout, /Preview only: no files written\./u);
  await assert.rejects(fs.access(path.join(root, '.ruletrip.json')));
});

test('starter discovery makes manual configuration explicit when npm test is absent', async (t) => {
  const root = await makeRoot();
  t.after(() => fs.rm(root, { recursive: true, force: true }));

  const starter = await buildStarterConfig(root);

  assert.equal(starter.needsCommand, true);
  assert.equal(starter.discovery.command, 'REPLACE_WITH_YOUR_GUARD_COMMAND');
  assert.equal(starter.discovery.commandSource, 'manual configuration required');
});
