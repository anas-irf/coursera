/**
 * Grade weights are percentages of the final grade with at most two decimals, and a course
 * can only be published when they add up to exactly 100.  Adding such numbers as floats goes
 * wrong (40.1 + 40.2 + 19.7 is 100.00000000000001), so they are compared as whole hundredths.
 */
export const FULL_WEIGHT = 100;

const HUNDREDTHS = 100;

/** A percentage as a whole number of hundredths of a percent: 33.33 -> 3333. */
export const toHundredths = (percent) => {
  const number = Number(percent);
  return Number.isFinite(number) ? Math.round(number * HUNDREDTHS) : 0;
};

/** The sum of some percentages, as a percentage with two decimals. */
export const sumWeights = (percents) =>
  percents.reduce((total, percent) => total + toHundredths(percent), 0) / HUNDREDTHS;

/** "complete" at exactly 100 %, "over" above it, "under" below it. */
export const weightStatus = (percent) => {
  const hundredths = toHundredths(percent);
  const full = FULL_WEIGHT * HUNDREDTHS;
  if (hundredths === full) return 'complete';
  return hundredths > full ? 'over' : 'under';
};

export const isFullWeight = (percent) => weightStatus(percent) === 'complete';

/** The graded weight of every quiz and assignment lecture of a list of sections. */
export const lectureWeights = (sections) => {
  const weights = [];
  (sections || []).forEach((section) => {
    (section.lectures || []).forEach((lecture) => {
      if (lecture.content_type === 'quiz' && lecture.quiz_settings) {
        weights.push(lecture.quiz_settings.weight);
      }
      if (lecture.content_type === 'assignment' && lecture.assignment_settings) {
        weights.push(lecture.assignment_settings.weight);
      }
    });
  });
  return weights;
};
