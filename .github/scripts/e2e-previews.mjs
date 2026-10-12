// Makes animated previews of the browser-spec recordings: what the pull request comment shows.
//
// GitHub plays no video that a workflow could upload, but it shows an animated image. WebP is
// the format for it: a recording is ~100 KB at its full 1280 px (its GIF at 800 px is more than
// twice that), in full colour, and raw.githubusercontent.com serves it as an image, so a click on
// the preview opens it big in the browser tab (release assets are always served as downloads,
// and GitHub plays no MP4 or WebM that comes from a repository).
//
// This runs in a job of its own without write permissions: ffmpeg decodes files that the code
// of the pull request produced, so it does not share a job with a write token. The job that
// holds the token only publishes the images written here, after checking their names, sizes and
// headers.
//
// Reads  <E2E_DIR>/ctrf/playwright.json and the videos under <E2E_DIR>/test-results
// Writes <OUT_DIR>/NN-<spec>.webp and <OUT_DIR>/previews.md. The Markdown names every image as
// {{BASE}}NN-<spec>.webp: the publishing job puts the address they are published under there.
//
//   E2E_DIR   where the specs live (default e2e)
//   OUT_DIR   where the previews go (default previews)
//   FFMPEG    the ffmpeg binary (default ffmpeg)
//
//   node .github/scripts/e2e-previews.mjs      (from the repository root)
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const MAX_PREVIEWS = 40; // a comment of more than that is not read, and GitHub caps its size
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const MAX_SECONDS = 4 * 60; // for the whole job: the rest of the specs go without a preview
const HOLD_SECONDS = 1.2; // the last frame stays on screen so that the end state can be read
// tried in order until the image fits; never larger than the recording itself
const RECIPES = [
  { width: 1280, fps: 10, quality: 70 },
  { width: 960, fps: 8, quality: 60 },
  { width: 640, fps: 6, quality: 50 },
];
const ICON = { passed: '✅', flaky: '⚠️', failed: '❌' };

const e2eDir = path.resolve(process.env.E2E_DIR || 'e2e');
const outDir = path.resolve(process.env.OUT_DIR || 'previews');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const started = Date.now();

// text that people read in the comment: nothing in it may become markup, a mention or a
// cross-reference (the names come from the code of the pull request)
const text = (value) =>
  String(value)
    .replace(/\s+/g, ' ')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('@', '@​')
    .replaceAll('#', '#​');

const slugOf = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/, '') || 'spec';

// the video of the last attempt, else of an earlier one, as a path below <E2E_DIR>/test-results
function videoOf(test) {
  for (const attempt of [test, ...[...(test.retryAttempts || [])].reverse()]) {
    const video = (attempt.attachments || []).find((a) => a.name === 'video' && a.path);
    if (!video) continue;
    const posix = video.path.replaceAll('\\', '/');
    const at = posix.lastIndexOf('/test-results/');
    if (at < 0) continue;
    const resolved = path.resolve(e2eDir, posix.slice(at + 1));
    if (resolved.startsWith(path.join(e2eDir, 'test-results') + path.sep)) return resolved;
  }
  return null;
}

function convert(video, image) {
  for (const { width, fps, quality } of RECIPES) {
    const filter =
      `fps=${fps},scale='min(${width},iw)':-2:flags=lanczos,` +
      `tpad=stop_mode=clone:stop_duration=${HOLD_SECONDS}`;
    const args = ['-v', 'error', '-y', '-i', video, '-vf', filter];
    args.push('-c:v', 'libwebp_anim', '-quality', String(quality), '-compression_level', '4');
    args.push('-loop', '0', '-f', 'webp', image);
    execFileSync(ffmpeg, args, { stdio: 'pipe', timeout: 60_000 });
    if (statSync(image).size <= MAX_IMAGE_BYTES) return true;
  }
  rmSync(image, { force: true });
  return false;
}

