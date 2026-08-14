import fs from 'node:fs/promises';
import path from 'node:path';
import { STATUS } from './constants.js';
import { normalizeRelativePath, resolveRepositoryPath } from './paths.js';

const ICON = Object.freeze({
  [STATUS.ALIVE]: '✅',
  [STATUS.DEAD]: '❌',
  [STATUS.BROKEN]: '🛠️',
  [STATUS.INCONCLUSIVE]: '❓'
});

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function buildMarkdown(report) {
  const lines = [
    '# RuleTrip report',
    '',
    `**Conclusion:** ${ICON[report.conclusion]} \`${report.conclusion.toUpperCase()}\``,
    '',
    `Commit: \`${report.source.commit}\`  `,
    `Config: \`${report.source.configPath}\`  `,
    `Generated: ${report.generatedAt}`,
    '',
    '| Outcome | Count |',
    '| --- | ---: |',
    `| ✅ Alive | ${report.counts.alive} |`,
    `| ❌ Dead | ${report.counts.dead} |`,
    `| 🛠️ Broken | ${report.counts.broken} |`,
    `| ❓ Inconclusive | ${report.counts.inconclusive} |`,
    '',
    '## Experiments',
    ''
  ];

  for (const guard of report.guards) {
    lines.push(`### ${ICON[guard.status]} ${guard.name}`, '');
    lines.push(`Command: \`${guard.command.replaceAll('`', '\\`')}\``, '');
    if (guard.reason) lines.push(`_${guard.reason}_`, '');
    if (guard.canaries.length > 0) {
      lines.push('| Canary | Mutation | Target | Result | Reason |');
      lines.push('| --- | --- | --- | --- | --- |');
      for (const canary of guard.canaries) {
        lines.push(
          `| ${escapeCell(canary.name)} | \`${escapeCell(canary.type)}\` | \`${escapeCell(canary.target)}\` | ${ICON[canary.status]} \`${canary.status.toUpperCase()}\` | ${escapeCell(canary.reason)} |`
        );
      }
      lines.push('');
    }
  }

  lines.push(
    '## What this proves',
    '',
    'An **ALIVE** result proves only that the configured command returned a non-zero exit code for that exact planted violation in this commit. It does not prove overall correctness, security, test quality, or coverage.',
    '',
    'Command output is intentionally excluded from persisted reports to reduce accidental secret leakage.',
    ''
  );
  return lines.join('\n');
}

function sarifLevel(status) {
  if (status === STATUS.DEAD || status === STATUS.BROKEN) return 'error';
  if (status === STATUS.INCONCLUSIVE) return 'warning';
  return 'note';
}

export function buildSarif(report) {
  const results = [];
  for (const guard of report.guards) {
    if (guard.canaries.length === 0 && guard.status !== STATUS.ALIVE) {
      results.push({
        ruleId: `ruletrip/${guard.status}`,
        level: sarifLevel(guard.status),
        message: { text: `${guard.name}: ${guard.reason}` }
      });
    }
    for (const canary of guard.canaries) {
      if (canary.status === STATUS.ALIVE) continue;
      results.push({
        ruleId: `ruletrip/${canary.status}`,
        level: sarifLevel(canary.status),
        message: { text: `${guard.name} / ${canary.name}: ${canary.reason}` },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: canary.target }
            }
          }
        ],
        properties: { guard: guard.id, canary: canary.id, mutation: canary.type }
      });
    }
  }

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: report.tool.name,
            version: report.tool.version,
            informationUri: 'https://github.com/Dean00dev/RuleTrip',
            rules: [
              { id: 'ruletrip/dead', shortDescription: { text: 'A planted violation escaped its guard' } },
              { id: 'ruletrip/broken', shortDescription: { text: 'A guard failed on the clean baseline' } },
              { id: 'ruletrip/inconclusive', shortDescription: { text: 'An experiment could not be classified safely' } }
            ]
          }
        },
        results
      }
    ]
  };
}

export async function writeReports(root, reportDir, report) {
  const relative = normalizeRelativePath(reportDir, 'report directory');
  const { absolute: directory } = await resolveRepositoryPath(root, relative, 'report directory');
  await fs.mkdir(directory, { recursive: true });

  const paths = {
    json: path.join(directory, 'ruletrip-report.json'),
    markdown: path.join(directory, 'ruletrip-summary.md'),
    sarif: path.join(directory, 'ruletrip-results.sarif')
  };
  const markdownText = buildMarkdown(report);
  await Promise.all([
    fs.writeFile(paths.json, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    fs.writeFile(paths.markdown, markdownText, 'utf8'),
    fs.writeFile(paths.sarif, `${JSON.stringify(buildSarif(report), null, 2)}\n`, 'utf8')
  ]);
  return { ...paths, markdownText };
}
