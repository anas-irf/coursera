import React from 'react';
import type { ReactElement, ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import http from '../../shared/api/client';
import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ConfirmProvider } from '../../shared/ui/ConfirmDialog';
import { ToastProvider } from '../../shared/ui/Toast';
import type { SubscriptionStatus } from '../billing';
import type { CatalogCourse, EnrolledCourse } from '../learning';
import AchievementsPage from './pages/AchievementsPage';
import InstructorAnalyticsPage from './pages/InstructorAnalyticsPage';
import InstructorEarningsPage from './pages/InstructorEarningsPage';
import InstructorOverviewPage from './pages/InstructorOverviewPage';
import StudentHomePage from './pages/StudentHomePage';
import type {
  Achievements,
  InstructorAnalytics,
  InstructorDashboard,
  InstructorEarnings,
  StudentStats,
  WeeklyProgress,
} from './types';

// the pages are exercised through their hooks and api modules: only the HTTP client is replaced
jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
// the greeting names the signed-in user
jest.mock('../../shared/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' } }),
}));
// the chart needs a layout engine; the page's own states are what these tests are about
jest.mock('recharts', () => ({
  BarChart: ({ children }: { children?: ReactNode }) => <div data-testid="chart">{children}</div>,
  AreaChart: () => <div data-testid="chart" />,
  PieChart: ({ children }: { children?: ReactNode }) => <div data-testid="pie">{children}</div>,
  Area: () => null,
  Pie: () => null,
  Cell: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const mockedGet = jest.mocked(http.get);

const serverError = Object.assign(new Error('Request failed with status code 500'), {
  response: { status: 500, data: { error: 'The server had a problem.' } },
});

const stats: StudentStats = {
  courses_enrolled: 5,
  courses_active: 4,
  courses_completed: 1,
  certificates_earned: 1,
  total_progress: 40,
  has_plus_subscription: true,
  learning_streak: 3,
  total_learning_hours: 12.46,
};
const weeklyProgress: WeeklyProgress = { monthly_progress: [{ month: 'Oct', hours: 4 }] };
const enrolledCourse: EnrolledCourse = {
  id: 'e-1',
  course_id: 'c-1',
  title: 'JavaScript from Scratch',
  instructor: 'Ada',
  thumbnail: null,
  progress: 40,
  status: 'active',
  last_accessed: null,
  next_lesson: 'Variables',
  total_lessons: 10,
  completed_lessons: 4,
  estimated_completion: '2 hours',
};
const catalogCourse: CatalogCourse = {
  id: 'c-9',
  title: 'React for Beginners',
  instructor: 'Grace',
  instructor_id: 'u-9',
  thumbnail: null,
  rating: 4.7,
  students: 5,
  duration: '3 hours',
  duration_seconds: 10800,
  level: 'beginner',
  category: 'Development',
  course_type: 'free',
  modules: 4,
  description: 'Components, props and state.',
  is_enrolled: false,
  is_bookmarked: false,
  can_enroll: true,
  enrollment_message: '',
  progress: 0,
};
const member: SubscriptionStatus = {
  has_subscription: true,
  status: 'active',
  subscription_type: 'monthly',
  is_active: true,
  can_access_plus_courses: true,
  start_date: '2026-09-01T09:00:00Z',
  end_date: '2026-11-01T09:00:00Z',
  auto_renew: true,
  next_billing_date: '2026-11-01T09:00:00Z',
};
const nonMember: SubscriptionStatus = {
  has_subscription: false,
  status: 'none',
  subscription_type: null,
  is_active: false,
  can_access_plus_courses: false,
  start_date: null,
  end_date: null,
  auto_renew: false,
  next_billing_date: null,
};

// what each url answers (or fails with, when it holds an error)
let answers: Record<string, unknown>;

beforeEach(() => {
  jest.clearAllMocks();
  answers = {
    '/insights/student/stats/': stats,
    '/insights/student/weekly-progress/': weeklyProgress,
    '/learning/enrolled/': [enrolledCourse],
    '/learning/courses/': [catalogCourse],
    '/billing/subscription/': member,
  };
  mockedGet.mockImplementation(async (url) => {
    const answer = answers[url];
    if (answer instanceof Error) throw answer;
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

const figure = (label: string) => within(screen.getByRole('group', { name: label }));

test('shows the figures, the courses to continue and the suggestions', async () => {
  renderHome();

  expect(await screen.findByRole('heading', { name: 'Welcome back, Ada' })).toBeInTheDocument();
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
  expect(figure('Courses Enrolled').getByText('-')).toBeInTheDocument();
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
  const idle: WeeklyProgress = {
    monthly_progress: [{ month: 'Aug', hours: 0 }, { month: 'Sep', hours: 0 }],
  };
  answers['/insights/student/weekly-progress/'] = idle;
  renderHome();

  expect(await screen.findByText('No learning time yet')).toBeInTheDocument();
  expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
});

describe('the instructor pages', () => {
  const renderPage = (page: ReactElement) =>
    render(
      <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
        <ToastProvider>
          <MemoryRouter>{page}</MemoryRouter>
        </ToastProvider>
      </QueryProvider>
    );

  const dashboard: InstructorDashboard = {
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
      { id: 'c-1', title: 'React for Beginners', course_type: 'coursera_plus', total_enrolled: 30,
        average_rating: 0, total_revenue: 900, thumbnail: null },
    ],
  };

  test('the overview says what its figures are about and shows no invented growth', async () => {
    answers['/insights/instructor/dashboard/'] = dashboard;
    answers['/insights/instructor/earnings/'] = earnings;
    renderPage(<InstructorOverviewPage />);

    expect(screen.getByRole('heading', { name: 'Dashboard Overview' })).toBeInTheDocument();
    expect(await screen.findByText('2 published, 1 draft')).toBeInTheDocument();
    expect(screen.getByText('$1,250.50')).toBeInTheDocument();
    expect(screen.queryByText(/from last month/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\+12%/)).not.toBeInTheDocument();
    // reviews do not exist yet: a rating of 0 is not shown as a rating
    expect(screen.getByText('no reviews yet')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
    expect(screen.getByText('Top Performing Courses')).toBeInTheDocument();
    expect(screen.getByText('Demo Student')).toBeInTheDocument();
    // earnings are calculated per month, so the trend is drawn by month
    expect(await screen.findByText('The last six months: $220.00')).toBeInTheDocument();
  });

  test('a dashboard that could not be loaded is an error, not a page of zeros', async () => {
    answers['/insights/instructor/dashboard/'] = serverError;
    answers['/insights/instructor/earnings/'] = serverError;
    renderPage(<InstructorOverviewPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.');
    expect(screen.queryByText('Total Courses')).not.toBeInTheDocument();
  });

  const earnings: InstructorEarnings = {
    summary: { total_earnings: 0, pending_earnings: 412.5, monthly_earnings: 120, platform_fee_rate: 60 },
    monthly_chart: [{ month: 'Sep', earnings: 100 }, { month: 'Oct', earnings: 120 }],
    recent_transactions: [],
    performance: { monthly_enrollments: 12, monthly_completions: 4, engagement_score: 70 },
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

    const achievements: Achievements = {
      total_points: 120, current_level: 2, next_level_points: 200, global_rank: 4, monthly_rank: null,
      achievements: [
        { id: 1, title: 'First Steps', icon: '*', description: 'Finish a lecture', earned: true,
          date: '2026-09-01', progress: 100 },
      ],
    };
    answers['/insights/student/achievements/'] = achievements;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('First Steps')).toBeInTheDocument();
    expect(screen.getByText('#4')).toBeInTheDocument();
  });
});

describe('the instructor analytics', () => {
  const analytics: InstructorAnalytics = {
    months: 6,
    totals: {
      courses: 3, published_courses: 2, students: 7, enrollments: 8, active_learners: 3, completions: 1,
      completion_rate: 12.5, average_progress: 41.3, quiz_attempts: 6, average_quiz_score: 66.7, quiz_pass_rate: 50,
      submissions: 4, pending_submissions: 1, earnings: 504.97, average_rating: null,
    },
    monthly: [
      { month: '2026-09', label: 'Sep', enrollments: 2, completions: 0, earnings: 123.07 },
      { month: '2026-10', label: 'Oct', enrollments: 1, completions: 1, earnings: 150.53 },
    ],
    progress_distribution: [
      { key: 'not_started', label: 'Not started', count: 1 },
      { key: 'under_half', label: 'Under half', count: 3 },
      { key: 'over_half', label: 'Half or more', count: 3 },
      { key: 'completed', label: 'Completed', count: 1 },
    ],
    courses: [
      { id: 'c-1', title: 'Introduction to Python', status: 'published', course_type: 'free', thumbnail: null,
        enrollments: 6, active_learners: 2, completions: 1, completion_rate: 16.7, average_progress: 48,
        average_quiz_score: 70, average_rating: 4.7, total_reviews: 12, revenue: 0 },
      { id: 'c-2', title: 'Cloud Computing Fundamentals', status: 'pending_review', course_type: 'coursera_plus',
        thumbnail: null, enrollments: 0, active_learners: 0, completions: 0, completion_rate: null,
        average_progress: null, average_quiz_score: null, average_rating: null, total_reviews: 0, revenue: 0 },
    ],
  };

  const renderAnalytics = () =>
    render(
      <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
        <MemoryRouter>
          <InstructorAnalyticsPage />
        </MemoryRouter>
      </QueryProvider>
    );

  const ANALYTICS_URL = '/insights/instructor/analytics/';

  test('shows the real figures of the courses, and a dash where there is nothing to compute', async () => {
    answers[ANALYTICS_URL] = analytics;
    renderAnalytics();

    await screen.findByRole('group', { name: 'Students' });
    expect(figure('Students').getByText('7')).toBeInTheDocument();
    expect(figure('Students').getByText('3 active in the last 7 days')).toBeInTheDocument();
    expect(figure('Completion rate').getByText('12.5%')).toBeInTheDocument();
    expect(figure('Average quiz score').getByText('66.7%')).toBeInTheDocument();
    expect(figure('Earnings').getByText('$504.97')).toBeInTheDocument();
    expect(figure('Average rating').getByText('-')).toBeInTheDocument();
    expect(figure('Hand-ins to grade').getByText('1')).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Course performance' });
    expect(within(table).getByText('Introduction to Python')).toBeInTheDocument();
    expect(within(table).getByText('Cloud Computing Fundamentals')).toBeInTheDocument();
    expect(within(table).getByText('Pending Review')).toBeInTheDocument();
    expect(screen.getByText('Under half')).toBeInTheDocument();
    expect(screen.getAllByTestId('chart')).toHaveLength(2);
    expect(mockedGet).toHaveBeenCalledWith(ANALYTICS_URL, { params: { months: 6 } });
  });

  test('another period is asked of the server', async () => {
    answers[ANALYTICS_URL] = analytics;
    renderAnalytics();
    await screen.findByRole('group', { name: 'Students' });

    fireEvent.click(screen.getByRole('radio', { name: '12 months' }));

    expect(screen.getByRole('radio', { name: '12 months' })).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith(ANALYTICS_URL, { params: { months: 12 } }));
  });

  test('months without activity say so instead of drawing flat charts', async () => {
    answers[ANALYTICS_URL] = {
      ...analytics,
      monthly: analytics.monthly.map((month) => ({ ...month, enrollments: 0, completions: 0, earnings: 0 })),
    };
    renderAnalytics();

    expect(await screen.findByText('No enrollments in this period')).toBeInTheDocument();
    expect(screen.getByText('No earnings in this period')).toBeInTheDocument();
    expect(screen.queryByTestId('chart')).not.toBeInTheDocument();
  });

  test('an instructor without courses is invited to create one', async () => {
    answers[ANALYTICS_URL] = {
      ...analytics,
      totals: { ...analytics.totals, courses: 0, published_courses: 0 },
      courses: [],
    };
    renderAnalytics();

    expect(await screen.findByText('No courses yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a course' })).toHaveAttribute('href', '/instructor/courses');
  });

  test('analytics that could not be loaded are an error, not zeros', async () => {
    answers[ANALYTICS_URL] = serverError;
    renderAnalytics();

    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.');
    expect(screen.queryByRole('group', { name: 'Students' })).not.toBeInTheDocument();
  });
});

describe('the student home', () => {
  test('a newcomer without courses is pointed at the catalogue', async () => {
    answers['/learning/enrolled/'] = [];
    renderHome();

    expect(await screen.findByText('Start your first course')).toBeInTheDocument();
    expect(screen.queryByText('Continue Learning')).not.toBeInTheDocument();
  });

  test('a member sees the overall progress instead of an upgrade', async () => {
    renderHome();

    expect(await screen.findByText('Overall progress')).toBeInTheDocument();
    expect(await screen.findByRole('progressbar', { name: 'Average progress' })).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText('3-day streak')).toBeInTheDocument();
  });
});

describe('the achievements page', () => {
  test('shows the level, the earned badges and how far the others are', async () => {
    const achievements: Achievements = {
      total_points: 620, current_level: 2, next_level_points: 750, global_rank: 3, monthly_rank: 2,
      achievements: [
        { id: 1, title: 'First Steps', icon: '*', description: 'Finish a lecture', earned: true,
          date: '2026-09-01', progress: 100 },
        { id: 3, title: 'Week Warrior', icon: '*', description: '7 day streak', earned: false,
          date: null, progress: 42.8 },
      ],
    };
    answers['/insights/student/achievements/'] = achievements;
    render(
      <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
        <AchievementsPage />
      </QueryProvider>
    );

    await screen.findByRole('group', { name: 'Points' });
    expect(figure('Points').getByText('620')).toBeInTheDocument();
    expect(screen.getByText('620 / 750 Points')).toBeInTheDocument();
    expect(screen.getByText(/^Earned \w{3} \d+, 2026$/)).toBeInTheDocument();
    expect(screen.getByText('43%')).toBeInTheDocument();
    expect(screen.getByText('#2 this month')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progress to level 3' })).toHaveAttribute('aria-valuenow', '48');
  });
});
