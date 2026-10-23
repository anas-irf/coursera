import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import http from '../../shared/api/client';
import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ConfirmProvider } from '../../shared/ui/ConfirmDialog';
import { ToastProvider } from '../../shared/ui/Toast';
import CurriculumTab from './components/CurriculumTab';
import type { CurriculumLecture, CurriculumSection } from './types';

jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockedGet = jest.mocked(http.get);
const mockedPost = jest.mocked(http.post);
const mockedPut = jest.mocked(http.put);

const SECTIONS_URL = '/courses/instructor/courses/c-1/sections/';
const LECTURES_URL = '/courses/instructor/sections/s-1/lectures/';

const quizLecture: CurriculumLecture = {
  id: 'l-9',
  title: 'Check yourself',
  description: 'Five quick questions',
  content_type: 'quiz',
  order: 1,
  is_preview: true,
  is_downloadable: false,
  resources: [],
  completion_rate: 0,
  video_content: null,
  subtitle_file: null,
  existing_video_name: null,
  existing_subtitle_name: null,
  article_content: '',
  reading_document: null,
  quiz_settings: {
    passing_score: 70, time_limit: 10, max_attempts: 2, weight: 25, randomize_questions: false, show_answers: true,
  },
  questions: [
    {
      id: 'q-1', question_text: 'What is 2 + 2?', question_type: 'multiple_choice', points: 1, explanation: '',
      options: [
        { id: 'o-1', option_text: '4', is_correct: true, order: 0 },
        { id: 'o-2', option_text: '5', is_correct: false, order: 1 },
      ],
    },
  ],
  assignment_settings: null,
};

const stored: CurriculumSection[] = [
  {
    id: 's-1', title: 'Basics', description: 'Where it starts', order: 1, is_preview: false, total_duration: 0,
    lectures: [quizLecture],
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockImplementation(async (url) => {
    if (url === SECTIONS_URL) return { data: stored };
    throw new Error(`unexpected GET ${url}`);
  });
  mockedPost.mockResolvedValue({ data: { id: 'l-new' } });
  mockedPut.mockResolvedValue({ data: { id: 'l-9' } });
});

const renderTab = () =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <ToastProvider>
        <ConfirmProvider>
          <CurriculumTab courseId="c-1" />
        </ConfirmProvider>
      </ToastProvider>
    </QueryProvider>
  );

/** Opens the "Add New Lecture" dialog of the only section. */
const openNewLecture = async () => {
  renderTab();
  await screen.findByText('Check yourself');
  fireEvent.click(screen.getByRole('button', { name: 'Add Lecture' }));
  return screen.findByRole('dialog', { name: 'Add New Lecture' });
};

const chooseType = (dialog: HTMLElement, type: string) =>
  fireEvent.click(within(within(dialog).getByRole('radiogroup', { name: 'Lecture type' })).getByRole('radio', { name: type }));

test('a lecture shows its kind, its weight and whether it can be previewed', async () => {
  renderTab();

  expect(await screen.findByText('Check yourself')).toBeInTheDocument();
  expect(screen.getByText('25%')).toBeInTheDocument();
  expect(screen.getByText('Preview')).toBeInTheDocument();
  expect(screen.getByText('Section 1: Basics')).toBeInTheDocument();
  expect(screen.getByText('Total Grade Weight: 25.00%')).toBeInTheDocument();
});

test('a section folds away and opens again', async () => {
  renderTab();
  const toggle = await screen.findByRole('button', { name: /Section 1: Basics/ });
  expect(toggle).toHaveAttribute('aria-expanded', 'true');

  fireEvent.click(toggle);

  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('Check yourself')).not.toBeInTheDocument();
});

