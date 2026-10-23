import React from 'react';
import type { ReactElement, ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import http from '../../shared/api/client';
import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ToastProvider } from '../../shared/ui/Toast';
import { planValues, validatePlan } from './lib/plans';
import OverviewPage from './pages/OverviewPage';
import ReportsPage from './pages/ReportsPage';
import RevenuePage from './pages/RevenuePage';
import SettingsPage from './pages/SettingsPage';
import type { AdminCourse, AdminPlan, AdminStudent, Platform, ReportInfo, Revenue } from './types';

jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
// a download is offered by the browser; jsdom has none
jest.mock('../../shared/lib/download', () => ({ saveBlob: jest.fn() }));
// the charts need a layout engine; what the pages say around them is what is tested
jest.mock('recharts', () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Nothing = () => null;
  return {
    ResponsiveContainer: Box,
    AreaChart: Nothing,
    BarChart: Box,
    PieChart: Box,
    Area: Nothing,
    Bar: Nothing,
    Pie: Box,
    Cell: Nothing,
    XAxis: Nothing,
    YAxis: Nothing,
    CartesianGrid: Nothing,
    Tooltip: Nothing,
  };
});

const mockedGet = jest.mocked(http.get);
const mockedPut = jest.mocked(http.put);

const revenue = (months: number): Revenue => ({
  currency: 'USD',
  months,
  revenue_share_percent: 40,
  summary: {
    gross_revenue: 5008.62,
    instructor_share: 1843.45,
    platform_share: 3165.17,
    this_month: 149.97,
    members: 4,
    renewing_members: 3,
    mrr: 133.31,
    failed_payments: 1,
    earnings_paid: 883.17,
    earnings_pending: 960.28,
  },
  monthly: [
    { month: '2026-05', label: 'May', gross: 399.99, instructor_share: 0, platform_share: 399.99, payments: 1, new_members: 1, source: 'live' },
    { month: '2026-06', label: 'Jun', gross: 180.98, instructor_share: 72.39, platform_share: 108.59, payments: 1, new_members: 0, source: 'ledger' },
  ],
  subscriptions: { active: 3, cancelled: 1, lapsed: 1, monthly: 4, yearly: 1 },
  plans: [
    { cycle: 'monthly', name: 'Coursera Plus Monthly', price: 49.99, members: 3 },
    { cycle: 'yearly', name: 'Coursera Plus Annual', price: 399.99, members: 1 },
  ],
  top_courses: [
    { id: 'c-1', title: 'Applied Machine Learning', instructor: 'Demo Instructor', course_type: 'coursera_plus', earnings: 504.97, enrollments: 3 },
  ],
  recent_payments: [
    { id: 'p-1', student: 'Mateo Alvarez', email: 'mateo@example.com', plan: 'monthly', amount: 49.99, status: 'failed', date: '2026-10-13T09:00:00Z' },
  ],
});

const REPORTS: ReportInfo[] = [
  { id: 'users', name: 'Users', description: 'Every account', rows: 32 },
  { id: 'payments', name: 'Plus payments', description: 'Every payment', rows: 1 },
];

const PLANS: AdminPlan[] = [
  { cycle: 'monthly', name: 'Coursera Plus Monthly', description: 'Monthly billing', price: 49.99, configured: true, members: 3 },
  { cycle: 'yearly', name: 'Coursera Plus Annual', description: 'Annual billing', price: 399.99, configured: false, members: 1 },
];

const PLATFORM: Platform = {
  rules: { revenue_share_percent: 40, course_passing_grade: 60, quiz_submit_grace_seconds: 30, access_token_minutes: 60, refresh_token_days: 7 },
  categories: [{ id: 1, name: 'Programming', slug: 'programming', courses: 3, published: 2 }],
  languages: [{ id: 1, code: 'en', name: 'English', courses: 18 }],
  environment: { demo_mode: true, debug: false, database: 'postgresql', realtime: 'redis', stripe: false, api_version: 'v1' },
};