const report = JSON.parse(readFileSync(path.join(e2eDir, 'ctrf', 'playwright.json'), 'utf8'));
const specs = report.results.tests
  .map((test, index) => {
    const file = (test.suite || [])[1] || path.basename(test.filePath || 'spec');
    const status = test.status === 'failed' ? 'failed' : test.flaky ? 'flaky' : 'passed';
    const title = [...(test.suite || []).slice(2), test.name].join(' › ');
    const number = String(index + 1).padStart(2, '0');
    const slug = slugOf([file.replace(/\.spec\.[cm]?[jt]s$/, ''), title].join(' '));
    return { test, file, status, title, name: `${number}-${slug}.webp`, video: videoOf(test) };
  })
  .filter((spec) => spec.video);

// failures are the ones worth watching: they come first when not everything fits
const order = { failed: 0, flaky: 1, passed: 2 };
const candidates = [...specs].sort((a, b) => order[a.status] - order[b.status]).slice(0, MAX_PREVIEWS);

mkdirSync(outDir, { recursive: true });
const made = new Set();
const skipped = [];
let total = 0;
let largest = 0;
for (const spec of candidates) {
  const image = path.join(outDir, spec.name);
  try {
    if (Date.now() - started > MAX_SECONDS * 1000) throw new Error('out of time');
    if (!convert(spec.video, image)) throw new Error('no recipe fits the size limit');
    const size = statSync(image).size;
    if (total + size > MAX_TOTAL_BYTES) {
      rmSync(image, { force: true });
      throw new Error('over the total size limit');
    }
    total += size;
    largest = Math.max(largest, size);
    made.add(spec.name);
  } catch (error) {
    // ffmpeg's own words, not the command line that execFileSync puts first
    const reason = (error.stderr ? String(error.stderr) : String(error.message)).trim();
    skipped.push(`${spec.title}: ${reason.split('\n').at(-1).slice(0, 160)}`);
  }
}

// ----------------------------------------------------------------------------- the Markdown
const cell = (spec) => {
  const label = text(spec.title);
  return (
    `<td width="50%" valign="top"><img src="{{BASE}}${spec.name}" alt="${label}" width="100%">` +
    `<br><sub>${ICON[spec.status]} ${label}</sub></td>`
  );
};
const table = (list) => {
  const rows = [];
  for (let i = 0; i < list.length; i += 2) {
    const pair = list.slice(i, i + 2).map(cell);
    if (pair.length === 1) pair.push('<td></td>');
    rows.push(`<tr>${pair.join('')}</tr>`);
  }
  return `<table>${rows.join('')}</table>`;
};

const shown = specs.filter((spec) => made.has(spec.name));
const attention = shown.filter((spec) => spec.status !== 'passed');
const groups = new Map();
for (const spec of shown.filter((s) => s.status === 'passed')) {
  groups.set(spec.file, [...(groups.get(spec.file) || []), spec]);
}

const lines = [];
if (shown.length > 0) {
  lines.push('**Previews** (animated; click one to open it full size)', '');
  if (attention.length > 0) {
    // they are named with their file: there is no group around them
    lines.push(table(attention.map((s) => ({ ...s, title: `${s.file} › ${s.title}` }))), '');
  }
  for (const [file, list] of groups) {
    lines.push(
      '<details>',
      `<summary><b>${text(file)}</b> · ${list.length} ${list.length === 1 ? 'recording' : 'recordings'}</summary>`,
      '',
      table(list),
      '',
      '</details>',
      '',
    );
  }
  const without = specs.length - shown.length;
  if (without > 0) {
    lines.push(`${without} more ${without === 1 ? 'recording has' : 'recordings have'} no preview: see the download.`);
  }
  writeFileSync(path.join(outDir, 'previews.md'), `${lines.join('\n').trimEnd()}\n`);
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1);
const summary = [
  '### Animated previews of the recordings',
  '',
  `${made.size} of ${specs.length} recordings, ${mb(total)} MB in all, the largest ${Math.round(largest / 1024)} KB`,
  ...skipped.map((reason) => `- skipped: ${reason}`),
].join('\n');
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
