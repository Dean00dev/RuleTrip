import { spawn } from 'node:child_process';

export function runGit(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn('git', args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) =>
      resolve({ code: null, stdout: '', stderr: '', error: error.message })
    );
    child.on('close', (code) =>
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString('utf8').trim(),
        stderr: Buffer.concat(stderr).toString('utf8').trim(),
        error: null
      })
    );
  });
}

export async function findGitRoot(start = process.cwd()) {
  const result = await runGit(['rev-parse', '--show-toplevel'], { cwd: start });
  if (result.code !== 0) {
    throw new Error(`RuleTrip requires a Git repository with at least one commit: ${result.stderr || result.error}`);
  }
  return result.stdout;
}

export async function currentCommit(root) {
  const result = await runGit(['rev-parse', 'HEAD'], { cwd: root });
  if (result.code !== 0) throw new Error(`could not resolve HEAD: ${result.stderr}`);
  return result.stdout;
}
