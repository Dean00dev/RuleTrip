import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { buildMarkdown, buildSarif, writeReports } from '../src/reports.js';
import { tempDirectory } from '../test-support/helpers.js';

const report = {
  tool: { name: 'RuleTrip', version: '0.1.0' },
  generatedAt: '2026-08-14T00:00:00.000Z',
  source: { commit: 'a'.repeat(40), configPath: '.ruletrip.json' },
  conclusion: 'dead',
  counts: { alive: 0, dead: 1, broken: 0, inconclusive: 0 },
  guards: [{
    id: 'tests', name: 'Tests', command: 'npm test', status: 'dead', reason: null,
    baseline: { exitCode: 0 },
    canaries: [{
      id: 'failing', name: 'Failing | test', type: 'create', target: 'test/canary.js',
      status: 'dead', reason: 'guard returned zero after the controlled violation', execution: { exitCode: 0 }
    }]
  }]
};

test('Markdown states bounded proof and escapes table cells', () => {
  const markdown = buildMarkdown(report);
  assert.match(markdown, /Failing \\| test/u);
  assert.match(markdown, /proves only that the configured command/u);
  assert.match(markdown, /output is intentionally excluded/u);
});

test('SARIF emits a location for escaped canaries', () => {
  const sarif = buildSarif(report);
  const result = sarif.runs[0].results[0];
  assert.equal(result.ruleId, 'ruletrip/dead');
  assert.equal(result.level, 'error');
  assert.equal(result.locations[0].physicalLocation.artifactLocation.uri, 'test/canary.js');
});

test('writeReports keeps the Markdown path separate from its contents', async (t) => {
  const root = await tempDirectory();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const written = await writeReports(root, 'reports', report);
  assert.equal(
    written.markdown,
    path.join(await fs.realpath(root), 'reports', 'ruletrip-summary.md')
  );
  assert.match(written.markdownText, /# RuleTrip report/u);
  assert.match(await fs.readFile(written.markdown, 'utf8'), /Conclusion/u);
});
