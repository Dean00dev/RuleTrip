import fs from 'node:fs/promises';
import {
  DEFAULT_CONFIG,
  DEFAULT_MAX_OUTPUT_BYTES,
  DEFAULT_TIMEOUT_MS
} from './constants.js';
import { assertUniqueIds, normalizeRelativePath, resolveRepositoryPath } from './paths.js';

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/u;
const CANARY_TYPES = new Set(['create', 'append', 'replace', 'delete']);

function positiveInteger(value, fallback, label, maximum = 30 * 60_000) {
  const actual = value ?? fallback;
  if (!Number.isInteger(actual) || actual <= 0 || actual > maximum) {
    throw new Error(`${label} must be a positive integer no greater than ${maximum}`);
  }
  return actual;
}

function validateId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new Error(`${label} must match ${ID_PATTERN}`);
  }
  return value;
}

function validateCanary(raw, guardId, index) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`guard ${guardId} canary ${index + 1} must be an object`);
  }

  const canary = {
    id: validateId(raw.id, `guard ${guardId} canary id`),
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : raw.id,
    type: raw.type,
    path: normalizeRelativePath(raw.path, `guard ${guardId} canary ${raw.id} path`)
  };

  if (!CANARY_TYPES.has(canary.type)) {
    throw new Error(`guard ${guardId} canary ${canary.id} has unsupported type: ${canary.type}`);
  }

  if (canary.type === 'create' || canary.type === 'append') {
    if (typeof raw.content !== 'string') {
      throw new Error(`guard ${guardId} canary ${canary.id} requires string content`);
    }
    canary.content = raw.content;
  }

  if (canary.type === 'create') canary.overwrite = raw.overwrite === true;

  if (canary.type === 'replace') {
    if (typeof raw.search !== 'string' || raw.search === '') {
      throw new Error(`guard ${guardId} canary ${canary.id} requires a non-empty search string`);
    }
    if (typeof raw.replacement !== 'string') {
      throw new Error(`guard ${guardId} canary ${canary.id} requires a replacement string`);
    }
    canary.search = raw.search;
    canary.replacement = raw.replacement;
    canary.replaceAll = raw.replaceAll === true;
  }

  return canary;
}

function validateGuard(raw, index, defaults) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`guard ${index + 1} must be an object`);
  }

  const id = validateId(raw.id, `guard ${index + 1} id`);
  if (typeof raw.command !== 'string' || raw.command.trim() === '') {
    throw new Error(`guard ${id} requires a non-empty command`);
  }
  if (!Array.isArray(raw.canaries) || raw.canaries.length === 0) {
    throw new Error(`guard ${id} requires at least one canary`);
  }

  const canaries = raw.canaries.map((canary, canaryIndex) =>
    validateCanary(canary, id, canaryIndex)
  );
  assertUniqueIds(canaries, `canary in guard ${id}`);

  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id,
    command: raw.command.trim(),
    timeoutMs: positiveInteger(raw.timeoutMs, defaults.timeoutMs, `guard ${id} timeoutMs`),
    maxOutputBytes: positiveInteger(
      raw.maxOutputBytes,
      defaults.maxOutputBytes,
      `guard ${id} maxOutputBytes`,
      10 * 1024 * 1024
    ),
    canaries
  };
}

export function validateConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('configuration must be a JSON object');
  }
  if (raw.version !== 1) throw new Error('configuration version must be 1');

  const defaults = {
    timeoutMs: positiveInteger(raw.defaults?.timeoutMs, DEFAULT_TIMEOUT_MS, 'defaults.timeoutMs'),
    maxOutputBytes: positiveInteger(
      raw.defaults?.maxOutputBytes,
      DEFAULT_MAX_OUTPUT_BYTES,
      'defaults.maxOutputBytes',
      10 * 1024 * 1024
    ),
    linkPaths: []
  };

  const rawLinks = raw.defaults?.linkPaths ?? ['node_modules'];
  if (!Array.isArray(rawLinks)) throw new Error('defaults.linkPaths must be an array');
  defaults.linkPaths = rawLinks.map((entry, index) =>
    normalizeRelativePath(entry, `defaults.linkPaths[${index}]`)
  );

  if (!Array.isArray(raw.guards) || raw.guards.length === 0) {
    throw new Error('configuration requires at least one guard');
  }
  const guards = raw.guards.map((guard, index) => validateGuard(guard, index, defaults));
  assertUniqueIds(guards, 'guard');

  return { version: 1, defaults, guards };
}

export async function loadConfig(root, configPath = DEFAULT_CONFIG) {
  const relative = normalizeRelativePath(configPath, 'config path');
  const { absolute } = await resolveRepositoryPath(root, relative, 'config path');
  let text;
  try {
    text = await fs.readFile(absolute, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`RuleTrip configuration not found: ${relative}`);
    }
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid JSON in ${relative}: ${error.message}`);
  }

  return { config: validateConfig(parsed), path: relative };
}
