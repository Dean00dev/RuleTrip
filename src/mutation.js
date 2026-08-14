import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveMutationPath } from './paths.js';

export async function applyCanary(root, canary) {
  const target = await resolveMutationPath(root, canary.path);
  await fs.mkdir(path.dirname(target.absolute), { recursive: true });

  if (canary.type === 'create') {
    await fs.writeFile(target.absolute, canary.content, {
      encoding: 'utf8',
      flag: canary.overwrite ? 'w' : 'wx'
    });
  } else if (canary.type === 'append') {
    const stat = await fs.lstat(target.absolute);
    if (!stat.isFile()) throw new Error(`append canary requires an existing file: ${target.relative}`);
    await fs.appendFile(target.absolute, canary.content, 'utf8');
  } else if (canary.type === 'replace') {
    const original = await fs.readFile(target.absolute, 'utf8');
    if (!original.includes(canary.search)) {
      throw new Error(`search text was not found in ${target.relative}`);
    }
    const changed = canary.replaceAll
      ? original.replaceAll(canary.search, canary.replacement)
      : original.replace(canary.search, canary.replacement);
    await fs.writeFile(target.absolute, changed, 'utf8');
  } else if (canary.type === 'delete') {
    const stat = await fs.lstat(target.absolute);
    if (!stat.isFile() && !stat.isSymbolicLink()) {
      throw new Error(`delete canary only supports files: ${target.relative}`);
    }
    await fs.unlink(target.absolute);
  } else {
    throw new Error(`unsupported canary type: ${canary.type}`);
  }

  return target.relative;
}
