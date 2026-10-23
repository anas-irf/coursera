import React from 'react';
import type { ComponentProps } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { createQueryClient } from '../../../shared/query/client';
import { QueryProvider } from '../../../shared/query/QueryProvider';
import { ToastProvider } from '../../../shared/ui/Toast';
import * as assessmentsApi from '../api';
import type { QuizAttempt, QuizResults } from '../types';
import QuizRunner from './QuizRunner';

jest.mock('../api');

const startQuiz = jest.mocked(assessmentsApi.startQuiz);
const submitQuiz = jest.mocked(assessmentsApi.submitQuiz);

// a lecture of the player: the quiz block plus the fields every lecture has
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

const attempt = (overrides: Partial<QuizAttempt> = {}): QuizAttempt => ({
  attempt_id: 'a-1',
  quiz: {
    id: 'q-1',
    title: 'Basics',
    description: 'Warm up',
    passing_score: 70,
    time_limit: 1,
    show_answers: true,
  },
  questions: [
    {
      id: 'question-1',
      text: 'What is 2 + 2?',
      type: 'multiple_choice',
      points: 1,
      order: 1,
      options: [{ id: 'o-1', text: '3', order: 1 }, { id: 'o-2', text: '4', order: 2 }],
    },
  ],
  start_time: '2026-10-12T12:00:00Z',
  expires_at: '2026-10-12T12:01:00Z',
  ...overrides,
});

const results: QuizResults = {
  score: 100, passed: true, best_score: 100, earned_points: 1, total_points: 1, passing_score: 70,
  attempt_number: 1, attempts_remaining: 2, current_attempt_passed: true,
};

const renderQuiz = (props: Partial<ComponentProps<typeof QuizRunner>> = {}) =>
  render(
    <QueryProvider client={createQueryClient()}>
      <ToastProvider>
        <QuizRunner lecture={lecture} onFinished={jest.fn()} onActiveChange={jest.fn()} {...props} />
      </ToastProvider>
    </QueryProvider>
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
  startQuiz.mockResolvedValue(attempt());
  renderQuiz();
  await start();

  expect(screen.getByRole('timer')).toHaveTextContent('Time left: 1:00');

  await act(async () => {
    jest.advanceTimersByTime(15 * 1000);
  });

  expect(screen.getByRole('timer')).toHaveTextContent('Time left: 0:45');
});

test('a quiz without a time limit has no timer', async () => {
  startQuiz.mockResolvedValue(attempt({ expires_at: null }));
  renderQuiz();
  await start();

  expect(screen.queryByRole('timer')).not.toBeInTheDocument();
});

test('when the time is up the answers given so far are handed in', async () => {
  startQuiz.mockResolvedValue(attempt());
  submitQuiz.mockResolvedValue({ success: true, results });
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
  startQuiz.mockResolvedValue(attempt());
  submitQuiz.mockRejectedValue({
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
  startQuiz.mockResolvedValue(attempt());
  submitQuiz.mockRejectedValue({
    response: { status: 500, data: { error: 'The server had a problem.' } },
  });
  renderQuiz();
  await start();

  fireEvent.click(screen.getByRole('button', { name: 'Submit Quiz' }));

  expect(await screen.findByText('The server had a problem.')).toBeInTheDocument();
  expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
  expect(screen.queryByText('Time is up')).not.toBeInTheDocument();
});

test('every kind of question is answered and the count of answers follows', async () => {
  startQuiz.mockResolvedValue(attempt({
    expires_at: null,
    questions: [
      {
        id: 'q-a', text: 'Pick the even numbers', type: 'multiple_select', points: 2, order: 1,
        options: [{ id: 'o-a', text: 'Two', order: 1 }, { id: 'o-b', text: 'Three', order: 2 }, { id: 'o-c', text: 'Four', order: 3 }],
      },
      { id: 'q-b', text: 'Name the language', type: 'fill_blank', points: 1, order: 2, options: [] },
    ],
  }));
  submitQuiz.mockResolvedValue({ success: true, results: { ...results, passed: false, current_attempt_passed: false, score: 40 } });
  renderQuiz();
  fireEvent.click(screen.getByRole('button', { name: 'Start Quiz' }));
  await screen.findByText('Pick the even numbers');

  expect(screen.getByText('0/2 answered')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Two'));
  fireEvent.click(screen.getByLabelText('Four'));
  fireEvent.click(screen.getByLabelText('Four'));
  fireEvent.click(screen.getByLabelText('Four'));
  fireEvent.change(screen.getByLabelText('Answer to question 2'), { target: { value: 'Python' } });
  expect(screen.getByText('2/2 answered')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Submit Quiz' }));

  await waitFor(() => expect(assessmentsApi.submitQuiz).toHaveBeenCalledWith('q-1', 'a-1', {
    'q-a': { selected_options: ['o-a', 'o-c'] },
    'q-b': { text_answer: 'Python' },
  }));
  expect(await screen.findByText('Quiz Not Passed')).toBeInTheDocument();
  expect(screen.getByText('NOT PASSED')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Continue Learning' }));
  expect(screen.getByRole('button', { name: /Start Quiz|Retake Quiz/ })).toBeInTheDocument();
});

test('a quiz without attempts left cannot be started again', () => {
  renderQuiz({ lecture: { ...lecture, attempts_taken: 3, can_attempt: false, best_score: 50 } });

  expect(screen.getByRole('button', { name: 'Retake Quiz' })).toBeDisabled();
  expect(screen.getByText('Maximum attempts reached')).toBeInTheDocument();
  expect(screen.getByText('3/3')).toBeInTheDocument();
});

test('leaving a quiz gives the overview back', async () => {
  startQuiz.mockResolvedValue(attempt({ expires_at: null }));
  const onActiveChange = jest.fn();
  renderQuiz({ onActiveChange });
  await start();
  expect(onActiveChange).toHaveBeenLastCalledWith(true);

  fireEvent.click(screen.getByRole('button', { name: 'Exit Quiz' }));

  expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeInTheDocument();
  expect(onActiveChange).toHaveBeenLastCalledWith(false);
});

test('a quiz that cannot be started says why', async () => {
  startQuiz.mockRejectedValue({ response: { status: 400, data: { error: 'No attempts left' } } });
  renderQuiz();

  fireEvent.click(screen.getByRole('button', { name: 'Start Quiz' }));

  expect(await screen.findByText('No attempts left')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start Quiz' })).toBeInTheDocument();
});
