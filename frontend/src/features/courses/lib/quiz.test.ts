import { newQuestion, removeQuestionAt, setOptionField, setQuestionField } from './quiz';
import type { QuizQuestion } from '../types';

// stored questions as the API sends them, cut down to what these tests look at
const stored = () =>
  [
    {
      id: 'q-1',
      question_text: 'Capital of France?',
      options: [
        { id: 'o-1', option_text: 'Paris', is_correct: true },
        { id: 'o-2', option_text: 'Berlin', is_correct: false },
      ],
    },
    { id: 'q-2', question_text: 'Two plus two?', options: [{ id: 'o-3', option_text: '4', is_correct: true }] },
  ] as QuizQuestion[];

test('a new question has four empty options and none is correct', () => {
  const question = newQuestion();

  expect(question.options).toHaveLength(4);
  expect(question.options.every((option) => option.option_text === '' && !option.is_correct)).toBe(true);
  expect(question.options.map((option) => option.order)).toEqual([0, 1, 2, 3]);
});

test('editing a question leaves the stored objects alone and keeps its id', () => {
  const before = stored();
  const snapshot = JSON.stringify(before);

  const after = setQuestionField(before, 0, 'question_text', 'Capital of Spain?');

  expect(JSON.stringify(before)).toBe(snapshot);
  expect(after[0]).toMatchObject({ id: 'q-1', question_text: 'Capital of Spain?' });
  expect(after[1]).toBe(before[1]);
});

test('editing an option leaves the stored objects alone and keeps the ids', () => {
  const before = stored();
  const snapshot = JSON.stringify(before);

  const after = setOptionField(before, 0, 1, 'option_text', 'Madrid');

  expect(JSON.stringify(before)).toBe(snapshot);
  expect(after[0].options[1]).toEqual({ id: 'o-2', option_text: 'Madrid', is_correct: false });
  expect(after[0].options[0]).toBe(before[0].options[0]);
  expect(after[0].id).toBe('q-1');
});

test('marking an option correct unmarks the others of that question only', () => {
  const before = stored();

  const after = setOptionField(before, 0, 1, 'is_correct', true);

  expect(after[0].options.map((option) => option.is_correct)).toEqual([false, true]);
  expect(after[1].options[0].is_correct).toBe(true); // another question is untouched
  expect(before[0].options[0].is_correct).toBe(true); // and so is the stored data
});

test('removing a question', () => {
  const after = removeQuestionAt(stored(), 0);

  expect(after.map((question) => question.id)).toEqual(['q-2']);
});
