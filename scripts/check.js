import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function collect(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(full)));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

function check(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--check', file], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`syntax check failed: ${file}`))));
  });
}

const directories = ['src', 'scripts', 'test', 'test-support'];
const files = [];
for (const directory of directories) {
  try {
    files.push(...(await collect(path.join(root, directory))));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
for (const file of files.sort()) await check(file);
process.stdout.write(`Syntax checked ${files.length} JavaScript files.\n`);