test('a lecture needs a title and, as a video, a source', async () => {
  const dialog = await openNewLecture();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Create Lecture' }));
  expect(await screen.findByText('Please enter a lecture title')).toBeInTheDocument();

  fireEvent.change(within(dialog).getByLabelText(/^Lecture Title/), { target: { value: 'Welcome' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create Lecture' }));
  expect(await screen.findByText('Please provide a video URL or upload a video file')).toBeInTheDocument();
  expect(http.post).not.toHaveBeenCalled();
});

test('a video link is sent with the lecture and the dialog closes', async () => {
  const dialog = await openNewLecture();

  fireEvent.change(within(dialog).getByLabelText(/^Lecture Title/), { target: { value: 'Welcome' } });
  fireEvent.change(within(dialog).getByLabelText('Video URL'), {
    target: { value: 'https://www.youtube.com/watch?v=abc' },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create Lecture' }));

  await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
  const [url, body] = mockedPost.mock.calls[0];
  expect(url).toBe(LECTURES_URL);
  const form = body as FormData;
  expect(form.get('title')).toBe('Welcome');
  expect(form.get('content_type')).toBe('video');
  expect(form.get('video_url')).toBe('https://www.youtube.com/watch?v=abc');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('an uploaded video file is chosen in the drop zone and can be removed', async () => {
  const dialog = await openNewLecture();

  fireEvent.click(within(dialog).getByRole('radio', { name: 'Upload a file' }));
  const input = within(dialog).getByLabelText('Video file', { selector: 'input' });
  fireEvent.change(input, { target: { files: [new File(['v'], 'intro.mp4', { type: 'video/mp4' })] } });

  expect(await within(dialog).findByText('intro.mp4')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove intro.mp4' }));
  expect(within(dialog).queryByText('intro.mp4')).not.toBeInTheDocument();
});

test('a quiz needs questions with a correct answer and is sent with them', async () => {
  const dialog = await openNewLecture();
  chooseType(dialog, 'Quiz');
  fireEvent.change(within(dialog).getByLabelText(/^Lecture Title/), { target: { value: 'Quick check' } });

  fireEvent.click(within(dialog).getByRole('button', { name: 'Create Lecture' }));
  expect(await screen.findByText('Please add at least one quiz question')).toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Add Question' }));
  fireEvent.change(within(dialog).getByLabelText(/^Question text/), { target: { value: 'Pick A' } });
  ['A', 'B', 'C', 'D'].forEach((letter) =>
    fireEvent.change(within(dialog).getByLabelText(`Option ${letter} of question 1`), { target: { value: letter } })
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create Lecture' }));
  expect(await screen.findByText('Please mark the correct answer for question 1')).toBeInTheDocument();

  fireEvent.click(within(dialog).getByLabelText('Option A is the correct answer'));
  fireEvent.click(within(dialog).getByRole('radio', { name: /Graded Quiz/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create Lecture' }));

  await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
  const form = mockedPost.mock.calls[0][1] as FormData;
  expect(form.get('content_type')).toBe('quiz');
  const questions = JSON.parse(String(form.get('questions')));
  expect(questions[0].question_text).toBe('Pick A');
  expect(questions[0].options[0].is_correct).toBe(true);
  expect(JSON.parse(String(form.get('quiz_settings'))).weight).toBe(10);
});

test('a removed question is gone from the form', async () => {
  const dialog = await openNewLecture();
  chooseType(dialog, 'Quiz');

  fireEvent.click(within(dialog).getByRole('button', { name: 'Add Question' }));
  expect(within(dialog).getByText('Question 1')).toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove question 1' }));
  expect(within(dialog).queryByText('Question 1')).not.toBeInTheDocument();
});

test('a reading is written in the form and sent as text', async () => {
  const dialog = await openNewLecture();
  chooseType(dialog, 'Reading');
  fireEvent.change(within(dialog).getByLabelText(/^Lecture Title/), { target: { value: 'Chapter one' } });

  fireEvent.click(within(dialog).getByRole('button', { name: 'Create Lecture' }));
  expect(await screen.findByText(/Please provide reading content/)).toBeInTheDocument();

  fireEvent.change(within(dialog).getByLabelText(/^Reading Content/), { target: { value: '# Hello' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create Lecture' }));

  await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
  expect((mockedPost.mock.calls[0][1] as FormData).get('article_content')).toBe('# Hello');
});

test('a reading can be a PDF instead', async () => {
  const dialog = await openNewLecture();
  chooseType(dialog, 'Reading');

  fireEvent.click(within(dialog).getByRole('radio', { name: 'PDF File' }));
  fireEvent.change(within(dialog).getByLabelText(/^PDF File/, { selector: 'input' }), {
    target: { files: [new File(['%PDF'], 'notes.pdf', { type: 'application/pdf' })] },
  });

  expect(await within(dialog).findByText('notes.pdf')).toBeInTheDocument();
});

test('an assignment needs its instructions', async () => {
  const dialog = await openNewLecture();
  chooseType(dialog, 'Assignment');
  fireEvent.change(within(dialog).getByLabelText(/^Lecture Title/), { target: { value: 'Hand-in' } });

  fireEvent.click(within(dialog).getByRole('button', { name: 'Create Lecture' }));
  expect(await screen.findByText('Please provide assignment instructions')).toBeInTheDocument();

  fireEvent.change(within(dialog).getByLabelText(/^Assignment Instructions/), { target: { value: 'Write a summary.' } });
  fireEvent.change(within(dialog).getByLabelText(/^Attachment/, { selector: 'input' }), {
    target: { files: [new File(['x'], 'template.docx', { type: 'application/msword' })] },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create Lecture' }));

  await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
  const form = mockedPost.mock.calls[0][1] as FormData;
  expect(JSON.parse(String(form.get('assignment_settings'))).instructions).toBe('Write a summary.');
  expect(form.get('attachment')).toBeInstanceOf(File);
});

test('editing a lecture starts from what is stored and saves it in place', async () => {
  renderTab();
  await screen.findByText('Check yourself');

  fireEvent.click(screen.getByRole('button', { name: 'Edit Lecture' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit Lecture' });

  expect(within(dialog).getByLabelText(/^Lecture Title/)).toHaveValue('Check yourself');
  expect(within(dialog).getByRole('radio', { name: 'Quiz' })).toHaveAttribute('aria-checked', 'true');
  expect(within(dialog).getByLabelText(/^Question text/)).toHaveValue('What is 2 + 2?');
  expect(within(dialog).getByRole('radio', { name: /Graded Quiz/ })).toHaveAttribute('aria-checked', 'true');

  fireEvent.click(within(dialog).getByRole('button', { name: 'Update Lecture' }));

  await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1));
  expect(mockedPut.mock.calls[0][0]).toBe('/courses/instructor/lectures/l-9/');
});

test('editing a section starts from what is stored', async () => {
  mockedPut.mockResolvedValue({ data: {} });
  renderTab();
  await screen.findByText('Check yourself');

  fireEvent.click(screen.getByRole('button', { name: 'Edit Section' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit Section' });

  expect(within(dialog).getByLabelText(/^Section Title/)).toHaveValue('Basics');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Update Section' }));

  await waitFor(() => expect(http.put).toHaveBeenCalledWith('/courses/instructor/sections/s-1/', {
    title: 'Basics', description: 'Where it starts', is_preview: false,
  }));
});
