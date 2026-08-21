import fs from 'node:fs/promises';
import {
  DEFAULT_CONFIG,
  DEFAULT_REPORT_DIR
} from './constants.js';
import { loadConfig } from './config.js';
import { runRuleTrip, shouldFail } from './engine.js';
import { findGitRoot } from './git.js';
import { parseFailOn } from './cli.js';
import { writeReports } from './reports.js';

function input(name, fallback) {
  return process.env[`INPUT_${name.toUpperCase()}`]?.trim() || fallback;
}

function escapeWorkflowCommand(value) {
  return String(value)
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
}

async function appendEnvironmentFile(file, lines) {
  if (!file) return;
  await fs.appendFile(file, `${lines.join('\n')}\n`, 'utf8');
}

async function setOutputs(report, reports) {
  await appendEnvironmentFile(process.env.GITHUB_OUTPUT, [
    `conclusion=${report.conclusion}`,
    `alive=${report.counts.alive}`,
    `dead=${report.counts.dead}`,
    `broken=${report.counts.broken}`,
    `inconclusive=${report.counts.inconclusive}`,
    `sensors_configured=${report.attribution.sensorsConfigured}`,
    `sensors_matched=${report.attribution.sensorsMatched}`,
    `sensors_missing=${report.attribution.sensorsMissing}`,
    `sensors_unattributed=${report.attribution.sensorsUnattributed}`,
    `exit_only=${report.attribution.exitOnly}`,
    `controls_configured=${report.attribution.controlsConfigured}`,
    `controls_passed=${report.attribution.controlsPassed}`,
    `controls_rejected=${report.attribution.controlsRejected}`,
    `controls_inconclusive=${report.attribution.controlsInconclusive}`,
    `controls_not_run=${report.attribution.controlsNotRun}`,
    `json_report=${reports.json}`,
    `sarif_report=${reports.sarif}`,
    `junit_report=${reports.junit}`,
    `markdown_report=${reports.markdown}`
  ]);
}

async function main() {
  if (process.env.GITHUB_EVENT_NAME === 'pull_request_target') {
    throw new Error(
      'RuleTrip refuses pull_request_target because repository-configured commands would run in a privileged context. Use pull_request instead.'
    );
  }

  const root = await findGitRoot(process.env.GITHUB_WORKSPACE || process.cwd());
  const configPath = input('config', DEFAULT_CONFIG);
  const reportDir = input('report_dir', DEFAULT_REPORT_DIR);
  const failOn = parseFailOn(input('fail_on', undefined));
  const { config, path: loadedPath } = await loadConfig(root, configPath);
  const report = await runRuleTrip({
    root,
    config,
    configPath: loadedPath,
    progress: (event) => {
      const name = event.phase === 'baseline' ? event.guard.name : event.canary.name;
      process.stdout.write(`RuleTrip ${event.phase}: ${name.replaceAll('\r', ' ').replaceAll('\n', ' ')}\n`);
    }
  });
  const reports = await writeReports(root, reportDir, report);
  await setOutputs(report, reports);
  await appendEnvironmentFile(process.env.GITHUB_STEP_SUMMARY, [reports.markdownText]);

  process.stdout.write(
    `RuleTrip ${report.conclusion.toUpperCase()}: ${JSON.stringify(report.counts)}\n`
  );
  if (shouldFail(report, failOn)) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`::error title=RuleTrip failed::${escapeWorkflowCommand(error.message)}\n`);
  process.exitCode = 2;
});
