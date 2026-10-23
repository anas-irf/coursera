import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { downloadFromUrl, saveBlob } from '../../../shared/lib/download';
import { createQueryClient } from '../../../shared/query/client';
import { QueryProvider } from '../../../shared/query/QueryProvider';
import { ToastProvider } from '../../../shared/ui/Toast';
import * as assessmentsApi from '../api';
import type { AssignmentLecture, StudentSubmission } from '../types';
import AssignmentPanel from './AssignmentPanel';

jest.mock('../api');
// saving a file is the browser's business: the tests check what is asked of it
jest.mock('../../../shared/lib/download');

const submitAssignment = jest.mocked(assessmentsApi.submitAssignment);
const downloadSubmission = jest.mocked(assessmentsApi.downloadSubmission);

const open: StudentSubmission = {
  submitted: false,
  submission_date: null,
  is_late: false,
  grade: null,
  feedback: '',
  graded: false,
};

const assignment = (overrides: Partial<AssignmentLecture> = {}): AssignmentLecture => ({
  assignment_id: 'as-1',
  title: 'Write a short summary',
  description: '',
  instructions: 'Summarise Python in three sentences.',
  due_date: null,
  max_points: 100,
  passing_score: 60,
  allow_late_submission: true,
  attachment: null,
  attachment_name: null,
  submission: open,
  ...overrides,
});

const renderPanel = (lecture: AssignmentLecture, onSubmitted = jest.fn()) =>
  render(
    <QueryProvider client={createQueryClient()}>
      <ToastProvider>
        <AssignmentPanel lecture={lecture} onSubmitted={onSubmitted} />
      </ToastProvider>
    </QueryProvider>
  );

beforeEach(() => jest.clearAllMocks());

describe('an assignment that is not handed in', () => {
  test('shows its details and instructions, and refuses an empty hand-in', async () => {
    renderPanel(assignment());

    expect(screen.getByText('Summarise Python in three sentences.')).toBeInTheDocument();
    expect(screen.getByText('Not Submitted')).toBeInTheDocument();
    expect(screen.getByText('No due date')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Submit Assignment' }));

    expect(await screen.findByText('Please provide either text submission or upload a file')).toBeInTheDocument();
    expect(submitAssignment).not.toHaveBeenCalled();
  });

  test('a written answer is handed in and the player is told', async () => {
    submitAssignment.mockResolvedValue({
      success: true,
      message: 'ok',
      submission: {
        id: 's-1', submitted_at: '2026-10-12T10:00:00Z', is_late: false, original_filename: '', has_file: false, has_text: true,
      },
    });
    const onSubmitted = jest.fn();
    renderPanel(assignment(), onSubmitted);

    fireEvent.change(screen.getByLabelText('Text Submission (Optional)'), { target: { value: 'Python reads like English.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Assignment' }));

    expect(await screen.findByText('Assignment submitted successfully!')).toBeInTheDocument();
    const [assignmentId, formData] = submitAssignment.mock.calls[0];
    expect(assignmentId).toBe('as-1');
    expect(formData.get('submission_text')).toBe('Python reads like English.');
    expect(onSubmitted).toHaveBeenCalled();
  });

  test('only the allowed kinds of file are taken', () => {
    renderPanel(assignment());
    const input = screen.getByLabelText(/Click to upload file/);

    fireEvent.change(input, { target: { files: [new File(['x'], 'setup.exe')] } });
    expect(screen.getByText(/File type \.exe not allowed/)).toBeInTheDocument();

    fireEvent.change(input, { target: { files: [new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' })] } });
    expect(screen.getByText('notes.pdf')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove notes.pdf' }));
    expect(screen.queryByText('notes.pdf')).not.toBeInTheDocument();
  });

  test('after the due date a late hand-in is refused when the instructor does not take them', () => {
    renderPanel(assignment({ due_date: '2020-01-01T00:00:00Z', allow_late_submission: false }));

    expect(screen.getByRole('button', { name: 'Submit Assignment' })).toBeDisabled();
    expect(screen.getByText('Late submissions not allowed for this assignment')).toBeInTheDocument();
  });

  test('a late hand-in that is allowed is sent with a warning', () => {
    renderPanel(assignment({ due_date: '2020-01-01T00:00:00Z', allow_late_submission: true }));

    expect(screen.getByRole('button', { name: 'Submit Assignment' })).toBeEnabled();
    expect(screen.getByText(/past the due date/)).toBeInTheDocument();
  });

  test("the instructor's materials can be downloaded", async () => {
    jest.mocked(downloadFromUrl).mockResolvedValue(undefined);
    renderPanel(assignment({ attachment: '/media/assignments/brief.pdf', attachment_name: 'brief.pdf' }));

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(downloadFromUrl).toHaveBeenCalledWith('http://localhost:8000/media/assignments/brief.pdf', 'brief.pdf'));
  });

  test('materials that cannot be downloaded are reported', async () => {
    jest.mocked(downloadFromUrl).mockRejectedValue(new Error('File not found: 404'));
    renderPanel(assignment({ attachment: '/media/assignments/brief.pdf', attachment_name: 'brief.pdf' }));

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(await screen.findByText('Download Failed')).toBeInTheDocument();
  });
});

describe('a handed-in assignment', () => {
  const handedIn: StudentSubmission = {
    submitted: true,
    submission_date: '2026-10-01T09:30:00Z',
    is_late: true,
    grade: 88,
    feedback: 'Clear and accurate.',
    graded: true,
    id: 's-1',
    submission_text: 'Python reads like English.',
    has_file: true,
    file_url: '/media/submissions/s-1.pdf',
    original_filename: 'summary.pdf',
  };

  test('shows what was handed in, the grade and the feedback', () => {
    renderPanel(assignment({ submission: handedIn }));

    expect(screen.getByRole('heading', { name: 'Your Submission' })).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Late')).toBeInTheDocument();
    expect(screen.getByText('Python reads like English.')).toBeInTheDocument();
    expect(screen.getByText('88/100')).toBeInTheDocument();
    expect(screen.getByText('Clear and accurate.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Assignment' })).not.toBeInTheDocument();
  });

  test('its file is downloaded through the API', async () => {
    downloadSubmission.mockResolvedValue(new Blob(['%PDF']));
    renderPanel(assignment({ submission: handedIn }));

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'summary.pdf'));
    expect(downloadSubmission).toHaveBeenCalledWith('s-1');
  });

  test('a hand-in waiting for its grade says so', () => {
    renderPanel(assignment({ submission: { ...handedIn, graded: false, grade: null, feedback: '' } }));

    expect(screen.getByText('Your instructor has not graded this hand-in yet.')).toBeInTheDocument();
  });
});
