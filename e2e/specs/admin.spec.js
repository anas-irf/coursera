// What an administrator sees and does: the numbers, the users, the money, the reports and the
// approval queue.
const { test, expect } = require('../support/session');

const ADMIN = 'demo.admin@example.com';

test('the overview totals match the seeded platform', async ({ page, signIn }) => {
  await signIn(ADMIN, '/admin');
  const main = page.locator('main');

  await expect(main).toContainText(/Total Users\s*32/);
  await expect(main).toContainText(/24 students\s*·\s*6 instructors/);
  await expect(main).toContainText(/Total Courses\s*18/);
  await expect(main).toContainText(/Pending Approvals\s*2/);
});

test('the user list shows roles, verification and deactivated accounts', async ({ page, signIn }) => {
  await signIn(ADMIN, '/admin/users');
  const main = page.locator('main');

  await expect(main).toContainText('32 total users (24 students, 6 instructors, 2 admins)');
  await expect(main).toContainText('grace.mwangi@example.com');
  await expect(main).toContainText('inactive');
  await expect(main).toContainText('Verified');
});

test('revenue comes from the payments and the ledger, not from sample figures', async ({ page, signIn }) => {
  await signIn(ADMIN, '/admin/revenue');
  const main = page.locator('main');

  await expect(main.getByRole('group', { name: 'Gross revenue' })).toContainText(/\$[1-9][\d,]*\.\d{2}/);
  await expect(main.getByRole('group', { name: 'Monthly recurring revenue' })).toContainText(/renewing member/);
  // the seeded members: a failed payment of the lapsed one, plans with their members
  await expect(main).toContainText('Mateo Alvarez');
  await expect(main).toContainText(/Monthly[\s\S]*\$49\.99/);
  await expect(main).not.toContainText('Sample data');
});

test('a report downloads as a CSV file named after the day', async ({ page, signIn }) => {
  await signIn(ADMIN, '/admin/reports');
  const card = page.getByRole('article', { name: 'Users' });
  await expect(card).toContainText('32 rows');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    card.getByRole('button', { name: 'Download CSV' }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^users-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('the platform settings show the plans as sold and the rules of the server', async ({ page, signIn }) => {
  await signIn(ADMIN, '/admin/settings');
  const main = page.locator('main');

  const monthly = main.getByRole('article', { name: 'Monthly plan' });
  await expect(monthly.getByLabel('Name')).toHaveValue(/Plus Monthly/);
  await expect(monthly.getByLabel('Price per month')).toHaveValue('49.99');
  await expect(main).toContainText(/Instructor revenue share\s*[\s\S]*40%/);
  await expect(main.getByRole('table', { name: 'Categories' })).toContainText('Web Development');
});

test('the approval queue shows the weight problem of the edited course', async ({ page, signIn }) => {
  await signIn(ADMIN, '/admin/courses/approvals');
  const main = page.locator('main');

  await expect(main).toContainText('Full-Stack Django with PostgreSQL');
  await expect(main).toContainText(/90%\s*Grade Weight/);
  await expect(main).toContainText('Cloud Computing Fundamentals');
  await expect(main).toContainText(/100%\s*Grade Weight/);
});

// Last on purpose: it changes the data the other specs of this file describe.  It approves a
// course no other spec looks at; reseed with `seed_dev --reset` to run the file again.
test('approving a course takes it out of the queue', async ({ page, signIn }) => {
  await signIn(ADMIN, '/admin/courses/approvals');
  const main = page.locator('main');
  const waiting = async () => Number((await main.innerText()).match(/(\d+) courses? awaiting approval/)[1]);

  await expect(main).toContainText('Cloud Computing Fundamentals');
  const before = await waiting();
  const card = main.getByRole('article', { name: 'Cloud Computing Fundamentals' });

  await card.getByRole('button', { name: 'Approve' }).click();

  await expect(main).not.toContainText('Cloud Computing Fundamentals');
  await expect.poll(waiting).toBe(before - 1);
  // the sidebar badge reads the same queue
  if (before > 1) {
    await expect(page.getByRole('link', { name: /Course Approvals/ })).toContainText(String(before - 1));
  }
});
