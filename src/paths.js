import fs from 'node:fs/promises';
import path from 'node:path';

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function normalizeRelativePath(value, label = 'path') {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty relative path`);
  }

  const portable = value.replaceAll('\\', '/');
  if (portable.includes('\0') || path.posix.isAbsolute(portable) || /^[A-Za-z]:\//u.test(portable)) {
    throw new Error(`${label} must stay inside the repository`);
  }

  const normalized = path.posix.normalize(portable);
  const segments = normalized.split('/');
  if (normalized === '.' || segments.includes('..') || segments.includes('.git')) {
    throw new Error(`${label} must stay inside the repository and may not target .git`);
  }

  return normalized.replace(/^\.\//u, '');
}

export async function resolveRepositoryPath(root, relativePath, label = 'path') {
  const normalized = normalizeRelativePath(relativePath, label);
  const rootReal = await fs.realpath(root);
  const target = path.resolve(rootReal, ...normalized.split('/'));

  if (!isWithin(rootReal, target)) {
    throw new Error('canary.path resolved outside the disposable worktree');
  }

  // Walk the existing portion of the path. A symlink may point to shared
  // dependencies outside the worktree; canaries must never mutate through it.
  let cursor = rootReal;
  for (const segment of normalized.split('/')) {
    cursor = path.join(cursor, segment);
    try {
      const stat = await fs.lstat(cursor);
      if (stat.isSymbolicLink()) {
        const resolved = await fs.realpath(cursor);
        if (!isWithin(rootReal, resolved)) {
          throw new Error(`${label} crosses a symlink outside the repository: ${relativePath}`);
        }
        cursor = resolved;
      }
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
  }

  return { absolute: target, relative: normalized };
}

export async function resolveMutationPath(root, relativePath) {
  return resolveRepositoryPath(root, relativePath, 'canary.path');
}

export function assertUniqueIds(items, kind) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`duplicate ${kind} id: ${item.id}`);
    seen.add(item.id);
  }
}
