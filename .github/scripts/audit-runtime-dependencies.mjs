// Fails when a package that ends up in the browser bundle has a high or critical advisory.
//
// `pnpm audit` on a Create React App project reports the whole build toolchain
// (react-scripts brings hundreds of packages) and is red all the time, which
// teaches everyone to ignore it. The packages that ship to users are the direct
// dependencies of the app; those are gated. The toolchain is summarised, not gated.
//
// pnpm 10 answers with a map of advisories, each naming the dependency paths that reach the
// vulnerable package (".>react-router-dom>react-router"): the second segment is the direct
// dependency. npm's v2 report, which a later pnpm may answer with, is a map of packages with
// a severity for every package that is affected, direct dependencies included. Both are read.
// An answer that is neither (an error, another schema) stops the job with exit code 2: it is
// never taken for "nothing found".
//
//   node ../.github/scripts/audit-runtime-dependencies.mjs      (from frontend/)
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const BUILD_TOOLS = ['react-scripts'];
// the severities that block, the worse one with the higher rank
const GATED = { high: 1, critical: 2 };

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const runtime = Object.keys(manifest.dependencies || {}).filter(
  (name) => !BUILD_TOOLS.includes(name) && !name.startsWith('@testing-library/'),
);

function stop(message, detail) {
  console.error(`::error::${message}`);
  if (detail) console.error(detail);
  process.exit(2);
}

let raw;
try {
  // on Windows pnpm is a .cmd shim, which needs a shell
  raw = execFileSync('pnpm', ['audit', '--prod', '--json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
} catch (error) {
  raw = error.stdout; // pnpm audit exits 1 when it finds something
}

let report;
try {
  report = JSON.parse(raw);
} catch (error) {
  stop('pnpm audit did not answer with a report (is the registry reachable?)', String(raw).slice(0, 500));
}

const isMap = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
if (!isMap(report)) {
  stop('pnpm audit did not answer with a report', String(raw).slice(0, 500));
}
if (report.error) {
  stop('pnpm audit answered with an error', JSON.stringify(report.error).slice(0, 500));
}
if (!isMap(report.advisories) && !isMap(report.vulnerabilities)) {
  stop(
    'pnpm audit answered with a report that has neither "advisories" nor "vulnerabilities"',
    `keys: ${Object.keys(report).join(', ') || '(none)'}`,
  );
}

// the direct runtime dependencies that reach a package with a high or critical advisory:
// (direct dependency, vulnerable package) -> the worst severity found
const reached = new Map();
const reach = (direct, module, severity) => {
  if (!runtime.includes(direct) || !Object.hasOwn(GATED, severity)) return;
  const key = `${direct}>${module}`;
  const known = reached.get(key);
  if (!known || GATED[severity] > GATED[known.severity]) {
    reached.set(key, { direct, module, severity });
  }
};

Object.values(report.advisories || {}).forEach((advisory) => {
  (advisory.findings || []).forEach((finding) => {
    (finding.paths || []).forEach((path) => {
      if (typeof path === 'string') reach(path.split('>')[1], advisory.module_name, advisory.severity);
    });
  });
});

Object.entries(report.vulnerabilities || {}).forEach(([name, entry]) => {
  // `via` names the vulnerable package for a direct dependency that is only affected through it
  const through = (entry.via || []).find((item) => isMap(item) && item.name);
  reach(name, through ? through.name : name, entry.severity);
});

const blocking = [...reached.values()];
const blockedPackages = [...new Set(blocking.map((entry) => entry.direct))];

const totals = report.metadata?.vulnerabilities ?? {};
const lines = [
  '### Frontend dependency audit',
  '',
  `Packages that ship in the bundle (${runtime.length}): ` +
    (blockedPackages.length
      ? `**${blockedPackages.length} with a high or critical advisory**`
      : 'no high or critical advisory'),
  '',
  `Build toolchain (not gated, react-scripts): ${totals.critical ?? 0} critical, ${totals.high ?? 0} high, ` +
    `${totals.moderate ?? 0} moderate, ${totals.low ?? 0} low`,
];
blocking.forEach(({ direct, module, severity }) =>
  lines.push(`- ${direct}${module === direct ? '' : ` (through ${module})`}: ${severity}`),
);

console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}

if (blockedPackages.length) {
  console.error(`::error::advisories in packages that ship to users: ${blockedPackages.join(', ')}`);
  process.exit(1);
}
