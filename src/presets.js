const TEST_CANARY = (testDirectory) => ({
  id: 'failing-test',
  name: 'A deliberately failing test is discovered',
  type: 'create',
  path: `${testDirectory}/ruletrip-canary.test.js`,
  content: "import test from 'node:test';\nimport assert from 'node:assert/strict';\n\ntest('RuleTrip planted failure', () => {\n  assert.fail('RULETRIP_CANARY: deliberate failure');\n});\n",
  sensor: { stream: 'combined', includes: 'RULETRIP_CANARY: deliberate failure' },
  control: {
    type: 'create',
    path: `${testDirectory}/ruletrip-canary.test.js`,
    content: "import test from 'node:test';\nimport assert from 'node:assert/strict';\n\ntest('RuleTrip neutral control', () => {\n  assert.equal('RULETRIP_CANARY: deliberate failure'.startsWith('RULETRIP_CANARY'), true);\n});\n"
  }
});

const PACKS = Object.freeze([
  Object.freeze({
    id: 'test',
    name: 'Test discovery',
    description: 'Plants a deliberately failing Node test so a test guard can prove it discovers and rejects it.',
    scriptNames: ['test'],
    buildCanary: ({ testDirectory }) => TEST_CANARY(testDirectory)
  }),
  Object.freeze({
    id: 'typecheck',
    name: 'Type-check discovery',
    description: 'Plants a TypeScript assignment error for type-check guards that include repository TypeScript sources.',
    scriptNames: ['typecheck', 'type-check', 'check:types', 'check-types'],
    buildCanary: () => ({
      id: 'type-error',
      name: 'A deliberate TypeScript type error is rejected',
      type: 'create',
      path: 'ruletrip-canary.ts',
      content: "const ruletripCanary: string = 42;\nexport { ruletripCanary };\n",
      sensor: { stream: 'combined', includes: 'ruletrip-canary.ts' },
      control: {
        type: 'create',
        path: 'ruletrip-canary.ts',
        content: "const ruletripCanary: string = 'RULETRIP_CANARY';\nexport { ruletripCanary };\n"
      }
    })
  }),
  Object.freeze({
    id: 'lint',
    name: 'Lint discovery',
    description: 'Plants syntactically invalid JavaScript so parsers/linters that include repository JavaScript must reject it.',
    scriptNames: ['lint'],
    buildCanary: () => ({
      id: 'syntax-error',
      name: 'A deliberate JavaScript syntax error is rejected',
      type: 'create',
      path: 'ruletrip-canary-lint.js',
      content: 'const = RULETRIP_CANARY;\n',
      sensor: { stream: 'combined', includes: 'ruletrip-canary-lint.js' },
      control: {
        type: 'create',
        path: 'ruletrip-canary-lint.js',
        content: 'const RULETRIP_CANARY = true;\nexport { RULETRIP_CANARY };\n'
      }
    })
  }),
  Object.freeze({
    id: 'workflow-pin',
    name: 'Workflow pin policy',
    description: 'Plants an inert workflow containing an intentionally unpinned action reference for workflow-policy scanners.',
    scriptNames: ['check:workflows', 'workflow:check', 'lint:workflows', 'actionlint'],
    buildCanary: () => ({
      id: 'unpinned-action',
      name: 'An intentionally unpinned workflow action is rejected',
      type: 'create',
      path: '.github/workflows/ruletrip-unpinned-canary.yml',
      content: "name: RuleTrip inert workflow-pin canary\non: workflow_dispatch\npermissions: {}\njobs:\n  canary:\n    if: ${{ false }}\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@main\n",
      sensor: { stream: 'combined', includes: 'ruletrip-unpinned-canary.yml' },
      control: {
        type: 'create',
        path: '.github/workflows/ruletrip-unpinned-canary.yml',
        content: "name: RuleTrip inert workflow-pin control\non: workflow_dispatch\npermissions: {}\njobs:\n  canary:\n    if: ${{ false }}\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n"
      }
    })
  }),
  Object.freeze({
    id: 'policy',
    name: 'Repository policy scanner',
    description: 'Plants an inert forbidden-marker file for repository policy scanners configured to reject it.',
    scriptNames: ['policy', 'policy:check', 'check:policy'],
    buildCanary: () => ({
      id: 'forbidden-marker',
      name: 'A deliberate repository policy marker is rejected',
      type: 'create',
      path: '.ruletrip-policy-canary',
      content: 'RULETRIP_FORBIDDEN_CANARY\n'
    })
  })
]);

function firstScript(scripts, names) {
  for (const name of names) {
    if (typeof scripts?.[name] === 'string' && scripts[name].trim()) return name;
  }
  return null;
}

export function listCanaryPacks() {
  return PACKS.map((pack) => ({
    id: pack.id,
    name: pack.name,
    description: pack.description,
    scriptNames: [...pack.scriptNames]
  }));
}

export function discoverCanaryPacks(packageJson, { testDirectory = 'test' } = {}) {
  const scripts = packageJson?.scripts ?? {};
  const guards = [];
  const discoveries = [];

  for (const pack of PACKS) {
    const scriptName = firstScript(scripts, pack.scriptNames);
    if (!scriptName) continue;
    const command = `npm run ${scriptName}`;
    guards.push({
      id: pack.id === 'test' ? 'tests' : pack.id,
      name: pack.name,
      command: scriptName === 'test' ? 'npm test' : command,
      canaries: [pack.buildCanary({ testDirectory })]
    });
    discoveries.push({
      pack: pack.id,
      command: scriptName === 'test' ? 'npm test' : command,
      commandSource: `package.json scripts.${scriptName}`
    });
  }

  return { guards, discoveries };
}

export function buildManualStarterGuard(testDirectory = 'test') {
  return {
    id: 'tests',
    name: 'Test discovery',
    command: 'REPLACE_WITH_YOUR_GUARD_COMMAND',
    canaries: [TEST_CANARY(testDirectory)]
  };
}
