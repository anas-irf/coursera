import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ConfirmProvider } from '../../shared/ui/ConfirmDialog';
import { ToastProvider } from '../../shared/ui/Toast';
import * as api from './api';
import ExplorePage from './pages/ExplorePage';
import InstructorStudentsPage from './pages/InstructorStudentsPage';
import MyLearningPage from './pages/MyLearningPage';

jest.mock('./api');

const serverError = { response: { status: 500, data: { error: 'The server had a problem.' } } };

const render_ = (page) =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter>{page}</MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </QueryProvider>
  );

const enrolled = (id, title, status = 'active', progress = 40) => ({
  id,
  course_id: `course-${id}`,
  title,
  instructor: 'Ada Lovelace',
  thumbnail: null,
  progress,
  status,
  last_accessed: null,
  total_lessons: 10,
  completed_lessons: 4,
  estimated_completion: '2 hours left',
});

const catalogue = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, index) => ({
    id: `c-${from + index}`,
    title: `Course ${from + index}`,
    instructor: 'Ada Lovelace',
    thumbnail: null,
    rating: 4.5,
    students: 10,
    duration: '2 hours',
    level: 'beginner',
    category: 'Development',
    course_type: 'free',
    modules: 3,
    is_enrolled: false,
    is_bookmarked: false,
    can_enroll: true,
    enrollment_message: '',
  }));

beforeEach(() => jest.clearAllMocks());

describe('My learning', () => {
  const courses = [
    enrolled('1', 'JavaScript from Scratch'),
    enrolled('2', 'Introduction to Python', 'completed', 100),
  ];

  test('shows the courses in progress first and the finished ones under "Completed"', async () => {
    api.myCourses.mockResolvedValue(courses);
    render_(<MyLearningPage />);

    expect(await screen.findByText('JavaScript from Scratch')).toBeInTheDocument();
    expect(screen.queryByText('Introduction to Python')).not.toBeInTheDocument();
    expect(api.myCourses).toHaveBeenCalledWith({ status: 'all' });

    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'completed' } });

    expect(screen.getByText('Introduction to Python')).toBeInTheDocument();
    expect(screen.queryByText('JavaScript from Scratch')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review Course' })).toBeInTheDocument();
  });

  test('"All Courses" lists both', async () => {
    api.myCourses.mockResolvedValue(courses);
    render_(<MyLearningPage />);
    await screen.findByText('JavaScript from Scratch');

    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'all' } });

    expect(screen.getByText('Introduction to Python')).toBeInTheDocument();
    expect(screen.getByText('JavaScript from Scratch')).toBeInTheDocument();
  });

  test('a student without courses is invited to browse; a filter with no match says so', async () => {
    api.myCourses.mockResolvedValue([]);
    render_(<MyLearningPage />);

    expect(await screen.findByText('No enrolled courses')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse Courses' })).toBeInTheDocument();
  });

  test('only finished courses: "In Progress" is empty but not "No enrolled courses"', async () => {
    api.myCourses.mockResolvedValue([courses[1]]);
    render_(<MyLearningPage />);

    expect(await screen.findByText('No courses found')).toBeInTheDocument();
    expect(screen.queryByText('No enrolled courses')).not.toBeInTheDocument();
  });

  test('a failed load is an error with a retry, not an empty list', async () => {
    api.myCourses.mockRejectedValueOnce(serverError).mockRejectedValueOnce(serverError);
    api.myCourses.mockResolvedValue(courses);
    render_(<MyLearningPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.');
    expect(screen.queryByText('No enrolled courses')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('JavaScript from Scratch')).toBeInTheDocument();
  });
});

describe('Explore', () => {
  test('loads the next page on demand and says how many courses match', async () => {
    api.listCoursesPage
      .mockResolvedValueOnce({ items: catalogue(1, 12), total: 14 })
      .mockResolvedValueOnce({ items: catalogue(13, 14), total: 14 });
    render_(<ExplorePage />);

    expect(await screen.findByText('14 courses found')).toBeInTheDocument();
    expect(screen.getByText('Showing 12 of 14')).toBeInTheDocument();
    expect(screen.queryByText('Course 13')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Load more courses' }));

    expect(await screen.findByText('Course 13')).toBeInTheDocument();
    expect(api.listCoursesPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Load more courses/ })).not.toBeInTheDocument());
  });

  test('a filter is sent to the server and the list is replaced', async () => {
    api.listCoursesPage.mockResolvedValue({ items: catalogue(1, 2), total: 2 });
    render_(<ExplorePage />);
    await screen.findByText('2 courses found');

    api.listCoursesPage.mockResolvedValue({ items: catalogue(7, 7), total: 1 });
    fireEvent.change(screen.getByLabelText('Level'), { target: { value: 'advanced' } });

    expect(await screen.findByText('1 course found')).toBeInTheDocument();
    expect(api.listCoursesPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: expect.objectContaining({ level: 'advanced' }), page: 1 })
    );
  });

  test('a failed load is an error with a retry, not "no courses found"', async () => {
    api.listCoursesPage.mockRejectedValueOnce(serverError).mockRejectedValueOnce(serverError);
    api.listCoursesPage.mockResolvedValue({ items: catalogue(1, 1), total: 1 });
    render_(<ExplorePage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load the courses');
    expect(screen.queryByText('No courses found')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Course 1')).toBeInTheDocument();
  });

  test('no match is said so', async () => {
    api.listCoursesPage.mockResolvedValue({ items: [], total: 0 });
    render_(<ExplorePage />);

    expect(await screen.findByText('No courses found')).toBeInTheDocument();
    expect(screen.getByText('0 courses found')).toBeInTheDocument();
  });
});

describe('Instructor students', () => {
  test('lists the learners and narrows them with the search', async () => {
    api.instructorStudents.mockResolvedValue([
      { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', courses_enrolled: 2, progress: 50, last_active: null },
      { id: 2, name: 'Grace Hopper', email: 'grace@example.com', courses_enrolled: 1, progress: 10, last_active: null },
    ]);
    render_(<InstructorStudentsPage />);

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getAllByText('Never')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Search students'), { target: { value: 'grace' } });

    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
  });

  test('no learners yet', async () => {
    api.instructorStudents.mockResolvedValue([]);
    render_(<InstructorStudentsPage />);

    expect(await screen.findByText('No Students Yet')).toBeInTheDocument();
  });

  test('a failed load is an error, not "No Students Yet"', async () => {
    api.instructorStudents.mockRejectedValue({ response: { status: 403, data: { detail: 'Not allowed' } } });
    render_(<InstructorStudentsPage />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('No Students Yet')).not.toBeInTheDocument();
  });
});
