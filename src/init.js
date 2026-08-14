import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CONFIG } from './constants.js';

async function exists(value) {
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
}

async function chooseTestDirectory(root) {
  if (await exists(path.join(root, 'test'))) return 'test';
  if (await exists(path.join(root, 'tests'))) return 'tests';
  return 'test';
}

export async function createStarterConfig(root, { force = false } = {}) {
  const target = path.join(root, DEFAULT_CONFIG);
  if (!force && (await exists(target))) {
    throw new Error(`${DEFAULT_CONFIG} already exists; pass --force to replace it`);
  }

  let packageJson = null;
  try {
    packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  } catch {
    // A language-neutral starter is written below.
  }

  const testDirectory = await chooseTestDirectory(root);
  const command = packageJson?.scripts?.test ? 'npm test' : 'REPLACE_WITH_YOUR_GUARD_COMMAND';
  const config = {
    version: 1,
    defaults: {
      timeoutMs: 120000,
      maxOutputBytes: 65536,
      linkPaths: ['node_modules']
    },
    guards: [
      {
        id: 'tests',
        name: 'Test discovery',
        command,
        canaries: [
          {
            id: 'failing-test',
            name: 'A deliberately failing test is discovered',
            type: 'create',
            path: `${testDirectory}/ruletrip-canary.test.js`,
            content: "import test from 'node:test';\nimport assert from 'node:assert/strict';\n\ntest('RuleTrip planted failure', () => {\n  assert.fail('RULETRIP_CANARY: deliberate failure');\n});\n"
          }
        ]
      }
    ]
  };

  await fs.writeFile(target, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: 'utf8',
    flag: force ? 'w' : 'wx'
  });
  return { path: target, needsCommand: !packageJson?.scripts?.test };
}
