import { isFullWeight, lectureWeights, sumWeights, toHundredths, weightStatus } from './gradeWeight';

test('weights are compared as whole hundredths, not as floats', () => {
  expect(40.1 + 40.2 + 19.7).not.toBe(100); // 100.00000000000001
  expect(sumWeights([40.1, 40.2, 19.7])).toBe(100);
  expect(isFullWeight(sumWeights([40.1, 40.2, 19.7]))).toBe(true);
  expect(toHundredths('12.5')).toBe(1250);
  expect(toHundredths(undefined)).toBe(0);
  expect(toHundredths('abc')).toBe(0);
});

test('a total is complete, over or under', () => {
  expect(weightStatus(100)).toBe('complete');
  expect(weightStatus(100.004)).toBe('complete'); // rounds to the hundredth
  expect(weightStatus(100.01)).toBe('over');
  expect(weightStatus(99.99)).toBe('under');
  expect(weightStatus(0)).toBe('under');
});

test('only quizzes and assignments carry a weight', () => {
  const sections = [
    {
      lectures: [
        { content_type: 'video' },
        { content_type: 'quiz', quiz_settings: { weight: 30 } },
        { content_type: 'assignment', assignment_settings: { weight: '70' } },
        { content_type: 'quiz' },
      ],
    },
    { lectures: undefined },
  ];

  expect(lectureWeights(sections)).toEqual([30, '70']);
  expect(sumWeights(lectureWeights(sections))).toBe(100);
  expect(lectureWeights(undefined)).toEqual([]);
});
