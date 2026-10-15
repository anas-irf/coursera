import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { createQueryClient } from '../../../shared/query/client';
import { QueryProvider } from '../../../shared/query/QueryProvider';
import { ConfirmProvider } from '../../../shared/ui/ConfirmDialog';
import { ToastProvider } from '../../../shared/ui/Toast';
import { enroll, toggleBookmark } from '../api';
import CourseCard from './CourseCard';

jest.mock('../api');

const course = {
  id: 'c-1',
  title: 'Intro to Python',
  instructor: 'Ada Lovelace',
  thumbnail: '/media/course_thumbnails/a.png',
  rating: 4.5,
  students: 1200,
  duration: '3 hours',
  level: 'beginner',
  category: 'Development',
  course_type: 'free',
  modules: 4,
  is_enrolled: false,
  is_bookmarked: false,
  can_enroll: true,
  enrollment_message: '',
  progress: 0,
};

const renderCard = ({ client = createQueryClient(), courseOverrides = {} } = {}) =>
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
  enroll.mockResolvedValue({ enrollment_id: 'e-1' });
  const client = createQueryClient();
  client.setQueryData(['learning', 'mine', 'active'], []);
  renderCard({ client });

  fireEvent.click(screen.getByText('Enroll Now'));

  await waitFor(() => expect(client.getQueryState(['learning', 'mine', 'active']).isInvalidated).toBe(true));
  expect(enroll).toHaveBeenCalledWith('c-1');
  expect(await screen.findByText('Successfully enrolled in course!')).toBeInTheDocument();
});

test('a Plus course without a subscription offers the checkout', async () => {
  const error = new Error('payment required');
  error.response = { status: 402, data: { requires_subscription: true } };
  enroll.mockRejectedValue(error);
  renderCard();

  fireEvent.click(screen.getByText('Enroll Now'));
  fireEvent.click(await screen.findByText('Upgrade Now'));

  expect(await screen.findByText('checkout page')).toBeInTheDocument();
});

test('other enrolment errors are shown with the server message', async () => {
  const error = new Error('bad request');
  error.response = { status: 400, data: { error: 'Already enrolled in this course' } };
  enroll.mockRejectedValue(error);
  renderCard();

  fireEvent.click(screen.getByText('Enroll Now'));

  expect(await screen.findByText('Already enrolled in this course')).toBeInTheDocument();
});

test('the heart bookmarks through the API', async () => {
  toggleBookmark.mockResolvedValue({ message: 'Course bookmarked' });
  renderCard();

  fireEvent.click(screen.getByRole('button', { name: 'Bookmark this course' }));

  await waitFor(() => expect(toggleBookmark).toHaveBeenCalledWith('c-1'));
  expect(screen.getByRole('button', { name: 'Remove bookmark' })).toHaveAttribute('aria-pressed', 'true');
});

test('a bookmark the server refuses is undone and reported', async () => {
  const error = new Error('boom');
  error.response = { status: 500, data: { error: 'Could not save' } };
  toggleBookmark.mockRejectedValue(error);
  renderCard();

  fireEvent.click(screen.getByRole('button', { name: 'Bookmark this course' }));

  expect(await screen.findByText('Could not save')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bookmark this course' })).toHaveAttribute('aria-pressed', 'false');
});
