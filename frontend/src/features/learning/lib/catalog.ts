/** Pure helpers of the catalogue's cards and filters. */

const LEVELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  all_levels: 'All levels',
};

/** "beginner" -> "Beginner"; a level this app does not know is shown as it is. */
export const levelLabel = (level: string | null | undefined): string =>
  (level && LEVELS[level]) || level || '';

/** "4.7", or ``null`` while nobody rated the course (a 0 is "no ratings", not a bad mark). */
export const ratingLabel = (rating: number | null | undefined): string | null =>
  rating && rating > 0 ? rating.toFixed(1) : null;

/** "1 learner", "1,240 learners". */
export const learnersLabel = (count: number | null | undefined): string => {
  const value = count || 0;
  return `${value.toLocaleString()} ${value === 1 ? 'learner' : 'learners'}`;
};
