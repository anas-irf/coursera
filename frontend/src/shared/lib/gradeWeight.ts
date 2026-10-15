/**
 * Grade weights are percentages of the final grade with at most two decimals, and a course
 * can only be published when they add up to exactly 100.  Adding such numbers as floats goes
 * wrong (40.1 + 40.2 + 19.7 is 100.00000000000001), so they are compared as whole hundredths.
 */
export const FULL_WEIGHT = 100;

const HUNDREDTHS = 100;

export type WeightStatus = 'complete' | 'over' | 'under';

/** What a lecture says about the weight it carries (a weight may arrive as a numeric string). */
export interface WeightedLecture {
  content_type: string;
  quiz_settings?: { weight: number | string } | null;
  assignment_settings?: { weight: number | string } | null;
}

export interface WeightedSection {
  lectures?: WeightedLecture[] | null;
}

/** A percentage as a whole number of hundredths of a percent: 33.33 -> 3333. */
export const toHundredths = (percent: unknown): number => {
  const number = Number(percent);
  return Number.isFinite(number) ? Math.round(number * HUNDREDTHS) : 0;
};

/** The sum of some percentages, as a percentage with two decimals. */
export const sumWeights = (percents: unknown[]): number =>
  percents.reduce<number>((total, percent) => total + toHundredths(percent), 0) / HUNDREDTHS;

/** "complete" at exactly 100 %, "over" above it, "under" below it. */
export const weightStatus = (percent: unknown): WeightStatus => {
  const hundredths = toHundredths(percent);
  const full = FULL_WEIGHT * HUNDREDTHS;
  if (hundredths === full) return 'complete';
  return hundredths > full ? 'over' : 'under';
};

export const isFullWeight = (percent: unknown): boolean => weightStatus(percent) === 'complete';

/** The graded weight of every quiz and assignment lecture of a list of sections. */
export const lectureWeights = (sections: WeightedSection[] | null | undefined): Array<number | string> => {
  const weights: Array<number | string> = [];
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
