export const VERSION = '0.1.0';

export const STATUS = Object.freeze({
  ALIVE: 'alive',
  DEAD: 'dead',
  BROKEN: 'broken',
  INCONCLUSIVE: 'inconclusive',
  NOT_RUN: 'not_run'
});

export const STATUS_ORDER = Object.freeze([
  STATUS.BROKEN,
  STATUS.DEAD,
  STATUS.INCONCLUSIVE,
  STATUS.ALIVE
]);

export const DEFAULT_CONFIG = '.ruletrip.json';
export const DEFAULT_REPORT_DIR = 'ruletrip-report';
export const DEFAULT_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;
export const DEFAULT_FAIL_ON = Object.freeze([
  STATUS.DEAD,
  STATUS.BROKEN,
  STATUS.INCONCLUSIVE
]);
