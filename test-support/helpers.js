import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export async function tempDirectory(prefix = 'ruletrip-test-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export function exec(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) =>
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8')
      })
    );
  });
}

export async function createGitFixture(files) {
  const root = await tempDirectory();
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
  }
  for (const args of [
    ['init', '--quiet', '--initial-branch=main'],
    ['config', 'user.name', 'RuleTrip Test'],
    ['config', 'user.email', 'ruletrip@example.invalid'],
    ['add', '.'],
    ['commit', '--quiet', '-m', 'fixture']
  ]) {
    const result = await exec('git', args, root);
    if (result.code !== 0) throw new Error(result.stderr);
  }
  return root;
}
