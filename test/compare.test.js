import assert from 'node:assert/strict';
import test from 'node:test';
import { compareReports, formatComparison } from '../src/compare.js';

function report(commit, status) {
  return {
    schemaVersion: 1,
    source: { commit },
    conclusion: status,
    guards: [{ id: 'tests', name: 'Tests', status, canaries: [{ id: 'canary', name: 'Canary', status }] }]
  };
}

test('detects a guard regression across report commits', () => {
  const comparison = compareReports(report('a'.repeat(40), 'alive'), report('b'.repeat(40), 'dead'));
  assert.equal(comparison.counts.regression, 1);
  assert.equal(comparison.changes[0].kind, 'regression');
  assert.match(formatComparison(comparison), /alive -> dead/u);
});

test('detects an improvement and preserves commit provenance', () => {
  const comparison = compareReports(report('a'.repeat(40), 'dead'), report('b'.repeat(40), 'alive'));
  assert.equal(comparison.counts.improvement, 1);
  assert.equal(comparison.before.commit, 'a'.repeat(40));
  assert.equal(comparison.after.commit, 'b'.repeat(40));
});

test('rejects unknown report schema versions', () => {
  assert.throws(() => compareReports({ schemaVersion: 2, guards: [] }, report('b', 'alive')), /schemaVersion must be 1/u);
});