const student = (id: string, name: string, joined: string): AdminStudent => ({
  id,
  name,
  email: `${id}@example.com`,
  user_type: 'student',
  join_date: joined,
  last_login: null,
  is_active: true,
  status: 'active',
  phone_number: '',
  email_verified: true,
  avatar: '',
  courses_enrolled: 2,
  completed_courses: 1,
  active_courses: 1,
});

const course = (id: string, status: AdminCourse['status']): AdminCourse => ({
  id,
  title: `Course ${id}`,
  instructor: { id: 'i-1', name: 'Ada', email: 'ada@example.com' },
  category: 'Programming',
  course_type: 'free',
  sections_count: 1,
  lectures_count: 2,
  total_weight: 100,
  description: '',
  thumbnail: null,
  duration_hours: 1,
  status,
  created_date: '2026-01-01T00:00:00Z',
  published_date: null,
  total_enrolled: 3,
  average_rating: 0,
});

const renderPage = (page: ReactElement) =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <ToastProvider>
        <MemoryRouter>{page}</MemoryRouter>
      </ToastProvider>
    </QueryProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockImplementation(async (url, config) => {
    if (url === '/insights/admin/revenue/') {
      return { data: revenue(Number((config?.params as { months?: number } | undefined)?.months)) };
    }
    if (url === '/insights/admin/reports/') return { data: REPORTS };
    if (url === '/insights/admin/reports/users/') {
      return { data: new Blob(['id,name\n']), headers: { 'content-disposition': 'attachment; filename="users-2026-10-23.csv"' } };
    }
    if (url === '/billing/admin/plans/') return { data: PLANS };
    if (url === '/insights/admin/platform/') return { data: PLATFORM };
    if (url === '/insights/admin/users/') {
      return { data: [student('u-1', 'Ada Old', '2026-01-01T00:00:00Z'), student('u-2', 'Bea New', '2026-10-01T00:00:00Z')] };
    }
    if (url === '/courses/admin/all/') return { data: [course('c-1', 'published'), course('c-2', 'pending_review')] };
    if (url === '/courses/admin/pending/') return { data: [] };
    throw new Error(`unexpected GET ${url}`);
  });
});

