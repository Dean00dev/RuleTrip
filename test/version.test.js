import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../src/constants.js';

const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));
const changelogPath = fileURLToPath(new URL('../CHANGELOG.md', import.meta.url));

test('release metadata agrees on RuleTrip version', async () => {
  const pkg = JSON.parse(await fs.readFile(packagePath, 'utf8'));
  const changelog = await fs.readFile(changelogPath, 'utf8');
  assert.equal(VERSION, '0.4.0');
  assert.equal(pkg.version, VERSION);
  assert.match(changelog, /\[0\.4\.0\]/u);
});
