import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import http from '../../shared/api/client';
import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ConfirmProvider } from '../../shared/ui/ConfirmDialog';
import { ToastProvider } from '../../shared/ui/Toast';
import CurriculumTab from './components/CurriculumTab';

jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const SECTIONS_URL = '/courses/instructor/courses/c-1/sections/';

const sections = (weights = []) => [
  {
    id: 's-1',
    title: 'Basics',
    description: '',
    order: 1,
    lectures: [
      { id: 'l-1', title: 'Welcome', content_type: 'video', order: 1 },
      { id: 'l-2', title: 'Chapter one', content_type: 'reading', order: 2 },
      ...weights.map((weight, index) => ({
        id: `q-${index}`,
        title: `Quiz ${index + 1}`,
        content_type: 'quiz',
        order: 3 + index,
        quiz_settings: { weight },
      })),
    ],
  },
];

let stored;

beforeEach(() => {
  jest.clearAllMocks();
  stored = sections();
  http.get.mockImplementation(async (url) => {
    if (url === SECTIONS_URL) return { data: stored };
    throw new Error(`unexpected GET ${url}`);
  });
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

test('lists the lectures with what they are; a reading is a "Reading"', async () => {
  renderTab();

  expect(await screen.findByText('Chapter one')).toBeInTheDocument();
  expect(screen.getByText('Reading')).toBeInTheDocument();
  expect(screen.getByText('Video Lecture')).toBeInTheDocument();
  expect(screen.queryByText('Content')).not.toBeInTheDocument();
});

test('the grade weights are added exactly', async () => {
  stored = sections([40.1, 40.2, 19.7]);
  renderTab();

  expect(await screen.findByText('Total Grade Weight: 100.00%')).toBeInTheDocument();
  expect(screen.getByText('Ready to Publish')).toBeInTheDocument();
});

test('weights that do not reach 100 are "Incomplete"', async () => {
  stored = sections([30]);
  renderTab();

  expect(await screen.findByText('Incomplete')).toBeInTheDocument();
});

test('a section that could not be created keeps its dialog open with what was typed', async () => {
  http.post.mockRejectedValue({
    response: { status: 400, data: { error: 'Cannot edit published courses.', course_status: 'published' } },
  });
  renderTab();
  await screen.findByText('Chapter one');

  fireEvent.click(screen.getByRole('button', { name: 'Add Section' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add New Section' });
  fireEvent.change(within(dialog).getByLabelText('Section Title *'), { target: { value: 'Advanced' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create Section' }));

  expect(await screen.findByText('Cannot edit published courses.')).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Add New Section' })).toBeInTheDocument();
  expect(within(screen.getByRole('dialog')).getByLabelText('Section Title *')).toHaveValue('Advanced');
});

test('a created section closes the dialog and shows up', async () => {
  http.post.mockImplementation(async () => {
    stored = [...stored, { id: 's-2', title: 'Advanced', description: '', order: 2, lectures: [] }];
    return { data: { id: 's-2' } };
  });
  renderTab();
  await screen.findByText('Chapter one');

  fireEvent.click(screen.getByRole('button', { name: 'Add Section' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add New Section' });
  fireEvent.change(within(dialog).getByLabelText('Section Title *'), { target: { value: 'Advanced' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Create Section' }));

  expect(await screen.findByText('Section 2: Advanced')).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(http.post).toHaveBeenCalledWith(SECTIONS_URL, expect.objectContaining({ title: 'Advanced', order: 2 }));
});

test('a curriculum that could not be loaded is an error with a retry', async () => {
  http.get.mockRejectedValueOnce({ response: { status: 500, data: { error: 'The server had a problem.' } } });
  http.get.mockRejectedValueOnce({ response: { status: 500, data: { error: 'The server had a problem.' } } });
  renderTab();

  expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.');

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Chapter one')).toBeInTheDocument();
});
