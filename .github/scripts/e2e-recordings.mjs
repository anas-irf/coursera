// Describes the recordings of a browser-spec run: what the pull request comment says.
//
// Reads the CTRF report of the run and counts the videos Playwright left behind, then writes one
// short Markdown text: to the job summary (so a fork's pull request has it too) and as the step
// output `comment`, which the "recordings" job of ci.yml posts as a sticky comment. It runs after
// the evidence is uploaded, because the text links to that artifact.
//
//   ARTIFACT_ID              id of the uploaded artifact (steps.<id>.outputs.artifact-id)
//   EVIDENCE_RETENTION_DAYS  how long the artifact is kept (default 14), set once for the job
//   TESTED_SHA               the commit the specs ran against
//   E2E_DIR                  where the specs live (default e2e)
//
//   node .github/scripts/e2e-recordings.mjs      (from the repository root)
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const MAX_LISTED = 10;

const e2eDir = process.env.E2E_DIR || 'e2e';
const retentionDays = Number(process.env.EVIDENCE_RETENTION_DAYS) || 14;
const sha = (process.env.TESTED_SHA || '').slice(0, 7);
const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repository, GITHUB_RUN_ID: runId } = process.env;
const runUrl = server && repository && runId ? `${server}/${repository}/actions/runs/${runId}` : null;
// built from the numeric id, so that nothing else can end up in the link
const artifactUrl =
  runUrl && /^\d+$/.test(process.env.ARTIFACT_ID || '') ? `${runUrl}/artifacts/${process.env.ARTIFACT_ID}` : null;

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function readTests() {
  try {
    const report = JSON.parse(readFileSync(path.join(e2eDir, 'ctrf', 'playwright.json'), 'utf8'));
    return report.results.tests;
  } catch {
    return null; // the run died before the reporter wrote its file
  }
}

function countVideos(directory) {
  if (!existsSync(directory)) return 0;
  return readdirSync(directory, { recursive: true }).filter((file) => String(file).endsWith('.webm')).length;
}

// A spec's name as inline code. The names come from the code of the pull request: inside a code
// span nothing turns into a mention, a link or a table cell.
function label(test) {
  const name = [...(test.suite || []), test.name].join(' › ').replace(/\s+/g, ' ').replaceAll('`', "'");
  return `\`${name.length > 160 ? `${name.slice(0, 159)}…` : name}\``;
}

function list(title, tests) {
  if (tests.length === 0) return [];
  const shown = tests.slice(0, MAX_LISTED).map((test) => `- ${label(test)}`);
  if (tests.length > MAX_LISTED) shown.push(`- … and ${tests.length - MAX_LISTED} more`);
  return ['', `**${title}**`, '', ...shown];
}

const tests = readTests();
const failed = (tests || []).filter((test) => test.status === 'failed');
const flaky = (tests || []).filter((test) => test.status === 'passed' && test.flaky);
const skipped = (tests || []).filter((test) => test.status === 'skipped' || test.status === 'pending');

let verdict;
if (tests === null) verdict = '⚠️ **The run wrote no test report**';
else if (tests.length === 0) verdict = '⚠️ **No spec ran**';
else if (failed.length > 0) verdict = `❌ **${failed.length} of ${count(tests.length, 'spec')} failed**`;
else if (flaky.length > 0) verdict = `⚠️ **${count(tests.length, 'spec')} passed, ${flaky.length} only on the retry**`;
else verdict = `✅ **${count(tests.length, 'spec')} passed**`;

const recordings = countVideos(path.join(e2eDir, 'test-results'));
const facts = [verdict, count(recordings, 'recording')];
if (skipped.length > 0) facts.push(`${skipped.length} skipped`);
if (sha) facts.push(`\`${sha}\``);

const expiry = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000));

const lines = ['### 🎬 Browser specs: recordings', '', facts.join(' · ')];
if (artifactUrl) {
  lines.push('', `**[Download the Playwright report and videos](${artifactUrl})**`);
} else if (runUrl) {
  lines.push('', `**[Open the workflow run](${runUrl})** and download \`playwright-evidence\` under *Artifacts*.`);
}
lines.push(
  '',
  'Unzip it and open `playwright-report/index.html`: the report plays the video of every spec ' +
    'next to its steps. The videos are also plain files in `test-results/`. ' +
    `Kept until **${expiry}**${runUrl ? ` ([workflow run](${runUrl}))` : ''}.`,
  ...list('Failed', failed),
  ...list('Passed only on the retry', flaky),
);

const text = lines.join('\n');
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
if (process.env.GITHUB_OUTPUT) {
  const delimiter = `EOF_${randomUUID()}`;
  appendFileSync(process.env.GITHUB_OUTPUT, `comment<<${delimiter}\n${text}\n${delimiter}\n`);
}
