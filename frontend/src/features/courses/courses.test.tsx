import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import http from '../../shared/api/client';
import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ConfirmProvider } from '../../shared/ui/ConfirmDialog';
import { ToastProvider } from '../../shared/ui/Toast';
import CoursesPage from './pages/CoursesPage';
import type { Category, CourseDetail, InstructorCourseRow, Language } from './types';

jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock('../../shared/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { email: 'ada@example.com' } }),
}));

const mockedGet = jest.mocked(http.get);
const mockedPost = jest.mocked(http.post);
const mockedPatch = jest.mocked(http.patch);

const course = (overrides: Partial<InstructorCourseRow> = {}): InstructorCourseRow => ({
  id: 'c-1',
  title: 'React for Beginners',
  status: 'draft',
  course_type: 'free',
  total_enrolled: 12,
  average_rating: 4.5,
  total_revenue: 100,
  created_at: '2026-01-01T00:00:00Z',
  thumbnail: null,
  ...overrides,
});

// the stored course, cut down to what the edit form starts from
const detail = {
  id: 'c-1',
  title: 'React for Beginners',
  subtitle: 'Hooks first',
  description: 'Learn React',
  category: 2,
  language: 1,
  level: 'intermediate',
  course_type: 'coursera_plus',
  estimated_hours: '8.0',
  thumbnail: null,
} as CourseDetail;

const categories: Category[] = [
  { id: 1, name: 'Design', slug: 'design' },
  { id: 2, name: 'Development', slug: 'development' },
];
const languages: Language[] = [
  { id: 1, code: 'en', name: 'English' },
  { id: 5, code: 'fr', name: 'French' },
];

let courseList: InstructorCourseRow[];

beforeEach(() => {
  jest.clearAllMocks();
  courseList = [course()];
  mockedGet.mockImplementation(async (url) => {
    if (url === '/courses/instructor/courses/') return { data: courseList };
    if (url === '/courses/instructor/courses/c-1/') return { data: detail };
    if (url === '/courses/categories/') return { data: categories };
    if (url === '/courses/languages/') return { data: languages };
    if (url === '/courses/instructor/courses/c-1/sections/') return { data: [] };
    throw new Error(`unexpected GET ${url}`);
  });
});

const renderPage = () =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <ToastProvider>
        <ConfirmProvider>
          <CoursesPage />
        </ConfirmProvider>
      </ToastProvider>
    </QueryProvider>
  );

const png = () => new File(['x'], 'cover.png', { type: 'image/png' });

describe('the instructor course list', () => {
  test('shows each course with its state and what can be done with it', async () => {
    courseList = [
      course(),
      course({ id: 'c-2', title: 'Django APIs', status: 'published' }),
      course({ id: 'c-3', title: 'SQL Basics', status: 'pending_review' }),
    ];
    renderPage();

    expect(await screen.findByText('React for Beginners')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request Publish/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Unpublish/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Under Review/ })).toBeDisabled();
    // a published course is edited after it was unpublished
    expect(screen.getAllByRole('button', { name: /Edit/ })[1]).toBeDisabled();
    expect(screen.getByText('Published', { selector: 'span' })).toBeInTheDocument();
  });

  test('a rejected course says why, and the list can be searched and narrowed', async () => {
    courseList = [
      course({
        description: 'Components, props and state',
        category: 'Web Development',
        level: 'beginner',
        subtitle: 'Hooks first',
      }),
      course({
        id: 'c-2',
        title: 'SQL Basics',
        status: 'rejected',
        description: 'Queries and joins',
        rejection_reason: 'The quiz answers are missing.',
        rejection_date: '2026-10-01T10:00:00Z',
      }),
    ];
    renderPage();

    const rejected = await screen.findByRole('article', { name: 'SQL Basics' });
    expect(within(rejected).getByText('Course Rejected')).toBeInTheDocument();
    expect(within(rejected).getByText('The quiz answers are missing.')).toBeInTheDocument();
    expect(within(rejected).getByRole('button', { name: /Resubmit for Review/ })).toBeEnabled();
    expect(screen.getByText('Hooks first')).toBeInTheDocument();
    expect(screen.getByText(/^Web Development · Beginner · /)).toBeInTheDocument();

    // the search reads the descriptions too
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search courses' }), { target: { value: 'joins' } });
    expect(screen.getByRole('article', { name: 'SQL Basics' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'React for Beginners' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search courses' }), { target: { value: 'nothing like it' } });
    expect(screen.getByText('No courses found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByRole('article')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'rejected' } });
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  test('a failed load is an error, not "No courses yet"', async () => {
    mockedGet.mockRejectedValue({ response: { status: 500, data: { error: 'The server had a problem.' } } });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.');
    expect(screen.queryByText('No courses yet')).not.toBeInTheDocument();
  });

  test('an instructor without courses is invited to create one', async () => {
    courseList = [];
    renderPage();

    expect(await screen.findByText('No courses yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Your First Course' })).toBeInTheDocument();
  });

  test('requesting publication submits the course and says so', async () => {
    mockedPost.mockResolvedValue({ data: { message: 'Course submitted for admin review.' } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Request Publish/ }));

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith('/courses/instructor/courses/c-1/apply_for_publish/'));
    expect(await screen.findByText('Course submitted for admin review.')).toBeInTheDocument();
  });

  test('a course whose weights do not add up is refused with what is missing', async () => {
    mockedPost.mockRejectedValue({
      response: {
        status: 400,
        data: { error: 'Course total grade weight must be exactly 100%', current_weight: 90, missing_weight: 10 },
      },
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Request Publish/ }));

    expect(await screen.findByText('Course total grade weight must be exactly 100%')).toBeInTheDocument();
    expect(screen.getByText('Current grade weight: 90%. Missing: 10%')).toBeInTheDocument();
  });

  test('deleting asks for the typed confirmation and then removes the course', async () => {
    mockedPost.mockResolvedValue({ data: { message: 'deleted' } });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Delete Course/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Course' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete Course' });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(/to confirm/), {
      target: { value: 'ada@example.com/React for Beginners' },
    });
    courseList = [];
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith('/courses/instructor/courses/c-1/delete-course/', {
        confirmation: 'ada@example.com/React for Beginners',
      }));
    expect(await screen.findByText('No courses yet')).toBeInTheDocument();
  });
});

