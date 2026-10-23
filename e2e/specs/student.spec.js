// What a learner sees: the seeded demo student (Plus member, five enrolments, a certificate)
// and the learners built for the empty and the gated states.
const { test, expect } = require('../support/session');

const DEMO = 'demo.student@example.com';

test.describe('the headline learner', () => {
  test('the home page shows the figures of the seeded activity', async ({ page, signIn }) => {
    await signIn(DEMO, '/student');
    const main = page.locator('main');

    await expect(main).toContainText('Welcome back');
    await expect(main).toContainText(/Courses Enrolled\s*5/);
    await expect(main).toContainText(/Certificates\s*1/);
    await expect(main.getByText('Continue Learning').first()).toBeVisible();
  });

  test('my learning lists the running courses with their progress', async ({ page, signIn }) => {
    await signIn(DEMO, '/student/my-learning');
    const main = page.locator('main');

    for (const title of ['JavaScript from Scratch', 'Strategic Marketing Analytics',
      'Applied Machine Learning', 'React for Beginners']) {
      await expect(main).toContainText(title);
    }
    await expect(main).toContainText(/75%/);
    // "In Progress" is the default view: the finished course is not "running"
    await expect(main).not.toContainText('Introduction to Python');
  });

  test('my learning keeps the finished course under "Completed" and lets it be reopened', async ({ page, signIn }) => {
    await signIn(DEMO, '/student/my-learning');
    const main = page.locator('main');
    await expect(main).toContainText('JavaScript from Scratch');

    await main.getByRole('tab', { name: /^Completed/ }).click();

    await expect(main).toContainText('Introduction to Python');
    await expect(main).not.toContainText('JavaScript from Scratch');
    await main.getByRole('button', { name: 'Review Course' }).first().click();
    await expect(page).toHaveURL(/\/courses\/.+\/learn/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('the grades page grades the course whose work is handed in', async ({ page, signIn }) => {
    await signIn(DEMO, '/student/grades');
    const main = page.locator('main');

    await expect(main).toContainText('My Grades');
    await expect(main).toContainText(/Applied Machine Learning[\s\S]*A-[\s\S]*91\.0%/);
    await expect(main).toContainText(/Passing Courses\s*1\/4/);
  });

  test('the certificate of the finished course is listed', async ({ page, signIn }) => {
    await signIn(DEMO, '/student/certificates');
    const main = page.locator('main');

    await expect(main).toContainText('Introduction to Python');
    await expect(main).toContainText('Credential ID');
  });

  test('achievements show points and an earned badge', async ({ page, signIn }) => {
    await signIn(DEMO, '/student/achievements');
    const main = page.locator('main');

    await expect(main).toContainText(/Points\s*\d+/);
    await expect(main).toContainText(/First Steps[\s\S]*Earned/);
  });

  test('the notification page shows a backlog of unread notifications', async ({ page, signIn }) => {
    await signIn(DEMO, '/student/notifications');
    const main = page.locator('main');

    await expect(main).toContainText(/\d+ unread notifications/);
    const text = await main.innerText();
    expect(Number(text.match(/(\d+) unread notifications/)[1])).toBeGreaterThanOrEqual(10);
    await expect(main).toContainText('Certificate earned');
  });

  test('the conversations show who wrote and open with their messages', async ({ page, signIn }) => {
    await signIn(DEMO, '/student/messages');
    const main = page.locator('main');

    for (const name of ['Yuki Tanaka', 'Demo Instructor', 'Ravi Shah', 'Priya Nair']) {
      await expect(main).toContainText(name);
    }
    await page.getByText('Yuki Tanaka').first().click();
    await expect(main).toContainText('Study group on Saturday?');
  });

  test('the player opens a course with its outline and a video', async ({ page, signIn }) => {
    await signIn(DEMO, '/student/my-learning');
    const main = page.locator('main');
    await expect(main).toContainText('JavaScript from Scratch');
    // the order of the cards depends on the database (PostgreSQL sorts never-visited courses
    // first, SQLite last): pick the card of the course, not the first card
    const card = main.locator('div')
      .filter({ hasText: 'JavaScript from Scratch' })
      .filter({ has: page.getByRole('button', { name: /Continue Learning/ }) })
      .last();
    await card.getByRole('button', { name: /Continue Learning/ }).click();

    await expect(page).toHaveURL(/\/courses\/.+\/learn/);
    // the outline lists the lectures; the first one is a video
    await page.getByText('Values, variables and types').first().click();
    await expect(page.locator('iframe[src*="youtube.com/embed"]').first()).toBeAttached();
  });
});

test.describe('discovering courses', () => {
  test('the category filter and the search narrow the catalogue', async ({ page, signIn }) => {
    await signIn(DEMO, '/student/explore');
    const main = page.locator('main');
    await expect(main).toContainText('Introduction to Python');

    await main.getByLabel('Category').selectOption('design');
    await expect(main).toContainText('UX Design Fundamentals');
    await expect(main).not.toContainText('Introduction to Python');

    await main.getByLabel('Category').selectOption('all');
    await page.getByPlaceholder(/Search for courses/).fill('python');
    await expect(main).toContainText('Introduction to Python');
    await expect(main).not.toContainText('React for Beginners');
  });

  test('a Plus course is gated for a learner without a subscription', async ({ page, signIn }) => {
    await signIn('ethan.walker@example.com', '/student/explore');
    const main = page.locator('main');

    await expect(main).toContainText('Project Management Essentials');
    await expect(main).toContainText(/Plus Required/);
  });

  test('a free course can be enrolled in and then shows up in my learning', async ({ page, signIn }) => {
    await signIn('mei.lin@example.com', '/student/explore');
    const main = page.locator('main');
    const enroll = main.getByRole('button', { name: 'Enroll Now' }).first();

    // the newcomer has no enrolments; a re-run on the same database finds the course already taken
    if (await enroll.count()) {
      await enroll.click();
      await expect(main.getByText(/enrolled/i).first()).toBeVisible();
    }
    await page.goto('/student/my-learning');
    await expect(page.locator('main')).not.toContainText('No enrolled courses');
  });
});

test.describe('empty states', () => {
  test('a newcomer sees empty learning and certificates', async ({ page, signIn }) => {
    await signIn('tariq.aziz@example.com', '/student/certificates');
    await expect(page.locator('main')).toContainText('No certificates yet');

    await page.goto('/student/my-learning');
    await expect(page.locator('main')).toContainText('No enrolled courses');
  });
});

test.describe('certificates and the account', () => {
  test('anyone with the link can verify a certificate, signed in or not', async ({ page, signIn }) => {
    await signIn(DEMO, '/student/certificates');
    const link = page.locator('main').getByRole('link', { name: /Verify Certificate/ }).first();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/verify\/[^/]+$/);

    // a visitor who never signed in
    await page.context().clearCookies();
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(new URL(href).pathname);

    await expect(page.getByText('Verified').first()).toBeVisible();
    await expect(page.locator('body')).toContainText('Demo Student');
    await expect(page.locator('body')).toContainText('Introduction to Python');
  });

  test('a code nobody was given is said to be unknown', async ({ page }) => {
    await page.goto('/verify/NOT-A-REAL-CODE');

    await expect(page.locator('body')).toContainText('No certificate has this code');
  });

  test('a learner edits the profile and it is kept', async ({ page, signIn }) => {
    await signIn('liam.chen@example.com', '/student/account');
    const main = page.locator('main');

    await main.getByLabel('City').fill('Kuala Lumpur');
    await main.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Your profile was saved.')).toBeVisible();

    await page.reload();
    await expect(page.locator('main').getByLabel('City')).toHaveValue('Kuala Lumpur');
    await expect(page.locator('main')).toContainText('Kuala Lumpur, Singapore');
  });

  test('the shared demo account keeps its password', async ({ page, signIn }) => {
    await signIn(DEMO, '/student/account');

    await expect(page.locator('main')).toContainText('This is a shared demo account');
    await expect(page.getByRole('button', { name: 'Change password' })).toBeDisabled();
  });
});
