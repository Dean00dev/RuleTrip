import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyCanary } from '../src/mutation.js';
import { tempDirectory } from '../test-support/helpers.js';

test('applies create, append, replace, and delete mutations', async (t) => {
  const root = await tempDirectory();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'source.txt'), 'alpha beta\n', 'utf8');

  await applyCanary(root, { type: 'create', path: 'nested/new.txt', content: 'created', overwrite: false });
  assert.equal(await fs.readFile(path.join(root, 'nested/new.txt'), 'utf8'), 'created');

  await applyCanary(root, { type: 'append', path: 'source.txt', content: 'gamma\n' });
  assert.equal(await fs.readFile(path.join(root, 'source.txt'), 'utf8'), 'alpha beta\ngamma\n');

  await applyCanary(root, {
    type: 'replace', path: 'source.txt', search: 'beta', replacement: 'delta', replaceAll: false
  });
  assert.match(await fs.readFile(path.join(root, 'source.txt'), 'utf8'), /alpha delta/u);

  await applyCanary(root, { type: 'delete', path: 'nested/new.txt' });
  await assert.rejects(fs.access(path.join(root, 'nested/new.txt')), /ENOENT/u);
});

test('create refuses to overwrite unless explicitly configured', async (t) => {
  const root = await tempDirectory();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'exists.txt'), 'original', 'utf8');
  await assert.rejects(
    applyCanary(root, { type: 'create', path: 'exists.txt', content: 'changed', overwrite: false }),
    /EEXIST/u
  );
  assert.equal(await fs.readFile(path.join(root, 'exists.txt'), 'utf8'), 'original');
});

test('refuses to mutate through a symlink that leaves the sandbox', async (t) => {
  const root = await tempDirectory();
  const outside = await tempDirectory('ruletrip-outside-');
  t.after(() => Promise.all([
    fs.rm(root, { recursive: true, force: true }),
    fs.rm(outside, { recursive: true, force: true })
  ]));
  await fs.writeFile(path.join(outside, 'protected.txt'), 'safe', 'utf8');
  await fs.symlink(outside, path.join(root, 'shared'), process.platform === 'win32' ? 'junction' : 'dir');

  await assert.rejects(
    applyCanary(root, { type: 'append', path: 'shared/protected.txt', content: 'unsafe' }),
    /symlink outside/u
  );
  assert.equal(await fs.readFile(path.join(outside, 'protected.txt'), 'utf8'), 'safe');
});
