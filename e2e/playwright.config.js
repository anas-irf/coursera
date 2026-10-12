// Browser specs that run against the seeded development stack:
//
//   backend   python manage.py runserver 8000      (after migrate + seed_dev)
//   frontend  node support/serve-build.js          (serves frontend/build on :3000)
//
// CI starts both, locally see docs/CI.md.  SEED_PASSWORD must be the password the
// seeded users share (seed_dev prints it, or it is SEED_PASSWORD in backend/.env).
const { defineConfig, devices } = require('@playwright/test');

const CI = Boolean(process.env.CI);

module.exports = defineConfig({
  testDir: './specs',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // the specs share one seeded database: run them in order, one worker
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  // one retry in CI: a spec that only passes on the retry is reported as flaky, not green
  retries: CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['playwright-ctrf-json-reporter', { outputDir: 'ctrf', outputFile: 'playwright.json' }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    viewport: { width: 1366, height: 800 },
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