describe('revenue', () => {
  test('shows the figures, the memberships, the best courses and the payments', async () => {
    renderPage(<RevenuePage />);

    expect(await screen.findByRole('group', { name: 'Gross revenue' })).toHaveTextContent('$5,008.62');
    expect(screen.getByRole('group', { name: 'Monthly recurring revenue' })).toHaveTextContent(/\$133\.31\s*3 renewing members/);
    expect(screen.getByRole('table', { name: 'Top earning courses' })).toHaveTextContent(/Applied Machine Learning[\s\S]*\$504\.97/);
    expect(screen.getByText('Mateo Alvarez')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('Coursera Plus Monthly'.replace('Coursera Plus ', ''))).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledWith('/insights/admin/revenue/', { params: { months: 6 } });
  });

  test('the period can be changed to a year', async () => {
    renderPage(<RevenuePage />);
    await screen.findByRole('group', { name: 'Gross revenue' });

    fireEvent.click(screen.getByRole('radio', { name: '12 months' }));

    await waitFor(() => expect(mockedGet).toHaveBeenCalledWith('/insights/admin/revenue/', { params: { months: 12 } }));
    expect(await screen.findByText('The last 12 months')).toBeInTheDocument();
  });

  test('a failure is an error with a retry, not empty figures', async () => {
    mockedGet.mockRejectedValue({ response: { status: 500, data: { error: 'The server had a problem.' } } });
    renderPage(<RevenuePage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.');
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });
});

describe('reports', () => {

  test('lists the reports with their size and downloads one under the server\'s file name', async () => {
    renderPage(<ReportsPage />);

    const card = await screen.findByRole('article', { name: 'Users' });
    expect(card).toHaveTextContent('32 rows');
    fireEvent.click(within(card).getByRole('button', { name: 'Download CSV' }));

    expect(await screen.findByText('users-2026-10-23.csv was downloaded.')).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledWith('/insights/admin/reports/users/', { responseType: 'blob' });
  });

  test('a report that cannot be generated is said so', async () => {
    renderPage(<ReportsPage />);

    const card = await screen.findByRole('article', { name: 'Plus payments' });
    fireEvent.click(within(card).getByRole('button', { name: 'Download CSV' }));

    expect(await screen.findByText('Download failed')).toBeInTheDocument();
  });
});

describe('platform settings', () => {
  test('the plans are editable and saved with their new price', async () => {
    mockedPut.mockResolvedValue({ data: { ...PLANS[0], price: 59 } });
    renderPage(<SettingsPage />);

    const monthly = await screen.findByRole('article', { name: 'Monthly plan' });
    expect(within(monthly).getByText('Configured')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Annual plan' })).getByText('Built-in default')).toBeInTheDocument();
    expect(within(monthly).getByRole('button', { name: 'Save plan' })).toBeDisabled();

    fireEvent.change(within(monthly).getByLabelText('Price per month'), { target: { value: '59' } });
    fireEvent.click(within(monthly).getByRole('button', { name: 'Save plan' }));

    await waitFor(() => expect(mockedPut).toHaveBeenCalledWith('/billing/admin/plans/monthly/', {
      name: 'Coursera Plus Monthly',
      description: 'Monthly billing',
      price: 59,
    }));
    expect(await screen.findByText('Coursera Plus Monthly now sells at $59.00 per month.')).toBeInTheDocument();
  });

  test('a price that is not a price is refused before anything is sent', async () => {
    renderPage(<SettingsPage />);

    const yearly = await screen.findByRole('article', { name: 'Annual plan' });
    fireEvent.change(within(yearly).getByLabelText('Price per year'), { target: { value: '-5' } });
    fireEvent.click(within(yearly).getByRole('button', { name: 'Save plan' }));

    expect(within(yearly).getByText(/A price above 0/)).toBeInTheDocument();
    expect(mockedPut).not.toHaveBeenCalled();
  });

  test('the server\'s complaint lands next to the field', async () => {
    mockedPut.mockRejectedValue({ response: { status: 400, data: { name: ['Ensure this field has no more than 100 characters.'] } } });
    renderPage(<SettingsPage />);

    const monthly = await screen.findByRole('article', { name: 'Monthly plan' });
    fireEvent.change(within(monthly).getByLabelText('Name'), { target: { value: 'Plus' } });
    fireEvent.click(within(monthly).getByRole('button', { name: 'Save plan' }));

    expect(await within(monthly).findByText('Ensure this field has no more than 100 characters.')).toBeInTheDocument();
  });

  test('the rules, the environment and the catalogue come from the server', async () => {
    renderPage(<SettingsPage />);

    expect(await screen.findByText('Instructor revenue share')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Categories' })).toHaveTextContent(/Programming\s*programming\s*3\s*2/);
    expect(screen.getByText('English · 18')).toBeInTheDocument();
  });
});

describe('the overview', () => {
  test('counts users and courses and lists the newest accounts first', async () => {
    renderPage(<OverviewPage />);

    expect(await screen.findByRole('group', { name: 'Total Users' })).toHaveTextContent(/Total Users\s*2\s*2 students · 0 instructors/);
    expect(screen.getByRole('group', { name: 'Pending Approvals' })).toHaveTextContent(/1\s*requires attention/);
    expect(screen.getByRole('link', { name: /Review 1 course/ })).toHaveAttribute('href', '/admin/courses/approvals');
    const names = screen.getAllByText(/Ada Old|Bea New/).map((element) => element.textContent);
    expect(names[0]).toBe('Bea New');
    expect(await screen.findByText('Nothing is waiting')).toBeInTheDocument();
  });
});

test('the plan form rules', () => {
  expect(planValues({ name: 'Plus', description: '', price: 49.9 })).toEqual({ name: 'Plus', description: '', price: '49.90' });
  expect(validatePlan({ name: '', description: 'x'.repeat(501), price: '1.234' })).toEqual({
    name: 'A plan needs a name',
    description: 'At most 500 characters',
    price: 'A price above 0, with at most two decimals (up to 9999.99)',
  });
  expect(validatePlan({ name: 'x'.repeat(101), description: '', price: '9999.99' })).toEqual({ name: 'At most 100 characters' });
  expect(validatePlan({ name: 'Plus', description: '', price: '0' })).toHaveProperty('price');
});
