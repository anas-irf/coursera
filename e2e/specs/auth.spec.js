// The login form, the role areas and what happens to visitors who are not allowed in.
const { test, expect, PASSWORD } = require('../support/session');

const ACCOUNTS = [
  { email: 'demo.student@example.com', area: /\/student$/, label: 'student' },
  { email: 'james.okafor@example.com', area: /\/instructor$/, label: 'instructor' },
  { email: 'demo.admin@example.com', area: /\/admin$/, label: 'admin' },
];

async function submitLogin(page, email, password) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}

for (const account of ACCOUNTS) {
  test(`a ${account.label} signs in with the form and lands in their own area`, async ({ page }) => {
    await submitLogin(page, account.email, PASSWORD);

    await expect(page).toHaveURL(account.area);
  });
}

test('a wrong password is refused and the visitor stays on the login page', async ({ page }) => {
  await submitLogin(page, 'demo.student@example.com', 'definitely-not-the-password');

  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('main, body')).not.toContainText('Welcome back! 👋');
});

test('the form asks for a valid e-mail address and a password', async ({ page }) => {
  await submitLogin(page, 'not-an-address', '');

  await expect(page.getByText('Please enter a valid email')).toBeVisible();
  await expect(page.getByText('Password is required')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('a visitor without a session is sent to the login page', async ({ page }) => {
  await page.goto('/student/grades');

  await expect(page).toHaveURL(/\/login/);
});

test('a role cannot open the area of another role', async ({ page, signIn }) => {
  await signIn('demo.student@example.com', '/admin/users');
  await expect(page).toHaveURL(/\/student$/);

  await page.goto('/instructor/earnings');
  await expect(page).toHaveURL(/\/student$/);
});

test('a deactivated account cannot sign in', async ({ page }) => {
  await submitLogin(page, 'grace.mwangi@example.com', PASSWORD);

  await expect(page).toHaveURL(/\/login/);
});
