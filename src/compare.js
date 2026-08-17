import fs from 'node:fs/promises';
import { STATUS, STATUS_ORDER } from './constants.js';

const VALID = new Set([STATUS.ALIVE, STATUS.DEAD, STATUS.BROKEN, STATUS.INCONCLUSIVE]);
const RANK = new Map(STATUS_ORDER.map((status, index) => [status, STATUS_ORDER.length - index]));

function assertReport(report, label) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error(`${label} report must be a JSON object`);
  }
  if (report.schemaVersion !== 1) throw new Error(`${label} report schemaVersion must be 1`);
  if (!Array.isArray(report.guards)) throw new Error(`${label} report guards must be an array`);
}

function flatten(report) {
  const rows = new Map();
  for (const guard of report.guards) {
    if (!guard || typeof guard.id !== 'string') continue;
    if (Array.isArray(guard.canaries) && guard.canaries.length > 0) {
      for (const canary of guard.canaries) {
        if (!canary || typeof canary.id !== 'string' || !VALID.has(canary.status)) continue;
        rows.set(`${guard.id}/${canary.id}`, {
          guardId: guard.id,
          guardName: guard.name ?? guard.id,
          canaryId: canary.id,
          canaryName: canary.name ?? canary.id,
          status: canary.status
        });
      }
    } else if (VALID.has(guard.status)) {
      rows.set(`${guard.id}/$baseline`, {
        guardId: guard.id,
        guardName: guard.name ?? guard.id,
        canaryId: '$baseline',
        canaryName: 'Clean baseline',
        status: guard.status
      });
    }
  }
  return rows;
}

function relation(before, after) {
  if (before === after) return 'unchanged';
  const b = RANK.get(before) ?? 0;
  const a = RANK.get(after) ?? 0;
  return a > b ? 'regression' : 'improvement';
}

export function compareReports(before, after) {
  assertReport(before, 'before');
  assertReport(after, 'after');
  const left = flatten(before);
  const right = flatten(after);
  const keys = [...new Set([...left.keys(), ...right.keys()])].sort();
  const changes = [];

  for (const key of keys) {
    const a = left.get(key);
    const b = right.get(key);
    if (!a) {
      changes.push({ key, kind: 'added', before: null, after: b.status, ...b });
      continue;
    }
    if (!b) {
      changes.push({ key, kind: 'removed', before: a.status, after: null, ...a });
      continue;
    }
    changes.push({ key, kind: relation(a.status, b.status), before: a.status, after: b.status, ...b });
  }

  const counts = { regression: 0, improvement: 0, added: 0, removed: 0, unchanged: 0 };
  for (const change of changes) counts[change.kind] += 1;

  return {
    schemaVersion: 1,
    before: { commit: before.source?.commit ?? null, conclusion: before.conclusion ?? null },
    after: { commit: after.source?.commit ?? null, conclusion: after.conclusion ?? null },
    counts,
    changes
  };
}

export function formatComparison(comparison) {
  const lines = [
    'RuleTrip report comparison',
    `Before: ${comparison.before.commit ?? 'unknown'} (${comparison.before.conclusion ?? 'unknown'})`,
    `After:  ${comparison.after.commit ?? 'unknown'} (${comparison.after.conclusion ?? 'unknown'})`,
    `Changes: regressions ${comparison.counts.regression} | improvements ${comparison.counts.improvement} | added ${comparison.counts.added} | removed ${comparison.counts.removed} | unchanged ${comparison.counts.unchanged}`
  ];
  for (const change of comparison.changes) {
    if (change.kind === 'unchanged') continue;
    lines.push(`- ${change.kind.toUpperCase()} ${change.key}: ${change.before ?? '—'} -> ${change.after ?? '—'}`);
  }
  return `${lines.join('\n')}\n`;
}

export async function compareReportFiles(beforePath, afterPath) {
  const [beforeText, afterText] = await Promise.all([
    fs.readFile(beforePath, 'utf8'),
    fs.readFile(afterPath, 'utf8')
  ]);
  let before;
  let after;
  try { before = JSON.parse(beforeText); } catch (error) { throw new Error(`invalid JSON in before report: ${error.message}`); }
  try { after = JSON.parse(afterText); } catch (error) { throw new Error(`invalid JSON in after report: ${error.message}`); }
  return compareReports(before, after);
}
