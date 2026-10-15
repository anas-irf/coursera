import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { QueryClient } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { createQueryClient } from '../../../shared/query/client';
import { QueryProvider } from '../../../shared/query/QueryProvider';
import { ConfirmProvider } from '../../../shared/ui/ConfirmDialog';
import { ToastProvider } from '../../../shared/ui/Toast';
import { enroll, toggleBookmark } from '../api';
import type { CatalogCourse } from '../types';
import CourseCard from './CourseCard';

jest.mock('../api');

const mockedEnroll = jest.mocked(enroll);
const mockedToggleBookmark = jest.mocked(toggleBookmark);

const course: CatalogCourse = {
  id: 'c-1',
  title: 'Intro to Python',
  instructor: 'Ada Lovelace',
  instructor_id: 'u-1',
  thumbnail: '/media/course_thumbnails/a.png',
  rating: 4.5,
  students: 1200,
  duration: '3 hours',
  duration_seconds: 10800,
  level: 'beginner',
  category: 'Development',
  course_type: 'free',
  modules: 4,
  description: 'Learn Python from the first line.',
  is_enrolled: false,
  is_bookmarked: false,
  can_enroll: true,
  enrollment_message: '',
  progress: 0,
};

interface RenderOptions {
  client?: QueryClient;
  courseOverrides?: Partial<CatalogCourse>;
}

const renderCard = ({ client = createQueryClient(), courseOverrides = {} }: RenderOptions = {}) =>
  render(
    <QueryProvider client={client}>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter initialEntries={['/student/explore']}>
            <Routes>
              <Route
                path="/student/explore"
                element={<CourseCard course={{ ...course, ...courseOverrides }} />}
              />
              <Route path="/student/checkout" element={<p>checkout page</p>} />
              <Route path="/courses/:id/learn" element={<p>player page</p>} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </QueryProvider>
  );

beforeEach(() => jest.clearAllMocks());

test('thumbnails are loaded from the API host', () => {
  renderCard();

  expect(screen.getByAltText('Intro to Python')).toHaveAttribute(
    'src',
    'http://localhost:8000/media/course_thumbnails/a.png'
  );
});

test('a course without a picture gets a local placeholder, not a third-party image', () => {
  renderCard({ courseOverrides: { thumbnail: null } });

  expect(screen.getByRole('img', { name: 'Intro to Python' }).tagName).not.toBe('IMG');
});

test('enrolling refreshes every list of courses', async () => {
  mockedEnroll.mockResolvedValue({ message: 'Successfully enrolled in course', enrollment_id: 'e-1' });
  const client = createQueryClient();
  client.setQueryData(['learning', 'mine', 'active'], []);
  renderCard({ client });

  fireEvent.click(screen.getByText('Enroll Now'));

  await waitFor(() => expect(client.getQueryState(['learning', 'mine', 'active'])?.isInvalidated).toBe(true));
  expect(enroll).toHaveBeenCalledWith('c-1');
  expect(await screen.findByText('Successfully enrolled in course!')).toBeInTheDocument();
});

test('a Plus course without a subscription offers the checkout', async () => {
  const error = Object.assign(new Error('payment required'), {
    response: { status: 402, data: { requires_subscription: true } },
  });
  mockedEnroll.mockRejectedValue(error);
  renderCard();

  fireEvent.click(screen.getByText('Enroll Now'));
  fireEvent.click(await screen.findByText('Upgrade Now'));

  expect(await screen.findByText('checkout page')).toBeInTheDocument();
});

test('other enrolment errors are shown with the server message', async () => {
  const error = Object.assign(new Error('bad request'), {
    response: { status: 400, data: { error: 'Already enrolled in this course' } },
  });
  mockedEnroll.mockRejectedValue(error);
  renderCard();

  fireEvent.click(screen.getByText('Enroll Now'));

  expect(await screen.findByText('Already enrolled in this course')).toBeInTheDocument();
});

test('the heart bookmarks through the API', async () => {
  mockedToggleBookmark.mockResolvedValue({ message: 'Course bookmarked' });
  renderCard();

  fireEvent.click(screen.getByRole('button', { name: 'Bookmark this course' }));

  await waitFor(() => expect(toggleBookmark).toHaveBeenCalledWith('c-1'));
  expect(screen.getByRole('button', { name: 'Remove bookmark' })).toHaveAttribute('aria-pressed', 'true');
});

test('a bookmark the server refuses is undone and reported', async () => {
  const error = Object.assign(new Error('boom'), {
    response: { status: 500, data: { error: 'Could not save' } },
  });
  mockedToggleBookmark.mockRejectedValue(error);
  renderCard();

  fireEvent.click(screen.getByRole('button', { name: 'Bookmark this course' }));

  expect(await screen.findByText('Could not save')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bookmark this course' })).toHaveAttribute('aria-pressed', 'false');
});
