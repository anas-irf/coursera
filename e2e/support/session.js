// Signing in for the specs: the API gives the session, the page gets it before the
// application starts, so a spec begins on the page it is about (the login form has
// its own spec).
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
  signIn: async ({ page, request }, use) => {
    await use(async (email, path = '/') => {
      const session = await apiLogin(request, email);
      await page.addInitScript(({ tokens, user, profile }) => {
        window.localStorage.setItem('access_token', tokens.access);
        window.localStorage.setItem('refresh_token', tokens.refresh);
        window.localStorage.setItem('user', JSON.stringify(user));
        if (profile) window.localStorage.setItem('profile', JSON.stringify(profile));
      }, session);
      await page.goto(path);
      return session.user;
    });
  },
});

module.exports = { test, expect, apiLogin, API_URL, PASSWORD };
