import assert from 'node:assert/strict';
import test from 'node:test';
import { formatProgress, parseFailOn } from '../src/cli.js';

test('parses fail-on values without duplicates', () => {
  assert.deepEqual(parseFailOn('dead, broken,dead'), ['dead', 'broken']);
});

test('rejects unsupported fail-on values', () => {
  assert.throws(() => parseFailOn('alive'), /dead,broken,inconclusive/u);
});

test('labels matched-control progress separately from violation runs', () => {
  const event = {
    phase: 'control',
    guard: { name: 'Tests' },
    canary: { name: 'Failing test' }
  };
  assert.equal(formatProgress(event), '[control]   Failing test\n');
});
