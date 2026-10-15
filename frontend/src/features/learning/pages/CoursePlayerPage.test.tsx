import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import http from '../../../shared/api/client';
import { createQueryClient } from '../../../shared/query/client';
import { QueryProvider } from '../../../shared/query/QueryProvider';
import { ConfirmProvider } from '../../../shared/ui/ConfirmDialog';
import { ToastProvider } from '../../../shared/ui/Toast';
import type { PlayerLecture, PlayerPayload } from '../types';
import CoursePlayerPage from './CoursePlayerPage';

jest.mock('../../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const mockedGet = jest.mocked(http.get);
const mockedPost = jest.mocked(http.post);

const lecture = (id: string, title: string, type: 'video' | 'reading', done = false): PlayerLecture => {
  const common = {
    id,
    title,
    description: '',
    order: 1,
    is_preview: false,
    is_downloadable: false,
    is_completed: done,
    progress_seconds: 0,
    last_watched_position: 0,
    watch_count: 0,
  };
  return type === 'video'
    ? {
        ...common,
        content_type: 'video',
        video_type: 'local',
        video_file_url: '/media/v.mp4',
        video_url: null,
        duration: 120,
        thumbnail: null,
        subtitles: [],
      }
    : {
        ...common,
        content_type: 'reading',
        content: '<p>Chapter one</p>',
        estimated_reading_time: 3,
        file_url: null,
      };
};

const payload = (lectures: PlayerLecture[]): PlayerPayload => {
  const completed = lectures.filter((l) => l.is_completed).length;
  return {
    course: {
      id: 'c-1',
      title: 'JavaScript from Scratch',
      description: '',
      instructor: 'Ada Lovelace',
      thumbnail: null,
      level: 'beginner',
      category: 'Development',
    },
    enrollment: {
      id: 'e-1',
      enrolled_date: '2026-09-01T09:00:00Z',
      progress_percentage: 0,
      last_accessed: null,
      status: 'active',
    },
    sections: [{
      id: 's-1', title: 'Basics', description: '', order: 1, is_preview: false, lectures,
      completed_lectures: completed, total_lectures: lectures.length,
    }],
    progress: {
      total_lectures: lectures.length,
      completed_lectures: completed,
      progress_percentage: 0,
    },
  };
};

const renderPlayer = () =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter initialEntries={['/courses/c-1/learn']}>
            <Routes>
              <Route path="/courses/:courseId/learn" element={<CoursePlayerPage />} />
              <Route path="/student" element={<p>student home</p>} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </QueryProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
});

test('opens on the first lecture that is not finished and offers "Mark Complete" for it', async () => {
  mockedGet.mockResolvedValue({
    data: payload([lecture('l-1', 'Intro video', 'video', true), lecture('l-2', 'Chapter one', 'reading')]),
  });
  renderPlayer();

  expect(await screen.findByRole('heading', { name: 'Chapter one' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mark Complete' })).toBeInTheDocument();
  expect(screen.getByText('1 of 2 lectures completed')).toBeInTheDocument();
});

test('completing a lecture refreshes the outline', async () => {
  const before = payload([lecture('l-1', 'Intro video', 'video')]);
  const after = payload([lecture('l-1', 'Intro video', 'video', true)]);
  mockedGet.mockResolvedValueOnce({ data: before }).mockResolvedValue({ data: after });
  mockedPost.mockResolvedValue({ data: { message: 'ok' } });
  renderPlayer();

  fireEvent.click(await screen.findByRole('button', { name: 'Mark Complete' }));

  await waitFor(() =>
    expect(http.post).toHaveBeenCalledWith('/learning/courses/c-1/lectures/l-1/complete/'));
  expect(await screen.findByText('1 of 1 lectures completed')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mark Complete' })).not.toBeInTheDocument();
});

test('a failure to complete is reported and the lecture stays open', async () => {
  mockedGet.mockResolvedValue({ data: payload([lecture('l-1', 'Intro video', 'video')]) });
  mockedPost.mockRejectedValue({ response: { status: 500, data: { error: 'The server had a problem.' } } });
  renderPlayer();

  fireEvent.click(await screen.findByRole('button', { name: 'Mark Complete' }));

  expect(await screen.findByText('The server had a problem.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mark Complete' })).toBeInTheDocument();
});

test('the student remembers the lecture they chose', async () => {
  mockedGet.mockResolvedValue({
    data: payload([lecture('l-1', 'Intro video', 'video'), lecture('l-2', 'Chapter one', 'reading')]),
  });
  renderPlayer();
  await screen.findByRole('heading', { name: 'Intro video' });

  fireEvent.click(screen.getByRole('button', { name: /Chapter one/ }));

  expect(await screen.findByRole('heading', { name: 'Chapter one' })).toBeInTheDocument();
  expect(window.localStorage.getItem('selectedLecture_c-1')).toBe('l-2');
});

test('without an enrolment the student is sent home with the reason', async () => {
  mockedGet.mockRejectedValue({ response: { status: 403, data: { detail: 'No' } } });
  renderPlayer();

  expect(await screen.findByText('student home')).toBeInTheDocument();
  expect(await screen.findByText('You must be enrolled in this course to access learning materials'))
    .toBeInTheDocument();
});

test('a course that cannot be loaded offers another try', async () => {
  mockedGet.mockRejectedValueOnce({ response: { status: 404, data: { detail: 'Not found.' } } });
  mockedGet.mockResolvedValue({ data: payload([lecture('l-1', 'Intro video', 'video')]) });
  renderPlayer();

  expect(await screen.findByText('Course not found')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

  expect(await screen.findByRole('heading', { name: 'Intro video' })).toBeInTheDocument();
});
