import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const reportSchema = fileURLToPath(new URL('../schema/ruletrip-report.schema.json', import.meta.url));
const configSchema = fileURLToPath(new URL('../schema/ruletrip-config.schema.json', import.meta.url));

test('published JSON schemas are valid JSON and pinned to schema version 1', async () => {
  const [report, config] = await Promise.all([
    fs.readFile(reportSchema, 'utf8').then(JSON.parse),
    fs.readFile(configSchema, 'utf8').then(JSON.parse)
  ]);
  assert.equal(report.properties.schemaVersion.const, 1);
  assert.equal(config.properties.version.const, 1);
  assert.deepEqual(report.properties.conclusion.enum, ['alive', 'dead', 'broken', 'inconclusive']);
});
