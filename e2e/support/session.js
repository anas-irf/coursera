// Signing in for the specs: the API gives the session cookies to the browser context of the
// page, so a spec begins on the page it is about, signed in exactly as after the login form
// (the login form has its own spec).
const { test: base, expect } = require('@playwright/test');

const API_URL = process.env.E2E_API_URL || 'http://localhost:8000/api/v1';
const PASSWORD = process.env.SEED_PASSWORD || process.env.E2E_PASSWORD || '';

async function apiLogin(request, email, password = PASSWORD) {
  if (!password) {
    throw new Error('Set SEED_PASSWORD to the password shared by the seeded users (see docs/CI.md).');
  }
  const response = await request.post(`${API_URL}/auth/login/`, { data: { email, password } });
  if (!response.ok()) {
    throw new Error(`login of ${email} failed with ${response.status()}: is the stack seeded (seed_dev)?`);
  }
  return response.json();
}

const test = base.extend({
  /** ``await signIn('demo.student@example.com', '/student/grades')`` */
  signIn: async ({ page }, use) => {
    await use(async (email, path = '/') => {
      // the page's own browser context: the answer's Set-Cookie headers become its session
      const session = await apiLogin(page.context().request, email);
      // the app asks the server who is signed in when this browser has signed in before
      await page.addInitScript(() => window.localStorage.setItem('session_hint', String(Date.now())));
      await page.goto(path);
      return session.user;
    });
  },
});

module.exports = { test, expect, apiLogin, API_URL, PASSWORD };
