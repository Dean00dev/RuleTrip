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

function escapeHeading(value) {
  return String(value)
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ')
    .replace(/([\\`*_{}\[\]()<>#+.!|-])/gu, '\\$1');
}

function escapeInlineCode(value) {
  return String(value).replaceAll('\r', ' ').replaceAll('\n', ' ').replaceAll('`', '\\`');
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function evidenceSummary(canary) {
  const required = canary.confirmation?.requiredRuns ?? 1;
  const completed = canary.confirmation?.completedRuns ?? (canary.execution ? 1 : 0);
  let sensor = 'exit only';
  if (canary.sensor?.configured) {
    if (canary.sensor.matched) sensor = 'sensor attributed';
    else if (!canary.sensor.baselineClear) sensor = 'sensor baseline unclear';
    else sensor = 'sensor missing';
  }
  let control = 'no matched control';
  if (canary.control?.configured) {
    if (canary.control.status === 'passed') control = 'control passed';
    else if (canary.control.status === 'rejected') control = 'control rejected';
    else control = `control ${canary.control.status}`;
  }
  return `${completed}/${required}; ${sensor}; ${control}`;
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
    '## Attribution coverage',
    '',
    `Sensors matched: **${report.attribution?.sensorsMatched ?? 0}/${report.attribution?.sensorsConfigured ?? 0}**  `,
    `Sensors missing: **${report.attribution?.sensorsMissing ?? 0}**  `,
    `Sensors unattributed at baseline: **${report.attribution?.sensorsUnattributed ?? 0}**  `,
    `Exit-only canaries: **${report.attribution?.exitOnly ?? 0}**  `,
    `Matched controls passed: **${report.attribution?.controlsPassed ?? 0}/${report.attribution?.controlsConfigured ?? 0}**  `,
    `Matched controls rejected: **${report.attribution?.controlsRejected ?? 0}**  `,
    `Matched controls inconclusive: **${report.attribution?.controlsInconclusive ?? 0}**  `,
    `Matched controls not run: **${report.attribution?.controlsNotRun ?? 0}**`,
    '',
    '## Experiments',
    ''
  ];

  for (const guard of report.guards) {
    lines.push(`### ${ICON[guard.status]} ${escapeHeading(guard.name)}`, '');
    lines.push(`Command: \`${escapeInlineCode(guard.command)}\``, '');
    if (guard.reason) lines.push(`_${guard.reason}_`, '');
    if (guard.canaries.length > 0) {
      lines.push('| Canary | Mutation | Target | Evidence | Result | Reason |');
      lines.push('| --- | --- | --- | --- | --- | --- |');
      for (const canary of guard.canaries) {
        lines.push(
          `| ${escapeCell(canary.name)} | \`${escapeCell(canary.type)}\` | \`${escapeCell(canary.target)}\` | ${escapeCell(evidenceSummary(canary))} | ${ICON[canary.status]} \`${canary.status.toUpperCase()}\` | ${escapeCell(canary.reason)} |`
        );
      }
      lines.push('');
    }
  }

  lines.push(
    '## What this proves',
    '',
    'An **ALIVE** result proves only that the configured command returned a non-zero exit code for that exact planted violation in this commit. When a sensor is configured, it also proves that the declared literal signal was absent from every bounded clean-control capture and appeared in every bounded mutation capture. When a matched control is configured, ALIVE additionally requires a near-identical neutral mutation to pass consistently. This tests specificity; it does not establish semantic equivalence between the control and the violation or prove overall correctness, security, test quality, or coverage.',
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
        properties: {
          guard: guard.id,
          canary: canary.id,
          mutation: canary.type,
          confirmationRuns: canary.confirmation?.requiredRuns ?? 1,
          sensorConfigured: canary.sensor?.configured ?? false,
          sensorBaselineClear: canary.sensor?.baselineClear ?? null,
          sensorBaselineMatchedRuns: canary.sensor?.baselineMatchedRuns ?? 0,
          sensorMutationMatchedRuns: canary.sensor?.mutationMatchedRuns ?? 0,
          sensorMatched: canary.sensor?.matched ?? null,
          controlConfigured: canary.control?.configured ?? false,
          controlStatus: canary.control?.status ?? 'not-configured',
          controlPassedRuns: canary.control?.passedRuns ?? 0
        }
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

export function buildJUnit(report) {
  const cases = [];
  for (const guard of report.guards) {
    if (guard.canaries.length === 0) {
      const detail = escapeXml(guard.reason || guard.status);
      if (guard.status === STATUS.INCONCLUSIVE) {
        cases.push(`  <testcase classname="${escapeXml(guard.id)}" name="clean baseline"><skipped message="${detail}"/></testcase>`);
      } else if (guard.status === STATUS.BROKEN || guard.status === STATUS.DEAD) {
        cases.push(`  <testcase classname="${escapeXml(guard.id)}" name="clean baseline"><failure message="${detail}"/></testcase>`);
      } else {
        cases.push(`  <testcase classname="${escapeXml(guard.id)}" name="clean baseline"/>`);
      }
      continue;
    }
    for (const canary of guard.canaries) {
      const attrs = `classname="${escapeXml(guard.id)}" name="${escapeXml(canary.id)}"`;
      const detail = escapeXml(canary.reason || canary.status);
      if (canary.status === STATUS.ALIVE) cases.push(`  <testcase ${attrs}/>`);
      else if (canary.status === STATUS.INCONCLUSIVE) cases.push(`  <testcase ${attrs}><skipped message="${detail}"/></testcase>`);
      else cases.push(`  <testcase ${attrs}><failure message="${detail}"/></testcase>`);
    }
  }
  const tests = cases.length;
  const failures = report.counts.dead + report.counts.broken;
  const skipped = report.counts.inconclusive;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="RuleTrip" tests="${tests}" failures="${failures}" skipped="${skipped}">\n${cases.join('\n')}\n</testsuite>\n`;
}

export async function writeReports(root, reportDir, report) {
  const relative = normalizeRelativePath(reportDir, 'report directory');
  const { absolute: directory } = await resolveRepositoryPath(root, relative, 'report directory');
  await fs.mkdir(directory, { recursive: true });

  const paths = {
    json: path.join(directory, 'ruletrip-report.json'),
    markdown: path.join(directory, 'ruletrip-summary.md'),
    sarif: path.join(directory, 'ruletrip-results.sarif'),
    junit: path.join(directory, 'ruletrip-results.junit.xml')
  };
  const markdownText = buildMarkdown(report);
  await Promise.all([
    fs.writeFile(paths.json, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    fs.writeFile(paths.markdown, markdownText, 'utf8'),
    fs.writeFile(paths.sarif, `${JSON.stringify(buildSarif(report), null, 2)}\n`, 'utf8'),
    fs.writeFile(paths.junit, buildJUnit(report), 'utf8')
  ]);
  return { ...paths, markdownText };
}
