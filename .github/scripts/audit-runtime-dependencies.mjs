// Fails when a package that ends up in the browser bundle has a high or critical advisory.
//
// `npm audit` on a Create React App project reports the whole build toolchain
// (react-scripts brings hundreds of packages) and is red all the time, which
// teaches everyone to ignore it. The packages that ship to users are the direct
// dependencies of the app; those are gated. The toolchain is summarised, not gated.
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
  raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8', shell: true });
} catch (error) {
  raw = error.stdout; // npm audit exits 1 when it finds something
}
const report = JSON.parse(raw);
const vulnerabilities = report.vulnerabilities || {};

const blocking = runtime
  .filter((name) => vulnerabilities[name] && GATED.has(vulnerabilities[name].severity))
  .map((name) => ({ name, severity: vulnerabilities[name].severity }));

const totals = report.metadata?.vulnerabilities ?? {};
const lines = [
  '### Frontend dependency audit',
  '',
  `Packages that ship in the bundle (${runtime.length}): ` +
    (blocking.length ? `**${blocking.length} with a high or critical advisory**` : 'no high or critical advisory'),
  '',
  `Build toolchain (not gated, react-scripts): ${totals.critical ?? 0} critical, ${totals.high ?? 0} high, ` +
    `${totals.moderate ?? 0} moderate, ${totals.low ?? 0} low`,
];
blocking.forEach(({ name, severity }) => lines.push(`- ${name}: ${severity}`));

console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}

if (blocking.length) {
  console.error(`::error::advisories in packages that ship to users: ${blocking.map((b) => b.name).join(', ')}`);
  process.exit(1);
}
