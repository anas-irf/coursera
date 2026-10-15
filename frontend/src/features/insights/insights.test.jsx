import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import http from '../../shared/api/client';
import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ConfirmProvider } from '../../shared/ui/ConfirmDialog';
import { ToastProvider } from '../../shared/ui/Toast';
import AchievementsPage from './pages/AchievementsPage';
import InstructorEarningsPage from './pages/InstructorEarningsPage';
import InstructorOverviewPage from './pages/InstructorOverviewPage';
import StudentHomePage from './pages/StudentHomePage';

// the pages are exercised through their hooks and api modules: only the HTTP client is replaced
jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
// the chart needs a layout engine; the page's own states are what these tests are about
jest.mock('recharts', () => ({
  BarChart: ({ children }) => <div data-testid="chart">{children}</div>,
  AreaChart: () => <div data-testid="chart" />,
  PieChart: ({ children }) => <div data-testid="pie">{children}</div>,
  Area: () => null,
  Pie: () => null,
  Cell: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

const serverError = { response: { status: 500, data: { error: 'The server had a problem.' } } };

const stats = {
  courses_enrolled: 5,
  courses_completed: 1,
  certificates_earned: 1,
  total_learning_hours: 12.46,
  learning_streak: 3,
};
const member = { has_subscription: true, can_access_plus_courses: true, is_active: true, auto_renew: true };
const nonMember = { has_subscription: false, can_access_plus_courses: false, is_active: false };

let answers;

beforeEach(() => {
  jest.clearAllMocks();
  answers = {
    '/insights/student/stats/': stats,
    '/insights/student/weekly-progress/': { monthly_progress: [{ month: 'Oct', hours: 4 }] },
    '/learning/enrolled/': [
      {
        id: 'e-1', course_id: 'c-1', title: 'JavaScript from Scratch', instructor: 'Ada', thumbnail: null,
        progress: 40, status: 'active',
      },
    ],
    '/learning/courses/': [{
      id: 'c-9', title: 'React for Beginners', instructor: 'Grace', thumbnail: null, rating: 4.7, students: 5,
      duration: '3 hours', level: 'beginner', category: 'Development', course_type: 'free', modules: 4,
      is_enrolled: false, can_enroll: true,
    }],
    '/billing/subscription/': member,
  };
  http.get.mockImplementation(async (url) => {
    const answer = answers[url];
    if (answer instanceof Error || (answer && answer.response)) throw answer;
    return { data: answer, headers: { 'x-total-count': '1' } };
  });
});

const renderHome = () =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter>
            <StudentHomePage />
          </MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </QueryProvider>
  );

const figure = (label) => within(screen.getByRole('group', { name: label }));

test('shows the figures, the courses to continue and the suggestions', async () => {
  renderHome();

  expect(await screen.findByText('Welcome back! 👋')).toBeInTheDocument();
  expect(await screen.findByText('JavaScript from Scratch')).toBeInTheDocument();
  expect(await screen.findByText('React for Beginners')).toBeInTheDocument();
  expect(await figure('Courses Enrolled').findByText('5')).toBeInTheDocument();
  expect(figure('Hours Learned').getByText('12.5')).toBeInTheDocument();
  expect(await screen.findByTestId('chart')).toBeInTheDocument();
  expect(screen.queryByText('Unlock Premium Content')).not.toBeInTheDocument();
});

test('figures that could not be loaded are not shown as zeros', async () => {
  answers['/insights/student/stats/'] = serverError;
  renderHome();

  expect(await screen.findByText(/Your figures could not be loaded/)).toBeInTheDocument();
  expect(figure('Courses Enrolled').getByText('–')).toBeInTheDocument();
  // the rest of the page does not depend on them
  expect(await screen.findByText('JavaScript from Scratch')).toBeInTheDocument();

  answers['/insights/student/stats/'] = stats;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await figure('Courses Enrolled').findByText('5')).toBeInTheDocument();
});

test('a failed list of courses is an error, not an invitation to enrol', async () => {
  answers['/learning/enrolled/'] = serverError;
  renderHome();

  expect(await screen.findByText('We could not load your courses')).toBeInTheDocument();
  expect(screen.queryByText('Continue Learning')).not.toBeInTheDocument();
});

test('a student without Plus is offered the upgrade', async () => {
  answers['/billing/subscription/'] = nonMember;
  renderHome();

  expect(await screen.findByText('Unlock Premium Content')).toBeInTheDocument();
});

test('a member whose subscription could not be read is not told to upgrade', async () => {
  answers['/billing/subscription/'] = serverError;
  renderHome();

  await screen.findByText('JavaScript from Scratch');
  expect(screen.queryByText('Unlock Premium Content')).not.toBeInTheDocument();
});

test('no recorded learning time shows an empty state instead of a flat chart', async () => {
  answers['/insights/student/weekly-progress/'] = {
    monthly_progress: [{ month: 'Aug', hours: 0 }, { month: 'Sep', hours: 0 }],
  };
  renderHome();

  expect(await screen.findByText('No learning time yet')).toBeInTheDocument();
  expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
});

describe('the instructor pages', () => {
  const renderPage = (page) =>
    render(
      <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
        <ToastProvider>
          <MemoryRouter>{page}</MemoryRouter>
        </ToastProvider>
      </QueryProvider>
    );

  const dashboard = {
    stats: {
      total_courses: 3, total_students: 40, total_revenue: 1250.5, average_rating: 0,
      published_courses: 2, draft_courses: 1,
    },
    recent_enrollments: [
      { student_name: 'Demo Student', student_email: 'demo@example.com', course_title: 'React for Beginners',
        enrolled_date: '2026-10-01T10:00:00Z' },
    ],
    revenue_chart: [{ date: '2026-10-01', revenue: 10 }],
    top_courses: [
      { id: 'c-1', title: 'React for Beginners', total_enrolled: 30, average_rating: 0, total_revenue: 900, thumbnail: null },
    ],
  };

  test('the overview says what its figures are about and shows no invented growth', async () => {
    answers['/insights/instructor/dashboard/'] = dashboard;
    renderPage(<InstructorOverviewPage />);

    expect(await screen.findByText('Dashboard Overview')).toBeInTheDocument();
    expect(screen.getByText('2 published, 1 draft')).toBeInTheDocument();
    expect(screen.getByText('$1,250.50')).toBeInTheDocument();
    expect(screen.queryByText(/from last month/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+12%/)).not.toBeInTheDocument();
    // reviews do not exist yet: a rating of 0 is not shown as a rating
    expect(screen.getByText('no reviews yet')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    expect(screen.getByText('Top Performing Courses')).toBeInTheDocument();
    expect(screen.getByText('Demo Student')).toBeInTheDocument();
  });

  test('a dashboard that could not be loaded is an error, not a page of zeros', async () => {
    answers['/insights/instructor/dashboard/'] = serverError;
    renderPage(<InstructorOverviewPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.');
    expect(screen.queryByText('Total Courses')).not.toBeInTheDocument();
  });

  const earnings = {
    summary: { total_earnings: 0, pending_earnings: 412.5, monthly_earnings: 120, platform_fee_rate: 60 },
    monthly_chart: [{ month: 'Sep', earnings: 100 }, { month: 'Oct', earnings: 120 }],
    recent_transactions: [],
    recent_earnings: [
      { id: 'e-1', month: 'October 2026', course: 'React for Beginners', enrollments: 12, completions: 4,
        engagement_score: 70, amount: 120, multiplier: 1, status: 'Pending' },
    ],
    earnings_model: { description: '40% of what students pay is shared among Plus courses', factors: [] },
  };

  test('earnings list each month and course with its amount and no student', async () => {
    answers['/insights/instructor/earnings/'] = earnings;
    renderPage(<InstructorEarningsPage />);

    expect(await screen.findByText('October 2026')).toBeInTheDocument();
    expect(screen.getByText('40% of what students pay is shared among Plus courses')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Course' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Student' })).not.toBeInTheDocument();
    expect(screen.getByText('$412.50')).toBeInTheDocument();
    expect(screen.getByText('Pending', { selector: 'span' })).toBeInTheDocument();
  });

  test('before the first month is calculated there is nothing to chart or list', async () => {
    answers['/insights/instructor/earnings/'] = {
      ...earnings,
      monthly_chart: [{ month: 'Oct', earnings: 0 }],
      recent_earnings: [],
    };
    renderPage(<InstructorEarningsPage />);

    expect(await screen.findByText('No earnings yet')).toBeInTheDocument();
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });

  test('earnings that could not be loaded are an error', async () => {
    answers['/insights/instructor/earnings/'] = serverError;
    renderPage(<InstructorEarningsPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.');
  });
});

describe('achievements', () => {
  test('a failed load is an error with a retry', async () => {
    answers['/insights/student/achievements/'] = serverError;
    render(
      <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
        <AchievementsPage />
      </QueryProvider>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Your achievements could not be loaded');

    answers['/insights/student/achievements/'] = {
      total_points: 120, current_level: 2, next_level_points: 200, global_rank: 4,
      achievements: [
        { id: 'first', title: 'First Steps', icon: '*', description: 'Finish a lecture', earned: true,
          date: '2026-09-01T00:00:00Z', progress: 100 },
      ],
    };
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('First Steps')).toBeInTheDocument();
    expect(screen.getByText('#4')).toBeInTheDocument();
  });
});
