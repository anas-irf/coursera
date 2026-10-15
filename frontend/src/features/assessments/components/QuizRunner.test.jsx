import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ToastProvider } from '../../../shared/ui/Toast';
import * as assessmentsApi from '../api';
import QuizRunner from './QuizRunner';

jest.mock('../api');

const lecture = {
  id: 'l-1',
  quiz_id: 'q-1',
  attempts_taken: 0,
  max_attempts: 3,
  passing_score: 70,
  best_score: 0,
  passed: false,
  can_attempt: true,
};

const attempt = (overrides = {}) => ({
  attempt_id: 'a-1',
  quiz: { id: 'q-1', title: 'Basics', description: 'Warm up', passing_score: 70, time_limit: 1 },
  questions: [
    {
      id: 'question-1',
      text: 'What is 2 + 2?',
      type: 'multiple_choice',
      points: 1,
      options: [{ id: 'o-1', text: '3' }, { id: 'o-2', text: '4' }],
    },
  ],
  expires_at: '2026-10-12T12:01:00Z',
  ...overrides,
});

const results = {
  score: 100, passed: true, best_score: 100, earned_points: 1, total_points: 1, passing_score: 70,
  attempt_number: 1, attempts_remaining: 2, current_attempt_passed: true,
};

const renderQuiz = (props = {}) =>
  render(
    <ToastProvider>
      <QuizRunner lecture={lecture} onFinished={jest.fn()} onActiveChange={jest.fn()} {...props} />
    </ToastProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-12T12:00:00Z'));
});

afterEach(() => jest.useRealTimers());

const start = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Start Quiz' }));
  await screen.findByText('What is 2 + 2?');
};

test('a quiz with a time limit shows the time left, counting down', async () => {
  assessmentsApi.startQuiz.mockResolvedValue(attempt());
  renderQuiz();
  await start();

  expect(screen.getByRole('timer')).toHaveTextContent('Time left: 1:00');

  await act(async () => {
    jest.advanceTimersByTime(15 * 1000);
  });

  expect(screen.getByRole('timer')).toHaveTextContent('Time left: 0:45');
});

test('a quiz without a time limit has no timer', async () => {
  assessmentsApi.startQuiz.mockResolvedValue(attempt({ expires_at: null }));
  renderQuiz();
  await start();

  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
});

test('when the time is up the answers given so far are handed in', async () => {
  assessmentsApi.startQuiz.mockResolvedValue(attempt());
  assessmentsApi.submitQuiz.mockResolvedValue({ results });
  const onFinished = jest.fn();
  renderQuiz({ onFinished });
  await start();

  fireEvent.click(screen.getByLabelText('4'));
  await act(async () => {
    jest.advanceTimersByTime(60 * 1000);
  });

  await waitFor(() => expect(assessmentsApi.submitQuiz).toHaveBeenCalledTimes(1));
  expect(assessmentsApi.submitQuiz).toHaveBeenCalledWith('q-1', 'a-1', {
    'question-1': { selected_option: 'o-2' },
  });
  expect(await screen.findByText('Quiz Passed!')).toBeInTheDocument();
  expect(onFinished).toHaveBeenCalled();
});

test('answers that the server refuses as too late say so and close the attempt', async () => {
  assessmentsApi.startQuiz.mockResolvedValue(attempt());
  assessmentsApi.submitQuiz.mockRejectedValue({
    response: { status: 400, data: { error: 'The time limit has passed', code: 'time_limit_exceeded' } },
  });
  const onFinished = jest.fn();
  renderQuiz({ onFinished });
  await start();

  fireEvent.click(screen.getByRole('button', { name: 'Submit Quiz' }));

  expect(await screen.findByText('Time is up')).toBeInTheDocument();
  // back on the overview, with the progress refreshed so the used attempt shows
  expect(screen.getByRole('button', { name: /Start Quiz|Retake Quiz/ })).toBeInTheDocument();
  expect(onFinished).toHaveBeenCalled();
});

test('another failure keeps the quiz open and reports the message', async () => {
  assessmentsApi.startQuiz.mockResolvedValue(attempt());
  assessmentsApi.submitQuiz.mockRejectedValue({
    response: { status: 500, data: { error: 'The server had a problem.' } },
  });
  renderQuiz();
  await start();

  fireEvent.click(screen.getByRole('button', { name: 'Submit Quiz' }));

  expect(await screen.findByText('The server had a problem.')).toBeInTheDocument();
  expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
  expect(screen.queryByText('Time is up')).not.toBeInTheDocument();
});
