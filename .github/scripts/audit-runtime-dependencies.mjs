// Fails when a package that ends up in the browser bundle has a high or critical advisory.
//
// `pnpm audit` on a Create React App project reports the whole build toolchain
// (react-scripts brings hundreds of packages) and is red all the time, which
// teaches everyone to ignore it. The packages that ship to users are the direct
// dependencies of the app; those are gated. The toolchain is summarised, not gated.
//
// For every advisory pnpm names the dependency paths that reach the vulnerable package
// (".>react-router-dom>react-router"): the second segment is the direct dependency, and
// that is what is gated.
//
//   node ../.github/scripts/audit-runtime-dependencies.mjs      (from frontend/)
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

const BUILD_TOOLS = ['react-scripts'];
const GATED = new Set(['high', 'critical']);

const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
const runtime = Object.keys(manifest.dependencies || {}).filter(
  (name) => !BUILD_TOOLS.includes(name) && !name.startsWith('@testing-library/'),
);

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
  console.error('::error::pnpm audit did not answer with a report (is the registry reachable?)');
  console.error(String(raw).slice(0, 500));
  process.exit(2);
}

// the direct runtime dependencies that reach a package with a high or critical advisory
const reached = new Map();
Object.values(report.advisories || {})
  .filter((advisory) => GATED.has(advisory.severity))
  .forEach((advisory) => {
    (advisory.findings || []).forEach((finding) => {
      (finding.paths || []).forEach((path) => {
        const direct = path.split('>')[1];
        if (runtime.includes(direct)) {
          reached.set(`${direct}>${advisory.module_name}`, {
            direct,
            module: advisory.module_name,
            severity: advisory.severity,
          });
        }
      });
    });
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
