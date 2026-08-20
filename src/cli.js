#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_CONFIG,
  DEFAULT_FAIL_ON,
  DEFAULT_REPORT_DIR,
  STATUS,
  VERSION
} from './constants.js';
import { compareReportFiles, formatComparison } from './compare.js';
import { loadConfig } from './config.js';
import { runRuleTrip, shouldFail } from './engine.js';
import { findGitRoot } from './git.js';
import { buildStarterConfig, createStarterConfig } from './init.js';
import { listCanaryPacks } from './presets.js';
import { writeReports } from './reports.js';

const HELP = `RuleTrip ${VERSION}

Mutation testing for repository guardrails.

Usage:
  ruletrip init [--force] [--dry-run]
  ruletrip presets
  ruletrip run [--config PATH] [--report-dir PATH] [--fail-on LIST]
  ruletrip list [--config PATH]
  ruletrip compare --before REPORT.json --after REPORT.json [--fail-on-regression] [--json]
  ruletrip --version

Outcomes:
  ALIVE         the guard rejected the planted violation
  DEAD          the guard returned zero after the planted violation
  BROKEN        the clean baseline failed
  INCONCLUSIVE  the experiment could not be classified safely
`;

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--force') options.force = true;
    else if (token === '--dry-run') options.dry_run = true;
    else if (token === '--fail-on-regression') options.fail_on_regression = true;
    else if (token === '--json') options.json = true;
    else if (
      token === '--config' ||
      token === '--report-dir' ||
      token === '--fail-on' ||
      token === '--before' ||
      token === '--after'
    ) {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${token} requires a value`);
      options[token.slice(2).replaceAll('-', '_')] = value;
      index += 1;
    } else {
      throw new Error(`unknown option: ${token}`);
    }
  }
  return options;
}

function rejectOptions(options, allowed, command) {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(options).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0) throw new Error(`option --${unknown[0].replaceAll('_', '-')} is not valid with ${command}`);
}

export function parseFailOn(value = DEFAULT_FAIL_ON.join(',')) {
  const allowed = new Set([STATUS.DEAD, STATUS.BROKEN, STATUS.INCONCLUSIVE]);
  const values = value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (values.length === 0 || values.some((item) => !allowed.has(item))) {
    throw new Error('--fail-on accepts a comma-separated subset of dead,broken,inconclusive');
  }
  return [...new Set(values)];
}

function printProgress(event) {
  if (event.phase === 'baseline') {
    process.stdout.write(`\n[baseline] ${event.guard.name}\n`);
  } else {
    process.stdout.write(`[canary]   ${event.canary.name}\n`);
  }
}

function printResult(report) {
  const counts = report.counts;
  process.stdout.write(
    `\nRuleTrip: ${report.conclusion.toUpperCase()} | alive ${counts.alive} | dead ${counts.dead} | broken ${counts.broken} | inconclusive ${counts.inconclusive}\n`
  );
  process.stdout.write(
    `Attribution: sensors ${report.attribution.sensorsMatched}/${report.attribution.sensorsConfigured} attributed | missing ${report.attribution.sensorsMissing} | baseline-unattributed ${report.attribution.sensorsUnattributed} | exit-only ${report.attribution.exitOnly}\n`
  );
  for (const guard of report.guards) {
    process.stdout.write(`- ${guard.status.toUpperCase()} ${guard.name}${guard.reason ? ` — ${guard.reason}` : ''}\n`);
    for (const canary of guard.canaries) {
      process.stdout.write(`  - ${canary.status.toUpperCase()} ${canary.name} — ${canary.reason}\n`);
    }
  }
}

function printDiscovery(discovery) {
  if (discovery.guards.length === 0) {
    process.stdout.write(`Detected guard command: ${discovery.command}\n`);
    process.stdout.write(`Command source: ${discovery.commandSource}\n`);
    return;
  }
  process.stdout.write(`Detected ${discovery.guards.length} guard preset${discovery.guards.length === 1 ? '' : 's'}:\n`);
  for (const guard of discovery.guards) {
    process.stdout.write(`- ${guard.pack}: ${guard.command} (${guard.commandSource})\n`);
  }
}

function printInitPreview(starter) {
  process.stdout.write('RuleTrip init preview\n');
  printDiscovery(starter.discovery);
  process.stdout.write(`Detected test directory: ${starter.discovery.testDirectory}\n\n`);
  process.stdout.write(`${JSON.stringify(starter.config, null, 2)}\n`);
  process.stdout.write('\nPreview only: no files written.\n');
}

function printPresets() {
  process.stdout.write('RuleTrip canary packs\n');
  for (const pack of listCanaryPacks()) {
    process.stdout.write(`\n${pack.id}: ${pack.name}\n`);
    process.stdout.write(`  ${pack.description}\n`);
    process.stdout.write(`  detected scripts: ${pack.scriptNames.join(', ')}\n`);
  }
}

export async function runCli(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  if (argv[0] === '--version' || argv[0] === '-v') {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  const command = argv[0];
  const options = parseOptions(argv.slice(1));

  if (command === 'presets') {
    rejectOptions(options, [], command);
    printPresets();
    return 0;
  }

  if (command === 'compare') {
    rejectOptions(options, ['before', 'after', 'fail_on_regression', 'json'], command);
    if (!options.before || !options.after) throw new Error('compare requires --before and --after report paths');
    const comparison = await compareReportFiles(options.before, options.after);
    process.stdout.write(options.json ? `${JSON.stringify(comparison, null, 2)}\n` : formatComparison(comparison));
    return options.fail_on_regression && comparison.counts.regression > 0 ? 1 : 0;
  }

  if (command === 'init') {
    rejectOptions(options, ['force', 'dry_run'], command);
    if (options.dry_run && options.force) throw new Error('--dry-run and --force cannot be used together');
  } else if (command === 'run') {
    rejectOptions(options, ['config', 'report_dir', 'fail_on'], command);
  } else if (command === 'list') {
    rejectOptions(options, ['config'], command);
  } else {
    throw new Error(`unknown command: ${command}`);
  }

  const root = await findGitRoot();

  if (command === 'init') {
    if (options.dry_run) {
      const starter = await buildStarterConfig(root);
      printInitPreview(starter);
      return 0;
    }

    const result = await createStarterConfig(root, options);
    process.stdout.write(`Created ${path.relative(root, result.path)}\n`);
    printDiscovery(result.discovery);
    if (result.needsCommand) {
      process.stdout.write('Replace REPLACE_WITH_YOUR_GUARD_COMMAND before running RuleTrip.\n');
    }
    return 0;
  }

  const configPath = options.config ?? DEFAULT_CONFIG;
  const { config, path: loadedPath } = await loadConfig(root, configPath);
  if (command === 'list') {
    for (const guard of config.guards) {
      process.stdout.write(`${guard.id}: ${guard.name} (${guard.canaries.length} canaries)\n`);
      for (const canary of guard.canaries) {
        process.stdout.write(`  ${canary.id}: ${canary.type} ${canary.path}\n`);
      }
    }
    return 0;
  }

  const failOn = parseFailOn(options.fail_on);
  const report = await runRuleTrip({ root, config, configPath: loadedPath, progress: printProgress });
  const reports = await writeReports(root, options.report_dir ?? DEFAULT_REPORT_DIR, report);
  printResult(report);
  process.stdout.write(`Reports: ${path.relative(root, reports.markdown)}\n`);
  return shouldFail(report, failOn) ? 1 : 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runCli().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`RuleTrip error: ${error.message}\n`);
      process.exitCode = 2;
    }
  );
}
