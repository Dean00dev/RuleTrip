import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { buildJUnit, buildMarkdown, buildSarif, writeReports } from '../src/reports.js';
import { tempDirectory } from '../test-support/helpers.js';

const report = {
  tool: { name: 'RuleTrip', version: '0.3.0' },
  generatedAt: '2026-08-17T00:00:00.000Z',
  source: { commit: 'a'.repeat(40), configPath: '.ruletrip.json' },
  conclusion: 'dead',
  counts: { alive: 0, dead: 1, broken: 0, inconclusive: 0 },
  attribution: {
    sensorsConfigured: 1, sensorsMatched: 0, sensorsMissing: 1, sensorsUnattributed: 0, exitOnly: 0
  },
  guards: [{
    id: 'tests', name: 'Tests', command: 'npm test', status: 'dead', reason: null,
    baseline: { exitCode: 0 },
    canaries: [{
      id: 'failing', name: 'Failing | test', type: 'create', target: 'test/canary.js',
      status: 'dead', reason: 'guard returned zero after the controlled violation', execution: { exitCode: 0 },
      confirmation: { requiredRuns: 2, completedRuns: 2, stable: true },
      sensor: {
        configured: true,
        stream: 'combined',
        baselineClear: true,
        baselineMatchedRuns: 0,
        mutationMatchedRuns: 0,
        matched: false
      }
    }]
  }]
};

test('Markdown states bounded proof and escapes table cells', () => {
  const markdown = buildMarkdown(report);
  assert.match(markdown, /Failing \\| test/u);
  assert.match(markdown, /proves only that the configured command/u);
  assert.match(markdown, /2\/2; sensor missing/u);
  assert.match(markdown, /Sensors matched: \*\*0\/1\*\*/u);
  assert.match(markdown, /Sensors unattributed at baseline: \*\*0\*\*/u);
  assert.match(markdown, /output is intentionally excluded/u);
});

test('SARIF emits a location for escaped canaries', () => {
  const sarif = buildSarif(report);
  const result = sarif.runs[0].results[0];
  assert.equal(result.ruleId, 'ruletrip/dead');
  assert.equal(result.level, 'error');
  assert.equal(result.locations[0].physicalLocation.artifactLocation.uri, 'test/canary.js');
});

test('JUnit maps dead canaries to failures and escapes XML', () => {
  const junit = buildJUnit(report);
  assert.match(junit, /testsuite name="RuleTrip" tests="1" failures="1" skipped="0"/u);
  assert.match(junit, /<failure message="guard returned zero after the controlled violation"\/>/u);
});

test('writeReports writes Markdown, JSON, SARIF, and JUnit', async (t) => {
  const root = await tempDirectory();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const written = await writeReports(root, 'reports', report);
  assert.equal(written.markdown, path.join(await fs.realpath(root), 'reports', 'ruletrip-summary.md'));
  assert.equal(written.junit, path.join(await fs.realpath(root), 'reports', 'ruletrip-results.junit.xml'));
  assert.match(written.markdownText, /# RuleTrip report/u);
  assert.match(await fs.readFile(written.junit, 'utf8'), /<testsuite/u);
});
