import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import http from '../../shared/api/client';
import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ConfirmProvider } from '../../shared/ui/ConfirmDialog';
import { ToastProvider } from '../../shared/ui/Toast';
import GradesPage from './pages/GradesPage';
import InstructorAssignmentsPage from './pages/InstructorAssignmentsPage';

jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const assignment = {
  id: 'a-1',
  title: 'Attribution comparison',
  course_title: 'Marketing Analytics',
  max_points: 50,
  passing_score: 60,
  due_date: null,
  total_submissions: 2,
  graded_submissions: 1,
};

let submissions;

const submission = (overrides = {}) => ({
  id: 's-1',
  student_name: 'Demo Student',
  submitted_at: '2026-10-01T10:00:00Z',
  grade: null,
  feedback: '',
  is_late: false,
  has_file: false,
  submission_text: 'My answer',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  submissions = [submission(), submission({ id: 's-2', student_name: 'Yuki Tanaka', grade: 45, feedback: 'Good' })];
  http.get.mockImplementation(async (url) => {
    if (url === '/assessments/instructor/assignments/') return { data: [assignment] };
    if (url === '/assessments/instructor/assignments/a-1/submissions/') return { data: submissions };
    throw new Error(`unexpected GET ${url}`);
  });
});

const renderWith = (page) =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <ToastProvider>
        <ConfirmProvider>{page}</ConfirmProvider>
      </ToastProvider>
    </QueryProvider>
  );

describe('grading hand-ins', () => {
  const open = async () => {
    renderWith(<InstructorAssignmentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Attribution comparison/ }));
    await screen.findByText('Demo Student');
  };

  test('choosing an assignment lists its hand-ins and who still waits for a grade', async () => {
    await open();

    expect(screen.getByText('Pending Review', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('45/50 pts')).toBeInTheDocument();
  });

  test('a hand-in is graded with a number and feedback', async () => {
    http.post.mockImplementation(async () => {
      submissions = [submission({ grade: 40, feedback: 'Nice' }), submissions[1]];
      return { data: { submission: {} } };
    });
    await open();

    fireEvent.click(screen.getByRole('button', { name: 'Open the submission of Demo Student' }));
    const dialog = await screen.findByRole('dialog', { name: 'Grade Submission: Demo Student' });
    expect(within(dialog).getByRole('button', { name: 'Submit Grade' })).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(/Grade \(out of 50\)/), { target: { value: '40' } });
    expect(within(dialog).getByText('80%')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Feedback/), { target: { value: 'Nice' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit Grade' }));

    await waitFor(() =>
      expect(http.post).toHaveBeenCalledWith('/assessments/instructor/submissions/s-1/grade/', {
        grade: 40, feedback: 'Nice',
      }));
    expect(await screen.findByText('Assignment graded successfully!')).toBeInTheDocument();
    // the dialog now shows the stored grade
    expect(await within(dialog).findByRole('button', { name: 'Update Grade' })).toBeInTheDocument();
  });

  test('a grade of zero can be given and is shown as given', async () => {
    http.post.mockImplementation(async () => {
      submissions = [submission({ grade: 0 }), submissions[1]];
      return { data: { submission: {} } };
    });
    await open();

    fireEvent.click(screen.getByRole('button', { name: 'Open the submission of Demo Student' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Grade \(out of 50\)/), { target: { value: '0' } });
    expect(within(dialog).getByRole('button', { name: 'Submit Grade' })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit Grade' }));

    await waitFor(() => expect(http.post).toHaveBeenCalledWith(expect.any(String), { grade: 0, feedback: '' }));
    expect(await within(dialog).findByRole('button', { name: 'Update Grade' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Grade \(out of 50\)/)).toHaveValue(0);
  });

  test('a refusal is reported and the dialog stays', async () => {
    http.post.mockRejectedValue({ response: { status: 400, data: { error: 'Grade cannot exceed 50' } } });
    await open();

    fireEvent.click(screen.getByRole('button', { name: 'Open the submission of Demo Student' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Grade \(out of 50\)/), { target: { value: '60' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit Grade' }));

    expect(await screen.findByText('Grade cannot exceed 50')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('submissions that could not be loaded are an error with a retry', async () => {
    http.get.mockImplementation(async (url) => {
      if (url === '/assessments/instructor/assignments/') return { data: [assignment] };
      throw { response: { status: 500, data: { error: 'The server had a problem.' } } }; // eslint-disable-line no-throw-literal
    });
    renderWith(<InstructorAssignmentsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Attribution comparison/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load the submissions');
    expect(screen.queryByText('No submissions found')).not.toBeInTheDocument();
  });
});

describe('the learner\'s grades', () => {
  const gradebook = {
    courses: [
      {
        course_id: 'c-1', course_title: 'Applied Machine Learning', instructor: 'Ravi Shah', enrollment_date: '2026-01-02T00:00:00Z',
        progress_percentage: 80, final_grade: 91, letter_grade: 'A-', is_passing: true,
        components: [{ type: 'assignments', completed: 1, total: 1, score: 91, weight: 100 }],
      },
      {
        course_id: 'c-2', course_title: 'JavaScript from Scratch', instructor: 'James Okafor', enrollment_date: '2026-01-03T00:00:00Z',
        progress_percentage: 20, final_grade: 40, letter_grade: 'F', is_passing: false, components: [],
      },
    ],
  };

  test('shows the average and the course picked in the list', async () => {
    http.get.mockResolvedValue({ data: gradebook });
    renderWith(<GradesPage />);

    expect(await screen.findByText('My Grades')).toBeInTheDocument();
    expect(screen.getByText('65.5%')).toBeInTheDocument(); // (91 + 40) / 2
    expect(screen.getByText('1/2')).toBeInTheDocument();
    // once in the list and once as the title of the breakdown
    expect(screen.getAllByRole('heading', { name: 'Applied Machine Learning' })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /JavaScript from Scratch/ }));

    expect(screen.getByText('No graded components yet')).toBeInTheDocument();
    expect(screen.getByText('Below Passing Threshold')).toBeInTheDocument();
  });

  test('a gradebook that could not be loaded is not "No Grades Available"', async () => {
    http.get.mockRejectedValue({ response: { status: 500, data: { error: 'The server had a problem.' } } });
    renderWith(<GradesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.');
    expect(screen.queryByText('No Grades Available')).not.toBeInTheDocument();
  });

  test('a learner without courses has none to show', async () => {
    http.get.mockResolvedValue({ data: { courses: [] } });
    renderWith(<GradesPage />);

    expect(await screen.findByText('No Grades Available')).toBeInTheDocument();
  });
});
