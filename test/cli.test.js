import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFailOn } from '../src/cli.js';

test('parses fail-on values without duplicates', () => {
  assert.deepEqual(parseFailOn('dead, broken,dead'), ['dead', 'broken']);
});

test('rejects unsupported fail-on values', () => {
  assert.throws(() => parseFailOn('alive'), /dead,broken,inconclusive/u);
});