describe('creating a course', () => {
  const open = async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Create New Course' }));
    return screen.findByRole('dialog', { name: 'Create New Course' });
  };

  test('needs a title, a description and a thumbnail', async () => {
    const dialog = await open();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Course' }));
    expect(await screen.findByText('Please fill in required fields (Title and Description)')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/^Course Title/), { target: { value: 'Python' } });
    fireEvent.change(within(dialog).getByLabelText(/^Description/), { target: { value: 'Learn it' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Course' }));

    expect(await screen.findByText('Please upload a course thumbnail')).toBeInTheDocument();
    expect(http.post).not.toHaveBeenCalled();
  });

  test('sends the chosen category and language and leaves the slug to the server', async () => {
    mockedPost.mockResolvedValue({ data: { id: 'c-9', message: 'Course created successfully', title: 'Python' } });
    const dialog = await open();

    fireEvent.change(within(dialog).getByLabelText(/^Course Title/), { target: { value: 'Python' } });
    fireEvent.change(within(dialog).getByLabelText(/^Description/), { target: { value: 'Learn it' } });
    await within(dialog).findByRole('option', { name: 'Development' });
    fireEvent.change(within(dialog).getByLabelText('Category'), { target: { value: '2' } });
    fireEvent.change(within(dialog).getByLabelText('Language'), { target: { value: '5' } });
    fireEvent.change(within(dialog).getByLabelText(/Course Thumbnail/, { selector: 'input' }), {
      target: { files: [png()] },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Course' }));

    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
    const [url, body] = mockedPost.mock.calls[0];
    expect(url).toBe('/courses/instructor/courses/');
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('title')).toBe('Python');
    expect(form.get('category')).toBe('2');
    expect(form.get('language')).toBe('5');
    expect(form.get('thumbnail')).toBeInstanceOf(File);
    expect(form.has('slug')).toBe(false);
    expect(await screen.findByText(/Course created successfully/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('a refused picture says why and is not sent', async () => {
    const dialog = await open();

    fireEvent.change(within(dialog).getByLabelText(/Course Thumbnail/, { selector: 'input' }), {
      target: { files: [new File(['x'], 'notes.pdf', { type: 'application/pdf' })] },
    });

    expect(await within(dialog).findByText(/valid image file/)).toBeInTheDocument();
  });

  test('the server\'s complaints about fields are all shown', async () => {
    mockedPost.mockRejectedValue({
      response: { status: 400, data: { title: ['This field may not be blank.'], category: ['Invalid pk'] } },
    });
    const dialog = await open();

    fireEvent.change(within(dialog).getByLabelText(/^Course Title/), { target: { value: 'Python' } });
    fireEvent.change(within(dialog).getByLabelText(/^Description/), { target: { value: 'Learn it' } });
    fireEvent.change(within(dialog).getByLabelText(/Course Thumbnail/, { selector: 'input' }), {
      target: { files: [png()] },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Course' }));

    expect(await screen.findByText(/title: This field may not be blank\. category: Invalid pk\./)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Create New Course' })).toBeInTheDocument();
  });
});

describe('editing a course', () => {
  // the dialog opens with a spinner and shows the form once the course is loaded
  const open = async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Edit/ }));
    return screen.findByRole('dialog', { name: /Edit Course/ });
  };

  test('starts from what is stored and saves only the course fields', async () => {
    mockedPatch.mockResolvedValue({ data: {} });
    const dialog = await open();

    const title = await within(dialog).findByLabelText(/^Course Title/);
    expect(title).toHaveValue('React for Beginners');
    expect(within(dialog).getByLabelText('Subtitle')).toHaveValue('Hooks first');
    expect(within(dialog).getByLabelText('Level')).toHaveValue('intermediate');
    await waitFor(() => expect(within(dialog).getByLabelText('Category')).toHaveValue('2'));

    fireEvent.change(title, { target: { value: 'React, properly' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(http.patch).toHaveBeenCalledTimes(1));
    const [url, body] = mockedPatch.mock.calls[0];
    expect(url).toBe('/courses/instructor/courses/c-1/');
    expect(body).toMatchObject({
      title: 'React, properly', subtitle: 'Hooks first', description: 'Learn React',
      category: 2, language: 1, level: 'intermediate', course_type: 'coursera_plus', estimated_hours: 8,
    });
    expect(body).not.toHaveProperty('slug');
    expect(await screen.findByText('Course updated successfully!')).toBeInTheDocument();
  });

  test('a course that could not be loaded cannot be saved over with blanks', async () => {
    mockedGet.mockImplementation(async (url) => {
      if (url === '/courses/instructor/courses/') return { data: courseList };
      throw Object.assign(new Error('Request failed with status code 500'), {
        response: { status: 500, data: { error: 'The server had a problem.' } },
      });
    });
    const dialog = await open();

    expect(await within(dialog).findByText('We could not load the course')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
  });

  test('has no pretend "settings" tab', async () => {
    const dialog = await open();
    await within(dialog).findByLabelText(/^Course Title/);

    expect(within(dialog).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Details', 'Curriculum', 'Pricing',
    ]);
  });
});
