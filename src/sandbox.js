import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runGit } from './git.js';
import { normalizeRelativePath } from './paths.js';

async function linkSharedPath(sourceRoot, worktree, relativePath) {
  const relative = normalizeRelativePath(relativePath, 'defaults.linkPaths entry');
  const source = path.join(sourceRoot, ...relative.split('/'));
  const target = path.join(worktree, ...relative.split('/'));

  try {
    await fs.access(source);
  } catch {
    return false;
  }

  try {
    await fs.lstat(target);
    return false;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.symlink(source, target, process.platform === 'win32' ? 'junction' : 'dir');
  return true;
}

export async function createSandbox(sourceRoot, linkPaths = []) {
  const container = await fs.mkdtemp(path.join(os.tmpdir(), 'ruletrip-'));
  const worktree = path.join(container, 'worktree');
  const added = await runGit(
    ['worktree', 'add', '--detach', '--quiet', worktree, 'HEAD'],
    { cwd: sourceRoot }
  );

  if (added.code !== 0) {
    await fs.rm(container, { recursive: true, force: true });
    throw new Error(`could not create disposable Git worktree: ${added.stderr || added.error}`);
  }

  const linked = [];
  try {
    for (const relative of linkPaths) {
      if (await linkSharedPath(sourceRoot, worktree, relative)) linked.push(relative);
    }
  } catch (error) {
    await cleanupSandbox(sourceRoot, { container, worktree, linked });
    throw error;
  }

  return { container, worktree, linked };
}

export async function cleanupSandbox(sourceRoot, sandbox) {
  for (const relative of sandbox.linked ?? []) {
    const target = path.join(sandbox.worktree, ...relative.split('/'));
    await fs.rm(target, { recursive: true, force: true }).catch(() => {});
  }

  await runGit(['worktree', 'remove', '--force', sandbox.worktree], { cwd: sourceRoot });
  await runGit(['worktree', 'prune'], { cwd: sourceRoot });
  await fs.rm(sandbox.container, { recursive: true, force: true });
}
