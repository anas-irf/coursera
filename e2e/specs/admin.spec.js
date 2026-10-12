// What an administrator sees and does: the numbers, the users and the approval queue.
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
  const card = main.locator('div')
    .filter({ hasText: 'Cloud Computing Fundamentals' })
    .filter({ has: page.getByRole('button', { name: 'Approve' }) })
    .last();

  await card.getByRole('button', { name: 'Approve' }).click();

  await expect(main).not.toContainText('Cloud Computing Fundamentals');
  await expect.poll(waiting).toBe(before - 1);
});
