import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import http from '../../shared/api/client';
import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ConfirmProvider } from '../../shared/ui/ConfirmDialog';
import { ToastProvider } from '../../shared/ui/Toast';
import { usePendingCount } from './hooks/useAdmin';
import ApprovalsPage from './pages/ApprovalsPage';
import CoursesPage from './pages/CoursesPage';
import UsersPage from './pages/UsersPage';

jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const pendingCourse = (id, title, weight = 100) => ({
  id,
  title,
  description: `About ${title}`,
  course_type: 'coursera_plus',
  category: 'Development',
  instructor: { name: 'Ada Lovelace', email: 'ada@example.com' },
  sections_count: 3,
  lectures_count: 9,
  duration_hours: 4,
  total_weight: weight,
  submitted_date: '2026-10-01T10:00:00Z',
});

let queue;

beforeEach(() => {
  jest.clearAllMocks();
  queue = [pendingCourse('c-1', 'Cloud Computing', 100), pendingCourse('c-2', 'Django with PostgreSQL', 90)];
  http.get.mockImplementation(async (url) => {
    if (url === '/courses/admin/pending/') return { data: queue };
    throw new Error(`unexpected GET ${url}`);
  });
});

// a stand-in for the sidebar badge: it must follow the queue
const Badge = () => <span data-testid="badge">{usePendingCount()}</span>;

const renderApprovals = () =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <ToastProvider>
        <ConfirmProvider>
          <Badge />
          <ApprovalsPage />
        </ConfirmProvider>
      </ToastProvider>
    </QueryProvider>
  );

describe('the approval queue', () => {
  test('lists the waiting courses with their grade weight and counts them', async () => {
    renderApprovals();

    expect(await screen.findByText('2 courses awaiting approval')).toBeInTheDocument();
    expect(screen.getByText('Cloud Computing')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Django with PostgreSQL' })).toHaveTextContent(/90%\s*Grade Weight/);
    expect(screen.getByRole('article', { name: 'Cloud Computing' })).toHaveTextContent(/100%\s*Grade Weight/);
    await waitFor(() => expect(screen.getByTestId('badge')).toHaveTextContent('2'));
  });

  test('approving takes the course out of the queue and off the badge', async () => {
    http.post.mockImplementation(async () => {
      queue = queue.filter((course) => course.id !== 'c-1');
      return { data: { message: 'approved' } };
    });
    renderApprovals();
    await screen.findByText('2 courses awaiting approval');

    const card = screen.getByRole('article', { name: 'Cloud Computing' });
    fireEvent.click(within(card).getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('1 course awaiting approval')).toBeInTheDocument();
    expect(screen.queryByText('Cloud Computing')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('badge')).toHaveTextContent('1'));
    expect(http.post).toHaveBeenCalledWith('/courses/admin/c-1/approve/');
  });

  test('rejecting needs a reason', async () => {
    http.post.mockImplementation(async () => {
      queue = queue.filter((course) => course.id !== 'c-2');
      return { data: {} };
    });
    renderApprovals();
    await screen.findByText('2 courses awaiting approval');

    const card = screen.getByRole('article', { name: 'Django with PostgreSQL' });
    fireEvent.click(within(card).getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject Course' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject Course' }));
    expect(await screen.findByText('Please provide a rejection reason.')).toBeInTheDocument();
    expect(http.post).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('Rejection reason'), { target: { value: 'Weights are 90%' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject Course' }));

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith('/courses/admin/c-2/reject/', { reason: 'Weights are 90%' }));
    expect(await screen.findByText('1 course awaiting approval')).toBeInTheDocument();
  });

  test('a failed approval is reported and the course stays', async () => {
    http.post.mockRejectedValue({ response: { status: 400, data: { error: 'Course is not pending' } } });
    renderApprovals();
    await screen.findByText('2 courses awaiting approval');

    const card = screen.getByRole('article', { name: 'Cloud Computing' });
    fireEvent.click(within(card).getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Course is not pending')).toBeInTheDocument();
    expect(screen.getByText('Cloud Computing')).toBeInTheDocument();
  });

  test('a queue that could not be loaded is an error, not "Great job"', async () => {
    http.get.mockRejectedValue({ response: { status: 500, data: { error: 'The server had a problem.' } } });
    renderApprovals();

    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.');
    expect(screen.queryByText(/Great job/)).not.toBeInTheDocument();
    expect(screen.getByTestId('badge')).toHaveTextContent('0');
  });

  test('an empty queue says so', async () => {
    queue = [];
    renderApprovals();

    expect(await screen.findByText('No pending approvals')).toBeInTheDocument();
    expect(screen.getByText('0 courses awaiting approval')).toBeInTheDocument();
  });
});

describe('the other admin lists', () => {
  const renderPage = (page) =>
    render(<QueryProvider client={createQueryClient({ retryDelay: 1 })}>{page}</QueryProvider>);

  test('all courses show every state, including the rejected ones', async () => {
    http.get.mockImplementation(async () => ({
      data: [
        {
          id: 'c-1', title: 'Old Course', status: 'rejected', course_type: 'free', category: 'Design',
          instructor: { name: 'Ada', email: 'ada@example.com' }, sections_count: 1, lectures_count: 2,
          total_weight: 60, created_date: '2026-01-01T00:00:00Z',
        },
      ],
    }));
    renderPage(<CoursesPage />);

    expect(await screen.findByText('Old Course')).toBeInTheDocument();
    expect(screen.getByText('Rejected', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
  });

  test('users are drawn without asking anyone for a picture', async () => {
    http.get.mockImplementation(async () => ({
      data: [
        {
          id: 'u-1', name: 'Grace Mwangi', email: 'grace@example.com', user_type: 'student', status: 'active',
          avatar: 'https://ui-avatars.com/api/?name=Grace', email_verified: true, join_date: '2026-01-01T00:00:00Z',
          courses_enrolled: 2, completed_courses: 1, active_courses: 1,
        },
      ],
    }));
    renderPage(<UsersPage />);

    expect(await screen.findByText('grace@example.com')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Grace Mwangi' })).toHaveTextContent('GM');
    expect(screen.queryByAltText('Grace Mwangi')).not.toBeInTheDocument();
  });

  test('a list that could not be loaded is an error', async () => {
    http.get.mockRejectedValue({ response: { status: 403, data: { detail: 'Not allowed' } } });
    renderPage(<UsersPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed');
    expect(screen.queryByText('No users found')).not.toBeInTheDocument();
  });
});
