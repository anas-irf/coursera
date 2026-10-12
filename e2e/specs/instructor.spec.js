// What an instructor sees: the busy one, the one with work to grade and the new one.
const { test, expect } = require('../support/session');

test('the course list shows every moderation state with learners and revenue', async ({ page, signIn }) => {
  await signIn('james.okafor@example.com', '/instructor/courses');
  const main = page.locator('main');

  await expect(main).toContainText('Full-Stack Django with PostgreSQL');
  await expect(main).toContainText('Under Review');
  await expect(main).toContainText('React for Beginners');
  await expect(main).toContainText('$433.59');
  await expect(main).toContainText('HTML and CSS Crash Course');
  await expect(main.getByText('Request Publish').first()).toBeVisible();
});

test('the overview lists the learners and the best courses', async ({ page, signIn }) => {
  await signIn('james.okafor@example.com', '/instructor');
  const main = page.locator('main');

  await expect(main).toContainText('Recent Enrollments');
  await expect(main).toContainText('Top Performing Courses');
  await expect(main).toContainText('React for Beginners');
});

test('the assignments list separates graded work from work waiting for a grade', async ({ page, signIn }) => {
  await signIn('ravi.shah@example.com', '/instructor/assignments');
  const main = page.locator('main');

  await expect(main).toContainText('Attribution comparison');
  await main.getByText('Attribution comparison').first().click();
  await expect(main).toContainText('Demo Student');
  await expect(main).toContainText(/Pending Review/);
});

test('the earnings page has money for a Plus instructor', async ({ page, signIn }) => {
  await signIn('ravi.shah@example.com', '/instructor/earnings');
  const main = page.locator('main');

  await expect(main).toContainText(/Pending/);
  await expect(main).toContainText(/\$\d/);
});

test('an instructor without courses sees the empty states', async ({ page, signIn }) => {
  await signIn('noah.bennett@example.com', '/instructor/students');
  await expect(page.locator('main')).toContainText('No Students Yet');
});
