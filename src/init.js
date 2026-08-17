import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CONFIG } from './constants.js';
import { buildManualStarterGuard, discoverCanaryPacks } from './presets.js';

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

async function readPackageJson(root) {
  try {
    return JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

export async function buildStarterConfig(root) {
  const packageJson = await readPackageJson(root);
  const testDirectory = await chooseTestDirectory(root);
  const detected = discoverCanaryPacks(packageJson, { testDirectory });
  const guards = detected.guards.length > 0 ? detected.guards : [buildManualStarterGuard(testDirectory)];
  const first = detected.discoveries[0] ?? {
    pack: 'manual',
    command: guards[0].command,
    commandSource: 'manual configuration required'
  };

  const config = {
    version: 1,
    defaults: {
      timeoutMs: 120000,
      maxOutputBytes: 65536,
      linkPaths: ['node_modules']
    },
    guards
  };

  return {
    config,
    needsCommand: detected.guards.length === 0,
    discovery: {
      testDirectory,
      command: first.command,
      commandSource: first.commandSource,
      guards: detected.discoveries
    }
  };
}

export async function createStarterConfig(root, { force = false } = {}) {
  const target = path.join(root, DEFAULT_CONFIG);
  if (!force && (await exists(target))) {
    throw new Error(`${DEFAULT_CONFIG} already exists; pass --force to replace it`);
  }

  const starter = await buildStarterConfig(root);
  await fs.writeFile(target, `${JSON.stringify(starter.config, null, 2)}\n`, {
    encoding: 'utf8',
    flag: force ? 'w' : 'wx'
  });
  return { path: target, ...starter };
}
